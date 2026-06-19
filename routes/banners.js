const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const isAdmin = require('../middleware/isAdmin');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

// GET /api/banners (public)
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('banners').where('active', '==', true).get();
    const banners = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    banners.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch banners: ' + err.message });
  }
});

// POST /api/banners (admin)
router.post('/', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, subtitle, buttonText, buttonLink, order } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Banner image is required' });
    }

    const { imageUrl, imagePublicId } = await uploadImage(req.file.buffer, 'banners');

    const newBanner = {
      title: title || '',
      subtitle: subtitle || '',
      buttonText: buttonText || '',
      buttonLink: buttonLink || '',
      order: order !== undefined ? Number(order) : Date.now(),
      imageUrl,
      imagePublicId,
      active: true,
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection('banners').add(newBanner);

    res.status(201).json({ id: docRef.id, ...newBanner });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create banner: ' + err.message });
  }
});

// PATCH /api/banners/:id (admin)
router.patch('/:id', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const docRef = db.collection('banners').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const existing = doc.data();
    const updates = {};

    const allowedFields = ['title', 'subtitle', 'buttonText', 'buttonLink', 'order', 'active'];
    allowedFields.forEach((field) => {
      if (req.body[field] === undefined) return;

      if (field === 'order') {
        updates[field] = Number(req.body[field]);
      } else if (field === 'active') {
        updates[field] = req.body[field] === 'true' || req.body[field] === true;
      } else {
        updates[field] = req.body[field];
      }
    });

    if (req.file) {
      if (existing.imagePublicId) {
        await deleteImage(existing.imagePublicId);
      }
      const result = await uploadImage(req.file.buffer, 'banners');
      updates.imageUrl = result.imageUrl;
      updates.imagePublicId = result.imagePublicId;
    }

    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);

    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update banner: ' + err.message });
  }
});

// DELETE /api/banners/:id (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('banners').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const { imagePublicId } = doc.data();
    if (imagePublicId) {
      await deleteImage(imagePublicId);
    }

    await docRef.delete();

    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete banner: ' + err.message });
  }
});

module.exports = router;