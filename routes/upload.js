const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/isAdmin');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadImage } = require('../utils/cloudinary');

/**
 * POST /api/upload (admin)
 *
 * Standalone image upload — the admin panel calls this FIRST to get a
 * URL back, then sends that URL as plain JSON when it creates/updates a
 * product or banner. This is separate from the older single-step flow
 * still supported on POST/PATCH /api/products and /api/banners (where
 * an image file can be attached directly to that same request).
 *
 * Body: multipart/form-data with a single field named "image"
 * (max 500kb, jpeg/png/webp only — enforced by uploadMiddleware.js)
 *
 * Response: { imageUrl, url, imagePublicId }
 * (both `imageUrl` and `url` are included since different frontend code
 * paths read one or the other)
 */
router.post('/', isAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const folder = req.query.folder === 'banners' ? 'banners' : 'products';
    const { imageUrl, imagePublicId } = await uploadImage(req.file.buffer, folder);

    res.status(201).json({
      success: true,
      imageUrl,
      url: imageUrl,
      imagePublicId,
    });
  } catch (err) {
    res.status(500).json({ error: 'Image upload failed: ' + err.message });
  }
});

module.exports = router;