/**
 * SMS & OTP Delivery Provider Service
 *
 * Provides a unified interface for SMS dispatch.
 * Supports production Indian SMS providers (MSG91, Fast2SMS), Twilio, and an in-memory
 * mock provider for local development and automated testing.
 *
 * In production (NODE_ENV=production):
 *   - Real SMS delivery credentials are REQUIRED.
 *   - Mock provider is STRICTLY DISABLED to prevent test OTPs or bypasses.
 */

const { maskPhoneNumber } = require('../utils/phone');

// In-memory store for mock OTPs (dev/test only)
const mockOtpStore = new Map();

/**
 * Determines the active SMS provider based on configuration.
 */
function resolveProvider() {
  const explicit = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
  if (explicit) return explicit;

  if (process.env.MSG91_AUTH_KEY) return 'msg91';
  if (process.env.FAST2SMS_API_KEY) return 'fast2sms';
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio';

  return 'mock';
}

/**
 * Dispatches an OTP via the configured SMS gateway.
 *
 * @param {{ phone: string, otp: string, templateId?: string }} params
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string }>}
 */
async function sendOtp({ phone, otp, templateId }) {
  const provider = resolveProvider();
  const isProduction = process.env.NODE_ENV === 'production';
  const maskedPhone = maskPhoneNumber(phone);

  if (isProduction && provider === 'mock') {
    const errorMsg =
      'SMS delivery provider is not configured. Real SMS credentials (e.g. MSG91, Fast2SMS, or Twilio) ' +
      'are required in production. Refusing to use mock OTP in production.';
    console.error(`[SMS Provider] PRODUCTION ERROR: ${errorMsg}`);
    const err = new Error(errorMsg);
    err.code = 'SMS_PROVIDER_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }

  if (provider === 'mock') {
    // Record mock OTP for dev & automated testing
    mockOtpStore.set(phone, {
      otp,
      sentAt: Date.now()
    });
    console.log(`[SMS Provider (Dev Mock)] Dispatched OTP challenge to ${maskedPhone}`);
    return {
      success: true,
      provider: 'mock',
      messageId: `mock_${Date.now()}`
    };
  }

  if (provider === 'msg91') {
    return sendViaMsg91({ phone, otp, templateId, maskedPhone });
  }

  if (provider === 'fast2sms') {
    return sendViaFast2Sms({ phone, otp, maskedPhone });
  }

  if (provider === 'twilio') {
    return sendViaTwilio({ phone, otp, maskedPhone });
  }

  throw new Error(`Unsupported SMS provider: ${provider}`);
}

/**
 * MSG91 OTP API Implementation
 */
async function sendViaMsg91({ phone, otp, templateId, maskedPhone }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const tId = templateId || process.env.MSG91_TEMPLATE_ID;

  if (!authKey) {
    throw new Error('MSG91_AUTH_KEY is not configured');
  }

  // MSG91 mobile number expects country code without +
  const cleanMobile = phone.replace(/^\+/, '');
  const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(tId || '')}&mobile=${encodeURIComponent(cleanMobile)}&otp=${encodeURIComponent(otp)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.type === 'error')) {
      const err = new Error(data.message || 'MSG91 dispatch failed');
      err.providerResponse = data;
      throw err;
    }

    console.log(`[SMS Provider (MSG91)] OTP successfully sent to ${maskedPhone}`);
    return {
      success: true,
      provider: 'msg91',
      messageId: data.message_id || data.request_id
    };
  } catch (err) {
    console.error(`[SMS Provider (MSG91)] Failed to dispatch to ${maskedPhone}:`, err.message);
    throw err;
  }
}

/**
 * Fast2SMS API Implementation
 */
async function sendViaFast2Sms({ phone, otp, maskedPhone }) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    throw new Error('FAST2SMS_API_KEY is not configured');
  }

  // Fast2SMS expects 10-digit national number for India
  const numbers = phone.replace(/^\+91/, '').replace(/\D/g, '');
  const url = 'https://www.fast2sms.com/dev/bulkV2';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        variables_values: otp,
        route: 'otp',
        numbers: numbers
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.return === false)) {
      const err = new Error(data.message || 'Fast2SMS dispatch failed');
      err.providerResponse = data;
      throw err;
    }

    console.log(`[SMS Provider (Fast2SMS)] OTP successfully sent to ${maskedPhone}`);
    return {
      success: true,
      provider: 'fast2sms',
      messageId: data.request_id
    };
  } catch (err) {
    console.error(`[SMS Provider (Fast2SMS)] Failed to dispatch to ${maskedPhone}:`, err.message);
    throw err;
  }
}

/**
 * Twilio API Implementation
 */
async function sendViaTwilio({ phone, otp, maskedPhone }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('TWILIO credentials (ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER) are not fully configured');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const bodyParams = new URLSearchParams();
  bodyParams.append('To', phone);
  bodyParams.append('From', fromNumber);
  bodyParams.append('Body', `Your VP52 verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.error_code)) {
      const err = new Error(data.message || 'Twilio dispatch failed');
      err.providerResponse = data;
      throw err;
    }

    console.log(`[SMS Provider (Twilio)] OTP successfully sent to ${maskedPhone}`);
    return {
      success: true,
      provider: 'twilio',
      messageId: data.sid
    };
  } catch (err) {
    console.error(`[SMS Provider (Twilio)] Failed to dispatch to ${maskedPhone}:`, err.message);
    throw err;
  }
}

/**
 * Helper for test fixtures to inspect the last mock OTP sent to a phone.
 * Dev / Test only.
 */
function getLastMockOtp(phone) {
  if (process.env.NODE_ENV === 'production') return null;
  const record = mockOtpStore.get(phone);
  return record ? record.otp : null;
}

/**
 * Helper to clear mock OTP store in tests.
 */
function clearMockStore() {
  mockOtpStore.clear();
}

module.exports = {
  sendOtp,
  resolveProvider,
  getLastMockOtp,
  clearMockStore
};
