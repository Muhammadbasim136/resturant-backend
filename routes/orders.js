const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');
const { sendOrderConfirmation, sendAdminOrderAlert } = require('../utils/mailer');

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

// POST /api/orders (user)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { items, deliveryAddress, phone, note } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must include at least one item' });
    }
    if (!deliveryAddress || !phone) {
      return res.status(400).json({ error: 'deliveryAddress and phone are required' });
    }

    // Re-fetch the real price for every item server-side.
    // We NEVER trust price values sent from the frontend.
    let total = 0;
    const verifiedItems = [];

    for (const item of items) {
      if (!item.productId || !item.qty || Number(item.qty) < 1) {
        return res.status(400).json({ error: 'Each item must include a valid productId and qty' });
      }

      const productDoc = await db.collection('products').doc(item.productId).get();

      if (!productDoc.exists) {
        return res.status(400).json({ error: `Product not found: ${item.productId}` });
      }

      const product = productDoc.data();

      if (product.available === false) {
        return res.status(400).json({ error: `Product is currently unavailable: ${product.name}` });
      }

      const qty = Number(item.qty);
      const subtotal = product.price * qty;
      total += subtotal;

      verifiedItems.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        qty,
      });
    }

    const newOrder = {
      userId: req.user.uid,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone,
      items: verifiedItems,
      total,
      deliveryAddress,
      phone,
      note: note || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await db.collection('orders').add(newOrder);
    const orderWithId = { id: docRef.id, ...newOrder };

    // Email failures should never block order creation from succeeding.
    try {
      await sendOrderConfirmation(req.user.email, req.user.name, orderWithId);
      await sendAdminOrderAlert(orderWithId);
    } catch (mailErr) {
      console.error('Failed to send order emails:', mailErr.message);
    }

    res.status(201).json(orderWithId);
  } catch (err) {
    res.status(500).json({ error: 'Failed to place order: ' + err.message });
  }
});

// GET /api/orders/mine (user)
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('orders').where('userId', '==', req.user.uid).get();

    const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your orders: ' + err.message });
  }
});

// GET /api/orders/admin/all (admin) - optional ?status=pending filter
router.get('/admin/all', isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('orders');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders: ' + err.message });
  }
});

// GET /api/orders/:id (user - only their own order)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = doc.data();

    if (order.userId !== req.user.uid) {
      return res.status(403).json({ error: 'You do not have access to this order' });
    }

    res.json({ id: doc.id, ...order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order: ' + err.message });
  }
});

// PATCH /api/orders/:id/status (admin)
router.patch('/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const docRef = db.collection('orders').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await docRef.update({ status, updatedAt: new Date().toISOString() });

    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status: ' + err.message });
  }
});

// DELETE /api/orders/:id (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('orders').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await docRef.delete();

    res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order: ' + err.message });
  }
});

// PATCH /api/orders/:id/cancel (user - only own order, only while pending/confirmed)
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const docRef = db.collection('orders').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = doc.data();

    if (order.userId !== req.user.uid) {
      return res.status(403).json({ error: 'You do not have access to this order' });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ error: 'Order can only be cancelled while pending or confirmed' });
    }

    await docRef.update({ status: 'cancelled', updatedAt: new Date().toISOString() });

    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order: ' + err.message });
  }
});

module.exports = router;
