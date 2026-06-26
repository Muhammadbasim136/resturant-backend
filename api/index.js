const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { db } = require('../utils/firebaseAdmin');
const productsRoutes = require('../routes/products');
const ordersRoutes = require('../routes/orders');
const usersRoutes = require('../routes/users');
const bannersRoutes = require('../routes/banners');
const reviewsRoutes = require('../routes/reviews');
const categoriesRoutes = require('../routes/categories');
const adminRoutes = require('../routes/admin');
const authRoutes = require('../routes/auth');
const uploadRoutes   = require('../routes/upload');
const contactRoutes  = require('../routes/contact');

const cookieParser = require('cookie-parser');
const app = express();

app.use(cors({
  origin: 'https://centraa-system.netlify.app',
  credentials: true
}));app.use(express.json());
app.use(cookieParser());

// GET /api/health — quick sanity check that the function is deployed and
// can talk to Firestore. Visit this first after deploying / setting env vars.
app.get('/api/health', async (req, res) => {
  try {
    await db.collection('_health').limit(1).get();
    res.json({
      ok: true,
      message: 'Centraa backend is alive and Firestore is connected ✅',
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Firebase connection failed', details: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/admin', adminRoutes);

// 404 for anything that doesn't match a route above
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — catches anything thrown/passed to next() that
// individual routes didn't already handle with their own try/catch.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;