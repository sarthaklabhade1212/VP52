/**
 * Client-Side Image Validation & Canvas Compression Utilities
 *
 * Ensures camera/gallery images are resized and JPEG-compressed before Base64 JSON
 * upload so request bodies remain well below reverse-proxy limits (including Nginx's
 * default `1m` client_max_body_size) and Express's JSON limit.
 */

export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

const ALLOWED_EXTENSION_REGEX = /\.(jpe?g|png|webp)$/i;
const DEFAULT_MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB pre-compression safety cap

export const IMAGE_UPLOAD_PRESETS = Object.freeze({
  PROFILE_AVATAR: Object.freeze({
    maxDimension: 800,
    minDimension: 320,
    quality: 0.8,
    maxBytes: 350 * 1024, // ~467 KB Base64 JSON payload (< 1 MiB)
    maxInputBytes: DEFAULT_MAX_INPUT_BYTES
  }),
  GENERAL_PHOTO: Object.freeze({
    maxDimension: 1280,
    minDimension: 480,
    quality: 0.8,
    maxBytes: 550 * 1024, // ~734 KB Base64 JSON payload (< 1 MiB)
    maxInputBytes: DEFAULT_MAX_INPUT_BYTES
  })
});

export class ImageCompressionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImageCompressionError';
    this.code = code;
  }
}

/**
 * Validates an uploaded File before decoding/compression.
 *
 * @param {File} file
 * @param {{
 *   allowedTypes?: readonly string[],
 *   allowAnyRasterImage?: boolean,
 *   maxInputBytes?: number
 * }} [options]
 * @returns {{ valid: boolean, reason: null | 'NO_FILE' | 'INVALID_TYPE' | 'FILE_TOO_LARGE' }}
 */
export function validateImageFile(file, options = {}) {
  if (!file || typeof file.size !== 'number') {
    return { valid: false, reason: 'NO_FILE' };
  }

  const {
    allowedTypes = ALLOWED_IMAGE_MIME_TYPES,
    allowAnyRasterImage = false,
    maxInputBytes = DEFAULT_MAX_INPUT_BYTES
  } = options;

  const mime = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
  const name = typeof file.name === 'string' ? file.name.trim() : '';

  if (allowAnyRasterImage) {
    const isSvg = mime === 'image/svg+xml' || /\.svg$/i.test(name);
    const isRaster = mime ? mime.startsWith('image/') && !isSvg : ALLOWED_EXTENSION_REGEX.test(name);
    if (!isRaster) {
      return { valid: false, reason: 'INVALID_TYPE' };
    }
  } else {
    const typeAllowed = mime ? allowedTypes.includes(mime) : ALLOWED_EXTENSION_REGEX.test(name);
    if (!typeAllowed) {
      return { valid: false, reason: 'INVALID_TYPE' };
    }
  }

  if (file.size > maxInputBytes) {
    return { valid: false, reason: 'FILE_TOO_LARGE' };
  }

  return { valid: true, reason: null };
}

/**
 * Computes aspect-ratio-preserving target dimensions capped at `maxDimension`.
 * Never upscales images smaller than `maxDimension`.
 */
export function calculateTargetDimensions(srcWidth, srcHeight, maxDimension) {
  if (!srcWidth || !srcHeight || srcWidth <= 0 || srcHeight <= 0) {
    throw new ImageCompressionError('INVALID_DIMENSIONS', 'Invalid image dimensions.');
  }
  const longestEdge = Math.max(srcWidth, srcHeight);
  if (!maxDimension || longestEdge <= maxDimension) {
    return { width: Math.round(srcWidth), height: Math.round(srcHeight) };
  }
  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(srcWidth * scale)),
    height: Math.max(1, Math.round(srcHeight * scale))
  };
}

/**
 * Computes the exact decoded binary byte length of a Base64 Data URL string.
 */
export function getDataUrlDecodedBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Loads a File into a drawable source (`ImageBitmap` preferred so EXIF orientation
 * is normalized by the browser, with `HTMLImageElement` fallback).
 */
async function loadDrawableImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          if (typeof bitmap.close === 'function') bitmap.close();
        }
      };
    } catch (_) {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => {
            if (typeof bitmap.close === 'function') bitmap.close();
          }
        };
      } catch (_) {
        // Fall through to HTMLImageElement
      }
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl)
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageCompressionError('DECODE_FAILED', 'Unable to decode selected image.'));
    };
    img.src = objectUrl;
  });
}

function renderCanvasToJpegDataUrl(source, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageCompressionError('CANVAS_UNAVAILABLE', 'Canvas 2D context unavailable.');
  }

  // Fill opaque white backdrop before drawing so PNG/WebP alpha does not become black in JPEG.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) {
    throw new ImageCompressionError('ENCODE_FAILED', 'Canvas JPEG encoding failed.');
  }

  return dataUrl;
}

/**
 * Resizes and compresses a selected File into an `image/jpeg` Data URL whose
 * decoded size fits within `maxBytes` (defaulting to `GENERAL_PHOTO`).
 *
 * @param {File} file
 * @param {{
 *   maxDimension?: number,
 *   minDimension?: number,
 *   quality?: number,
 *   maxBytes?: number
 * }} [preset]
 * @returns {Promise<{
 *   dataUrl: string,
 *   bytes: number,
 *   width: number,
 *   height: number,
 *   quality: number
 * }>}
 */
export async function compressImageToDataUrl(file, preset = IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO) {
  const maxDimension = preset?.maxDimension ?? IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO.maxDimension;
  const minDimension = preset?.minDimension ?? IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO.minDimension;
  const initialQuality = preset?.quality ?? IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO.quality;
  const maxBytes = preset?.maxBytes ?? IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO.maxBytes;

  const loaded = await loadDrawableImage(file);
  try {
    let currentMaxEdge = maxDimension;
    let bestAttempt = null;

    for (let pass = 0; pass < 3; pass++) {
      const { width, height } = calculateTargetDimensions(
        loaded.width,
        loaded.height,
        currentMaxEdge
      );

      const qualitySteps =
        pass === 0
          ? [initialQuality, Math.min(initialQuality, 0.7), 0.58, 0.45]
          : [0.68, 0.52, 0.4];

      for (const q of qualitySteps) {
        const dataUrl = renderCanvasToJpegDataUrl(loaded.source, width, height, q);
        const bytes = getDataUrlDecodedBytes(dataUrl);
        bestAttempt = { dataUrl, bytes, width, height, quality: q };
        if (bytes <= maxBytes) {
          return bestAttempt;
        }
      }

      const nextEdge = Math.max(minDimension, Math.round(currentMaxEdge * 0.72));
      if (nextEdge >= currentMaxEdge) {
        break;
      }
      currentMaxEdge = nextEdge;
    }

    if (bestAttempt && bestAttempt.bytes <= maxBytes) {
      return bestAttempt;
    }

    throw new ImageCompressionError(
      'COMPRESSED_TOO_LARGE',
      'Compressed image still exceeds the safe upload size limit.'
    );
  } finally {
    loaded.cleanup();
  }
}
