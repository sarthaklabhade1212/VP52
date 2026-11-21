const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, requireRole, requireApprovedMerchant, revokeToken, JWT_SECRET } = require('../middleware/auth');
const { validatePasswordStrength, generateStrongPassword } = require('../utils/password');
const { normalizePhoneNumber } = require('../utils/phone');
const { verifyCustomerGoogleIdToken } = require('../utils/googleOAuth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Precomputed dummy bcrypt hash so invalid/missing merchant lookups take comparable time.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('vp52-timing-normalization-guard', 10);

// Dedicated rate limiters for authentication endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please wait a few minutes before trying again.'
});

const merchantLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many merchant login attempts. Please wait a few minutes before trying again.'
});

const profileLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many profile completion attempts. Please wait a few minutes before trying again.'
});

const resetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: 'Too many password recovery requests. Please wait a few minutes before trying again.'
});

// ============================================================
// Customer Mobile OTP Authentication (REMOVED)
// ------------------------------------------------------------
// Mandatory customer OTP authentication has been removed in favor
// of Google Sign-In and standard credentials. Any calls to these
// deprecated endpoints return an explicit 410 Gone status.
// ============================================================
router.all(['/customer/request-otp', '/customer/verify-otp'], (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Customer mobile OTP authentication has been removed. Please use Continue with Google or Email sign-in.'
  });
});

// 3. Customer Profile Endpoint
router.get('/customer/me', authenticateToken, requireRole('customer'), (req, res) => {
  try {
    const user = db.prepare('SELECT id, full_name, email, phone, status, profile_photo, profile_completed, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'User unavailable or suspended' });
    }
    const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(user.id);
    const isProfileCompleted = Boolean(user.profile_completed && user.phone);
    return res.json({
      success: true,
      user: {
        ...user,
        role: 'customer',
        profile_photo: user.profile_photo || null,
        profile_completed: isProfileCompleted,
        balance: wallet ? wallet.balance : 0,
        total_earned: wallet ? wallet.total_earned : 0,
        total_redeemed: wallet ? wallet.total_redeemed : 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch customer profile' });
  }
});

// 4. Customer Logout & Session Revocation
router.post('/customer/logout', authenticateToken, (req, res) => {
  try {
    if (req.token) {
      revokeToken(req.token, req.user?.exp);
    }
    return res.json({ success: true, message: 'Customer logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to process logout' });
  }
});

// General Logout
router.post('/logout', authenticateToken, (req, res) => {
  try {
    if (req.token) {
      revokeToken(req.token, req.user?.exp);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to process logout' });
  }
});

// Customer Registration (Email + Password with authoritative validation)
router.post('/customer/register', authLimiter, (req, res) => {
  try {
    const { full_name, email, phone, password, confirm_password } = req.body || {};

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required (minimum 2 characters)' });
    }
    if (full_name.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Full name cannot exceed 100 characters' });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Mobile number is required' });
    }
    const phoneResult = normalizePhoneNumber(phone);
    if (!phoneResult.isValid) {
      return res.status(400).json({ success: false, error: phoneResult.error });
    }

    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }
    if (password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password cannot exceed 128 characters' });
    }
    if (confirm_password !== undefined && confirm_password !== null && confirm_password !== password) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check existing email in customer accounts
    const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ success: false, error: 'Email is already registered' });
    }

    // Check existing phone in customer accounts
    const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phoneResult.normalized);
    if (existingPhone) {
      return res.status(409).json({ success: false, error: 'Mobile number is already registered to another account' });
    }

    // Role isolation: prevent registering with admin/shop email or phone
    const adminConflict = db.prepare('SELECT id FROM admins WHERE LOWER(email) = ?').get(cleanEmail);
    const shopConflict = db.prepare('SELECT id FROM shops WHERE LOWER(email) = ? OR phone = ?').get(cleanEmail, phoneResult.normalized);
    if (adminConflict || shopConflict) {
      return res.status(409).json({ success: false, error: 'This email or phone number is associated with a merchant or admin account.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const insertUser = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status, auth_provider, profile_completed)
      VALUES (?, ?, ?, ?, 'active', 'local', 1)
    `);

    const result = insertUser.run(full_name.trim(), cleanEmail, phoneResult.normalized, passwordHash);
    const userId = result.lastInsertRowid;

    // Create wallet for new customer
    db.prepare(`
      INSERT INTO wallets (user_id, balance, total_earned, total_redeemed)
      VALUES (?, 0, 0, 0)
    `).run(userId);

    const token = jwt.sign(
      { id: userId, email: cleanEmail, phone: phoneResult.normalized, role: 'customer', profile_completed: 1 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      profile_completed: true,
      user: {
        id: userId,
        full_name: full_name.trim(),
        email: cleanEmail,
        phone: phoneResult.normalized,
        role: 'customer',
        profile_photo: null,
        profile_completed: true,
        balance: 0
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error during registration' });
  }
});

// Customer Login (Email + Password)
router.post('/customer/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

    // Generic error message to prevent account enumeration
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is suspended. Please contact administrator.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(user.id);
    const isProfileCompleted = Boolean(user.profile_completed && user.phone);

    const token = jwt.sign(
      { id: user.id, email: user.email, phone: user.phone, role: 'customer', profile_completed: isProfileCompleted ? 1 : 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      profile_completed: isProfileCompleted,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: 'customer',
        profile_photo: user.profile_photo || null,
        profile_completed: isProfileCompleted,
        balance: wallet ? wallet.balance : 0,
        total_earned: wallet ? wallet.total_earned : 0,
        total_redeemed: wallet ? wallet.total_redeemed : 0
      }
    });
  } catch (error) {
    console.error('Customer login error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error during login' });
  }
});

// ============================================================
// Customer Google Sign-In (native ID-token flow)
// ------------------------------------------------------------
// The client obtains a Google ID token via @capgo/capacitor-social-login
// (native Credential Manager on Android). We verify that token SERVER-SIDE with
// google-auth-library against GOOGLE_WEB_CLIENT_ID, then issue the SAME customer
// JWT used by email/password login. The email / sub / name are NEVER trusted
// from the client -- only what Google's verified token asserts.
// ============================================================
router.post('/customer/google', authLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const rawIdToken = body.idToken || body.id_token || body.credential;
    const verification = await verifyCustomerGoogleIdToken(rawIdToken);

    if (!verification.ok) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const payload = verification.payload;

    const googleSub = String(payload.sub);
    const email = (payload.email || '').trim().toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const displayName = (payload.name || (email ? email.split('@')[0] : 'Customer')).trim();
    const googlePhoto = (payload.picture && typeof payload.picture === 'string') ? payload.picture.trim() : null;

    // 2) Resolve the customer account (link existing / create new) safely.
    let user = db.prepare('SELECT * FROM users WHERE google_subject_id = ?').get(googleSub);
    let isProfileCompleted = false;

    if (!user) {
      if (!email) {
        console.warn('[CustomerGoogleAuth] Rejected login: reason=missing_email');
        return res.status(400).json({ success: false, error: 'Google account did not provide an email address' });
      }

      const existingCustomer = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);

      if (existingCustomer) {
        // Same email is already a customer account.
        if (existingCustomer.google_subject_id && existingCustomer.google_subject_id !== googleSub) {
          console.warn(`[CustomerGoogleAuth] Rejected login: reason=google_sub_conflict userId=${existingCustomer.id}`);
          return res.status(409).json({ success: false, error: 'This account is already linked to a different Google identity.' });
        }
        if (!emailVerified) {
          console.warn(`[CustomerGoogleAuth] Rejected login: reason=email_not_verified userId=${existingCustomer.id}`);
          return res.status(403).json({ success: false, error: 'Google has not verified this email, so it cannot be linked to your existing account.' });
        }
        if (existingCustomer.status !== 'active') {
          console.warn(`[CustomerGoogleAuth] Rejected login: reason=account_suspended userId=${existingCustomer.id}`);
          return res.status(403).json({ success: false, error: 'Account is suspended. Please contact administrator.' });
        }
        // Safe account-linking: attach the verified Google identity to the customer.
        db.prepare('UPDATE users SET google_subject_id = ?, profile_photo = COALESCE(profile_photo, ?) WHERE id = ?').run(googleSub, googlePhoto, existingCustomer.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(existingCustomer.id);
        isProfileCompleted = Boolean(user.profile_completed && user.phone);
      } else {
        // No customer with this email. NEVER convert an admin or merchant account.
        const adminConflict = db.prepare('SELECT id FROM admins WHERE LOWER(email) = ?').get(email);
        const shopConflict = db.prepare('SELECT id FROM shops WHERE LOWER(email) = ?').get(email);
        if (adminConflict || shopConflict) {
          console.warn('[CustomerGoogleAuth] Rejected login: reason=role_conflict');
          return res.status(409).json({ success: false, error: 'This email is registered to a merchant or admin account and cannot be used for customer Google sign-in.' });
        }
        if (!emailVerified) {
          console.warn('[CustomerGoogleAuth] Rejected login: reason=email_not_verified_new');
          return res.status(403).json({ success: false, error: 'Google has not verified this email address.' });
        }
        // Create a new Google customer. profile_completed is initially 0;
        // phone is NULL until the Complete Profile step is performed.
        const randomSecret = crypto.randomBytes(32).toString('hex');
        const passwordHash = bcrypt.hashSync(randomSecret, 10);
        let userId;
        try {
          const result = db.prepare(`
            INSERT INTO users (full_name, email, phone, password_hash, status, google_subject_id, auth_provider, profile_completed, profile_photo)
            VALUES (?, ?, NULL, ?, 'active', ?, 'google', 0, ?)
          `).run(displayName, email, passwordHash, googleSub, googlePhoto);
          userId = result.lastInsertRowid;
        } catch (e) {
          console.warn('[CustomerGoogleAuth] Rejected login: reason=insert_conflict');
          // Unique-index race (duplicate google_subject_id / email) -> reject safely.
          return res.status(409).json({ success: false, error: 'Google account could not be registered (already in use).' });
        }
        db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        isProfileCompleted = false;
      }
    } else {
      // Found directly by Google identity -> check active status and profile completion
      if (user.status !== 'active') {
        console.warn(`[CustomerGoogleAuth] Rejected login: reason=account_suspended userId=${user.id}`);
        return res.status(403).json({ success: false, error: 'Account is suspended. Please contact administrator.' });
      }
      if (!user.profile_photo && googlePhoto) {
        db.prepare('UPDATE users SET profile_photo = ? WHERE id = ?').run(googlePhoto, user.id);
        user.profile_photo = googlePhoto;
      }
      isProfileCompleted = Boolean(user.profile_completed && user.phone);
    }

    // 3) Issue customer JWT + user shape
    const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(user.id);
    const token = jwt.sign(
      { id: user.id, email: user.email, phone: user.phone, role: 'customer', profile_completed: isProfileCompleted ? 1 : 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: isProfileCompleted ? 'Google login successful' : 'Please complete your profile to finish registration',
      token,
      profile_completed: isProfileCompleted,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: 'customer',
        profile_photo: user.profile_photo || googlePhoto || null,
        profile_completed: isProfileCompleted,
        balance: wallet ? wallet.balance : 0,
        total_earned: wallet ? wallet.total_earned : 0,
        total_redeemed: wallet ? wallet.total_redeemed : 0
      }
    });
  } catch (error) {
    console.error('Google customer login error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error during Google sign-in' });
  }
});

// ============================================================
// Customer Complete Profile (Required after first-time Google sign-in)
// ------------------------------------------------------------
// Validates Full Name, Mobile Number, and sets up Customer Password.
// Prevents duplicate mobile numbers across customers, hashes the password
// securely, and marks profile_completed = 1 before unlocking customer services.
// ============================================================
router.post('/customer/complete-profile', authenticateToken, requireRole('customer'), profileLimiter, (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, mobile_number, password, confirm_password } = req.body || {};

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Customer account unavailable or suspended' });
    }

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required (minimum 2 characters)' });
    }
    if (full_name.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Full name cannot exceed 100 characters' });
    }

    if (!mobile_number) {
      return res.status(400).json({ success: false, error: 'Mobile number is required' });
    }
    const phoneResult = normalizePhoneNumber(mobile_number);
    if (!phoneResult.isValid) {
      return res.status(400).json({ success: false, error: phoneResult.error });
    }

    // Uniqueness check: mobile number must not belong to another customer
    const phoneConflict = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phoneResult.normalized, userId);
    if (phoneConflict) {
      return res.status(409).json({ success: false, error: 'Mobile number is already registered to another account' });
    }

    // Uniqueness check: mobile number must not belong to a merchant
    const shopPhoneConflict = db.prepare('SELECT id FROM shops WHERE phone = ?').get(phoneResult.normalized);
    if (shopPhoneConflict) {
      return res.status(409).json({ success: false, error: 'This mobile number is registered to a merchant account' });
    }

    if (!password || !confirm_password) {
      return res.status(400).json({ success: false, error: 'Password and confirm password are required' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }
    if (password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password cannot exceed 128 characters' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
      UPDATE users
      SET full_name = ?,
          phone = ?,
          password_hash = ?,
          profile_completed = 1
      WHERE id = ?
    `).run(full_name.trim(), phoneResult.normalized, passwordHash, userId);

    const updatedUser = db.prepare('SELECT id, full_name, email, phone, status, profile_photo, profile_completed, created_at FROM users WHERE id = ?').get(userId);
    const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(userId);

    // Issue updated token reflecting profile_completed: 1
    const token = jwt.sign(
      { id: updatedUser.id, email: updatedUser.email, phone: updatedUser.phone, role: 'customer', profile_completed: 1 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Profile completed successfully',
      token,
      profile_completed: true,
      user: {
        id: updatedUser.id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: 'customer',
        profile_photo: updatedUser.profile_photo || null,
        profile_completed: true,
        balance: wallet ? wallet.balance : 0,
        total_earned: wallet ? wallet.total_earned : 0,
        total_redeemed: wallet ? wallet.total_redeemed : 0
      }
    });
  } catch (error) {
    console.error('Complete profile error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to complete profile' });
  }
});

// ============================================================
// Customer Password Recovery (Secure token-based flow)
// ------------------------------------------------------------
// POST /customer/forgot-password: Initiates recovery. Uses a generic message
// to prevent email enumeration. In dev mode, returns the token for verification.
// POST /customer/reset-password: Validates hashed single-use token and updates password.
// ============================================================
router.post('/customer/forgot-password', resetLimiter, (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const genericMsg = 'If an account exists with this email, password reset instructions have been initiated.';

    const user = db.prepare('SELECT id, email, status FROM users WHERE LOWER(email) = ?').get(cleanEmail);

    let devResetToken = null;
    if (user && user.status === 'active') {
      // Invalidate any active unused reset tokens for this user
      db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(user.id);

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `).run(user.id, tokenHash, expiresAt);

      if (process.env.NODE_ENV !== 'production') {
        devResetToken = rawToken;
      }
    }

    const responseBody = {
      success: true,
      message: genericMsg
    };
    if (devResetToken) {
      responseBody.dev_reset_token = devResetToken;
    }

    return res.json(responseBody);
  } catch (error) {
    console.error('Forgot password error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to process password recovery request' });
  }
});

router.post('/customer/reset-password', resetLimiter, (req, res) => {
  try {
    const { token, password, confirm_password } = req.body || {};

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ success: false, error: 'Password reset token is required' });
    }

    if (!password || !confirm_password) {
      return res.status(400).json({ success: false, error: 'Password and confirm password are required' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }
    if (password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password cannot exceed 128 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const record = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL').get(tokenHash);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired password reset link. Please request a new one.' });
    }

    const now = new Date().getTime();
    const expiresAt = new Date(record.expires_at).getTime();
    if (now > expiresAt) {
      return res.status(400).json({ success: false, error: 'Password reset link has expired. Please request a new one.' });
    }

    const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(record.user_id);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'User account is unavailable or suspended' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
    db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(record.id);

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// Admin Login
router.post('/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.trim().toLowerCase());

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }

    const passwordMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    db.prepare("UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(admin.id);

    let parsedPerms = ['*'];
    try {
      parsedPerms = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || ['*']);
    } catch (e) {
      parsedPerms = ['*'];
    }

    return res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: 'admin',
        admin_role: admin.role || 'super_admin',
        permissions: parsedPerms
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during admin login' });
  }
});

// Shop / Merchant Login (Email or Mobile Number + Password ONLY)
router.post('/shop/login', merchantLoginLimiter, (req, res) => {
  try {
    const body = req.body || {};
    const rawIdentifier =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim()
        : (typeof body.identifier === 'string' && body.identifier.trim()
            ? body.identifier.trim()
            : (typeof body.mobile === 'string' && body.mobile.trim() ? body.mobile.trim() : ''));
    const password = body.password;

    if (!rawIdentifier || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, error: 'Shop email or mobile number and password are required' });
    }

    const cleanLower = rawIdentifier.toLowerCase();
    let shop = db.prepare('SELECT * FROM shops WHERE LOWER(email) = ? OR phone = ?').get(cleanLower, rawIdentifier);

    if (!shop && !rawIdentifier.includes('@')) {
      const normalized = normalizePhoneNumber(rawIdentifier);
      if (normalized.isValid) {
        const compactE164 = normalized.normalized;
        const national = normalized.nationalNumber || '';
        shop = db.prepare(`
          SELECT * FROM shops
          WHERE phone = ?
             OR phone = ?
             OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '(', ''), ')', '') = ?
             OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '(', ''), ')', '') = ?
        `).get(compactE164, national, compactE164, national);
      }
    }

    // Verify password BEFORE revealing account status (prevents account/status enumeration).
    const candidateHash = shop && shop.password_hash ? shop.password_hash : DUMMY_PASSWORD_HASH;
    const passwordMatch = bcrypt.compareSync(password, candidateHash);

    if (!shop || !shop.password_hash || !passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid merchant login credentials' });
    }

    if (shop.status === 'suspended' || shop.verification_status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Your merchant account has been suspended by the administrator.' });
    }

    if (shop.status === 'inactive' || shop.status === 'deactivated') {
      return res.status(403).json({ success: false, error: 'Your merchant account is deactivated. Please contact administrator.' });
    }

    if (shop.verification_status === 'rejected' || shop.status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: shop.rejection_reason
          ? `Merchant application was rejected: ${shop.rejection_reason}`
          : 'Merchant application was rejected by the administrator.'
      });
    }

    if (shop.status !== 'active' || shop.verification_status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'Merchant account is pending administrator approval.'
      });
    }

    const token = jwt.sign(
      { id: shop.id, shop_id: shop.id, shop_code: shop.shop_code, email: shop.email, role: 'shop' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Shop Merchant login successful',
      token,
      user: {
        id: shop.id,
        shop_id: shop.id,
        shop_code: shop.shop_code || `SHOP-00${shop.id}`,
        full_name: shop.name,
        shop_name: shop.name,
        owner_name: shop.owner_name,
        email: shop.email,
        phone: shop.phone,
        address: shop.address,
        category: shop.category,
        status: shop.status,
        verification_status: shop.verification_status,
        role: 'shop',
        must_change_password: shop.must_change_password ? 1 : 0
      }
    });
  } catch (error) {
    console.error('Shop login error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error during shop login' });
  }
});

// Merchant Mobile OTP Authentication (PERMANENTLY REMOVED)
// Legacy OTP endpoints return 410 Gone and never issue sessions or accept OTP codes.
router.all(['/shop/login-mobile', '/send-otp', '/verify-otp'], (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Merchant OTP authentication has been removed. Please sign in with your registered email or mobile number and password.'
  });
});

// Merchant self-registration is PERMANENTLY DISABLED for unauthenticated direct POST.
// Legacy test suite requires 410 Gone for direct unverified registration.
router.post('/merchant/register', (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Merchant accounts are created by VP52 administrators.'
  });
});

// Merchant Google Sign-In & Self-Registration Flow
router.post('/merchant/google', authLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const rawIdToken = body.idToken || body.id_token || body.credential;
    const verification = await verifyCustomerGoogleIdToken(rawIdToken);

    if (!verification.ok) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const payload = verification.payload;
    const googleSub = String(payload.sub);
    const rawEmail = (payload.email || '').trim().toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const googleName = (payload.name || (rawEmail ? rawEmail.split('@')[0] : 'Merchant')).trim();

    if (!rawEmail) {
      return res.status(400).json({
        success: false,
        error: 'Google account did not provide an email address'
      });
    }

    // 1. Check if a merchant account already exists for this Google identity or email
    let shop = db.prepare('SELECT * FROM shops WHERE google_id = ?').get(googleSub);
    if (!shop) {
      const shopByEmail = db.prepare('SELECT * FROM shops WHERE LOWER(email) = ?').get(rawEmail);
      if (shopByEmail) {
        if (shopByEmail.google_id && shopByEmail.google_id !== googleSub) {
          return res.status(409).json({
            success: false,
            error: 'This merchant account is already linked to a different Google identity.'
          });
        }
        if (!emailVerified) {
          return res.status(403).json({
            success: false,
            error: 'Google has not verified this email, so it cannot be linked to your existing merchant account.'
          });
        }
        db.prepare('UPDATE shops SET google_id = ? WHERE id = ?').run(googleSub, shopByEmail.id);
        shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopByEmail.id);
      }
    }

    if (shop) {
      if (shop.status === 'suspended' || shop.verification_status === 'suspended') {
        return res.status(403).json({ success: false, error: 'Merchant account has been suspended by administration.' });
      }
      if (shop.status === 'inactive' || shop.status === 'deactivated') {
        return res.status(403).json({ success: false, error: 'Merchant account is deactivated. Please contact administrator.' });
      }
      if (shop.status === 'rejected' || shop.verification_status === 'rejected') {
        return res.status(403).json({
          success: false,
          code: 'MERCHANT_REJECTED',
          rejection_reason: shop.rejection_reason || null,
          error: shop.rejection_reason
            ? `Merchant application was rejected: ${shop.rejection_reason}`
            : 'Merchant application was rejected by administrator.'
        });
      }
      if (shop.status !== 'active' || shop.verification_status !== 'approved') {
        return res.status(403).json({
          success: false,
          code: 'MERCHANT_PENDING',
          error: 'Merchant application is already submitted and pending administrator approval.',
          shop: {
            id: shop.id,
            shop_code: shop.shop_code || `SHOP-00${shop.id}`,
            shop_name: shop.name,
            status: shop.status,
            verification_status: shop.verification_status
          }
        });
      }

      const token = jwt.sign(
        { id: shop.id, shop_id: shop.id, email: shop.email, role: 'shop', status: shop.status, verification_status: shop.verification_status },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Merchant Google login successful',
        token,
        user: {
          id: shop.id,
          shop_id: shop.id,
          shop_code: shop.shop_code || `SHOP-00${shop.id}`,
          full_name: shop.name,
          shop_name: shop.name,
          owner_name: shop.owner_name,
          email: shop.email,
          phone: shop.phone,
          status: shop.status,
          verification_status: shop.verification_status,
          category: shop.category,
          subcategory: shop.subcategory,
          role: 'shop',
          must_change_password: 0
        }
      });
    }

    // 2. New merchant Google onboarding — require verified email and role isolation
    if (!emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Google has not verified this email address.'
      });
    }

    const customerConflict = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(rawEmail);
    const adminConflict = db.prepare('SELECT id FROM admins WHERE LOWER(email) = ?').get(rawEmail);
    if (customerConflict || adminConflict) {
      return res.status(409).json({
        success: false,
        error: 'This email is already registered to a customer or admin account and cannot be used for merchant onboarding.'
      });
    }

    const {
      complete_onboarding,
      name, owner_name, phone, whatsapp_number, category, subcategory, description,
      address, area_locality, city, district, state, pincode,
      latitude, longitude, opening_time, closing_time, logo_url, cover_photo_url
    } = body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanOwner = typeof owner_name === 'string' && owner_name.trim() ? owner_name.trim() : googleName;
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanAddress = typeof address === 'string' ? address.trim() : '';
    const hasCompleteOnboarding = Boolean(cleanName && cleanOwner && cleanPhone && cleanAddress);

    // Initial Google Sign-In tap: return prefill details without creating an incomplete shop record
    if (!hasCompleteOnboarding) {
      if (complete_onboarding) {
        return res.status(400).json({
          success: false,
          error: 'Shop name, owner name, mobile number, and address are required'
        });
      }
      return res.json({
        success: true,
        onboardingRequired: true,
        prefill: {
          name: googleName,
          email: rawEmail
        }
      });
    }

    const existingPhoneShop = db.prepare("SELECT id FROM shops WHERE phone = ? AND phone != ''").get(cleanPhone);
    if (existingPhoneShop) {
      return res.status(409).json({
        success: false,
        error: 'A merchant account with this mobile number already exists'
      });
    }

    let maxIdRow = db.prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM shops').get();
    let nextId = (maxIdRow ? maxIdRow.max_id : 0) + 1;
    let shopCode = `SHOP-00${nextId}`;
    while (db.prepare('SELECT id FROM shops WHERE shop_code = ?').get(shopCode)) {
      nextId += 1;
      shopCode = `SHOP-00${nextId}`;
    }

    const rawTempPassword = generateStrongPassword(16);
    const passwordHash = bcrypt.hashSync(rawTempPassword, 10);

    const lat = Number(latitude) || 18.5204;
    const lng = Number(longitude) || 73.8567;
    const cleanLogo = typeof logo_url === 'string' && logo_url.trim() ? logo_url.trim() : null;
    const cleanCover = typeof cover_photo_url === 'string' && cover_photo_url.trim() ? cover_photo_url.trim() : null;

    const result = db.prepare(`
      INSERT INTO shops (
        shop_code, email, password_hash, name, category, subcategory, description,
        address, area_locality, city, district, state, pincode,
        phone, whatsapp_number, opening_time, closing_time,
        image_url, logo_url, cover_photo_url,
        status, verification_status, owner_name, latitude, longitude,
        auth_provider, google_id, must_change_password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, 'google', ?, 0)
    `).run(
      shopCode,
      rawEmail,
      passwordHash,
      cleanName,
      category && typeof category === 'string' ? category.trim() : 'Retail',
      subcategory && typeof subcategory === 'string' ? subcategory.trim() : null,
      description && typeof description === 'string' && description.trim()
        ? description.trim()
        : `Registered via Google by ${cleanOwner}`,
      cleanAddress,
      area_locality || null,
      city || null,
      district || null,
      state || null,
      pincode || null,
      cleanPhone,
      whatsapp_number || null,
      opening_time || '09:00',
      closing_time || '21:00',
      cleanCover || cleanLogo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      cleanLogo,
      cleanCover,
      cleanOwner,
      lat,
      lng,
      googleSub
    );

    const newShopId = result.lastInsertRowid;
    const permanentQr = 'VP52-MCH-' + crypto.randomBytes(10).toString('hex').toUpperCase();
    db.prepare("UPDATE shops SET permanent_qr_code = ?, qr_status = 'pending', qr_generated_at = NULL WHERE id = ?").run(permanentQr, newShopId);
    db.prepare('INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(newShopId);
    const newShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(newShopId);

    // Narrow onboarding-only token (valid ONLY for onboarding status/photo upload, never active merchant APIs)
    const token = jwt.sign(
      {
        id: newShop.id,
        shop_id: newShop.id,
        shop_code: newShop.shop_code,
        email: newShop.email,
        role: 'merchant_onboarding',
        scope: 'onboarding'
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.status(201).json({
      success: true,
      message: 'Merchant application registered successfully and submitted for admin review.',
      token,
      user: {
        id: newShop.id,
        shop_id: newShop.id,
        shop_code: newShop.shop_code,
        full_name: newShop.name,
        shop_name: newShop.name,
        owner_name: newShop.owner_name,
        email: newShop.email,
        phone: newShop.phone,
        status: 'pending',
        verification_status: 'pending',
        category: newShop.category,
        subcategory: newShop.subcategory,
        role: 'merchant_onboarding',
        must_change_password: 0
      }
    });
  } catch (error) {
    console.error('Merchant Google auth error:', error);
    return res.status(500).json({ success: false, error: 'Merchant Google authentication failed' });
  }
});

// Merchant Email/Password Self-Registration
router.post('/merchant/self-register', authLimiter, async (req, res) => {
  try {
    const {
      name, owner_name, email, password, phone, whatsapp_number,
      category, subcategory, description,
      address, area_locality, city, district, state, pincode,
      latitude, longitude, opening_time, closing_time, logo_url, cover_photo_url
    } = req.body || {};

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanOwner = typeof owner_name === 'string' ? owner_name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanAddress = typeof address === 'string' ? address.trim() : '';

    if (!cleanName || !cleanOwner || !cleanEmail || !password || !cleanPhone || !cleanAddress) {
      return res.status(400).json({
        success: false,
        error: 'Shop name, owner name, email, password, mobile number, and address are required'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    const existing = db.prepare('SELECT id FROM shops WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, error: 'A merchant account with this email already exists' });
    }

    const customerConflict = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    const adminConflict = db.prepare('SELECT id FROM admins WHERE LOWER(email) = ?').get(cleanEmail);
    if (customerConflict || adminConflict) {
      return res.status(409).json({
        success: false,
        error: 'This email is already registered to a customer or admin account and cannot be used for merchant registration.'
      });
    }

    const existingPhone = db.prepare("SELECT id FROM shops WHERE phone = ? AND phone != ''").get(cleanPhone);
    if (existingPhone) {
      return res.status(409).json({ success: false, error: 'A merchant account with this mobile number already exists' });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.ok) {
      return res.status(400).json({ success: false, error: strength.error });
    }

    let maxIdRow = db.prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM shops').get();
    let nextId = (maxIdRow ? maxIdRow.max_id : 0) + 1;
    let shopCode = `SHOP-00${nextId}`;
    while (db.prepare('SELECT id FROM shops WHERE shop_code = ?').get(shopCode)) {
      nextId += 1;
      shopCode = `SHOP-00${nextId}`;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const lat = Number(latitude) || 18.5204;
    const lng = Number(longitude) || 73.8567;
    const cleanLogo = typeof logo_url === 'string' && logo_url.trim() ? logo_url.trim() : null;
    const cleanCover = typeof cover_photo_url === 'string' && cover_photo_url.trim() ? cover_photo_url.trim() : null;

    const result = db.prepare(`
      INSERT INTO shops (
        shop_code, email, password_hash, name, category, subcategory, description,
        address, area_locality, city, district, state, pincode,
        phone, whatsapp_number, opening_time, closing_time,
        image_url, logo_url, cover_photo_url,
        status, verification_status, owner_name, latitude, longitude,
        auth_provider, must_change_password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, 'local', 0)
    `).run(
      shopCode,
      cleanEmail,
      passwordHash,
      cleanName,
      category && typeof category === 'string' ? category.trim() : 'Retail',
      subcategory && typeof subcategory === 'string' ? subcategory.trim() : null,
      description && typeof description === 'string' && description.trim()
        ? description.trim()
        : `Registered by ${cleanOwner}`,
      cleanAddress,
      area_locality || null,
      city || null,
      district || null,
      state || null,
      pincode || null,
      cleanPhone,
      whatsapp_number || null,
      opening_time || '09:00',
      closing_time || '21:00',
      cleanCover || cleanLogo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      cleanLogo,
      cleanCover,
      cleanOwner,
      lat,
      lng
    );

    const newShopId = result.lastInsertRowid;
    const permanentQr = 'VP52-MCH-' + crypto.randomBytes(10).toString('hex').toUpperCase();
    db.prepare("UPDATE shops SET permanent_qr_code = ?, qr_status = 'pending', qr_generated_at = NULL WHERE id = ?").run(permanentQr, newShopId);
    db.prepare('INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(newShopId);
    const newShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(newShopId);

    // Narrow onboarding-only token (valid ONLY for onboarding status/photo upload, never active merchant APIs)
    const token = jwt.sign(
      {
        id: newShop.id,
        shop_id: newShop.id,
        shop_code: newShop.shop_code,
        email: newShop.email,
        role: 'merchant_onboarding',
        scope: 'onboarding'
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.status(201).json({
      success: true,
      message: 'Merchant application registered successfully and submitted for admin review.',
      token,
      user: {
        id: newShop.id,
        shop_id: newShop.id,
        shop_code: newShop.shop_code,
        full_name: newShop.name,
        shop_name: newShop.name,
        owner_name: newShop.owner_name,
        email: newShop.email,
        phone: newShop.phone,
        status: 'pending',
        verification_status: 'pending',
        category: newShop.category,
        subcategory: newShop.subcategory,
        role: 'merchant_onboarding',
        must_change_password: 0
      }
    });
  } catch (error) {
    console.error('Merchant self-registration error:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete merchant self-registration' });
  }
});
router.get('/me', authenticateToken, (req, res) => {
  try {
    if (req.user.role === 'customer') {
      const user = db.prepare('SELECT id, full_name, email, phone, status, profile_photo, profile_completed, created_at FROM users WHERE id = ?').get(req.user.id);
      if (!user || user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'User unavailable or suspended' });
      }
      const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(user.id);
      const isProfileCompleted = Boolean(user.profile_completed && user.phone);
      return res.json({
        success: true,
        user: {
          ...user,
          role: 'customer',
          profile_photo: user.profile_photo || null,
          profile_completed: isProfileCompleted,
          balance: wallet ? wallet.balance : 0,
          total_earned: wallet ? wallet.total_earned : 0,
          total_redeemed: wallet ? wallet.total_redeemed : 0
        }
      });
    } else if (req.user.role === 'admin') {
      const admin = db.prepare('SELECT id, full_name, email, role, permissions, status, phone, created_at, last_login_at FROM admins WHERE id = ?').get(req.user.id);
      if (!admin) {
        return res.status(404).json({ success: false, error: 'Admin user not found' });
      }
      let parsedPerms = ['*'];
      try {
        parsedPerms = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || ['*']);
      } catch (e) {
        parsedPerms = ['*'];
      }
      return res.json({
        success: true,
        user: {
          ...admin,
          role: 'admin',
          admin_role: admin.role || 'super_admin',
          permissions: parsedPerms
        }
      });
    } else if (req.user.role === 'shop') {
      const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.user.shop_id || req.user.id);
      if (!shop || shop.status !== 'active' || shop.verification_status !== 'approved') {
        return res.status(403).json({
          success: false,
          error: 'Merchant account is pending approval, inactive, or suspended'
        });
      }
      return res.json({
        success: true,
        user: {
          id: shop.id,
          shop_id: shop.id,
          shop_code: shop.shop_code || `SHOP-00${shop.id}`,
          full_name: shop.name,
          shop_name: shop.name,
          owner_name: shop.owner_name,
          email: shop.email,
          phone: shop.phone,
          address: shop.address,
          category: shop.category,
          subcategory: shop.subcategory,
          logo_url: shop.logo_url,
          cover_photo_url: shop.cover_photo_url,
          status: shop.status,
          verification_status: shop.verification_status,
          rejection_reason: shop.rejection_reason,
          role: 'shop',
          must_change_password: shop.must_change_password ? 1 : 0
        }
      });
    } else if (req.user.role === 'merchant_onboarding') {
      const shop = db.prepare('SELECT id, shop_code, name, owner_name, email, status, verification_status, rejection_reason, logo_url, cover_photo_url FROM shops WHERE id = ?').get(req.user.shop_id || req.user.id);
      if (!shop || shop.status === 'suspended' || shop.verification_status === 'suspended' || shop.status === 'inactive' || shop.status === 'deactivated') {
        return res.status(403).json({ success: false, error: 'Merchant application is unavailable or suspended' });
      }
      return res.json({
        success: true,
        user: {
          id: shop.id,
          shop_id: shop.id,
          shop_code: shop.shop_code || `SHOP-00${shop.id}`,
          full_name: shop.name,
          shop_name: shop.name,
          owner_name: shop.owner_name,
          email: shop.email,
          logo_url: shop.logo_url,
          cover_photo_url: shop.cover_photo_url,
          status: shop.status,
          verification_status: shop.verification_status,
          rejection_reason: shop.rejection_reason,
          role: 'merchant_onboarding'
        }
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
});

// ============================================================
// Merchant password change (forced first-login change + voluntary change)
// ------------------------------------------------------------
// Authenticated approved merchants ONLY. The shop identity is taken exclusively from the
// verified JWT (req.user.shop_id) -- never from the request body -- so a merchant
// can only ever change THEIR OWN credentials. Verifies the current/temporary
// password, enforces the shared strength policy on the new password, stores a
// bcrypt hash, and clears shops.must_change_password. Passwords are never logged.
// ============================================================
router.post('/shop/change-password', authLimiter, authenticateToken, requireRole('shop'), requireApprovedMerchant, (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required' });
    }

    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Merchant account not found' });
    }
    if (shop.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Merchant account is inactive or suspended' });
    }
    if (!shop.password_hash) {
      return res.status(400).json({ success: false, error: 'Merchant password credentials not set. Please contact administrator.' });
    }

    // Verify the current / temporary password before allowing any change.
    const currentMatches = bcrypt.compareSync(current_password, shop.password_hash);
    if (!currentMatches) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Enforce the shared strength policy (>=12 chars, mixed case + digit).
    const strength = validatePasswordStrength(new_password);
    if (!strength.ok) {
      return res.status(400).json({ success: false, error: strength.error });
    }

    // The new password must actually differ from the current/temporary one.
    if (bcrypt.compareSync(new_password, shop.password_hash)) {
      return res.status(400).json({ success: false, error: 'New password must be different from your current password' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE shops SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, shopId);

    return res.json({
      success: true,
      message: 'Password updated successfully',
      must_change_password: 0
    });
  } catch (error) {
    console.error('Merchant change-password error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

// POST /api/auth/request-account-deletion - Public Account Deletion Request (Google Play Compliance)
router.post('/request-account-deletion', (req, res) => {
  try {
    const { identifier, reason } = req.body;
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ success: false, error: 'Email or phone number is required.' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanReason = (reason || '').trim().slice(0, 500);

    db.prepare(`
      INSERT INTO account_deletion_requests (identifier, reason, status)
      VALUES (?, ?, 'pending')
    `).run(cleanIdentifier, cleanReason);

    return res.json({
      success: true,
      message: 'Your deletion request has been registered in the operator review queue. The operator manually reviews requests and verifies identity before processing account deletion.'
    });
  } catch (error) {
    console.error('Account deletion request error:', error);
    return res.status(500).json({ success: false, error: 'Failed to record deletion request.' });
  }
});

module.exports = router;

