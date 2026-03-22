const { PrismaClient, EcoType, EcoState, Status } = require('@prisma/client');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');
const {
  ecoResponseInclude,
  generateEcoReference,
  checkActiveEco,
  advanceEcoStage,
  rejectEco,
  getEcoApprovalState,
} = require('../services/eco.service');
const { getFirstEcoStage } = require('../services/stage-bootstrap.service');
const { generateBomDiff, generateProductDiff } = require('../utils/diff');
const { createAuditLog } = require('../services/audit.service');
const { getIO } = require('../socket');

const prisma = new PrismaClient();

const getAttachmentSnapshot = (entity) => {
  if (entity?.attachmentRecords?.length) {
    return entity.attachmentRecords
      .filter((attachment) => attachment.status === Status.ACTIVE)
      .map((attachment) => ({
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        version: attachment.version,
        status: attachment.status,
        description: attachment.description,
      }));
  }

  return entity?.attachments || [];
};

const getEcoAttachmentState = (eco) => {
  const liveAttachments =
    eco.ecoType === EcoType.PRODUCT
      ? getAttachmentSnapshot(eco.product)
      : getAttachmentSnapshot(eco.bom);

  const proposedChanges =
    eco.ecoType === EcoType.PRODUCT
      ? eco.proposedProductChanges || {}
      : eco.proposedBomChanges || {};

  return {
    liveAttachments,
    proposedAttachments: proposedChanges.attachments || liveAttachments,
  };
};

const getAllEcos = async (req, res, next) => {
  try {
    const { stageId, ecoType, state, search, page = 1, limit = 50 } = req.query;

    const where = {};

    if (stageId) where.stageId = stageId;
    if (ecoType) where.ecoType = ecoType;
    if (state) where.state = state;

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        {
          product: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const skip = (page - 1) * parseInt(limit, 10);

    const [ecos, total] = await Promise.all([
      prisma.eco.findMany({
        where,
        include: {
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
              status: true,
              version: true,
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
            },
          },
          _count: {
            select: { approvals: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.eco.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        ecos,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getEcoById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const eco = await prisma.eco.findUnique({
      where: { id },
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
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
            role: true,
          },
        },
        stage: true,
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
            createdAt: 'asc',
          },
        },
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    const allStages = await prisma.ecoStage.findMany({
      orderBy: { sequence: 'asc' },
    });
    const currentStageIndex = allStages.findIndex((stage) => stage.id === eco.stageId);
    const nextStage = currentStageIndex >= 0 ? allStages[currentStageIndex + 1] : null;

    const approvalState = await getEcoApprovalState(
      eco.id,
      eco.stageId,
      req.user.id,
      req.user.role === 'ADMIN',
      req.user.role,
      eco.userId
    );

    res.json({
      success: true,
      data: {
        eco: {
          ...eco,
          product: eco.product
            ? {
                ...eco.product,
                attachments: getAttachmentSnapshot(eco.product),
              }
            : null,
          bom: eco.bom
            ? {
                ...eco.bom,
                attachments: getAttachmentSnapshot(eco.bom),
              }
            : null,
        },
        stages: allStages,
        stageApprovalRules: approvalState.stageApprovalRules,
        stageApprovals: approvalState.stageApprovals,
        pendingApprovers: approvalState.pendingApprovers,
        canApprove: approvalState.canApprove,
        canValidate: approvalState.canValidate,
        canComment: approvalState.canComment,
        canReject: approvalState.canReject,
        canApplyChanges:
          eco.stage.allowApplyChanges ||
          eco.stage.isFinal ||
          Boolean(nextStage?.allowApplyChanges || nextStage?.isFinal),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createEco = async (req, res, next) => {
  try {
    const {
      title,
      description,
      ecoType,
      productId,
      bomId,
      userId,
      effectiveDate,
      versionUpdate = true,
      proposedProductChanges,
      proposedBomChanges,
    } = req.body;

    const [product, assignedUser] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
      }),
      prisma.user.findUnique({
        where: { id: userId },
      }),
    ]);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (product.status !== Status.ACTIVE) {
      throw new ValidationError('Cannot create ECO for an archived product');
    }

    if (!assignedUser) {
      throw new NotFoundError('Assigned user not found');
    }

    if (assignedUser.accountStatus !== 'ACTIVE') {
      throw new ValidationError('Assigned user must be active');
    }

    let bom = null;
    if (ecoType === EcoType.BOM) {
      if (!bomId) {
        throw new ValidationError('Bill of Materials is required for BoM ECOs');
      }

      bom = await prisma.bom.findUnique({
        where: { id: bomId },
        include: {
          product: true,
        },
      });

      if (!bom) {
        throw new NotFoundError('Bill of Materials not found');
      }

      if (bom.status !== Status.ACTIVE) {
        throw new ValidationError('Cannot create ECO for an archived BoM');
      }

      if (bom.product.status !== Status.ACTIVE) {
        throw new ValidationError('Cannot create a BoM ECO for an archived product');
      }

      if (bom.productId !== productId) {
        throw new ValidationError('The selected BoM does not belong to the selected product');
      }
    }

    const activeEco = await checkActiveEco(productId, bomId);
    if (activeEco) {
      throw new ValidationError('An active ECO already exists for this item. Complete or cancel it first.');
    }

    const firstStage = await getFirstEcoStage(prisma);

    if (!firstStage) {
      throw new ValidationError('No ECO stages configured');
    }

    const reference = await generateEcoReference();

    const eco = await prisma.eco.create({
      data: {
        reference,
        title,
        description,
        ecoType,
        productId,
        bomId: ecoType === EcoType.BOM ? bomId : null,
        userId,
        stageId: firstStage.id,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        versionUpdate,
        state: EcoState.IN_PROGRESS,
        isStarted: false,
        isApplied: false,
        proposedProductChanges: proposedProductChanges || null,
        proposedBomChanges: proposedBomChanges || null,
      },
      include: ecoResponseInclude,
    });

    await createAuditLog({
      action: 'ECO_CREATED',
      entityType: 'ECO',
      entityId: eco.id,
      userId: req.user.id,
      ecoId: eco.id,
    });

    getIO().emit('eco:created', { eco, userId: req.user.id });

    res.status(201).json({
      success: true,
      message: 'ECO created successfully',
      data: { eco },
    });
  } catch (error) {
    next(error);
  }
};

const updateEco = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      productId,
      bomId,
      userId,
      effectiveDate,
      versionUpdate,
      proposedProductChanges,
      proposedBomChanges,
    } = req.body;

    const eco = await prisma.eco.findUnique({
      where: { id },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    if (eco.isStarted) {
      throw new ValidationError('Cannot edit ECO after it has been started');
    }

    if (eco.isApplied) {
      throw new ValidationError('Cannot edit an applied ECO');
    }

    if (productId || bomId) {
      const product = await prisma.product.findUnique({
        where: { id: productId || eco.productId },
      });

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      if (product.status !== Status.ACTIVE) {
        throw new ValidationError('Only active products can be linked to an ECO');
      }

      if ((eco.ecoType === EcoType.BOM || bomId) && (bomId || eco.bomId)) {
        const bom = await prisma.bom.findUnique({
          where: { id: bomId || eco.bomId },
        });
        if (!bom) {
          throw new NotFoundError('Bill of Materials not found');
        }
        if (bom.status !== Status.ACTIVE) {
          throw new ValidationError('Only active BoMs can be linked to an ECO');
        }
      }
    }

    const updatedEco = await prisma.eco.update({
      where: { id },
      data: {
        title: title || eco.title,
        description: description !== undefined ? description : eco.description,
        productId: productId || eco.productId,
        bomId: bomId !== undefined ? bomId : eco.bomId,
        userId: userId || eco.userId,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : eco.effectiveDate,
        versionUpdate: versionUpdate !== undefined ? versionUpdate : eco.versionUpdate,
        proposedProductChanges:
          proposedProductChanges !== undefined ? proposedProductChanges : eco.proposedProductChanges,
        proposedBomChanges:
          proposedBomChanges !== undefined ? proposedBomChanges : eco.proposedBomChanges,
      },
      include: ecoResponseInclude,
    });

    getIO().emit('eco:updated', { eco: updatedEco, userId: req.user.id });

    res.json({
      success: true,
      message: 'ECO updated successfully',
      data: { eco: updatedEco },
    });
  } catch (error) {
    next(error);
  }
};

const startEco = async (req, res, next) => {
  try {
    const { id } = req.params;

    const eco = await prisma.eco.findUnique({
      where: { id },
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
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    if (eco.isStarted) {
      throw new ValidationError('ECO has already been started');
    }

    if (!eco.title || !eco.productId || !eco.userId) {
      throw new ValidationError('All mandatory fields must be filled before starting');
    }

    if (eco.ecoType === EcoType.BOM && !eco.bomId) {
      throw new ValidationError('Bill of Materials is required for BoM ECOs');
    }

    const hasProposedChanges =
      eco.ecoType === EcoType.PRODUCT
        ? eco.proposedProductChanges && Object.keys(eco.proposedProductChanges).length > 0
        : eco.proposedBomChanges &&
          ((eco.proposedBomChanges.components?.length || 0) > 0 ||
            (eco.proposedBomChanges.operations?.length || 0) > 0);

    let proposedChanges = {};
    if (!hasProposedChanges) {
      if (eco.ecoType === EcoType.PRODUCT) {
        proposedChanges = {
          proposedProductChanges: {
            name: eco.product.name,
            salesPrice: eco.product.salesPrice,
            costPrice: eco.product.costPrice,
            attachments: getAttachmentSnapshot(eco.product),
          },
        };
      } else {
        proposedChanges = {
          proposedBomChanges: {
            attachments: getAttachmentSnapshot(eco.bom),
            components: eco.bom.components.map((component) => ({
              componentName: component.componentName,
              quantity: component.quantity,
              units: component.units,
            })),
            operations: eco.bom.operations.map((operation) => ({
              operationName: operation.operationName,
              expectedDuration: operation.expectedDuration,
              workCenter: operation.workCenter,
            })),
          },
        };
      }
    }

    const allStages = await prisma.ecoStage.findMany({
      orderBy: { sequence: 'asc' },
    });
    const currentStageIndex = allStages.findIndex((stage) => stage.id === eco.stageId);
    const currentStage = currentStageIndex >= 0 ? allStages[currentStageIndex] : null;
    const nextStage = currentStageIndex >= 0 ? allStages[currentStageIndex + 1] : null;
    const approvalStage =
      allStages.find((stage) => stage.name === 'Approval') ||
      allStages.find((stage) => stage.requiresApproval);
    const targetStage =
      currentStage?.name === 'New'
        ? approvalStage || nextStage || currentStage
        : nextStage || currentStage;

    if (currentStageIndex < 0) {
      throw new ValidationError('Current ECO stage is invalid');
    }

    const updateData = {
      isStarted: true,
      ...(targetStage && targetStage.id !== eco.stageId ? { stageId: targetStage.id } : {}),
      ...proposedChanges,
    };

    const updatedEco = await prisma.eco.update({
      where: { id },
      data: updateData,
      include: ecoResponseInclude,
    });

    await createAuditLog({
      action: 'ECO_STARTED',
      entityType: 'ECO',
      entityId: eco.id,
      userId: req.user.id,
      ecoId: eco.id,
    });

    if (targetStage && targetStage.id !== eco.stageId) {
      await createAuditLog({
        action: 'STAGE_TRANSITION',
        entityType: 'ECO',
        entityId: eco.id,
        userId: req.user.id,
        ecoId: eco.id,
        oldValue: { stage: currentStage?.name },
        newValue: { stage: targetStage.name },
      });
    }

    getIO().emit('eco:started', { eco: updatedEco, userId: req.user.id });

    res.json({
      success: true,
      message: 'ECO started successfully',
      data: { eco: updatedEco },
    });
  } catch (error) {
    next(error);
  }
};

const approveEco = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const eco = await prisma.eco.findUnique({
      where: { id },
      include: { stage: true },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    const approvalState = await getEcoApprovalState(
      eco.id,
      eco.stageId,
      req.user.id,
      req.user.role === 'ADMIN',
      req.user.role,
      eco.userId
    );

    if (!approvalState.canApprove && !approvalState.canComment) {
      throw new ForbiddenError('You are not authorized to approve this ECO');
    }

    const result = await advanceEcoStage(id, req.user.id, 'APPROVE', comments, {
      isAdmin: req.user.role === 'ADMIN',
    });

    getIO().emit('eco:approved', { eco: result, userId: req.user.id });

    res.json({
      success: true,
      message: 'ECO approval recorded successfully',
      data: { eco: result },
    });
  } catch (error) {
    next(error);
  }
};

const validateEco = async (req, res, next) => {
  try {
    const { id } = req.params;

    const eco = await prisma.eco.findUnique({
      where: { id },
      include: { stage: true },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    const approvalState = await getEcoApprovalState(
      eco.id,
      eco.stageId,
      req.user.id,
      req.user.role === 'ADMIN',
      req.user.role,
      eco.userId
    );

    if (!approvalState.canValidate) {
      throw new ValidationError('This stage requires approval, not validation');
    }

    const result = await advanceEcoStage(id, req.user.id, 'VALIDATE');

    getIO().emit('eco:validated', { eco: result, userId: req.user.id });

    res.json({
      success: true,
      message: 'ECO validated and advanced to next stage',
      data: { eco: result },
    });
  } catch (error) {
    next(error);
  }
};

const rejectEcoController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const result = await rejectEco(id, req.user.id, comments, {
      isAdmin: req.user.role === 'ADMIN',
    });

    getIO().emit('eco:rejected', { eco: result, userId: req.user.id });

    res.json({
      success: true,
      message: 'ECO rejected successfully',
      data: { eco: result },
    });
  } catch (error) {
    next(error);
  }
};

const getEcoDiff = async (req, res, next) => {
  try {
    const { id } = req.params;

    const eco = await prisma.eco.findUnique({
      where: { id },
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
          },
        },
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    let diff = {};

    if (eco.ecoType === EcoType.PRODUCT) {
      const currentProduct = {
        ...eco.product,
        attachments: getAttachmentSnapshot(eco.product),
      };
      const proposedChanges = eco.proposedProductChanges || {};
      diff = generateProductDiff(currentProduct, proposedChanges);
    } else {
      const proposedChanges = eco.proposedBomChanges || { components: [], operations: [] };
      diff = {
        components: generateBomDiff(eco.bom.components, proposedChanges.components || []),
        operations: generateBomDiff(eco.bom.operations, proposedChanges.operations || []),
      };
    }

    res.json({
      success: true,
      data: {
        ecoType: eco.ecoType,
        product: eco.product
          ? {
              ...eco.product,
              attachments: getAttachmentSnapshot(eco.product),
            }
          : null,
        bom: eco.ecoType === EcoType.BOM ? eco.bom : null,
        diff,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getEcoAttachments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const eco = await prisma.eco.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            attachmentRecords: true,
          },
        },
        bom: {
          include: {
            attachmentRecords: true,
          },
        },
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    const { liveAttachments, proposedAttachments } = getEcoAttachmentState(eco);

    res.json({
      success: true,
      data: {
        ecoId: eco.id,
        ecoType: eco.ecoType,
        liveAttachments,
        proposedAttachments,
      },
    });
  } catch (error) {
    next(error);
  }
};

const addEcoAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fileName, fileUrl, mimeType, fileSize, version, description, status } = req.body;

    if (!fileName || !fileUrl) {
      throw new ValidationError('fileName and fileUrl are required');
    }

    const eco = await prisma.eco.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            attachmentRecords: true,
          },
        },
        bom: {
          include: {
            attachmentRecords: true,
          },
        },
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    if (eco.isApplied || eco.state === EcoState.CANCELLED) {
      throw new ValidationError('Attachments cannot be changed on a completed or cancelled ECO');
    }

    const { proposedAttachments } = getEcoAttachmentState(eco);
    const nextAttachments = [
      ...proposedAttachments.filter((attachment) => attachment.fileUrl !== fileUrl),
      {
        fileName,
        fileUrl,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: parseInt(fileSize || 0, 10),
        version: version || 1,
        status: status || Status.ACTIVE,
        description: description || null,
      },
    ];

    const data =
      eco.ecoType === EcoType.PRODUCT
        ? {
            proposedProductChanges: {
              ...(eco.proposedProductChanges || {}),
              attachments: nextAttachments,
            },
          }
        : {
            proposedBomChanges: {
              ...(eco.proposedBomChanges || {}),
              attachments: nextAttachments,
            },
          };

    const updatedEco = await prisma.eco.update({
      where: { id },
      data,
    });

    await createAuditLog({
      action: 'ATTACHMENT_ADDED',
      entityType: 'ECO',
      entityId: eco.id,
      oldValue: { attachments: proposedAttachments },
      newValue: { attachments: nextAttachments },
      userId: req.user.id,
      ecoId: eco.id,
    });

    res.json({
      success: true,
      message: 'Attachment added to ECO draft',
      data: {
        eco: updatedEco,
        proposedAttachments: nextAttachments,
      },
    });
  } catch (error) {
    next(error);
  }
};

const removeEcoAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fileUrl, fileName } = req.body;

    if (!fileUrl && !fileName) {
      throw new ValidationError('fileUrl or fileName is required');
    }

    const eco = await prisma.eco.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            attachmentRecords: true,
          },
        },
        bom: {
          include: {
            attachmentRecords: true,
          },
        },
      },
    });

    if (!eco) {
      throw new NotFoundError('ECO not found');
    }

    if (eco.isApplied || eco.state === EcoState.CANCELLED) {
      throw new ValidationError('Attachments cannot be changed on a completed or cancelled ECO');
    }

    const { proposedAttachments } = getEcoAttachmentState(eco);
    const nextAttachments = proposedAttachments.filter(
      (attachment) =>
        attachment.fileUrl !== fileUrl &&
        attachment.fileName !== fileName
    );

    const data =
      eco.ecoType === EcoType.PRODUCT
        ? {
            proposedProductChanges: {
              ...(eco.proposedProductChanges || {}),
              attachments: nextAttachments,
            },
          }
        : {
            proposedBomChanges: {
              ...(eco.proposedBomChanges || {}),
              attachments: nextAttachments,
            },
          };

    const updatedEco = await prisma.eco.update({
      where: { id },
      data,
    });

    await createAuditLog({
      action: 'ATTACHMENT_REMOVED',
      entityType: 'ECO',
      entityId: eco.id,
      oldValue: { attachments: proposedAttachments },
      newValue: { attachments: nextAttachments },
      userId: req.user.id,
      ecoId: eco.id,
    });

    res.json({
      success: true,
      message: 'Attachment removed from ECO draft',
      data: {
        eco: updatedEco,
        proposedAttachments: nextAttachments,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllEcos,
  getEcoById,
  createEco,
  updateEco,
  startEco,
  approveEco,
  validateEco,
  rejectEco: rejectEcoController,
  getEcoDiff,
  getEcoAttachments,
  addEcoAttachment,
  removeEcoAttachment,
};
