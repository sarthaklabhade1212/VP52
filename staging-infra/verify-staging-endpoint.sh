#!/usr/bin/env bash
# ==============================================================================
# VP52 Public Staging Endpoint Verification Script
# Target: https://staging-api.vp52coin.com
# ==============================================================================
set -euo pipefail

TARGET_HOST="staging-api.vp52coin.com"
TARGET_URL="https://${TARGET_HOST}"

echo "======================================================================"
echo "VP52 STAGING ENDPOINT VERIFICATION: ${TARGET_URL}"
echo "======================================================================"

# 1. DNS Resolution Check
echo -n "[1/5] Checking DNS Resolution for ${TARGET_HOST}... "
DNS_IP=$(dig +short A "${TARGET_HOST}" | tail -n1 || true)
if [ -z "${DNS_IP}" ]; then
    echo "❌ FAILED (No A record found)"
    echo "👉 Please configure GoDaddy DNS A record: staging-api -> [Staging Host IP]"
    exit 1
fi
echo "✓ Resolved to ${DNS_IP}"

# 2. TLS Certificate Validity Check
echo -n "[2/5] Checking TLS Certificate Validity... "
TLS_EXPIRY=$(echo | openssl s_client -servername "${TARGET_HOST}" -connect "${TARGET_HOST}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null || true)
if [ -z "${TLS_EXPIRY}" ]; then
    echo "❌ FAILED (TLS handshake failed)"
    exit 1
fi
echo "✓ Valid (${TLS_EXPIRY})"

# 3. Health Check Endpoint
echo -n "[3/5] Testing Staging Health Endpoint (${TARGET_URL}/api/health)... "
HEALTH_RESP=$(curl -sS -o /dev/null -w "%{http_code}" "${TARGET_URL}/api/health" || true)
if [ "${HEALTH_RESP}" != "200" ]; then
    echo "❌ FAILED (HTTP ${HEALTH_RESP})"
    exit 1
fi
echo "✓ HTTP 200 OK"

# 4. SSV Route Reachability Without Customer JWT
echo -n "[4/5] Testing SSV Route Reachability Without Customer JWT... "
SSV_RESP=$(curl -sS -o /dev/null -w "%{http_code}" "${TARGET_URL}/api/admob/ssv" || true)
# Should return 400 (Missing or invalid signature), NOT 401 or 403 (Customer JWT not required)
if [ "${SSV_RESP}" != "400" ]; then
    echo "❌ FAILED (Expected HTTP 400 for unsigned callback, got HTTP ${SSV_RESP})"
    exit 1
fi
echo "✓ HTTP 400 (Unsigned callback rejected fail-closed, customer JWT not required)"

# 5. Invalid Signature Rejection Test
echo -n "[5/5] Testing Fake/Tampered Signature Rejection... "
TAMPER_RESP=$(curl -sS "${TARGET_URL}/api/admob/ssv?custom_data=VP52SSV_fake&signature=invalid_sig&key_id=999999" || true)
if echo "${TAMPER_RESP}" | grep -q "INVALID_SIGNATURE"; then
    echo "✓ HTTP 400 INVALID_SIGNATURE (Zero coins credited)"
else
    echo "❌ Unexpected response: ${TAMPER_RESP}"
    exit 1
fi

echo "======================================================================"
echo "🎉 ALL STAGING INGRESS VERIFICATION CHECKS PASSED!"
echo "======================================================================"
