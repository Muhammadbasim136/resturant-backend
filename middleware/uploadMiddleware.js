const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 512000; // 500kb

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error('Only JPEG, PNG, and WEBP images are allowed');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

/**
 * Wraps multer's `.single(fieldName)` so we can return clean, consistent
 * JSON error responses instead of letting multer's raw errors bubble up
 * to the global error handler (which would return a generic 500).
 */
function wrapSingle(fieldName) {
  const middleware = multerInstance.single(fieldName);

  return function (req, res, next) {
    middleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Image must be under 500kb' });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: err.message || 'Image upload failed' });
      }
      next();
    });
  };
}

const upload = { single: wrapSingle };

module.exports = { upload };