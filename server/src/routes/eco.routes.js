const express = require('express');
const router = express.Router();
const {
  getAllEcos,
  getEcoById,
  createEco,
  updateEco,
  startEco,
  approveEco,
  validateEco,
  rejectEco,
  getEcoDiff,
  getEcoAttachments,
  addEcoAttachment,
  removeEcoAttachment,
} = require('../controllers/eco.controller');
const { createEcoValidator, updateEcoValidator } = require('../utils/validators');
const { authenticate } = require('../middleware/auth.middleware');
const { requireEngineering } = require('../middleware/role.middleware');

router.use(authenticate);

router.get('/', getAllEcos);
router.get('/:id', getEcoById);
router.get('/:id/diff', getEcoDiff);
router.get('/:id/attachments', getEcoAttachments);
router.post('/', requireEngineering, createEcoValidator, createEco);
router.put('/:id', requireEngineering, updateEcoValidator, updateEco);
router.post('/:id/attachments', requireEngineering, addEcoAttachment);
router.delete('/:id/attachments', requireEngineering, removeEcoAttachment);
router.post('/:id/start', requireEngineering, startEco);
router.post('/:id/approve', approveEco);
router.post('/:id/validate', validateEco);
router.post('/:id/reject', rejectEco);

module.exports = router;
