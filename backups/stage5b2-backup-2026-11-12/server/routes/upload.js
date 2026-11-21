const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many image upload requests. Please wait a few minutes and try again.'
});

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function hasValidImageMagicBytes(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

/**
 * POST /api/upload/image
 * Accepts Base64 / Data URL image:
 * {
 *   image: "data:image/jpeg;base64,...",
 *   type: "shop_logo" | "shop_photo" | "product_photo" | "review_photo" | "customer_profile"
 * }
 */
router.post('/image', uploadLimiter, authenticateToken, (req, res) => {
  try {
    const { image, type } = req.body || {};

    // Verify caller authorization & live account status
    const role = req.user && req.user.role;
    if (role === 'merchant_onboarding') {
      if (type !== 'shop_logo' && type !== 'shop_photo') {
        return res.status(403).json({
          success: false,
          error: 'Pending merchant applications may only upload shop logo or cover photos.'
        });
      }
      const shop = db.prepare('SELECT status, verification_status FROM shops WHERE id = ?').get(req.user.shop_id || req.user.id);
      if (!shop || shop.status !== 'pending' || shop.verification_status !== 'pending') {
        return res.status(403).json({
          success: false,
          error: 'Onboarding upload is only permitted while your merchant application is pending review.'
        });
      }
    } else if (role === 'shop') {
      const shop = db.prepare('SELECT status, verification_status FROM shops WHERE id = ?').get(req.user.shop_id || req.user.id);
      if (!shop || shop.status !== 'active' || shop.verification_status !== 'approved') {
        return res.status(403).json({
          success: false,
          error: 'Approved active merchant account required to upload images.'
        });
      }
    } else if (role === 'customer') {
      const user = db.prepare('SELECT status FROM users WHERE id = ?').get(req.user.id);
      if (!user || user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Active customer account required to upload images.' });
      }
    } else if (role === 'admin') {
      const admin = db.prepare('SELECT status FROM admins WHERE id = ?').get(req.user.id);
      if (!admin || admin.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Active admin account required to upload images.' });
      }
    } else {
      return res.status(403).json({ success: false, error: 'Unauthorized role for image upload.' });
    }

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, error: 'Image data is required' });
    }

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'Image must be a valid base64 Data URI (JPEG, PNG, or WEBP).'
      });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];

    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported image format (${mimeType}). Allowed formats: JPEG, PNG, WEBP.`
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'Image file size exceeds the 10MB limit.'
      });
    }

    if (!hasValidImageMagicBytes(buffer, mimeType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or corrupted image file contents.'
      });
    }

    // Generate safe cryptographically random filename
    const ext = ALLOWED_MIME_TYPES[mimeType];
    const prefix = type ? `${type.replace(/[^a-z0-9_-]/gi, '')}_` : 'img_';
    const filename = `${prefix}${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;
    return res.json({
      success: true,
      url: publicUrl,
      filename,
      size: buffer.length,
      mimeType
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process image upload' });
  }
});

module.exports = router;
