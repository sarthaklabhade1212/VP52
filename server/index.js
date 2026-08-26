require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/database');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const merchantRoutes = require('./routes/merchant');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Vite frontend
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/merchant', merchantRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Customer Rewards API Server is running',
    timestamp: new Date().toISOString()
  });
});

// Optional demo seeding -- DEVELOPMENT ONLY and explicitly opt-in.
// Production never auto-seeds, so a published backend can't ship with known
// demo credentials or a default administrator.
const isProduction = process.env.NODE_ENV === 'production';
const seedDemoData = process.env.SEED_DEMO_DATA === 'true';

if (!isProduction && seedDemoData) {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      console.log('⚡ [dev] Empty database + SEED_DEMO_DATA=true — running demo seed...');
      require('./db/seed');
    }
  } catch (err) {
    console.error('Database auto-seed check error:', err);
  }
} else if (!isProduction && !seedDemoData) {
  console.log('ℹ️  Demo seeding disabled (set SEED_DEMO_DATA=true in server/.env to enable for local dev).');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Rewards App API Server running on port ${PORT}`);
  // Never print credentials in production. Only surface demo logins locally,
  // and only when demo seeding is actually enabled.
  if (!isProduction && seedDemoData) {
    console.log(`👉 [dev] Customer: customer@example.com / Customer@123`);
    console.log(`👉 [dev] Shop:     shop@example.com / Shop@123`);
    console.log(`👉 [dev] Admin:    admin@example.com / Admin@123`);
  }
  console.log(`====================================================`);
});
