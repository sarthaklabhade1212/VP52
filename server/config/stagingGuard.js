/**
 * VP52 Staging Environment Isolation Guard
 *
 * Enforces strict boundaries between staging and production.
 * Throws an immediate fatal exception on startup if any production state,
 * production host, production database path, or production JWT secret is detected.
 */

const path = require('path');
const fs = require('fs');

const FORBIDDEN_PRODUCTION_DOMAINS = [
  'api.vp52coin.com',
  'vp52coin.com',
  'www.vp52coin.com'
];

const FORBIDDEN_PRODUCTION_PATHS = [
  '/var/www/vp52',
  '/var/www/vp52/server',
  '/var/www/vp52/server/db/rewards.db'
];

function validateStagingEnvironment(customEnv = process.env) {
  const nodeEnv = (customEnv.NODE_ENV || '').toLowerCase().trim();
  const violations = [];

  if (nodeEnv === 'production') {
    violations.push('NODE_ENV cannot be "production" in a staging environment.');
  }

  // Check database path
  const dbPath = customEnv.DATABASE_PATH || customEnv.VP52_DB_FILE_OVERRIDE || '';
  for (const forbidden of FORBIDDEN_PRODUCTION_PATHS) {
    if (dbPath && dbPath.includes(forbidden)) {
      violations.push(`DATABASE_PATH contains forbidden production path: ${forbidden}`);
    }
  }

  // Ensure staging does not use the canonical local production-baseline rewards.db
  if (dbPath) {
    try {
      const canonicalLocalPath = path.resolve(__dirname, '..', 'db', 'rewards.db');
      if (fs.existsSync(dbPath) && fs.existsSync(canonicalLocalPath)) {
        if (fs.realpathSync(dbPath) === fs.realpathSync(canonicalLocalPath)) {
          violations.push('DATABASE_PATH targets the canonical workspace database server/db/rewards.db! Staging must use an isolated database file.');
        }
      }
    } catch (_) {}
  }

  // Check API URLs and callback URLs
  const apiUrl = customEnv.API_URL || customEnv.VITE_API_URL || '';
  const callbackUrl = customEnv.ADMOB_SSV_CALLBACK_URL || '';

  for (const domain of FORBIDDEN_PRODUCTION_DOMAINS) {
    if (apiUrl.includes(domain)) {
      violations.push(`API_URL targets production domain: ${domain}`);
    }
    if (callbackUrl.includes(domain)) {
      violations.push(`ADMOB_SSV_CALLBACK_URL targets production domain: ${domain}`);
    }
  }

  // Check upload directory
  const uploadDir = customEnv.UPLOAD_DIR || '';
  for (const forbidden of FORBIDDEN_PRODUCTION_PATHS) {
    if (uploadDir && uploadDir.includes(forbidden)) {
      violations.push(`UPLOAD_DIR contains forbidden production path: ${forbidden}`);
    }
  }

  // Check JWT secret
  const jwtSecret = customEnv.JWT_SECRET || '';
  if (!jwtSecret || jwtSecret.length < 32) {
    violations.push('JWT_SECRET must be at least 32 characters long in staging.');
  }

  if (violations.length > 0) {
    const errorMsg = `[FATAL] Staging Environment Isolation Guard triggered with ${violations.length} violation(s):\n  - ` + violations.join('\n  - ');
    throw new Error(errorMsg);
  }

  return {
    valid: true,
    nodeEnv,
    dbPath: dbPath || '[isolated staging db]',
    apiUrl: apiUrl || '[local staging api]'
  };
}

module.exports = {
  validateStagingEnvironment,
  FORBIDDEN_PRODUCTION_DOMAINS,
  FORBIDDEN_PRODUCTION_PATHS
};
