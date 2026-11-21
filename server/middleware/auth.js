const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/database');

// JWT secret comes exclusively from the environment -- no insecure in-source fallback.
// Fail fast at startup if it is missing, so a server can never run with a default secret.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be configured. Set it in server/.env (development) or the ' +
    'environment (production). Refusing to start without a secret.'
  );
}

function isTokenRevoked(token) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const row = db.prepare('SELECT id FROM revoked_tokens WHERE token_hash = ?').get(tokenHash);
    return !!row;
  } catch (e) {
    return false;
  }
}

function revokeToken(token, expiresAt) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const exp = expiresAt
      ? (typeof expiresAt === 'number' ? new Date(expiresAt * 1000).toISOString() : String(expiresAt))
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO revoked_tokens (token_hash, expires_at)
      VALUES (?, ?)
    `).run(tokenHash, exp);
    return true;
  } catch (e) {
    console.error('Error revoking token:', e.message);
    return false;
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token required' });
  }

  if (isTokenRevoked(token)) {
    return res.status(401).json({ success: false, error: 'Session has been revoked. Please sign in again.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = decoded;
    req.token = token;
    next();
  });
}

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({ success: false, error: `Access denied. ${requiredRole} access required.` });
    }
    next();
  };
}

const ADMIN_ROLES = [
  'super_admin',
  'finance_admin',
  'support_admin',
  'operations_admin'
];

const ADMIN_PERMISSIONS = [
  'dashboard:view',
  'customers:view',
  'customers:manage',
  'merchants:view',
  'merchants:manage',
  'categories:view',
  'categories:manage',
  'coins:view',
  'coins:adjust',
  'offers:view',
  'offers:manage',
  'orders:view',
  'orders:manage',
  'payments:view',
  'payments:manage',
  'referrals:view',
  'referrals:manage',
  'memberships:view',
  'memberships:manage',
  'notifications:view',
  'notifications:send',
  'advertisements:view',
  'advertisements:manage',
  'support:view',
  'support:manage',
  'reports:view',
  'security:view',
  'security:manage',
  'admins:manage'
];

const ADMIN_PERMISSION_SET = new Set(ADMIN_PERMISSIONS);

const DEFAULT_ADMIN_PERMISSIONS_BY_ROLE = {
  super_admin: ['*'],
  operations_admin: ['dashboard:view', 'merchants:view', 'customers:view'],
  finance_admin: ['dashboard:view', 'coins:view', 'payments:view', 'reports:view'],
  support_admin: ['dashboard:view', 'customers:view', 'support:view', 'orders:view']
};

/**
 * Validates caller-supplied admin permissions strictly against ADMIN_PERMISSIONS.
 * Never permits wildcard ('*') permissions for non-super_admin roles.
 */
function validateAdminPermissions(rawPermissions, { isSuperAdmin = false } = {}) {
  if (!Array.isArray(rawPermissions)) {
    return { ok: false, error: 'Permissions must be an array of valid permission strings.' };
  }

  const normalized = [];
  const seen = new Set();

  for (const item of rawPermissions) {
    if (typeof item !== 'string' || !item.trim()) {
      return { ok: false, error: 'Each permission must be a non-empty string.' };
    }
    const perm = item.trim();

    if (perm === '*') {
      if (!isSuperAdmin) {
        return { ok: false, error: 'Wildcard (*) permission can only be assigned to super_admin accounts.' };
      }
      if (!seen.has('*')) {
        seen.add('*');
        normalized.push('*');
      }
      continue;
    }

    if (!ADMIN_PERMISSION_SET.has(perm)) {
      return { ok: false, error: `Invalid or unsupported permission: "${perm}".` };
    }

    if (!seen.has(perm)) {
      seen.add(perm);
      normalized.push(perm);
    }
  }

  if (normalized.length === 0) {
    return { ok: false, error: 'At least one valid granular permission must be assigned.' };
  }

  if (isSuperAdmin && normalized.includes('*') && normalized.length > 1) {
    return { ok: true, permissions: ['*'] };
  }

  return { ok: true, permissions: normalized };
}

/**
 * Safely parses stored admin permissions.
 * Only super_admin receives wildcard ['*']. Non-superadmin accounts never
 * honor stored '*' or unrecognized permissions (even on malformed JSON).
 */
function sanitizeStoredAdminPermissions(adminRole, rawPermissions) {
  if (adminRole === 'super_admin') {
    return ['*'];
  }

  let parsed = [];
  try {
    parsed = typeof rawPermissions === 'string'
      ? JSON.parse(rawPermissions)
      : (Array.isArray(rawPermissions) ? rawPermissions : []);
  } catch (e) {
    parsed = [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const clean = [];
  const seen = new Set();
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    const perm = item.trim();
    if (perm === '*' || !ADMIN_PERMISSION_SET.has(perm) || seen.has(perm)) {
      continue;
    }
    seen.add(perm);
    clean.push(perm);
  }
  return clean;
}

/**
 * Verifies live active admin record on every /api/admin/* request so
 * deactivated or suspended admins cannot reuse an unexpired JWT.
 */
function requireActiveAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied. Admin access required.' });
  }

  try {
    const admin = db.prepare('SELECT id, full_name, email, role, permissions, status FROM admins WHERE id = ?').get(req.user.id);
    if (!admin || admin.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Admin account is inactive or suspended.' });
    }

    req.admin = admin;
    req.adminPermissions = sanitizeStoredAdminPermissions(admin.role, admin.permissions);
    return next();
  } catch (e) {
    console.error('Admin verification error:', e.message);
    return res.status(500).json({ success: false, error: 'Failed to verify admin account.' });
  }
}

function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin access required.' });
    }

    try {
      const admin = req.admin || db.prepare('SELECT id, full_name, email, role, permissions, status FROM admins WHERE id = ?').get(req.user.id);
      if (!admin || admin.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Admin account is inactive or suspended.' });
      }

      req.admin = admin;
      const perms = req.adminPermissions || sanitizeStoredAdminPermissions(admin.role, admin.permissions);
      req.adminPermissions = perms;

      // Only genuine super_admin role has unrestricted access
      if (admin.role === 'super_admin') {
        return next();
      }

      if (perms.includes(requiredPermission)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: `Permission denied. You do not have the required permission: "${requiredPermission}".`
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Failed to verify admin permissions.' });
    }
  };
}

function requireCompletedProfile(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication token required' });
  }

  if (req.user.role === 'customer') {
    const user = db.prepare('SELECT profile_completed, phone, status FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'User unavailable or suspended' });
    }

    const isComplete = Boolean((user.profile_completed || user.phone) && user.phone);
    if (!isComplete) {
      return res.status(403).json({
        success: false,
        error: 'Please complete your profile to access customer services.',
        code: 'PROFILE_INCOMPLETE'
      });
    }
  }

  next();
}

/**
 * Authorizes active + approved shop merchants against live database state.
 * Enforced on every protected /api/shop/* and /api/merchant/* operation so
 * pending, rejected, inactive, or later-suspended merchants are always blocked
 * even if they still hold an older unexpired JWT.
 */
function requireApprovedMerchant(req, res, next) {
  if (!req.user || req.user.role !== 'shop') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Approved merchant access required.'
    });
  }

  try {
    const shopId = req.user.shop_id || req.user.id;
    const shop = db.prepare(`
      SELECT id, shop_code, name, email, status, verification_status, rejection_reason
      FROM shops
      WHERE id = ?
    `).get(shopId);

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Merchant account not found.' });
    }

    if (shop.status === 'suspended' || shop.verification_status === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'MERCHANT_SUSPENDED',
        error: 'Merchant account has been suspended by administration.'
      });
    }

    if (shop.verification_status === 'rejected' || shop.status === 'rejected') {
      return res.status(403).json({
        success: false,
        code: 'MERCHANT_REJECTED',
        rejection_reason: shop.rejection_reason || null,
        error: 'Merchant application was rejected and cannot access merchant operations.'
      });
    }

    if (shop.status === 'inactive' || shop.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        code: 'MERCHANT_INACTIVE',
        error: 'Merchant account is deactivated. Please contact administrator.'
      });
    }

    if (shop.status !== 'active' || shop.verification_status !== 'approved') {
      return res.status(403).json({
        success: false,
        code: 'MERCHANT_PENDING',
        error: 'Merchant account is pending administrator approval.'
      });
    }

    req.merchantShop = shop;
    return next();
  } catch (err) {
    console.error('Merchant approval check error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to verify merchant account status.' });
  }
}

/**
 * Authorizes a merchant onboarding token (or active shop) strictly for explicit
 * self-registration follow-up actions (reading onboarding status and attaching
 * initial registration photos while pending). Never permits operational access.
 */
function requireMerchantOnboarding(req, res, next) {
  if (!req.user || (req.user.role !== 'merchant_onboarding' && req.user.role !== 'shop')) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Merchant onboarding authentication required.'
    });
  }

  try {
    const shopId = req.user.shop_id || req.user.id;
    const shop = db.prepare(`
      SELECT id, shop_code, name, owner_name, email, phone, category, subcategory,
             status, verification_status, rejection_reason, logo_url, cover_photo_url
      FROM shops
      WHERE id = ?
    `).get(shopId);

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Merchant application not found.' });
    }

    if (
      shop.status === 'suspended' ||
      shop.verification_status === 'suspended' ||
      shop.status === 'inactive' ||
      shop.status === 'deactivated'
    ) {
      return res.status(403).json({
        success: false,
        code: 'MERCHANT_UNAVAILABLE',
        error: 'Merchant account is inactive or suspended.'
      });
    }

    req.merchantShop = shop;
    return next();
  } catch (err) {
    console.error('Merchant onboarding check error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to verify merchant onboarding status.' });
  }
}

module.exports = {
  ADMIN_ROLES,
  ADMIN_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS_BY_ROLE,
  validateAdminPermissions,
  sanitizeStoredAdminPermissions,
  authenticateToken,
  requireRole,
  requireActiveAdmin,
  requirePermission,
  requireCompletedProfile,
  requireApprovedMerchant,
  requireMerchantOnboarding,
  revokeToken,
  isTokenRevoked,
  JWT_SECRET
};
