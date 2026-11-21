const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimiter');

const router = express.Router();

const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many image upload requests. Please wait a few minutes and try again.',
  keyGenerator: (req) => `upload_img:${getClientIp(req)}`
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

const ALLOWED_UPLOAD_TYPES = new Set([
  'shop_logo',
  'shop_photo',
  'product_photo',
  'review_photo',
  'customer_profile',
  'ad_banner'
]);

const ALLOWED_FOLDERS = new Set([
  'merchant',
  'products',
  'reviews',
  'customer',
  'ads'
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_BASE64_CHARS = Math.ceil((MAX_FILE_SIZE_BYTES * 4) / 3) + 64;

function containsDangerousFileSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) return true;

  // Windows PE/MZ executable, ELF binary, ZIP/DOCX/APK, PDF
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return true; // MZ
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return true; // \x7fELF
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return true; // PK\x03\x04
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') return true;

  // Reject SVG/XML/HTML/script prefixes (in case spoofed under an image MIME)
  const headText = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase();
  if (
    headText.includes('<svg') ||
    headText.includes('<?xml') ||
    headText.includes('<html') ||
    headText.includes('<!doctype') ||
    headText.includes('<script') ||
    headText.includes('javascript:')
  ) {
    return true;
  }

  return false;
}

function hasValidImageMagicBytes(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (containsDangerousFileSignature(buffer)) return false;

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff &&
      buffer[3] >= 0xc0
    );
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimeType === 'image/webp') {
    if (buffer.length < 20) return false;
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    const chunk = buffer.subarray(12, 16).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP' && (chunk === 'VP8 ' || chunk === 'VP8L' || chunk === 'VP8X');
  }
  return false;
}

/**
 * POST /api/upload/image
 * Accepts Base64 / Data URL image:
 * {
 *   image: "data:image/jpeg;base64,...",
 *   type: "shop_logo" | "shop_photo" | "product_photo" | "review_photo" | "customer_profile" | "ad_banner"
 * }
 */
router.post('/image', uploadLimiter, authenticateToken, (req, res) => {
  try {
    const { image, type, folder } = req.body || {};

    if (type !== undefined && type !== null && type !== '') {
      if (typeof type !== 'string' || !ALLOWED_UPLOAD_TYPES.has(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid upload type specified.'
        });
      }
    }

    if (folder !== undefined && folder !== null && folder !== '') {
      if (typeof folder !== 'string' || !ALLOWED_FOLDERS.has(folder)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid upload folder specified.'
        });
      }
    }

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
      if (type && !['shop_logo', 'shop_photo', 'product_photo'].includes(type)) {
        return res.status(403).json({
          success: false,
          error: 'Merchants may only upload shop or product images.'
        });
      }
      const shop = db.prepare('SELECT status, verification_status FROM shops WHERE id = ?').get(req.user.shop_id || req.user.id);
      if (!shop || shop.status !== 'active' || shop.verification_status !== 'approved') {
        return res.status(403).json({
          success: false,
          error: 'Approved active merchant account required to upload images.'
        });
      }
    } else if (role === 'customer') {
      if (type && !['customer_profile', 'review_photo'].includes(type)) {
        return res.status(403).json({
          success: false,
          error: 'Customers may only upload profile or review images.'
        });
      }
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

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'Image must be a valid base64 Data URI (JPEG, PNG, or WEBP).'
      });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2].replace(/\s+/g, '');

    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported image format (${mimeType}). Allowed formats: JPEG, PNG, WEBP.`
      });
    }

    if (!base64Data || base64Data.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
      return res.status(400).json({
        success: false,
        error: base64Data.length > MAX_BASE64_CHARS
          ? 'Image file size exceeds the 10MB limit.'
          : 'Invalid base64 image encoding.'
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
    const safePrefixSource = typeof type === 'string' && type
      ? type
      : (typeof folder === 'string' && folder ? folder : 'img');
    const prefix = `${safePrefixSource.replace(/[^a-z0-9_-]/gi, '')}_`;
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
    console.error('Image upload error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to process image upload' });
  }
});

module.exports = router;
