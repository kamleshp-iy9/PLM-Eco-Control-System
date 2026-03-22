const { getAuditLogs, getEcoAuditLogs } = require('../services/audit.service');

const getAllAuditLogs = async (req, res, next) => {
  try {
    const { entityType, entityId, ecoId, userId, page, limit } = req.query;

    const result = await getAuditLogs({
      entityType,
      entityId,
      ecoId,
      userId,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getEcoAuditLogsController = async (req, res, next) => {
  try {
    const { ecoId } = req.params;

    const logs = await getEcoAuditLogs(ecoId);

    res.json({
      success: true,
      data: { logs },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAuditLogs,
  getEcoAuditLogs: getEcoAuditLogsController,
};
