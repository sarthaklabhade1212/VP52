/**
 * Phone Number Normalization and Validation Utility
 *
 * Implements strict E.164 normalization for Indian (+91) and international mobile numbers.
 * Enforces authoritative server-side validation rules.
 */

/**
 * Normalizes and validates a phone number.
 *
 * @param {string} rawPhone - Raw input string from client or database.
 * @param {string} [defaultCountryCode='+91'] - Default country calling code if not specified.
 * @returns {{ isValid: boolean, normalized?: string, countryCode?: string, nationalNumber?: string, error?: string }}
 */
function normalizePhoneNumber(rawPhone, defaultCountryCode = '+91') {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, error: 'Mobile number is required' };
  }

  const cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (!cleaned) {
    return { isValid: false, error: 'Mobile number cannot be empty' };
  }

  // Handle explicit '+' prefix
  if (cleaned.startsWith('+')) {
    if (cleaned.startsWith('+91')) {
      const national = cleaned.slice(3).replace(/^0+/, ''); // strip +91 and any leading 0
      if (!/^[6-9]\d{9}$/.test(national)) {
        return {
          isValid: false,
          error: 'Indian mobile number must be 10 digits starting with 6, 7, 8, or 9'
        };
      }
      return {
        isValid: true,
        normalized: `+91${national}`,
        countryCode: '+91',
        nationalNumber: national
      };
    }

    // International E.164 format: + followed by 7 to 15 digits
    const digitsOnly = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digitsOnly)) {
      return {
        isValid: false,
        error: 'Invalid international phone number format (must be 7 to 15 digits)'
      };
    }

    return {
      isValid: true,
      normalized: `+${digitsOnly}`,
      countryCode: defaultCountryCode,
      nationalNumber: digitsOnly
    };
  }

  // Handle '00' international prefix
  if (cleaned.startsWith('00')) {
    return normalizePhoneNumber('+' + cleaned.slice(2), defaultCountryCode);
  }

  // Handle Indian phone numbers without '+' prefix
  let digits = cleaned.replace(/\D/g, '');

  // Handle '0' trunk prefix (e.g. 09876543210 -> 9876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Handle '91' prefix without '+' (e.g. 919876543210 -> 9876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  // Validate 10-digit Indian mobile number
  if (digits.length === 10) {
    if (!/^[6-9]/.test(digits)) {
      return {
        isValid: false,
        error: 'Indian mobile number must start with 6, 7, 8, or 9'
      };
    }
    return {
      isValid: true,
      normalized: `+91${digits}`,
      countryCode: '+91',
      nationalNumber: digits
    };
  }

  return {
    isValid: false,
    error: 'Please enter a valid 10-digit mobile number'
  };
}

/**
 * Generates a masked phone number for safe display in UI and logs.
 * E.g., "+919876543210" -> "+91 98••• ••210"
 *
 * @param {string} phone
 * @returns {string}
 */
function maskPhoneNumber(phone) {
  if (!phone) return '';
  const parsed = normalizePhoneNumber(phone);
  if (!parsed.isValid || !parsed.normalized) {
    return phone.slice(0, 3) + '••••' + phone.slice(-2);
  }

  const norm = parsed.normalized;
  if (norm.startsWith('+91') && norm.length === 13) {
    const nat = norm.slice(3); // 10 digits
    return `+91 ${nat.slice(0, 2)}••• ••${nat.slice(7)}`;
  }

  if (norm.length > 6) {
    return `${norm.slice(0, 4)}••••${norm.slice(-3)}`;
  }

  return norm;
}

module.exports = {
  normalizePhoneNumber,
  maskPhoneNumber
};
