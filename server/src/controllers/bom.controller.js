const { PrismaClient, Status, EcoType, EcoState } = require('@prisma/client');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { generateBomReference, generateEcoReference } = require('../services/eco.service');
const { getFirstEcoStage } = require('../services/stage-bootstrap.service');

const prisma = new PrismaClient();

const getBomAttachmentSnapshot = (bom) =>
  (bom?.attachmentRecords || [])
    .filter((attachment) => attachment.status === Status.ACTIVE)
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      version: attachment.version,
      status: attachment.status,
      description: attachment.description,
      createdAt: attachment.createdAt,
    }));

const getAllBoms = async (req, res, next) => {
  try {
    const { productId, status, search, page = 1, limit = 50 } = req.query;

    const where = {};

    if (req.user.role === 'OPERATIONS_USER') {
      where.status = Status.ACTIVE;
    } else if (status) {
      where.status = status;
    }

    if (productId) {
      where.productId = productId;
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        {
          product: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const skip = (page - 1) * parseInt(limit, 10);

    const [boms, total] = await Promise.all([
      prisma.bom.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          _count: {
            select: {
              components: true,
              operations: true,
              attachmentRecords: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.bom.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        boms,
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

const getBomById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bom = await prisma.bom.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            salesPrice: true,
            costPrice: true,
            status: true,
          },
        },
        components: true,
        operations: true,
        parent: {
          select: {
            id: true,
            reference: true,
            version: true,
            status: true,
          },
        },
        nextVersions: {
          select: {
            id: true,
            reference: true,
            version: true,
            status: true,
            createdAt: true,
          },
          orderBy: { version: 'desc' },
        },
        attachmentRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('Bill of Materials not found');
    }

    if (req.user.role === 'OPERATIONS_USER' && bom.status !== Status.ACTIVE) {
      throw new NotFoundError('Bill of Materials not found');
    }

    res.json({
      success: true,
      data: {
        bom: {
          ...bom,
          attachments: getBomAttachmentSnapshot(bom),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getBomVersions = async (req, res, next) => {
  try {
    const { id } = req.params;

    let current = await prisma.bom.findUnique({
      where: { id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          components: true,
          operations: true,
          attachmentRecords: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

    if (!current) {
      throw new NotFoundError('Bill of Materials not found');
    }

    const versions = [];
    while (current) {
      versions.push(current);
      versions[versions.length - 1] = {
        ...versions[versions.length - 1],
        attachments: getBomAttachmentSnapshot(current),
      };

      if (current.parentId) {
        current = await prisma.bom.findUnique({
          where: { id: current.parentId },
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            components: true,
            operations: true,
            attachmentRecords: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });
      } else {
        current = null;
      }
    }

    versions.sort((a, b) => b.version - a.version);

    res.json({
      success: true,
      data: { versions },
    });
  } catch (error) {
    next(error);
  }
};

const getBomAttachments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bom = await prisma.bom.findUnique({
      where: { id },
      include: {
        attachmentRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('Bill of Materials not found');
    }

    res.json({
      success: true,
      data: {
        attachments: getBomAttachmentSnapshot(bom),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createBom = async (req, res, next) => {
  try {
    const { productId, quantity, units, components = [], operations = [] } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (product.status !== Status.ACTIVE) {
      throw new ValidationError('Cannot create BoM for an archived product');
    }

    const existingActiveBom = await prisma.bom.findFirst({
      where: {
        productId,
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        reference: true,
        version: true,
      },
    });

    if (existingActiveBom) {
      throw new ValidationError(
        `An active BoM already exists for this product version (${existingActiveBom.reference}, v${existingActiveBom.version})`
      );
    }

    const reference = await generateBomReference();

    const bom = await prisma.bom.create({
      data: {
        reference,
        productId,
        quantity: parseFloat(quantity) || 1,
        units: units || 'Units',
        version: 1,
        status: Status.ACTIVE,
        components: {
          create: components.map((component) => ({
            componentName: component.componentName,
            quantity: parseFloat(component.quantity),
            units: component.units || 'Units',
          })),
        },
        operations: {
          create: operations.map((operation) => ({
            operationName: operation.operationName,
            expectedDuration: parseInt(operation.expectedDuration, 10),
            workCenter: operation.workCenter,
          })),
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        components: true,
        operations: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Bill of Materials created successfully',
      data: { bom },
    });
  } catch (error) {
    next(error);
  }
};

const restoreBomVersion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { versionId } = req.body;

    const [currentBom, targetVersion] = await Promise.all([
      prisma.bom.findUnique({
        where: { id },
      }),
      prisma.bom.findUnique({
        where: { id: versionId },
        include: {
          components: true,
          operations: true,
        },
      }),
    ]);

    if (!currentBom) {
      throw new NotFoundError('Bill of Materials not found');
    }

    if (!targetVersion) {
      throw new NotFoundError('Selected BoM version not found');
    }

    if (currentBom.status !== Status.ACTIVE) {
      throw new ValidationError('Only the active BoM version can be restored through a new ECO');
    }

    const firstStage = await getFirstEcoStage(prisma);

    if (!firstStage) {
      throw new ValidationError('No ECO stages configured');
    }

    const eco = await prisma.eco.create({
      data: {
        reference: await generateEcoReference(),
        title: `Restore BoM to v${targetVersion.version}`,
        description: `Restore ${currentBom.reference} from version ${currentBom.version} to version ${targetVersion.version}`,
        ecoType: EcoType.BOM,
        productId: currentBom.productId,
        bomId: currentBom.id,
        userId: req.user.id,
        stageId: firstStage.id,
        state: EcoState.IN_PROGRESS,
        isStarted: false,
        versionUpdate: true,
        proposedBomChanges: {
          components: targetVersion.components.map((component) => ({
            componentName: component.componentName,
            quantity: component.quantity,
            units: component.units,
          })),
          operations: targetVersion.operations.map((operation) => ({
            operationName: operation.operationName,
            expectedDuration: operation.expectedDuration,
            workCenter: operation.workCenter,
          })),
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Restore ECO created successfully',
      data: { eco },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBoms,
  getBomById,
  getBomVersions,
  getBomAttachments,
  createBom,
  restoreBomVersion,
};
