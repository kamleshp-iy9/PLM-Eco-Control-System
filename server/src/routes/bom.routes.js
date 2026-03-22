const express = require('express');
const router = express.Router();
const {
  getAllBoms,
  getBomById,
  getBomVersions,
  getBomAttachments,
  createBom,
  restoreBomVersion,
} = require('../controllers/bom.controller');
const { createBomValidator } = require('../utils/validators');
const { authenticate } = require('../middleware/auth.middleware');
const { requireEngineering } = require('../middleware/role.middleware');

router.use(authenticate);

router.get('/', getAllBoms);
router.get('/:id', getBomById);
router.get('/:id/versions', getBomVersions);
router.get('/:id/attachments', getBomAttachments);
router.post('/:id/restore', requireEngineering, restoreBomVersion);
router.post('/', requireEngineering, createBomValidator, createBom);

module.exports = router;
