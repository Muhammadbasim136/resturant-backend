const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const isAdmin = require('../middleware/isAdmin');

const DEFAULT_CATEGORIES = [
  { name: 'Burgers', slug: 'burgers', icon: '🍔', order: 1 },
  { name: 'Sandwiches', slug: 'sandwiches', icon: '🥪', order: 2 },
  { name: 'Bread (Chapati & Naan)', slug: 'bread', icon: '🫓', order: 3 },
  { name: 'Cold Drinks', slug: 'cold-drinks', icon: '🥤', order: 4 },
];

// GET /api/categories (public) - seeds defaults on first call if empty
router.get('/', async (req, res) => {
  try {
    const collectionRef = db.collection('categories');
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      const batch = db.batch();
      const seeded = [];

      DEFAULT_CATEGORIES.forEach((cat) => {
        const docRef = collectionRef.doc();
        const data = { ...cat, createdAt: new Date().toISOString() };
        batch.set(docRef, data);
        seeded.push({ id: docRef.id, ...data });
      });

      await batch.commit();

      seeded.sort((a, b) => (a.order || 0) - (b.order || 0));
      return res.json(seeded);
    }

    const categories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories: ' + err.message });
  }
});

// POST /api/categories (admin)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, slug, icon, order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    const newCategory = {
      name,
      slug,
      icon: icon || '',
      order: order !== undefined ? Number(order) : Date.now(),
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection('categories').add(newCategory);

    res.status(201).json({ id: docRef.id, ...newCategory });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category: ' + err.message });
  }
});

// PATCH /api/categories/:id (admin)
router.patch('/:id', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('categories').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updates = {};
    const allowedFields = ['name', 'slug', 'icon', 'order'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'order' ? Number(req.body[field]) : req.body[field];
      }
    });

    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);

    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category: ' + err.message });
  }
});

// DELETE /api/categories/:id (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('categories').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await docRef.delete();

    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category: ' + err.message });
  }
});

module.exports = router;
