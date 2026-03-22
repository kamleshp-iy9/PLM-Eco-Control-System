const express = require('express');
const router = express.Router();
const {
  getEcoReport,
  getProductVersionReport,
  getBomChangeReport,
  getArchivedProductsReport,
  getActiveMatrixReport,
} = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/ecos', getEcoReport);
router.get('/product-versions', getProductVersionReport);
router.get('/bom-changes', getBomChangeReport);
router.get('/archived-products', getArchivedProductsReport);
router.get('/active-matrix', getActiveMatrixReport);

module.exports = router;
