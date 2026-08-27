// Shared server-side password utilities.
//
// Two responsibilities, both used by the admin merchant-creation / reset flows
// (Phase 3) and the merchant forced-change endpoint (Phase 4):
//
//   1. generateStrongPassword()  -> a cryptographically secure temporary password
//      that the ADMIN sees exactly once when an account is created / reset. It is
//      never chosen by the admin, never stored in plaintext, and never logged.
//
//   2. validatePasswordStrength() -> the single source of truth for "is this a
//      strong enough password", so the merchant-chosen new password on first login
//      is held to the same bar everywhere.
//
// All randomness comes from Node's crypto module (crypto.randomInt), never
// Math.random(), so generated passwords are cryptographically secure.

const crypto = require('crypto');

// Character classes. Visually-ambiguous characters (l, I, 0, O, 1) are omitted from
// the generated-password alphabet so an admin can read a temp password aloud / copy
// it without transcription errors. This does NOT weaken validation of merchant-chosen
// passwords (they may use any characters).
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

// Minimum length enforced for BOTH generated and merchant-chosen passwords.
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

// Uniform, unbiased pick from an alphabet using a CSPRNG.
function pick(alphabet) {
  return alphabet[crypto.randomInt(0, alphabet.length)];
}

/**
 * Generate a cryptographically secure temporary password.
 * Guarantees length >= 16 and at least one lowercase, uppercase, digit and symbol,
 * so the result always satisfies validatePasswordStrength().
 * @param {number} length desired length (clamped to a strong minimum)
 * @returns {string}
 */
function generateStrongPassword(length = 16) {
  const target = Math.max(length, 16);

  // Seed one character from each required class, then fill the rest from the full
  // alphabet, then shuffle so the required characters are not positionally predictable.
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < target) {
    chars.push(pick(ALL));
  }

  // Fisher-Yates shuffle driven by crypto.randomInt (not Math.random).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}

/**
 * Validate the strength of a (merchant-chosen) password.
 * Requirements: length in [12, 128], and at least one lowercase, one uppercase and
 * one digit. This is deliberately the ONE place strength is defined.
 * @param {string} pw
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validatePasswordStrength(pw) {
  if (typeof pw !== 'string' || pw.length === 0) {
    return { ok: false, error: 'Password is required' };
  }
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` };
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `Password is too long (maximum ${MAX_PASSWORD_LENGTH} characters)` };
  }
  if (!/[a-z]/.test(pw)) {
    return { ok: false, error: 'Password must include at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(pw)) {
    return { ok: false, error: 'Password must include at least one uppercase letter' };
  }
  if (!/[0-9]/.test(pw)) {
    return { ok: false, error: 'Password must include at least one number' };
  }
  return { ok: true };
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  generateStrongPassword,
  validatePasswordStrength
};
