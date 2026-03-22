const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  getProductVersions,
  getProductAttachments,
  createProduct,
  restoreProductVersion,
} = require('../controllers/product.controller');
const { createProductValidator } = require('../utils/validators');
const { authenticate } = require('../middleware/auth.middleware');
const { requireEngineering } = require('../middleware/role.middleware');

router.use(authenticate);

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.get('/:id/versions', getProductVersions);
router.get('/:id/attachments', getProductAttachments);
router.post('/:id/restore', requireEngineering, restoreProductVersion);
router.post('/', requireEngineering, createProductValidator, createProduct);

module.exports = router;
