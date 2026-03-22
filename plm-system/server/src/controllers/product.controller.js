const { PrismaClient, Status, EcoType, EcoState } = require('@prisma/client');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { generateEcoReference } = require('../services/eco.service');
const { getFirstEcoStage } = require('../services/stage-bootstrap.service');

const prisma = new PrismaClient();

const getProductAttachmentSnapshot = (product) => {
  if (product.attachmentRecords?.length) {
    return product.attachmentRecords
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
  }

  return product.attachments || [];
};

const getAllProducts = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;

    const where = {};

    if (req.user.role === 'OPERATIONS_USER') {
      where.status = Status.ACTIVE;
    } else if (status) {
      where.status = status;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const skip = (page - 1) * parseInt(limit, 10);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          _count: {
            select: {
              boms: true,
              attachmentRecords: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        products,
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

const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        boms: {
          where: req.user.role === 'OPERATIONS_USER' ? { status: Status.ACTIVE } : undefined,
          select: {
            id: true,
            reference: true,
            version: true,
            status: true,
          },
          orderBy: { version: 'desc' },
        },
        parent: {
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
          },
        },
        versions: {
          select: {
            id: true,
            name: true,
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

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (req.user.role === 'OPERATIONS_USER' && product.status !== Status.ACTIVE) {
      throw new NotFoundError('Product not found');
    }

    res.json({
      success: true,
      data: {
        product: {
          ...product,
          attachments: getProductAttachmentSnapshot(product),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getProductVersions = async (req, res, next) => {
  try {
    const { id } = req.params;

    let current = await prisma.product.findUnique({
      where: { id },
      include: {
        attachmentRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!current) {
      throw new NotFoundError('Product not found');
    }

    const versions = [];
    while (current) {
      versions.push({
        ...current,
        attachments: getProductAttachmentSnapshot(current),
      });

      if (current.parentId) {
        current = await prisma.product.findUnique({
          where: { id: current.parentId },
          include: {
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

const getProductAttachments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        attachmentRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    res.json({
      success: true,
      data: {
        attachments: getProductAttachmentSnapshot(product),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, salesPrice, costPrice, attachments = [] } = req.body;

    const normalizedAttachments = attachments || [];

    const product = await prisma.product.create({
      data: {
        name,
        salesPrice: parseFloat(salesPrice),
        costPrice: parseFloat(costPrice),
        attachments: normalizedAttachments,
        version: 1,
        status: Status.ACTIVE,
        attachmentRecords: normalizedAttachments.length
          ? {
              create: normalizedAttachments.map((attachment) => ({
                fileName: attachment.fileName,
                fileUrl: attachment.fileUrl,
                mimeType: attachment.mimeType || 'application/octet-stream',
                fileSize: parseInt(attachment.fileSize || 0, 10),
                version: attachment.version || 1,
                uploadedBy: req.user.id,
                description: attachment.description || null,
              })),
            }
          : undefined,
      },
      include: {
        attachmentRecords: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product: {
          ...product,
          attachments: getProductAttachmentSnapshot(product),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const restoreProductVersion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { versionId } = req.body;

    const [currentProduct, targetVersion] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        include: {
          attachmentRecords: true,
        },
      }),
      prisma.product.findUnique({
        where: { id: versionId },
        include: {
          attachmentRecords: true,
        },
      }),
    ]);

    if (!currentProduct) {
      throw new NotFoundError('Product not found');
    }

    if (!targetVersion) {
      throw new NotFoundError('Selected product version not found');
    }

    if (currentProduct.status !== Status.ACTIVE) {
      throw new ValidationError('Only the active product version can be restored through a new ECO');
    }

    const firstStage = await getFirstEcoStage(prisma);

    if (!firstStage) {
      throw new ValidationError('No ECO stages configured');
    }

    const eco = await prisma.eco.create({
      data: {
        reference: await generateEcoReference(),
        title: `Restore Product to v${targetVersion.version}`,
        description: `Restore ${currentProduct.name} from version ${currentProduct.version} to version ${targetVersion.version}`,
        ecoType: EcoType.PRODUCT,
        productId: currentProduct.id,
        userId: req.user.id,
        stageId: firstStage.id,
        state: EcoState.IN_PROGRESS,
        isStarted: false,
        versionUpdate: true,
        proposedProductChanges: {
          name: targetVersion.name,
          salesPrice: targetVersion.salesPrice,
          costPrice: targetVersion.costPrice,
          attachments: getProductAttachmentSnapshot(targetVersion),
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
  getAllProducts,
  getProductById,
  getProductVersions,
  getProductAttachments,
  createProduct,
  restoreProductVersion,
};
