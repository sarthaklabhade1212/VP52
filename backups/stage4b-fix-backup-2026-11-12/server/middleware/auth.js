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

function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin access required.' });
    }

    try {
      const admin = db.prepare('SELECT id, full_name, email, role, permissions, status FROM admins WHERE id = ?').get(req.user.id);
      if (!admin || admin.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Admin account is inactive or suspended.' });
      }

      req.admin = admin;

      // Super Admin has unrestricted access to all modules and actions
      if (admin.role === 'super_admin') {
        return next();
      }

      let perms = [];
      try {
        perms = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || []);
      } catch (e) {
        perms = [];
      }

      if (perms.includes('*') || perms.includes(requiredPermission)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: `Permission denied. You do not have the required permission: "${requiredPermission}".`
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
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

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireCompletedProfile,
  revokeToken,
  isTokenRevoked,
  JWT_SECRET
};
