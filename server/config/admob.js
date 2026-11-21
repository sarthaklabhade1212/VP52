/**
 * Google AdMob & SSV Configuration
 *
 * Stage 5B.4A / 5B.4.1B Rewarded Ad Configuration:
 * - App ID:              ca-app-pub-4004834464698326~8764285486
 * - Rewarded Ad Unit ID: ca-app-pub-4004834464698326/8368553876
 * - Reward Amount:       1
 * - Reward Item:         coin
 * - Session Policy:      3 rewarded ads per 6-hour customer session
 *
 * NOTE: Live AdMob SSV callback URL must only be configured in the AdMob console
 * after deployment to a verified HTTPS endpoint.
 */

const DEFAULT_ADMOB_APP_ID = 'ca-app-pub-4004834464698326~8764285486';
const DEFAULT_ADMOB_REWARDED_AD_UNIT_ID = 'ca-app-pub-4004834464698326/8368553876';

// Native / Banner placeholders retained from prior stages until production units are supplied
const DEFAULT_NATIVE_AD_UNIT_ID = 'ca-app-pub-3940256099942544/2247696110';
const DEFAULT_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

const SSV_REWARD_AMOUNT = 1;
const SSV_REWARD_ITEM = 'coin';
const SESSION_DURATION_HOURS = 6;
const MAX_ADS_PER_SESSION = 3;
const COIN_EXPIRY_DAYS = 30;
const DEFAULT_PENDING_TTL_SECONDS = 900; // 15 minutes

function extractNumericUnitId(unitId) {
  if (!unitId || typeof unitId !== 'string') return '';
  const trimmed = unitId.trim();
  if (!trimmed) return '';
  const slashIdx = trimmed.indexOf('/');
  return slashIdx >= 0 ? trimmed.slice(slashIdx + 1).trim() : trimmed;
}

function getAdMobConfig() {
  const appId = (process.env.ADMOB_APP_ID || '').trim() || DEFAULT_ADMOB_APP_ID;
  const rewardedAdUnitId = (process.env.ADMOB_REWARDED_AD_UNIT_ID || '').trim() || DEFAULT_ADMOB_REWARDED_AD_UNIT_ID;
  const nativeAdUnitId = (process.env.ADMOB_NATIVE_AD_UNIT_ID || '').trim() || DEFAULT_NATIVE_AD_UNIT_ID;
  const bannerAdUnitId = (process.env.ADMOB_BANNER_AD_UNIT_ID || '').trim() || DEFAULT_BANNER_AD_UNIT_ID;

  const ttlRaw = parseInt(process.env.ADMOB_SSV_PENDING_TTL_SECONDS || String(DEFAULT_PENDING_TTL_SECONDS), 10);
  const pendingTtlSeconds = (!Number.isNaN(ttlRaw) && ttlRaw > 0) ? ttlRaw : DEFAULT_PENDING_TTL_SECONDS;

  return {
    appId,
    rewardedAdUnitId,
    rewardedAdUnitNumericId: extractNumericUnitId(rewardedAdUnitId),
    nativeAdUnitId,
    bannerAdUnitId,
    rewardAmount: SSV_REWARD_AMOUNT,
    rewardItem: SSV_REWARD_ITEM,
    sessionDurationHours: SESSION_DURATION_HOURS,
    maxAdsPerSession: MAX_ADS_PER_SESSION,
    coinExpiryDays: COIN_EXPIRY_DAYS,
    pendingTtlSeconds,
    callbackUrlConfigured: Boolean((process.env.ADMOB_SSV_CALLBACK_URL || '').trim())
  };
}

/**
 * Validates that incoming AdMob SSV `ad_unit` matches the configured rewarded ad unit.
 * Google sends either the numeric unit suffix (e.g. `8368553876`) or full ID
 * (`ca-app-pub-4004834464698326/8368553876`).
 * Rejects wrong unit IDs, wrong publisher prefixes, empty strings, and test ad units.
 */
function isExpectedRewardedAdUnit(incomingAdUnit, configuredAdUnitId = getAdMobConfig().rewardedAdUnitId) {
  if (!incomingAdUnit || typeof incomingAdUnit !== 'string') return false;
  const incoming = incomingAdUnit.trim();
  const configured = String(configuredAdUnitId || '').trim();
  if (!incoming || !configured) return false;

  if (incoming.includes('/')) {
    return incoming === configured;
  }

  const expectedNumeric = extractNumericUnitId(configured);
  return Boolean(expectedNumeric) && incoming === expectedNumeric;
}

module.exports = {
  DEFAULT_ADMOB_APP_ID,
  DEFAULT_ADMOB_REWARDED_AD_UNIT_ID,
  SSV_REWARD_AMOUNT,
  SSV_REWARD_ITEM,
  SESSION_DURATION_HOURS,
  MAX_ADS_PER_SESSION,
  COIN_EXPIRY_DAYS,
  DEFAULT_PENDING_TTL_SECONDS,
  extractNumericUnitId,
  getAdMobConfig,
  isExpectedRewardedAdUnit
};
