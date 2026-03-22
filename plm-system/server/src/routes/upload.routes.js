const express = require('express');
const router = express.Router();
const { uploadFile, uploadMultipleFiles } = require('../controllers/upload.controller');
const { uploadSingle, uploadMultiple } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadLimiter } = require('../middleware/rate-limit.middleware');

router.use(authenticate);

router.post('/', uploadLimiter, uploadSingle, uploadFile);
router.post('/multiple', uploadLimiter, uploadMultiple, uploadMultipleFiles);

module.exports = router;
