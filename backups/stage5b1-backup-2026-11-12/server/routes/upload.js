const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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

/**
 * POST /api/upload/image
 * Accepts Base64 / Data URL image:
 * {
 *   image: "data:image/jpeg;base64,...",
 *   type: "shop_logo" | "shop_photo" | "product_photo" | "review_photo"
 * }
 */
router.post('/image', authenticateToken, (req, res) => {
  try {
    const { image, type } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, error: 'Image data is required' });
    }

    // Parse Data URI or raw base64
    let mimeType = 'image/jpeg';
    let base64Data = image;

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1].toLowerCase();
      base64Data = matches[2];
    }

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
