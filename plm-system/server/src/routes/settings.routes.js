const express = require('express');
const router = express.Router();
const {
  getAllStages,
  createStage,
  updateStage,
  deleteStage,
  getAllApprovalRules,
  getStageApprovalRules,
  createStageApprovalRule,
  updateStageApprovalRule,
  deleteStageApprovalRule,
} = require('../controllers/settings.controller');
const { createStageValidator, createApprovalRuleValidator } = require('../utils/validators');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

router.use(authenticate);
router.use(requireAdmin);

// Stages
router.get('/stages', getAllStages);
router.post('/stages', createStageValidator, createStage);
router.put('/stages/:id', updateStage);
router.delete('/stages/:id', deleteStage);

// Approval Rules
router.get('/approval-rules', getAllApprovalRules);
router.get('/stages/:stageId/approvals', getStageApprovalRules);
router.post('/stages/:stageId/approvals', createApprovalRuleValidator, createStageApprovalRule);
router.put('/stages/:stageId/approvals/:ruleId', updateStageApprovalRule);
router.delete('/stages/:stageId/approvals/:ruleId', deleteStageApprovalRule);

module.exports = router;
