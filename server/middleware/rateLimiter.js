/**
 * Lightweight in-memory rate limiter for authentication endpoints.
 * Prevents credential stuffing, brute force, and profile-completion spam.
 */

const hitRecords = new Map();

// Periodic cleanup of stale rate-limit records every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of hitRecords.entries()) {
    if (now > record.resetTime) {
      hitRecords.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Creates an Express rate-limiting middleware.
 *
 * @param {Object} options
 * @param {number} [options.windowMs=60000] - Window duration in milliseconds (default: 1 min)
 * @param {number} [options.max=15] - Maximum allowed requests per window
 * @param {string} [options.message='Too many requests. Please try again later.'] - Error response message
 * @param {Function} [options.keyGenerator] - Custom key generator function (defaults to IP + route)
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 15;
  const message = options.message || 'Too many attempts. Please try again later.';
  const keyGen = options.keyGenerator || ((req) => {
    const ip = req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    return `${req.baseUrl || ''}${req.path}:${ip}`;
  });

  return (req, res, next) => {
    // In test environment, allow bypassing with test header if explicitly set
    if (process.env.NODE_ENV === 'test' && req.headers['x-skip-rate-limit'] === 'true') {
      return next();
    }

    const key = keyGen(req);
    const now = Date.now();
    let record = hitRecords.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
    } else {
      record.count += 1;
    }

    hitRecords.set(key, record);

    const remaining = Math.max(0, max - record.count);
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter
      });
    }

    next();
  };
}

module.exports = {
  createRateLimiter
};
