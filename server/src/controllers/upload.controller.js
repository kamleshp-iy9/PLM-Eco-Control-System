const path = require('path');
const { ValidationError } = require('../utils/errors');

const uploadFile = (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const file = req.file;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        fileType: file.mimetype,
        size: file.size,
      },
    });
  } catch (error) {
    next(error);
  }
};

const uploadMultipleFiles = (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    const files = req.files.map(file => ({
      fileName: file.originalname,
      filePath: `/uploads/${file.filename}`,
      fileType: file.mimetype,
      size: file.size,
    }));

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      data: { files },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  uploadMultipleFiles,
};
