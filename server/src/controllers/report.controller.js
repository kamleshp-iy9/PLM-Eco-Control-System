const { PrismaClient, Status } = require('@prisma/client');
const { generateBomDiff } = require('../utils/diff');

const prisma = new PrismaClient();

const toCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const sendCsvOrJson = (req, res, payload, rows, filename) => {
  if (req.query.format !== 'csv') {
    return res.json({
      success: true,
      data: payload,
    });
  }

  if (!rows.length) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('');
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
};

const getEcoReport = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * parseInt(limit, 10);

    const [ecos, total] = await Promise.all([
      prisma.eco.findMany({
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          bom: {
            select: {
              id: true,
              reference: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              loginId: true,
            },
          },
          stage: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.eco.count(),
    ]);

    const rows = ecos.map((eco) => ({
      reference: eco.reference,
      title: eco.title,
      ecoType: eco.ecoType,
      product: eco.product?.name || '',
      bom: eco.bom?.reference || '',
      assignedTo: eco.user?.name || '',
      stage: eco.stage?.name || '',
      state: eco.state,
      effectiveDate: eco.effectiveDate ? eco.effectiveDate.toISOString() : '',
      appliedAt: eco.appliedAt ? eco.appliedAt.toISOString() : '',
      createdAt: eco.createdAt.toISOString(),
    }));

    return sendCsvOrJson(
      req,
      res,
      {
        ecos,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
      rows,
      'eco-report.csv'
    );
  } catch (error) {
    next(error);
  }
};

const getProductVersionReport = async (req, res, next) => {
  try {
    const { productId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * parseInt(limit, 10);

    const where = {};
    if (productId) where.id = productId;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          versions: {
            orderBy: { version: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.product.count({ where }),
    ]);

    const versionHistory = [];
    for (const product of products) {
      const versions = [product, ...product.versions];
      for (const version of versions) {
        versionHistory.push({
          productId: product.id,
          productName: product.name,
          version: version.version,
          salesPrice: version.salesPrice,
          costPrice: version.costPrice,
          status: version.status,
          createdAt: version.createdAt,
        });
      }
    }

    versionHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const rows = versionHistory.map((version) => ({
      productName: version.productName,
      version: version.version,
      salesPrice: version.salesPrice,
      costPrice: version.costPrice,
      status: version.status,
      createdAt: version.createdAt.toISOString(),
    }));

    return sendCsvOrJson(
      req,
      res,
      {
        versions: versionHistory,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: versionHistory.length,
          pages: Math.ceil(versionHistory.length / parseInt(limit, 10)),
        },
      },
      rows,
      'product-versions.csv'
    );
  } catch (error) {
    next(error);
  }
};

const getBomChangeReport = async (req, res, next) => {
  try {
    const { productId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * parseInt(limit, 10);

    const where = {};
    if (productId) where.productId = productId;

    const [boms, total] = await Promise.all([
      prisma.bom.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          components: true,
          operations: true,
          nextVersions: {
            include: {
              components: true,
              operations: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.bom.count({ where }),
    ]);

    const bomChanges = [];
    for (const bom of boms) {
      const changes = [];

      if (bom.nextVersions.length > 0) {
        for (const nextVersion of bom.nextVersions) {
          const componentsDiff = generateBomDiff(bom.components, nextVersion.components);
          const operationsDiff = generateBomDiff(bom.operations, nextVersion.operations);

          const changedComponents = componentsDiff.filter((diff) => diff.change !== 'unchanged');
          const changedOperations = operationsDiff.filter((diff) => diff.change !== 'unchanged');

          if (changedComponents.length > 0 || changedOperations.length > 0) {
            changes.push({
              fromVersion: bom.version,
              toVersion: nextVersion.version,
              componentsChanged: changedComponents.length,
              operationsChanged: changedOperations.length,
              details: {
                components: changedComponents,
                operations: changedOperations,
              },
            });
          }
        }
      }

      bomChanges.push({
        bomId: bom.id,
        reference: bom.reference,
        finishedProduct: bom.product.name,
        version: bom.version,
        status: bom.status,
        componentsCount: bom.components.length,
        operationsCount: bom.operations.length,
        changes,
        createdAt: bom.createdAt,
      });
    }

    const rows = bomChanges.map((bom) => ({
      reference: bom.reference,
      finishedProduct: bom.finishedProduct,
      version: bom.version,
      status: bom.status,
      componentsCount: bom.componentsCount,
      operationsCount: bom.operationsCount,
      changeCount: bom.changes.length,
      createdAt: bom.createdAt.toISOString(),
    }));

    return sendCsvOrJson(
      req,
      res,
      {
        bomChanges,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
      rows,
      'bom-changes.csv'
    );
  } catch (error) {
    next(error);
  }
};

const getArchivedProductsReport = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * parseInt(limit, 10);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { status: Status.ARCHIVED },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.product.count({ where: { status: Status.ARCHIVED } }),
    ]);

    const rows = products.map((product) => ({
      name: product.name,
      version: product.version,
      salesPrice: product.salesPrice,
      costPrice: product.costPrice,
      updatedAt: product.updatedAt.toISOString(),
    }));

    return sendCsvOrJson(
      req,
      res,
      {
        products,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
      rows,
      'archived-products.csv'
    );
  } catch (error) {
    next(error);
  }
};

const getActiveMatrixReport = async (req, res, next) => {
  try {
    const activeProducts = await prisma.product.findMany({
      where: { status: Status.ACTIVE },
      include: {
        boms: {
          where: { status: Status.ACTIVE },
          include: {
            _count: {
              select: {
                components: true,
                operations: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const matrix = activeProducts.map((product) => {
      const activeBom = product.boms[0];
      return {
        productId: product.id,
        productName: product.name,
        productVersion: product.version,
        bomReference: activeBom?.reference || null,
        bomVersion: activeBom?.version || null,
        componentsCount: activeBom?._count.components || 0,
        operationsCount: activeBom?._count.operations || 0,
      };
    });

    const rows = matrix.map((item) => ({
      productName: item.productName,
      productVersion: item.productVersion,
      bomReference: item.bomReference || '',
      bomVersion: item.bomVersion || '',
      componentsCount: item.componentsCount,
      operationsCount: item.operationsCount,
    }));

    return sendCsvOrJson(
      req,
      res,
      { matrix },
      rows,
      'active-matrix.csv'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEcoReport,
  getProductVersionReport,
  getBomChangeReport,
  getArchivedProductsReport,
  getActiveMatrixReport,
};
