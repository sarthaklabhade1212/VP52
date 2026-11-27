const fs = require('fs');
const path = require('path');
const dotenvPath = process.env.DOTENV_PATH || (process.env.NODE_ENV === 'staging' ? path.join(__dirname, '.env.staging') : path.join(__dirname, '.env'));
require('dotenv').config({
  path: dotenvPath
});

if (process.env.NODE_ENV === 'staging') {
  const { validateStagingEnvironment } = require('./config/stagingGuard');
  validateStagingEnvironment();
}

const express = require('express');
const cors = require('cors');

const db = require('./db/database');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const merchantRoutes = require('./routes/merchant');
const uploadRoutes = require('./routes/upload');
const admobRoutes = require('./routes/admob');
const { logGoogleOAuthStartupDiagnostics } = require('./utils/googleOAuth');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust local reverse proxy (Nginx on 127.0.0.1 / ::1) for accurate req.ip without
// blindly trusting client-spoofed X-Forwarded-For headers from untrusted peers.
const trustProxySetting = process.env.TRUST_PROXY || 'loopback';
app.set('trust proxy', trustProxySetting);

// ============================================================
// Environment / configuration
// ============================================================

const isProduction = process.env.NODE_ENV === 'production';
const seedDemoData = process.env.SEED_DEMO_DATA === 'true';

// ============================================================
// Middleware
// ============================================================

// Enable CORS for Vite frontend
app.use(cors());

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static uploads directory
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, 'public', 'uploads');
app.use('/uploads', express.static(uploadDir));

// ============================================================
// API Routes
// ============================================================

app.use('/api/auth', authRoutes);
// Public AdMob SSV callback alias mounted before customer bearer auth
app.use('/api/customer/admob-ssv', admobRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admob', admobRoutes);

// ============================================================
// Health check endpoint
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Customer Rewards API Server is running',
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// Development demo seeding
// ============================================================
//
// Demo seeding is ONLY allowed when:
//   - NODE_ENV is not production
//   - SEED_DEMO_DATA=true
//   - database is empty
//
// Production NEVER auto-seeds demo credentials.
//

if (!isProduction && seedDemoData) {
  try {
    const userCount = db
      .prepare('SELECT COUNT(*) as count FROM users')
      .get();

    if (userCount.count === 0) {
      console.log(
        '⚡ [dev] Empty database + SEED_DEMO_DATA=true — running demo seed...'
      );

      require('./db/seed');
    }
  } catch (err) {
    console.error('Database auto-seed check error:', err);
  }
} else if (!isProduction && !seedDemoData) {
  console.log(
    'ℹ️  Demo seeding disabled (set SEED_DEMO_DATA=true in server/.env to enable for local dev).'
  );
}

// ============================================================
// Start server (supports staging HTTPS mode when configured)
// ============================================================

let server;
const stagingCertPath = path.join(__dirname, 'certs', 'staging.crt');
const stagingKeyPath = path.join(__dirname, 'certs', 'staging.key');

if (process.env.STAGING_ENFORCE_HTTPS === 'true' && fs.existsSync(stagingCertPath) && fs.existsSync(stagingKeyPath)) {
  const https = require('https');
  const httpsOptions = {
    key: fs.readFileSync(stagingKeyPath),
    cert: fs.readFileSync(stagingCertPath)
  };
  server = https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`🔒 Rewards App Staging HTTPS API Server running on port ${PORT}`);
    console.log('====================================================');
  });
} else {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`🚀 Rewards App API Server running on port ${PORT}`);
    logGoogleOAuthStartupDiagnostics();

    // Never print credentials in production.
    // Only show development demo accounts when explicitly enabled.
    if (!isProduction && seedDemoData) {
      console.log(
        '👉 [dev] Customer: customer@example.com / Customer@123'
      );
      console.log(
        '👉 [dev] Shop:     shop@example.com / Shop@123'
      );
      console.log(
        '👉 [dev] Admin:    admin@example.com / Admin@123'
      );
    }

    console.log('====================================================');
  });
}

// VP52 365-Day Automatic Coin Conversion Engine (Runs every 1 hour)
const { reconcileCoinConversions } = require('./utils/coinConversion');
const conversionInterval = setInterval(() => {
  try {
    reconcileCoinConversions();
  } catch (e) {
    console.error('[coin-conversion] Periodic reconciliation error:', e.message);
  }
}, 60 * 60 * 1000);
if (conversionInterval.unref) conversionInterval.unref();

let isShuttingDown = false;
function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[shutdown] Received ${signal}. Closing HTTP server and SQLite database...`);

  const forceExitTimer = setTimeout(() => {
    try {
      if (db && db.open) db.close();
    } catch (_) {}
    process.exit(0);
  }, 5000);
  if (forceExitTimer.unref) forceExitTimer.unref();

  server.close(() => {
    try {
      if (db && db.open) {
        db.close();
      }
      console.log(`[shutdown] Clean exit after ${signal}.`);
      process.exit(0);
    } catch (err) {
      console.error('[shutdown] Error closing database:', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));