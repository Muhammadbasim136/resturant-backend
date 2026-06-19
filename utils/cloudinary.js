const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads an in-memory image buffer (from multer's memoryStorage) to
 * Cloudinary and returns a public URL plus the public_id needed to
 * delete it later.
 *
 * @param {Buffer} fileBuffer - raw image bytes (req.file.buffer)
 * @param {string} folder - logical sub-folder, e.g. 'products' or 'banners'
 * @returns {Promise<{ imageUrl: string, imagePublicId: string }>}
 */
function uploadImage(fileBuffer, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `centraa/${folder}`,
        resource_type: 'image',
        // Auto-compress + serve modern formats (webp/avif) where supported —
        // this is the free optimization Firebase Storage didn't give us.
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ imageUrl: result.secure_url, imagePublicId: result.public_id });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Deletes a previously uploaded image by its Cloudinary public_id.
 * Never throws — a failed cleanup shouldn't block the calling request.
 *
 * @param {string} imagePublicId
 */
async function deleteImage(imagePublicId) {
  if (!imagePublicId) return;
  try {
    await cloudinary.uploader.destroy(imagePublicId);
  } catch (err) {
    console.error('Failed to delete Cloudinary image:', imagePublicId, err.message);
  }
}

module.exports = { uploadImage, deleteImage };