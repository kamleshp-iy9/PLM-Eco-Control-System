// ─── File upload middleware ────────────────────────────────────────────────────
// Configures Multer for handling multipart/form-data file uploads.
// Files land in /uploads on disk with a sanitized, timestamped filename.

const multer = require('multer');
const path = require('path');
const { ValidationError } = require('../utils/errors');

// sanitizeFilename — strips directory components and replaces unsafe characters.
// Prevents path traversal attacks like uploading a file named "../../etc/passwd".
function sanitizeFilename(name) {
  const basename = path.basename(name); // drop any directory prefix
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_'); // only allow safe characters
}

// ─── Disk storage config ───────────────────────────────────────────────────────
// Files are saved to the /uploads directory at the server root.
// A unique prefix (timestamp + random number) prevents filename collisions.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = sanitizeFilename(file.originalname);
    cb(null, uniqueSuffix + '-' + safeName); // e.g. 1712345678901-987654321-spec.pdf
  },
});

// ─── File type whitelist ───────────────────────────────────────────────────────
// Only allow document and image formats relevant to PLM. Anything else is rejected.
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true); // accept
  } else {
    cb(new ValidationError('Invalid file type. Allowed: PDF, Excel, JPG, PNG'), false); // reject
  }
};

// ─── Multer instance ───────────────────────────────────────────────────────────
// MAX_FILE_SIZE is read from .env (default 10MB).
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB cap
  },
});

// Convenience wrappers used in route files
const uploadSingle = upload.single('file');      // expect one file under the key "file"
const uploadMultiple = upload.array('files', 10); // up to 10 files under the key "files"

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
};
