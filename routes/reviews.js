const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');

// POST /api/reviews (user) - must own the order and order must be delivered
router.post('/', verifyToken, async (req, res) => {
  try {
    const { orderId, productId, productName, rating, text } = req.body;

    if (!orderId || !productId || rating === undefined) {
      return res.status(400).json({ error: 'orderId, productId, and rating are required' });
    }

    const ratingNum = Number(rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
    }

    const orderDoc = await db.collection('orders').doc(orderId).get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderDoc.data();

    if (order.userId !== req.user.uid) {
      return res.status(403).json({ error: 'This order does not belong to you' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'You can only review delivered orders' });
    }

    const newReview = {
      orderId,
      productId,
      productName: productName || '',
      userId: req.user.uid,
      userName: req.user.name,
      rating: ratingNum,
      text: text || '',
      approved: false,
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection('reviews').add(newReview);

    res.status(201).json({ id: docRef.id, ...newReview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review: ' + err.message });
  }
});

// GET /api/reviews (public) - approved only, capped at 20
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('reviews').where('approved', '==', true).limit(20).get();

    const reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews: ' + err.message });
  }
});

// GET /api/reviews/admin/all (admin) - includes unapproved
router.get('/admin/all', isAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('reviews').get();
    const reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews: ' + err.message });
  }
});

// PATCH /api/reviews/:id/approve (admin)
router.patch('/:id/approve', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('reviews').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await docRef.update({ approved: true });

    res.json({ success: true, message: 'Review approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve review: ' + err.message });
  }
});

// DELETE /api/reviews/:id (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('reviews').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await docRef.delete();

    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review: ' + err.message });
  }
});

module.exports = router;
