// ─── Audit log service ─────────────────────────────────────────────────────────
// Every important action in the system (approvals, stage transitions, product changes,
// user management) gets written here so we have a full, immutable history.
// Controllers call createAuditLog() after every meaningful operation.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// createAuditLog — writes a single audit entry.
// data should contain: action, entityType, entityId, userId,
// and optionally oldValue/newValue (JSON snapshots of what changed) and ecoId.
const createAuditLog = async (data) => {
  return prisma.auditLog.create({
    data,
  });
};

// getAuditLogs — paginated fetch with optional filters.
// Used by the admin audit trail page. Default page size is 50.
const getAuditLogs = async (filters = {}) => {
  const { entityType, entityId, ecoId, userId, page = 1, limit = 50 } = filters;

  const where = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (ecoId) where.ecoId = ecoId;
  if (userId) where.userId = userId;

  // Calculate how many rows to skip for the requested page
  const skip = (page - 1) * limit;

  // Fetch the log entries and the total count in parallel to avoid two sequential queries
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
          },
        },
        eco: {
          select: {
            id: true,
            reference: true, // e.g. ECO-0042
          },
        },
      },
      orderBy: { timestamp: 'desc' }, // most recent events first
      skip,
      take: parseInt(limit),
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// getEcoAuditLogs — fetches all audit entries for a specific ECO in chronological order.
// Used to display the activity timeline on the ECO detail page.
const getEcoAuditLogs = async (ecoId) => {
  return prisma.auditLog.findMany({
    where: { ecoId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          loginId: true,
        },
      },
    },
    orderBy: { timestamp: 'asc' }, // oldest first so the timeline reads top-to-bottom
  });
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getEcoAuditLogs,
};
