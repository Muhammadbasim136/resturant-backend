const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const isAdmin = require('../middleware/isAdmin');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

// GET /api/products
// Query params: ?category=burgers  ?featured=true  ?available=true
router.get('/', async (req, res) => {
  try {
    const { category, featured, available } = req.query;
    let query = db.collection('products');

    if (category) query = query.where('category', '==', category);
    if (featured !== undefined) query = query.where('featured', '==', featured === 'true');
    if (available !== undefined) query = query.where('available', '==', available === 'true');

    const snapshot = await query.get();
    const products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    products.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product: ' + err.message });
  }
});

// POST /api/products (admin)
//
// Accepts an image two ways:
//  1. Two-step flow (used by admin.html): image was already uploaded via
//     POST /api/upload, and the resulting `imageUrl` / `imagePublicId`
//     are sent here as plain JSON fields.
//  2. One-step flow: an image file is attached directly to this same
//     request as multipart/form-data under the field name "image".
// If both are somehow present, the directly-attached file wins.
router.post('/', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category, featured } = req.body;

    if (!name || price === undefined || !category) {
      return res.status(400).json({ error: 'name, price, and category are required' });
    }

    const priceNum = Number(price);
    if (Number.isNaN(priceNum)) {
      return res.status(400).json({ error: 'price must be a number' });
    }

    let imageUrl = req.body.imageUrl || null;
    let imagePublicId = req.body.imagePublicId || null;

    if (req.file) {
      const result = await uploadImage(req.file.buffer, 'products');
      imageUrl = result.imageUrl;
      imagePublicId = result.imagePublicId;
    }

    const newProduct = {
      name,
      description: description || '',
      price: priceNum,
      category,
      imageUrl,
      imagePublicId,
      featured: featured === 'true' || featured === true,
      available: true,
      stock: 999,
      order: Date.now(),
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection('products').add(newProduct);

    res.status(201).json({ id: docRef.id, ...newProduct });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

// PATCH /api/products/:id (admin)
router.patch('/:id', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const docRef = db.collection('products').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const existing = doc.data();
    const updates = {};

    const allowedFields = ['name', 'description', 'price', 'category', 'featured', 'available', 'stock'];
    allowedFields.forEach((field) => {
      if (req.body[field] === undefined) return;

      if (field === 'price' || field === 'stock') {
        const num = Number(req.body[field]);
        if (!Number.isNaN(num)) updates[field] = num;
      } else if (field === 'featured' || field === 'available') {
        updates[field] = req.body[field] === 'true' || req.body[field] === true;
      } else {
        updates[field] = req.body[field];
      }
    });

    // Two-step flow: image was already uploaded via POST /api/upload and
    // its URL was sent as a plain JSON field on this request.
    if (req.body.imageUrl && !req.file) {
      if (existing.imagePublicId) {
        await deleteImage(existing.imagePublicId);
      }
      updates.imageUrl = req.body.imageUrl;
      updates.imagePublicId = req.body.imagePublicId || null;
    }

    // One-step flow: an image file is attached directly to this request.
    if (req.file) {
      if (existing.imagePublicId) {
        await deleteImage(existing.imagePublicId);
      }
      const result = await uploadImage(req.file.buffer, 'products');
      updates.imageUrl = result.imageUrl;
      updates.imagePublicId = result.imagePublicId;
    }

    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);

    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

// DELETE /api/products/:id (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('products').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { imagePublicId } = doc.data();
    if (imagePublicId) {
      await deleteImage(imagePublicId);
    }

    await docRef.delete();

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
});

module.exports = router;