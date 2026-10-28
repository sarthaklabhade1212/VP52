const crypto = require('crypto');

// Secret salt for keyed OTP hashing
const OTP_SECRET = process.env.JWT_SECRET || 'vp52-otp-internal-salt-key';

/**
 * Generates a cryptographically secure 6-digit OTP string.
 *
 * @param {number} [length=6]
 * @returns {string}
 */
function generateSecureOtp(length = 6) {
  if (length === 6) {
    // 100000 to 999999 inclusive
    return crypto.randomInt(100000, 1000000).toString();
  }
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  return crypto.randomInt(min, max).toString();
}

/**
 * Hashes an OTP with a challenge ID and secret key using HMAC-SHA256.
 *
 * @param {string} otp
 * @param {string} challengeId
 * @returns {string}
 */
function hashOtp(otp, challengeId) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${challengeId}:${otp.trim()}`)
    .digest('hex');
}

/**
 * Constant-time comparison to verify candidate OTP against stored hash.
 *
 * @param {string} candidateOtp
 * @param {string} challengeId
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyOtpHash(candidateOtp, challengeId, storedHash) {
  if (!candidateOtp || !challengeId || !storedHash) return false;

  try {
    const candidateHash = hashOtp(candidateOtp, challengeId);
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (candidateBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(candidateBuf, storedBuf);
  } catch (e) {
    return false;
  }
}

/**
 * Generates a unique challenge ID.
 *
 * @returns {string}
 */
function generateChallengeId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(24).toString('hex');
}

module.exports = {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  generateChallengeId
};
