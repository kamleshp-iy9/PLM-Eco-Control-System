// ─── ECO service — the core business logic ────────────────────────────────────
// This file handles everything that makes an Engineering Change Order actually work:
//   • Generating unique ECO/BOM reference numbers
//   • Checking for conflicts (two ECOs on the same product at once)
//   • Computing approval state for the current user
//   • Applying an ECO — creating new product/BOM versions and archiving the old ones
//   • Advancing an ECO through workflow stages
//   • Rejecting an ECO and sending it back to the previous stage
//
// Almost everything here runs inside a Prisma $transaction so the DB is never
// left in a half-updated state if something goes wrong mid-operation.

const { PrismaClient, Status, EcoType, EcoState, ApprovalCategory } = require('@prisma/client');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

const prisma = new PrismaClient();

// ─── Standard ECO response shape ──────────────────────────────────────────────
// Reused in every query that returns an ECO to the frontend so the shape is
// always consistent — product, BOM, user, stage, and all approvals are included.
const ecoResponseInclude = {
  product: {
    select: {
      id: true,
      name: true,
      status: true,
      version: true,
    },
  },
  bom: {
    select: {
      id: true,
      reference: true,
      productId: true,
      version: true,
      status: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      loginId: true,
      role: true,
    },
  },
  stage: {
    select: {
      id: true,
      name: true,
      sequence: true,
      isFinal: true,
      requiresApproval: true,
      allowApplyChanges: true,
      folded: true,
    },
  },
  approvals: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          loginId: true,
          role: true,
        },
      },
      stage: {
        select: {
          id: true,
          name: true,
          sequence: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc', // show approvals in the order they were given
    },
  },
};

// ─── Reference number generators ──────────────────────────────────────────────
// Counts existing records and pads the next number to 4 digits.
// e.g. ECO-0001, ECO-0042, BOM-0007
// Note: in high-concurrency production these should use a DB sequence — fine for now.
const generateEcoReference = async (tx) => {
  const client = tx || prisma;
  const count = await client.eco.count();
  const nextNumber = count + 1;
  return `ECO-${String(nextNumber).padStart(4, '0')}`;
};

const generateBomReference = async (tx) => {
  const client = tx || prisma;
  const count = await client.bom.count();
  const nextNumber = count + 1;
  return `BOM-${String(nextNumber).padStart(4, '0')}`;
};

// ─── checkActiveEco ────────────────────────────────────────────────────────────
// Returns an in-progress ECO for the same product/BOM if one already exists.
// We use this to prevent two ECOs from modifying the same thing at the same time,
// which would cause version conflicts when applied.
const checkActiveEco = async (productId, bomId, excludeEcoId = null) => {
  const where = {
    state: EcoState.IN_PROGRESS,
    isApplied: false,
  };

  if (bomId) {
    // BOM ECO — check for conflicts on this specific BOM
    where.bomId = bomId;
  } else {
    // Product ECO — only conflicts with other Product-type ECOs on the same product
    where.productId = productId;
    where.ecoType = EcoType.PRODUCT;
  }

  // When editing an existing ECO, exclude it from its own conflict check
  if (excludeEcoId) {
    where.id = { not: excludeEcoId };
  }

  return prisma.eco.findFirst({ where });
};

// ─── Attachment helpers ────────────────────────────────────────────────────────
// Attachments are stored in two places: the legacy product.attachments JSON field
// and the newer Attachment table. These helpers normalize them into a consistent shape.

const serializeAttachment = (attachment) => ({
  fileName: attachment.fileName,
  fileUrl: attachment.fileUrl,
  mimeType: attachment.mimeType || 'application/octet-stream',
  fileSize: parseInt(attachment.fileSize || 0, 10),
  version: attachment.version || 1,
  status: attachment.status || Status.ACTIVE,
  description: attachment.description || null,
});

// Filter out nulls and apply serializeAttachment to every item in the array
const normalizeAttachments = (attachments = []) =>
  (attachments || [])
    .filter(Boolean)
    .map((attachment) => serializeAttachment(attachment));

// getCurrentAttachmentSnapshot — returns the current active attachments for a product.
// Prefers the Attachment table records; falls back to the JSON field for older products.
const getCurrentAttachmentSnapshot = async (tx, productId) => {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: {
      attachmentRecords: {
        where: { status: Status.ACTIVE },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const attachmentRecords = product?.attachmentRecords || [];
  if (attachmentRecords.length > 0) {
    return attachmentRecords.map(serializeAttachment);
  }

  // Fall back to legacy JSON field
  return product?.attachments || [];
};

// Same as above but for a BOM
const getCurrentBomAttachmentSnapshot = async (tx, bomId) => {
  const bom = await tx.bom.findUnique({
    where: { id: bomId },
    include: {
      attachmentRecords: {
        where: { status: Status.ACTIVE },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return (bom?.attachmentRecords || []).map(serializeAttachment);
};

// getActiveBomsForProduct — finds all active BOMs belonging to a product.
// Used when creating a new product version so we can copy the BOMs across.
const getActiveBomsForProduct = async (tx, productId) =>
  tx.bom.findMany({
    where: {
      productId,
      status: Status.ACTIVE,
    },
    include: {
      components: true,
      operations: true,
      attachmentRecords: {
        where: { status: Status.ACTIVE },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  });

// createDerivedBom — creates a new BOM as a child of sourceBom (version bump).
// If sourceBom is provided, components, operations, and attachments are copied over.
// The old BOM is archived immediately after so only the new one is ACTIVE.
const createDerivedBom = async (tx, { sourceBom = null, targetProductId, userId }) => {
  const newBom = await tx.bom.create({
    data: {
      reference: await generateBomReference(tx),
      productId: targetProductId,
      quantity: sourceBom?.quantity ?? 1,
      units: sourceBom?.units ?? 'Units',
      version: sourceBom ? sourceBom.version + 1 : 1, // bump version if derived from existing BOM
      status: Status.ACTIVE,
      parentId: sourceBom?.id || null, // link to the BOM we derived from for version history
    },
  });

  // Copy components if the source had any
  if (sourceBom?.components?.length) {
    await tx.bomComponent.createMany({
      data: sourceBom.components.map((component) => ({
        bomId: newBom.id,
        componentName: component.componentName,
        quantity: component.quantity,
        units: component.units,
      })),
    });
  }

  // Copy operations if the source had any
  if (sourceBom?.operations?.length) {
    await tx.bomOperation.createMany({
      data: sourceBom.operations.map((operation) => ({
        bomId: newBom.id,
        operationName: operation.operationName,
        expectedDuration: operation.expectedDuration,
        workCenter: operation.workCenter,
      })),
    });
  }

  // Copy attachment records to the new BOM
  const attachments = normalizeAttachments(sourceBom?.attachmentRecords || []);
  if (attachments.length > 0) {
    await createAttachmentRecords(tx, {
      attachments,
      uploadedBy: userId,
      bomId: newBom.id,
    });
  }

  // Archive the source BOM so there's only ever one ACTIVE version per product
  if (sourceBom?.status === Status.ACTIVE) {
    await tx.bom.update({
      where: { id: sourceBom.id },
      data: { status: Status.ARCHIVED },
    });
    await archiveCurrentBomAttachments(tx, sourceBom.id);
  }

  return { newBom, sourceBom };
};

// ensureProductVersionBom — after a product version is created, make sure the new
// product has at least one active BOM. If not, copy the BOMs from the source product.
// Returns early if the target product already has active BOMs (nothing to do).
const ensureProductVersionBom = async (tx, { sourceProductId, targetProductId, userId, copyFromSource = true }) => {
  // Check if the target product already has BOMs — if so, nothing to create
  const targetActiveBoms = await tx.bom.findMany({
    where: {
      productId: targetProductId,
      status: Status.ACTIVE,
    },
    select: { id: true },
  });

  if (targetActiveBoms.length > 0) {
    return []; // already has BOMs, no action needed
  }

  // Copy BOMs from the source product if requested and source is a different product
  if (copyFromSource && sourceProductId && sourceProductId !== targetProductId) {
    const sourceBoms = await getActiveBomsForProduct(tx, sourceProductId);
    if (sourceBoms.length > 0) {
      const createdBoms = [];
      for (const sourceBom of sourceBoms) {
        createdBoms.push(await createDerivedBom(tx, { sourceBom, targetProductId, userId }));
      }
      return createdBoms;
    }
  }

  // If no source BOMs to copy, create a blank BOM for the new product
  return [await createDerivedBom(tx, { targetProductId, userId })];
};

// ─── Attachment record helpers ─────────────────────────────────────────────────

// createAttachmentRecords — inserts Attachment rows into the DB for a product/BOM/ECO
const createAttachmentRecords = async (tx, { attachments, uploadedBy, productId = null, bomId = null, ecoId = null }) => {
  const normalized = normalizeAttachments(attachments);
  if (normalized.length === 0) {
    return;
  }

  await tx.attachment.createMany({
    data: normalized.map((attachment) => ({
      productId,
      bomId,
      ecoId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      version: attachment.version || 1,
      status: attachment.status || Status.ACTIVE,
      description: attachment.description,
      uploadedBy,
    })),
  });
};

// Archive all active attachment records for a product (called before creating a new version)
const archiveCurrentProductAttachments = async (tx, productId) => {
  await tx.attachment.updateMany({
    where: {
      productId,
      status: Status.ACTIVE,
    },
    data: {
      status: Status.ARCHIVED,
    },
  });
};

// Archive all active attachment records for a BOM (called before creating a new version)
const archiveCurrentBomAttachments = async (tx, bomId) => {
  await tx.attachment.updateMany({
    where: {
      bomId,
      status: Status.ACTIVE,
    },
    data: {
      status: Status.ARCHIVED,
    },
  });
};

// ─── Approval state helpers ────────────────────────────────────────────────────

// getStageApprovalRules — returns all active approval rules for a given stage.
// Each rule links a user to a stage with a category (REQUIRED / OPTIONAL / COMMENT_ONLY).
const getStageApprovalRules = async (stageId, tx = prisma) => {
  return tx.approvalRule.findMany({
    where: {
      stageId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          loginId: true,
          email: true,
          role: true,
        },
      },
      stage: {
        select: {
          id: true,
          name: true,
          sequence: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
};

// getEcoApprovalState — computes what actions the current user can take on an ECO
// at its current stage. Returns flags: canApprove, canComment, canValidate, canReject.
// This is called by the ECO detail page to show/hide the correct action buttons.
const getEcoApprovalState = async (
  ecoId,
  stageId,
  currentUserId,
  isAdmin = false,
  currentUserRole = null,
  ecoOwnerId = null,
  tx = prisma
) => {
  // Fetch rules and existing approvals in parallel for performance
  const [stageApprovalRules, stageApprovals] = await Promise.all([
    getStageApprovalRules(stageId, tx),
    tx.ecoApproval.findMany({
      where: {
        ecoId,
        stageId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build a Set of userIds who have already approved — O(1) lookup below
  const approvedUserIds = new Set(
    stageApprovals
      .filter((approval) => approval.action === 'APPROVED')
      .map((approval) => approval.userId)
  );

  // Approvers who have not yet acted on this ECO
  const pendingApprovers = stageApprovalRules.filter(
    (rule) => !approvedUserIds.has(rule.userId)
  );

  // Rules that apply specifically to the current logged-in user
  const currentUserRules = stageApprovalRules.filter((rule) => rule.userId === currentUserId);
  const hasRules = stageApprovalRules.length > 0;

  return {
    stageApprovalRules,
    stageApprovals,
    pendingApprovers,

    // canApprove: admin always can; regular users need a REQUIRED or OPTIONAL rule
    canApprove:
      isAdmin ||
      currentUserRules.some((rule) =>
        [ApprovalCategory.REQUIRED, ApprovalCategory.OPTIONAL].includes(rule.approvalCategory)
      ),

    // canComment: same as canApprove plus COMMENT_ONLY rules
    canComment:
      isAdmin ||
      currentUserRules.some((rule) =>
        [
          ApprovalCategory.REQUIRED,
          ApprovalCategory.OPTIONAL,
          ApprovalCategory.COMMENT_ONLY,
        ].includes(rule.approvalCategory)
      ),

    // canValidate: only when there are NO approval rules on this stage
    // (stages without rules use "validate" instead of "approve" to advance)
    canValidate:
      !hasRules &&
      (isAdmin ||
        ecoOwnerId === currentUserId ||
        ['ENGINEERING_USER', 'APPROVER'].includes(currentUserRole || '')),

    // canReject: only available on stages that have approval rules configured
    canReject: hasRules && (isAdmin || currentUserRules.length > 0),
  };
};

// ─── applyEco ─────────────────────────────────────────────────────────────────
// The most complex operation in the system. Applies the proposed changes in an
// ECO to the actual product/BOM records.
//
// Two modes:
//   versionUpdate=true  → create a new version of the product/BOM (old one archived)
//   versionUpdate=false → update the existing record in-place (no new version)
//
// Everything runs in a single $transaction so the DB is consistent if anything fails.
const applyEco = async (ecoId, userId) => {
  return prisma.$transaction(async (tx) => {
    // Load the ECO with all related data we'll need during apply
    const eco = await tx.eco.findUnique({
      where: { id: ecoId },
      include: {
        product: {
          include: {
            attachmentRecords: true,
          },
        },
        bom: {
          include: {
            components: true,
            operations: true,
            attachmentRecords: true,
          },
        },
        stage: true,
        approvals: true,
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    if (eco.isApplied) {
      throw new ValidationError('ECO has already been applied');
    }

    // ECO can only be applied from a stage that allows it
    if (!eco.stage.allowApplyChanges && !eco.stage.isFinal) {
      throw new ValidationError('ECO must reach an apply-enabled stage before changes can be applied');
    }

    // Verify all REQUIRED approvals are in before applying
    const rules = await tx.approvalRule.findMany({
      where: {
        stageId: eco.stageId,
        isActive: true,
        approvalCategory: ApprovalCategory.REQUIRED,
      },
    });

    const approvedUserIds = new Set(
      eco.approvals
        .filter((approval) => approval.stageId === eco.stageId && approval.action === 'APPROVED')
        .map((approval) => approval.userId)
    );

    for (const rule of rules) {
      if (!approvedUserIds.has(rule.userId)) {
        throw new ValidationError(`Required approval from ${rule.name} is missing`);
      }
    }

    const now = new Date();
    const auditLogs = []; // collect all audit entries then write them in one batch at the end
    let linkedBomId = eco.bomId; // track if a new BOM was auto-created during a product version bump

    // ─── PRODUCT ECO ──────────────────────────────────────────────────────────
    if (eco.ecoType === EcoType.PRODUCT) {
      const currentProduct = eco.product;
      const proposedChanges = eco.proposedProductChanges || {};

      // Use the proposed attachments if provided, otherwise snapshot the current ones
      const targetAttachments = normalizeAttachments(
        proposedChanges.attachments || (await getCurrentAttachmentSnapshot(tx, currentProduct.id))
      );

      if (eco.versionUpdate) {
        // Create a new product version — old product is archived, new one is ACTIVE
        const newProduct = await tx.product.create({
          data: {
            name: proposedChanges.name || currentProduct.name,
            salesPrice: proposedChanges.salesPrice ?? currentProduct.salesPrice,
            costPrice: proposedChanges.costPrice ?? currentProduct.costPrice,
            attachments: targetAttachments,
            version: currentProduct.version + 1,
            status: Status.ACTIVE,
            parentId: currentProduct.id, // links to the previous version for history
          },
        });

        // Archive the old product
        await tx.product.update({
          where: { id: currentProduct.id },
          data: { status: Status.ARCHIVED },
        });

        await archiveCurrentProductAttachments(tx, currentProduct.id);

        // Attach files to the new product version
        await createAttachmentRecords(tx, {
          attachments: targetAttachments,
          uploadedBy: userId,
          productId: newProduct.id,
        });

        // Auto-create a new BOM for the new product version by copying from the old product
        const autoCreatedBoms = await ensureProductVersionBom(tx, {
          sourceProductId: currentProduct.id,
          targetProductId: newProduct.id,
          userId,
          copyFromSource: true,
        });

        // If exactly one BOM was auto-created, link it to this ECO so it's visible in the UI
        if (autoCreatedBoms.length === 1) {
          linkedBomId = autoCreatedBoms[0].newBom.id;
        }

        auditLogs.push({
          action: 'VERSION_CREATED',
          entityType: 'Product',
          entityId: newProduct.id,
          oldValue: { version: currentProduct.version },
          newValue: { version: newProduct.version },
          userId,
          ecoId: eco.id,
        });

        auditLogs.push({
          action: 'PRODUCT_CHANGED',
          entityType: 'Product',
          entityId: newProduct.id,
          oldValue: {
            salesPrice: currentProduct.salesPrice,
            costPrice: currentProduct.costPrice,
            attachments: currentProduct.attachments,
          },
          newValue: {
            salesPrice: newProduct.salesPrice,
            costPrice: newProduct.costPrice,
            attachments: targetAttachments,
          },
          userId,
          ecoId: eco.id,
        });

        // Record an audit entry for each BOM that was auto-created
        autoCreatedBoms.forEach(({ newBom, sourceBom }) => {
          auditLogs.push({
            action: sourceBom ? 'VERSION_CREATED' : 'BOM_CREATED',
            entityType: 'Bom',
            entityId: newBom.id,
            oldValue: sourceBom
              ? {
                  bomId: sourceBom.id,
                  reference: sourceBom.reference,
                  version: sourceBom.version,
                  productId: sourceBom.productId,
                }
              : null,
            newValue: {
              bomId: newBom.id,
              reference: newBom.reference,
              version: newBom.version,
              productId: newBom.productId,
              source: 'PRODUCT_ECO_AUTO', // flag so we know this BOM was auto-created
            },
            userId,
            ecoId: eco.id,
          });
        });
      } else {
        // In-place update — same product record, just update the fields
        const updatedProduct = await tx.product.update({
          where: { id: currentProduct.id },
          data: {
            name: proposedChanges.name || currentProduct.name,
            salesPrice: proposedChanges.salesPrice ?? currentProduct.salesPrice,
            costPrice: proposedChanges.costPrice ?? currentProduct.costPrice,
            attachments: targetAttachments,
          },
        });

        await archiveCurrentProductAttachments(tx, currentProduct.id);
        await createAttachmentRecords(tx, {
          attachments: targetAttachments,
          uploadedBy: userId,
          productId: currentProduct.id,
        });

        // Still ensure a BOM exists for this product even on an in-place update
        const autoCreatedBoms = await ensureProductVersionBom(tx, {
          sourceProductId: currentProduct.id,
          targetProductId: currentProduct.id,
          userId,
          copyFromSource: false, // don't copy from self — just create blank if missing
        });

        if (autoCreatedBoms.length === 1) {
          linkedBomId = autoCreatedBoms[0].newBom.id;
        }

        auditLogs.push({
          action: 'PRODUCT_CHANGED',
          entityType: 'Product',
          entityId: updatedProduct.id,
          oldValue: {
            name: currentProduct.name,
            salesPrice: currentProduct.salesPrice,
            costPrice: currentProduct.costPrice,
            attachments: currentProduct.attachments,
          },
          newValue: {
            name: updatedProduct.name,
            salesPrice: updatedProduct.salesPrice,
            costPrice: updatedProduct.costPrice,
            attachments: targetAttachments,
          },
          userId,
          ecoId: eco.id,
        });

        autoCreatedBoms.forEach(({ newBom }) => {
          auditLogs.push({
            action: 'BOM_CREATED',
            entityType: 'Bom',
            entityId: newBom.id,
            oldValue: null,
            newValue: {
              bomId: newBom.id,
              reference: newBom.reference,
              version: newBom.version,
              productId: newBom.productId,
              source: 'PRODUCT_ECO_AUTO',
            },
            userId,
            ecoId: eco.id,
          });
        });
      }

    // ─── BOM ECO ──────────────────────────────────────────────────────────────
    } else if (eco.ecoType === EcoType.BOM) {
      const currentBom = eco.bom;
      const proposedChanges = eco.proposedBomChanges || {};

      // Use proposed components/operations if provided, otherwise keep existing ones
      const targetComponents = proposedChanges.components || currentBom.components;
      const targetOperations = proposedChanges.operations || currentBom.operations;
      const targetAttachments = normalizeAttachments(
        proposedChanges.attachments || (await getCurrentBomAttachmentSnapshot(tx, currentBom.id))
      );

      if (eco.versionUpdate) {
        // Create a new BOM version — old one is archived
        const newBom = await tx.bom.create({
          data: {
            reference: await generateBomReference(tx),
            productId: currentBom.productId,
            quantity: currentBom.quantity,
            units: currentBom.units,
            version: currentBom.version + 1,
            status: Status.ACTIVE,
            parentId: currentBom.id, // links to the previous version
          },
        });

        // Write the proposed components and operations to the new BOM
        if (targetComponents.length > 0) {
          await tx.bomComponent.createMany({
            data: targetComponents.map((component) => ({
              bomId: newBom.id,
              componentName: component.componentName,
              quantity: component.quantity,
              units: component.units,
            })),
          });
        }

        if (targetOperations.length > 0) {
          await tx.bomOperation.createMany({
            data: targetOperations.map((operation) => ({
              bomId: newBom.id,
              operationName: operation.operationName,
              expectedDuration: operation.expectedDuration,
              workCenter: operation.workCenter,
            })),
          });
        }

        // Archive old BOM and transfer attachments to the new one
        await tx.bom.update({
          where: { id: currentBom.id },
          data: { status: Status.ARCHIVED },
        });

        await archiveCurrentBomAttachments(tx, currentBom.id);
        await createAttachmentRecords(tx, {
          attachments: targetAttachments,
          uploadedBy: userId,
          bomId: newBom.id,
        });

        auditLogs.push({
          action: 'VERSION_CREATED',
          entityType: 'Bom',
          entityId: newBom.id,
          oldValue: { version: currentBom.version },
          newValue: { version: newBom.version },
          userId,
          ecoId: eco.id,
        });

        auditLogs.push({
          action: 'BOM_CHANGED',
          entityType: 'Bom',
          entityId: newBom.id,
          oldValue: {
            components: currentBom.components,
            operations: currentBom.operations,
            attachments: currentBom.attachmentRecords,
          },
          newValue: {
            components: targetComponents,
            operations: targetOperations,
            attachments: targetAttachments,
          },
          userId,
          ecoId: eco.id,
        });
      } else {
        // In-place BOM update — delete existing rows and replace them
        // (simpler than diffing and patching individual rows)
        await tx.bomComponent.deleteMany({ where: { bomId: currentBom.id } });
        await tx.bomOperation.deleteMany({ where: { bomId: currentBom.id } });

        if (targetComponents.length > 0) {
          await tx.bomComponent.createMany({
            data: targetComponents.map((component) => ({
              bomId: currentBom.id,
              componentName: component.componentName,
              quantity: component.quantity,
              units: component.units,
            })),
          });
        }

        if (targetOperations.length > 0) {
          await tx.bomOperation.createMany({
            data: targetOperations.map((operation) => ({
              bomId: currentBom.id,
              operationName: operation.operationName,
              expectedDuration: operation.expectedDuration,
              workCenter: operation.workCenter,
            })),
          });
        }

        await archiveCurrentBomAttachments(tx, currentBom.id);
        await createAttachmentRecords(tx, {
          attachments: targetAttachments,
          uploadedBy: userId,
          bomId: currentBom.id,
        });

        auditLogs.push({
          action: 'BOM_CHANGED',
          entityType: 'Bom',
          entityId: currentBom.id,
          oldValue: {
            components: currentBom.components,
            operations: currentBom.operations,
            attachments: currentBom.attachmentRecords,
          },
          newValue: {
            components: targetComponents,
            operations: targetOperations,
            attachments: targetAttachments,
          },
          userId,
          ecoId: eco.id,
        });
      }
    }

    // Mark the ECO as applied and set the applied timestamp
    const updatedEco = await tx.eco.update({
      where: { id: ecoId },
      data: {
        isApplied: true,
        state: EcoState.APPROVED,
        appliedAt: now,
        effectiveDate: eco.effectiveDate || now, // use requested effective date or now
        ...(linkedBomId ? { bomId: linkedBomId } : {}), // link the auto-created BOM if any
      },
      include: ecoResponseInclude,
    });

    // Add ECO_APPLIED and STAGE_TRANSITION entries to the audit batch
    auditLogs.push(
      {
        action: 'ECO_APPLIED',
        entityType: 'ECO',
        entityId: eco.id,
        oldValue: { isApplied: false, stage: eco.stage.name },
        newValue: { isApplied: true, stage: eco.stage.name, appliedAt: now.toISOString() },
        userId,
        ecoId: eco.id,
      },
      {
        action: 'STAGE_TRANSITION',
        entityType: 'ECO',
        entityId: eco.id,
        oldValue: { stage: eco.stage.name },
        newValue: { stage: eco.stage.name, applied: true },
        userId,
        ecoId: eco.id,
      }
    );

    // Write all audit log entries in a single batch for efficiency
    await tx.auditLog.createMany({ data: auditLogs });

    return updatedEco;
  });
};

// ─── advanceEcoStage ──────────────────────────────────────────────────────────
// Moves an ECO to the next stage. Two paths:
//
//   VALIDATE — used on stages without approval rules. Anyone eligible can validate.
//   APPROVE  — used on stages with approval rules. Records the approval and checks
//              if all required approvers have now signed off before advancing.
//
// If the next stage has allowApplyChanges=true or isFinal=true, applyEco() is
// called automatically right after advancing.
const advanceEcoStage = async (ecoId, userId, action = 'VALIDATE', comments = null, options = {}) => {
  const { isAdmin = false } = options;

  const result = await prisma.$transaction(async (tx) => {
    const eco = await tx.eco.findUnique({
      where: { id: ecoId },
      include: {
        stage: true,
        approvals: true,
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    // ECO must be explicitly started before it can move through stages
    if (!eco.isStarted) {
      throw new ValidationError('ECO must be started before advancing');
    }

    if (eco.isApplied) {
      throw new ValidationError('ECO has already been applied');
    }

    if (eco.state === EcoState.CANCELLED) {
      throw new ValidationError('Cannot advance a cancelled ECO');
    }

    // Load all stages in order so we can find the current index and next stage
    const stages = await tx.ecoStage.findMany({
      orderBy: { sequence: 'asc' },
    });

    const currentStageIndex = stages.findIndex((stage) => stage.id === eco.stageId);
    const currentStage = stages[currentStageIndex];

    if (!currentStage) {
      throw new ValidationError('Current ECO stage is invalid');
    }

    if (currentStage.isFinal) {
      throw new ValidationError('ECO is already at the final stage');
    }

    const nextStage = stages[currentStageIndex + 1];
    if (!nextStage) {
      throw new ValidationError('No subsequent ECO stage is configured');
    }

    // Load approval rules and existing approvals for the current stage
    const stageRules = await tx.approvalRule.findMany({
      where: {
        stageId: currentStage.id,
        isActive: true,
      },
    });

    const stageApprovals = await tx.ecoApproval.findMany({
      where: {
        ecoId,
        stageId: currentStage.id,
      },
    });

    // ─── VALIDATE path ─────────────────────────────────────────────────────
    if (action === 'VALIDATE') {
      // Validate is only valid on stages with no approval rules
      if (stageRules.length > 0) {
        throw new ValidationError('This stage requires approval, not validation');
      }

      // Advance directly to next stage
      const updatedEco = await tx.eco.update({
        where: { id: ecoId },
        data: {
          stageId: nextStage.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'STAGE_TRANSITION',
          entityType: 'ECO',
          entityId: eco.id,
          oldValue: { stage: currentStage.name },
          newValue: { stage: nextStage.name },
          userId,
          ecoId: eco.id,
        },
      });

      return {
        ecoId: updatedEco.id,
        shouldApply: nextStage.allowApplyChanges || nextStage.isFinal,
      };
    }

    // ─── APPROVE path ──────────────────────────────────────────────────────
    // Make sure this user has a rule granting them approval rights on this stage
    const currentUserRule = stageRules.find((rule) => rule.userId === userId);
    if (!isAdmin && !currentUserRule) {
      throw new ForbiddenError('You are not authorized to approve this ECO at the current stage');
    }

    // Prevent double-approving
    const existingApproval = stageApprovals.find(
      (approval) => approval.userId === userId && approval.action === 'APPROVED'
    );
    if (existingApproval) {
      throw new ValidationError('You have already approved this ECO at the current stage');
    }

    // Record the approval in the DB
    await tx.ecoApproval.create({
      data: {
        ecoId,
        userId,
        stageId: currentStage.id,
        action: 'APPROVED',
        comments,
      },
    });

    const requiredRules = stageRules.filter(
      (rule) => rule.approvalCategory === ApprovalCategory.REQUIRED
    );
    const optionalRule = currentUserRule?.approvalCategory === ApprovalCategory.OPTIONAL;
    const commentOnlyRule = currentUserRule?.approvalCategory === ApprovalCategory.COMMENT_ONLY;

    // COMMENT_ONLY users don't trigger a stage advance — just log their comment
    if (commentOnlyRule && !isAdmin) {
      await tx.auditLog.create({
        data: {
          action: 'APPROVAL_COMMENTED',
          entityType: 'ECO',
          entityId: eco.id,
          oldValue: { stage: currentStage.name },
          newValue: { stage: currentStage.name, commentedBy: userId },
          userId,
          ecoId: eco.id,
        },
      });

      return {
        ecoId: eco.id,
        shouldApply: false, // comment-only — don't advance the stage
      };
    }

    // If there are required approvals and the current user is not optional,
    // check whether all required approvers have now signed off
    if (!optionalRule && requiredRules.length > 0 && !isAdmin) {
      // Include this just-recorded approval in the check
      const approvedUserIds = new Set(
        [
          ...stageApprovals,
          {
            userId,
            action: 'APPROVED',
          },
        ]
          .filter((approval) => approval.action === 'APPROVED')
          .map((approval) => approval.userId)
      );

      const allRequiredApproved = requiredRules.every((rule) => approvedUserIds.has(rule.userId));
      if (!allRequiredApproved) {
        // Not all required approvers have signed off yet — record the approval but don't advance
        await tx.auditLog.create({
          data: {
            action: 'APPROVAL_RECORDED',
            entityType: 'ECO',
            entityId: eco.id,
            oldValue: { stage: currentStage.name },
            newValue: { stage: currentStage.name, approvedBy: userId },
            userId,
            ecoId: eco.id,
          },
        });

        return {
          ecoId: eco.id,
          shouldApply: false, // waiting for remaining approvers
        };
      }
    }

    // All required approvals are in (or admin bypassed) — advance to the next stage
    await tx.eco.update({
      where: { id: ecoId },
      data: {
        stageId: nextStage.id,
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'STAGE_TRANSITION',
        entityType: 'ECO',
        entityId: eco.id,
        oldValue: { stage: currentStage.name },
        newValue: { stage: nextStage.name },
        userId,
        ecoId: eco.id,
      },
    });

    return {
      ecoId: eco.id,
      shouldApply: nextStage.allowApplyChanges || nextStage.isFinal,
    };
  });

  // If the next stage triggers an automatic apply, do it now (outside the transaction
  // so it gets its own transaction inside applyEco)
  if (result.shouldApply) {
    return applyEco(ecoId, userId);
  }

  // Return the updated ECO with the full response shape
  return prisma.eco.findUnique({
    where: { id: ecoId },
    include: ecoResponseInclude,
  });
};

// ─── rejectEco ────────────────────────────────────────────────────────────────
// Records a rejection and sends the ECO back to the previous stage (or cancels it
// if it was at the first stage). This lets engineers fix the issue and resubmit.
const rejectEco = async (ecoId, userId, comments, options = {}) => {
  const { isAdmin = false } = options;

  return prisma.$transaction(async (tx) => {
    const eco = await tx.eco.findUnique({
      where: { id: ecoId },
      include: { stage: true },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    if (eco.isApplied) {
      throw new ValidationError('Cannot reject an applied ECO');
    }

    const stages = await tx.ecoStage.findMany({
      orderBy: { sequence: 'asc' },
    });

    const currentStageIndex = stages.findIndex((stage) => stage.id === eco.stageId);
    const currentStage = stages[currentStageIndex];
    const previousStage = currentStageIndex > 0 ? stages[currentStageIndex - 1] : null;

    // Only stages with approval rules support rejection
    const stageRules = await tx.approvalRule.findMany({
      where: {
        stageId: eco.stageId,
        isActive: true,
      },
    });

    if (!isAdmin && stageRules.length === 0) {
      throw new ForbiddenError('This ECO stage does not support rejection');
    }

    const currentUserRule = stageRules.find((rule) => rule.userId === userId);
    if (!isAdmin && stageRules.length > 0 && !currentUserRule) {
      throw new ForbiddenError('You are not authorized to reject this ECO at the current stage');
    }

    // Record the rejection approval action
    await tx.ecoApproval.create({
      data: {
        ecoId,
        userId,
        stageId: eco.stageId,
        action: 'REJECTED',
        comments,
      },
    });

    // Send back to the previous stage if one exists, otherwise cancel the ECO
    const updateData = previousStage
      ? {
          stageId: previousStage.id,
          state: EcoState.IN_PROGRESS, // back to in-progress for rework
        }
      : {
          state: EcoState.CANCELLED, // no previous stage — ECO is dead
        };

    await tx.eco.update({
      where: { id: ecoId },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: 'APPROVAL_REJECTED',
        entityType: 'ECO',
        entityId: eco.id,
        oldValue: { stage: currentStage.name, state: eco.state },
        newValue: previousStage
          ? { stage: previousStage.name, state: EcoState.IN_PROGRESS }
          : { stage: currentStage.name, state: EcoState.CANCELLED },
        userId,
        ecoId: eco.id,
      },
    });

    return tx.eco.findUnique({
      where: { id: ecoId },
      include: ecoResponseInclude,
    });
  });
};

module.exports = {
  ecoResponseInclude,
  generateEcoReference,
  generateBomReference,
  checkActiveEco,
  getStageApprovalRules,
  getEcoApprovalState,
  applyEco,
  advanceEcoStage,
  rejectEco,
};
