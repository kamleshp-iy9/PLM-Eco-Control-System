const express = require('express');
const router = express.Router();
const { getAllAuditLogs, getEcoAuditLogs } = require('../controllers/audit.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', getAllAuditLogs);
router.get('/eco/:ecoId', getEcoAuditLogs);

module.exports = router;
