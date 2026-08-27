const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Customer Registration
router.post('/customer/register', (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Full name, email, and password are required' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email is already registered' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const insertUser = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status)
      VALUES (?, ?, ?, ?, 'active')
    `);

    const result = insertUser.run(full_name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, passwordHash);
    const userId = result.lastInsertRowid;

    // Create wallet for new customer
    db.prepare(`
      INSERT INTO wallets (user_id, balance, total_earned, total_redeemed)
      VALUES (?, 0, 0, 0)
    `).run(userId);

    const token = jwt.sign(
      { id: userId, email: email.trim().toLowerCase(), role: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: userId,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        role: 'customer',
        balance: 0
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during registration' });
  }
});

// Customer Login
router.post('/customer/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

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

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: 'customer',
        balance: wallet ? wallet.balance : 0,
        total_earned: wallet ? wallet.total_earned : 0,
        total_redeemed: wallet ? wallet.total_redeemed : 0
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
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
router.post('/customer/google', async (req, res) => {
  try {
    const idToken = req.body.idToken || req.body.id_token || req.body.credential;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Google ID token is required' });
    }

    // Lazy-load the verifier so the server still boots before `npm install`
    // adds google-auth-library. Returns a clear, actionable error until then.
    let OAuth2Client;
    try {
      ({ OAuth2Client } = require('google-auth-library'));
    } catch (e) {
      return res.status(503).json({ success: false, error: 'Google sign-in is not available on the server yet (run "npm install" in /server).' });
    }

    const CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!CLIENT_ID) {
      return res.status(503).json({ success: false, error: 'Google sign-in is not configured on the server (GOOGLE_WEB_CLIENT_ID missing).' });
    }

    // 1) Verify signature, issuer, audience and expiry via Google's public keys.
    let payload;
    try {
      const client = new OAuth2Client(CLIENT_ID);
      const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
      payload = ticket.getPayload();
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid or unverifiable Google credential' });
    }

    if (!payload || !payload.sub) {
      return res.status(401).json({ success: false, error: 'Invalid Google credential' });
    }

    const googleSub = String(payload.sub);
    const email = (payload.email || '').trim().toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const displayName = (payload.name || (email ? email.split('@')[0] : 'Customer')).trim();

    // 2) Resolve the customer account (link existing / create new) safely.
    let user = db.prepare('SELECT * FROM users WHERE google_subject_id = ?').get(googleSub);

    if (!user) {
      if (!email) {
        return res.status(400).json({ success: false, error: 'Google account did not provide an email address' });
      }

      const existingCustomer = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

      if (existingCustomer) {
        // Same email is already a customer account.
        if (existingCustomer.google_subject_id && existingCustomer.google_subject_id !== googleSub) {
          return res.status(409).json({ success: false, error: 'This account is already linked to a different Google identity.' });
        }
        if (!emailVerified) {
          return res.status(403).json({ success: false, error: 'Google has not verified this email, so it cannot be linked to your existing account.' });
        }
        if (existingCustomer.status !== 'active') {
          return res.status(403).json({ success: false, error: 'Account is suspended. Please contact administrator.' });
        }
        // Safe account-linking: attach the verified Google identity to the customer.
        db.prepare('UPDATE users SET google_subject_id = ? WHERE id = ?').run(googleSub, existingCustomer.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(existingCustomer.id);
      } else {
        // No customer with this email. NEVER convert an admin or merchant account.
        const adminConflict = db.prepare('SELECT id FROM admins WHERE LOWER(email) = ?').get(email);
        const shopConflict = db.prepare('SELECT id FROM shops WHERE LOWER(email) = ?').get(email);
        if (adminConflict || shopConflict) {
          return res.status(409).json({ success: false, error: 'This email is registered to a merchant or admin account and cannot be used for customer Google sign-in.' });
        }
        if (!emailVerified) {
          return res.status(403).json({ success: false, error: 'Google has not verified this email address.' });
        }
        // Create a Google-provisioned customer. A random unusable password hash
        // satisfies the existing NOT NULL column without enabling password login.
        const randomSecret = crypto.randomBytes(32).toString('hex');
        const passwordHash = bcrypt.hashSync(randomSecret, 10);
        let userId;
        try {
          const result = db.prepare(`
            INSERT INTO users (full_name, email, phone, password_hash, status, google_subject_id, auth_provider)
            VALUES (?, ?, ?, ?, 'active', ?, 'google')
          `).run(displayName, email, null, passwordHash, googleSub);
          userId = result.lastInsertRowid;
        } catch (e) {
          // Unique-index race (duplicate google_subject_id / email) -> reject safely.
          return res.status(409).json({ success: false, error: 'Google account could not be registered (already in use).' });
        }
        db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      }
    } else {
      // Found directly by Google identity -> standard sign-in.
      if (user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Account is suspended. Please contact administrator.' });
      }
    }

    // 3) Issue the SAME customer JWT + user shape as email/password login.
    const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(user.id);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: 'customer',
        balance: wallet ? wallet.balance : 0,
        total_earned: wallet ? wallet.total_earned : 0,
        total_redeemed: wallet ? wallet.total_redeemed : 0
      }
    });
  } catch (error) {
    console.error('Google customer login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during Google sign-in' });
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

    return res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during admin login' });
  }
});

// Shop / Merchant Login (Email / Mobile + Password)
router.post('/shop/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Shop email or mobile number and password are required' });
    }

    const cleanInput = email.trim().toLowerCase();
    const shop = db.prepare('SELECT * FROM shops WHERE LOWER(email) = ? OR phone = ?').get(cleanInput, email.trim());

    if (!shop) {
      return res.status(401).json({ success: false, error: 'Invalid merchant login credentials' });
    }

    if (shop.status === 'suspended') {
      return res.status(403).json({ success: false, error: '❌ ACCOUNT SUSPENDED: Your merchant account has been suspended by the administrator.' });
    }

    if (shop.status === 'inactive' || shop.status === 'deactivated') {
      return res.status(403).json({ success: false, error: '❌ ACCOUNT INACTIVE: Your merchant account is deactivated. Please contact administrator.' });
    }

    if (shop.status !== 'active') {
      return res.status(403).json({ success: false, error: `❌ ACCOUNT ${shop.status.toUpperCase()}: Merchant account is pending administrator approval.` });
    }

    if (!shop.password_hash) {
      return res.status(401).json({ success: false, error: 'Shop password credentials not set. Please contact administrator.' });
    }

    const passwordMatch = bcrypt.compareSync(password, shop.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid merchant login credentials' });
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
        role: 'shop'
      }
    });
  } catch (error) {
    console.error('Shop login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during shop login' });
  }
});

// Shop / Merchant Login (Mobile Number + OTP)
router.post('/shop/login-mobile', (req, res) => {
  try {
    const { mobile, otp_code } = req.body;

    if (!mobile || !otp_code) {
      return res.status(400).json({ success: false, error: 'Mobile number and OTP code are required' });
    }

    if (otp_code !== '123456' && otp_code.length !== 6) {
      return res.status(400).json({ success: false, error: 'Invalid OTP code. Please use 123456 for demo.' });
    }

    const shop = db.prepare('SELECT * FROM shops WHERE phone = ? OR email = ?').get(mobile.trim(), mobile.trim().toLowerCase());

    if (!shop) {
      return res.status(404).json({ success: false, error: `No merchant account registered with mobile number "${mobile}".` });
    }

    if (shop.status === 'suspended') {
      return res.status(403).json({ success: false, error: '❌ ACCOUNT SUSPENDED: Your merchant account has been suspended by the administrator.' });
    }

    if (shop.status === 'inactive' || shop.status === 'deactivated') {
      return res.status(403).json({ success: false, error: '❌ ACCOUNT INACTIVE: Your merchant account is deactivated. Please contact administrator.' });
    }

    if (shop.status !== 'active') {
      return res.status(403).json({ success: false, error: `❌ ACCOUNT ${shop.status.toUpperCase()}: Merchant account is pending administrator approval.` });
    }

    const token = jwt.sign(
      { id: shop.id, shop_id: shop.id, shop_code: shop.shop_code, email: shop.email, role: 'shop' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Mobile OTP Login Successful!',
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
        role: 'shop'
      }
    });
  } catch (error) {
    console.error('Merchant mobile login error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process mobile OTP merchant login' });
  }
});

// OTP Send Request
router.post('/send-otp', (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, error: 'Mobile number is required' });
    }
    // Dev Mock OTP code: 123456
    return res.json({
      success: true,
      message: 'OTP sent to ' + mobile,
      otp_code: '123456'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

// OTP Verification Request
router.post('/verify-otp', (req, res) => {
  try {
    const { mobile, otp_code } = req.body;
    if (!mobile || !otp_code) {
      return res.status(400).json({ success: false, error: 'Mobile and OTP code are required' });
    }
    if (otp_code === '123456' || otp_code.length === 6) {
      return res.json({ success: true, verified: true, message: 'OTP verified successfully' });
    }
    return res.status(400).json({ success: false, error: 'Invalid OTP code. Please use 123456 for demo.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'OTP verification failed' });
  }
});

// Merchant Registration (State: Pending Admin Approval)
router.post('/merchant/register', (req, res) => {
  try {
    const { owner_name, shop_name, mobile, email, category, address, latitude, longitude, password } = req.body;

    if (!owner_name || !shop_name || !email || !password || !address) {
      return res.status(400).json({ success: false, error: 'Owner name, shop name, email, address, and password are required' });
    }

    const existingShop = db.prepare('SELECT id FROM shops WHERE email = ?').get(email.trim().toLowerCase());
    if (existingShop) {
      return res.status(400).json({ success: false, error: 'Shop email is already registered' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM shops').get();
    const nextId = (countRow ? countRow.count : 0) + 1;
    const shopCode = `SHOP-00${nextId}`;

    const result = db.prepare(`
      INSERT INTO shops (shop_code, email, password_hash, name, category, description, address, phone, image_url, status, verification_status, owner_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'pending', ?, ?, ?)
    `).run(
      shopCode,
      email.trim().toLowerCase(),
      passwordHash,
      shop_name.trim(),
      category ? category.trim() : 'Retail',
      `Merchant registered by ${owner_name}`,
      address.trim(),
      mobile ? mobile.trim() : '',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      owner_name.trim(),
      latitude ? parseFloat(latitude) : 18.5204,
      longitude ? parseFloat(longitude) : 73.8567
    );

    return res.status(201).json({
      success: true,
      message: 'Merchant application submitted! Account verification pending administrator approval.',
      shopCode
    });
  } catch (error) {
    console.error('Merchant registration error:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit merchant registration' });
  }
});
router.get('/me', authenticateToken, (req, res) => {
  try {
    if (req.user.role === 'customer') {
      const user = db.prepare('SELECT id, full_name, email, phone, status, created_at FROM users WHERE id = ?').get(req.user.id);
      if (!user || user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'User unavailable or suspended' });
      }
      const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(user.id);
      return res.json({
        success: true,
        user: {
          ...user,
          role: 'customer',
          balance: wallet ? wallet.balance : 0,
          total_earned: wallet ? wallet.total_earned : 0,
          total_redeemed: wallet ? wallet.total_redeemed : 0
        }
      });
    } else if (req.user.role === 'admin') {
      const admin = db.prepare('SELECT id, full_name, email, created_at FROM admins WHERE id = ?').get(req.user.id);
      if (!admin) {
        return res.status(404).json({ success: false, error: 'Admin user not found' });
      }
      return res.json({
        success: true,
        user: {
          ...admin,
          role: 'admin'
        }
      });
    } else if (req.user.role === 'shop') {
      const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.user.shop_id || req.user.id);
      if (!shop || shop.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Shop account is inactive or suspended' });
      }
      return res.json({
        success: true,
        user: {
          id: shop.id,
          shop_id: shop.id,
          shop_code: shop.shop_code || `SHOP-00${shop.id}`,
          full_name: shop.name,
          shop_name: shop.name,
          email: shop.email,
          phone: shop.phone,
          address: shop.address,
          category: shop.category,
          role: 'shop'
        }
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
