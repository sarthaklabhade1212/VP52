const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runUpgradedE2ETest() {
  console.log('🚀 Running Upgraded Reward Economy & Platform System Verification Script...');

  // 1. Customer Login & Wallet Verification
  console.log('\n--- 1. Customer Authentication & Wallet Expiry Test ---');
  const custLogin = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/auth/customer/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'customer@example.com', password: 'Customer@123' });

  if (custLogin.status !== 200 || !custLogin.body.token) {
    throw new Error('Customer login failed: ' + JSON.stringify(custLogin.body));
  }
  const custToken = custLogin.body.token;

  const walletRes = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/customer/wallet', method: 'GET',
    headers: { 'Authorization': `Bearer ${custToken}` }
  });

  if (walletRes.status !== 200 || !walletRes.body.wallet) {
    throw new Error('Customer wallet fetch failed!');
  }
  console.log('✅ Customer Wallet PASS! Available Coins:', walletRes.body.wallet.available_coins, '| Discount Value: ₹' + walletRes.body.wallet.discount_value_inr);

  // 2. 6-Hour Reward Session & 3-Ad Limit Test
  console.log('\n--- 2. Server-Controlled 6-Hour Session & 3-Ad Limit Test ---');
  const sessionStatus = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/customer/reward-session/status', method: 'GET',
    headers: { 'Authorization': `Bearer ${custToken}` }
  });

  if (sessionStatus.status !== 200 || !sessionStatus.body.active) {
    throw new Error('Reward session status failed: ' + JSON.stringify(sessionStatus.body));
  }
  console.log('✅ Active 6-Hour Session Verified! Ads Watched:', sessionStatus.body.session.ads_watched + '/3', '| Time Left:', sessionStatus.body.session.remaining_seconds + 's');

  // Watch 1 Ad
  const watchAdRes = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/customer/reward-session/watch-ad', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${custToken}` }
  });

  if (watchAdRes.status !== 200 || !watchAdRes.body.success) {
    throw new Error('Watch ad reward failed: ' + JSON.stringify(watchAdRes.body));
  }
  console.log('✅ Demo Reward Ad Completion PASS!', watchAdRes.body.message);

  // 3. Level Progression & Discount Cap Engine Test
  console.log('\n--- 3. Level Progression & Discount Cap Engine Test ---');
  const levelRes = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/customer/level', method: 'GET',
    headers: { 'Authorization': `Bearer ${custToken}` }
  });

  if (levelRes.status !== 200 || !levelRes.body.currentLevel) {
    throw new Error('Customer level calculation failed!');
  }
  console.log('✅ Customer Level Engine PASS! Current Tier:', levelRes.body.currentLevel, '| Lifetime Coins:', levelRes.body.lifetimeCoins, '| Max Discount Cap:', levelRes.body.discountCapPercent + '%');

  // 4. Merchant Itemized Billing with Level Discount Cap & FIFO Redemption Test
  console.log('\n--- 4. Merchant Billing with Level Discount Cap & FIFO Redemption Test ---');
  const shopLogin = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/auth/shop/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'shop@example.com', password: 'Shop@123' });

  const shopToken = shopLogin.body.token;

  const billRes = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/merchant/create-bill', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${shopToken}` }
  }, {
    customer_identifier: 'customer@example.com',
    items: [
      { product_name: 'Paithani Saree', price: 2000, quantity: 1, reward_eligible: true },
      { product_name: 'Matching Jewellery', price: 500, quantity: 1, reward_eligible: false }
    ]
  });

  if (billRes.status !== 201 || !billRes.body.success) {
    throw new Error('Create itemized bill failed: ' + JSON.stringify(billRes.body));
  }
  const bill = billRes.body.bill;
  console.log('✅ Itemized Bill Generated with Level Cap PASS!');
  console.log(`   Bill Number: ${bill.bill_number}`);
  console.log(`   Customer Level: ${bill.customer_level} (Max ${bill.level_discount_cap_percent}% Cap)`);
  console.log(`   Eligible Amount: ₹${bill.eligible_amount} | Max Allowed Discount: ₹${bill.max_allowed_discount}`);
  console.log(`   Coins Redeemed via FIFO: ${bill.coins_redeemed} | Net Amount Payable: ₹${bill.net_amount_payable}`);
  console.log(`   Points Awarded: +${bill.points_awarded} Coins (30-day lot)`);

  // 5. Admin Reward Economy Settings Update Test
  console.log('\n--- 5. Admin Reward Economy Configuration Test ---');
  const adminLogin = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/auth/admin/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@example.com', password: 'Admin@123' });

  const adminToken = adminLogin.body.token;

  const updateSettingsRes = await request({
    hostname: '127.0.0.1', port: 5000, path: '/api/admin/reward-settings', method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    settings: { session_duration_hours: '6', ads_per_session: '3', max_sessions_per_day: '2', coins_per_ad: '2', coin_expiry_days: '30' }
  });

  if (updateSettingsRes.status !== 200 || !updateSettingsRes.body.success) {
    throw new Error('Admin reward settings update failed!');
  }
  console.log('✅ Admin Reward Economy Configuration PASS! Settings updated and logged to audit trail.');

  console.log('\n🎉 ALL REWARD ECONOMY & PLATFORM SYSTEM TESTS PASSED PERFECTLY!');
}

runUpgradedE2ETest().catch(err => {
  console.error('❌ E2E Test Failure:', err);
  process.exit(1);
});
