// End-to-end tests for the Customer <-> Merchant chat feature.
//
// Style matches server/test-e2e.js: no test framework, sequential assertions that
// throw on failure. Rather than binding a TCP port, this harness drives the REAL
// Express app in-process via socket-free request injection. That means it exercises
// the full production stack — CORS + express.json() body parsing, the JWT
// authenticateToken / requireRole middleware, the actual customer/merchant route
// handlers, and the real better-sqlite3 database — without needing a listening
// socket. It runs anywhere `node` runs (no server to start, no port, no network),
// which is also why it is safe in restricted/sandboxed CI.
//
// Fixtures used (from server/db/seed.js), which must already exist in the dev DB:
//   Customer A: customer@example.com     / Customer@123
//   Customer B: rahul.sharma@example.com / Customer@123
//   Shop A:     shop@example.com         / Shop@123   (SHOP-001)
//   Shop B:     cityrest@example.com     / Shop@123   (SHOP-002)

const path = require('path');

// Load env (JWT_SECRET, etc.) exactly like index.js BEFORE requiring any router,
// because middleware/auth.js reads process.env.JWT_SECRET at module-load time.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const { Readable, Duplex } = require('stream');
const express = require('express');
const cors = require('cors');

// Build the same app index.js builds — same middleware order, same routers —
// but without app.listen() (no socket bind).
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/merchant', require('./routes/merchant'));

// Inject a request straight into the Express app and capture the response without
// any TCP/UNIX socket. Keeps the exact { status, body } contract the assertions use.
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = options.method || 'GET';
    req.url = options.path;
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.headers = {};
    for (const key of Object.keys(options.headers || {})) {
      req.headers[key.toLowerCase()] = options.headers[key];
    }
    // A real stream stands in for the socket so Node's IncomingMessage teardown
    // (which calls socket.destroy(), .on(), cork/uncork, etc.) never throws.
    const fakeSocket = new Duplex({ read() {}, write(chunk, enc, cb) { cb(); } });
    fakeSocket.remoteAddress = '127.0.0.1';
    fakeSocket.encrypted = false;
    req.socket = req.connection = fakeSocket;

    let payload = null;
    if (body !== undefined && body !== null) {
      payload = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      if (!req.headers['content-type']) req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = String(payload.length);
    }

    const res = new http.ServerResponse(req);
    const chunks = [];
    let settled = false;

    res.write = function (chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };
    res.end = function (chunk, encoding, cb) {
      if (typeof chunk === 'function') { cb = chunk; chunk = null; }
      else if (typeof encoding === 'function') { cb = encoding; }
      if (chunk) chunks.push(Buffer.from(chunk));
      if (!settled) {
        settled = true;
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON body */ }
        resolve({ status: res.statusCode, headers: res.getHeaders(), body: parsed });
      }
      if (typeof cb === 'function') cb();
      return res;
    };

    try {
      app(req, res);
    } catch (err) {
      reject(err);
      return;
    }

    if (payload) req.push(payload);
    req.push(null);
  });
}

const H = {};
const jsonHeaders = { 'Content-Type': 'application/json' };
const auth = (token) => ({ Authorization: `Bearer ${token}` });

function expect(cond, msg) {
  if (!cond) throw new Error('❌ ' + msg);
  console.log('✅ ' + msg);
}

async function login(path, creds) {
  const res = await request({ ...H, path, method: 'POST', headers: jsonHeaders }, creds);
  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Login failed for ${path}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function run() {
  console.log('🚀 Chat feature verification\n');

  // --- Logins ---
  const custA = await login('/api/auth/customer/login', { email: 'customer@example.com', password: 'Customer@123' });
  const custB = await login('/api/auth/customer/login', { email: 'rahul.sharma@example.com', password: 'Customer@123' });
  const shopA = await login('/api/auth/shop/login', { email: 'shop@example.com', password: 'Shop@123' });
  const shopB = await login('/api/auth/shop/login', { email: 'cityrest@example.com', password: 'Shop@123' });
  const shopAId = shopA.user.shop_id || shopA.user.id;
  const shopBId = shopB.user.shop_id || shopB.user.id;
  console.log(`   (shopA id=${shopAId}, shopB id=${shopBId})\n`);

  // --- 0. Unauthenticated access is rejected ---
  const noTok = await request({ ...H, path: '/api/customer/conversations', method: 'GET' });
  expect(noTok.status === 401, '0. Unauthenticated conversation list is rejected (401)');

  // --- 1. Customer creates a conversation with a shop ---
  const create = await request(
    { ...H, path: '/api/customer/conversations', method: 'POST', headers: { ...jsonHeaders, ...auth(custA.token) } },
    { shop_id: shopAId }
  );
  expect(create.status === 200 && create.body.success && create.body.conversation && create.body.conversation.id,
    '1. Customer creates a conversation with the shop');
  const convId = create.body.conversation.id;

  // --- 9. Duplicate conversation prevented (create-or-reuse) ---
  const createAgain = await request(
    { ...H, path: '/api/customer/conversations', method: 'POST', headers: { ...jsonHeaders, ...auth(custA.token) } },
    { shop_id: shopAId }
  );
  expect(createAgain.status === 200 && createAgain.body.conversation.id === convId,
    '9. Duplicate conversation prevented — same conversation id reused');

  // --- 2. Customer reads their OWN conversation ---
  const ownRead = await request(
    { ...H, path: `/api/customer/conversations/${convId}/messages`, method: 'GET', headers: auth(custA.token) }
  );
  expect(ownRead.status === 200 && ownRead.body.success && Array.isArray(ownRead.body.messages),
    '2. Customer reads their own conversation messages');

  // --- 3. Customer CANNOT read another customer's conversation (IDOR) ---
  const otherCust = await request(
    { ...H, path: `/api/customer/conversations/${convId}/messages`, method: 'GET', headers: auth(custB.token) }
  );
  expect(otherCust.status === 404, "3. Customer B cannot read Customer A's conversation (404, no enumeration)");

  // --- 8. Empty message rejected ---
  const empty = await request(
    { ...H, path: `/api/customer/conversations/${convId}/messages`, method: 'POST', headers: { ...jsonHeaders, ...auth(custA.token) } },
    { message_text: '    ' }
  );
  expect(empty.status === 400, '8. Empty/whitespace message rejected (400)');

  // --- 8b. Over-long message rejected ---
  const tooLong = await request(
    { ...H, path: `/api/customer/conversations/${convId}/messages`, method: 'POST', headers: { ...jsonHeaders, ...auth(custA.token) } },
    { message_text: 'x'.repeat(2001) }
  );
  expect(tooLong.status === 400, '8b. Over-long message (>2000 chars) rejected (400)');

  // --- 6. Customer sends a message ---
  const custMsg = await request(
    { ...H, path: `/api/customer/conversations/${convId}/messages`, method: 'POST', headers: { ...jsonHeaders, ...auth(custA.token) } },
    { message_text: 'Hello, is offer still valid?' }
  );
  expect(custMsg.status === 201 && custMsg.body.success && custMsg.body.message.sender_role === 'customer',
    '6. Customer sends a message (sender_role=customer)');

  // --- 4. Merchant reads their own shop's conversations, sees unread from customer ---
  const merchList = await request(
    { ...H, path: '/api/merchant/conversations', method: 'GET', headers: auth(shopA.token) }
  );
  const merchConvo = merchList.body.conversations.find((c) => c.id === convId);
  expect(merchList.status === 200 && merchConvo, '4. Merchant sees the conversation for their shop');
  expect(merchConvo.unread_count >= 1, '10a. Merchant has unread count >= 1 after customer message');

  // --- 5. Merchant CANNOT access another shop's conversation (IDOR) ---
  const otherShopRead = await request(
    { ...H, path: `/api/merchant/conversations/${convId}/messages`, method: 'GET', headers: auth(shopB.token) }
  );
  expect(otherShopRead.status === 404, "5. Shop B cannot read Shop A's conversation (404, no enumeration)");
  const otherShopSend = await request(
    { ...H, path: `/api/merchant/conversations/${convId}/messages`, method: 'POST', headers: { ...jsonHeaders, ...auth(shopB.token) } },
    { message_text: 'I should not be able to send this' }
  );
  expect(otherShopSend.status === 404, "5b. Shop B cannot send into Shop A's conversation (404)");

  // --- 10b. Merchant marks read -> unread clears ---
  const merchRead = await request(
    { ...H, path: `/api/merchant/conversations/${convId}/read`, method: 'PATCH', headers: auth(shopA.token) }
  );
  expect(merchRead.status === 200 && merchRead.body.success, '10b. Merchant marks conversation read');
  const merchListAfter = await request(
    { ...H, path: '/api/merchant/conversations', method: 'GET', headers: auth(shopA.token) }
  );
  const merchConvoAfter = merchListAfter.body.conversations.find((c) => c.id === convId);
  expect(merchConvoAfter && merchConvoAfter.unread_count === 0, '10c. Merchant unread count is 0 after marking read');

  // --- 7. Merchant replies ---
  const merchMsg = await request(
    { ...H, path: `/api/merchant/conversations/${convId}/messages`, method: 'POST', headers: { ...jsonHeaders, ...auth(shopA.token) } },
    { message_text: 'Yes! Valid until end of month.' }
  );
  expect(merchMsg.status === 201 && merchMsg.body.message.sender_role === 'shop',
    '7. Merchant replies (sender_role=shop)');

  // --- 10d. Customer now has unread from shop, then clears it ---
  const custUnread = await request(
    { ...H, path: '/api/customer/conversations/unread-count', method: 'GET', headers: auth(custA.token) }
  );
  expect(custUnread.status === 200 && custUnread.body.unread_count >= 1,
    '10d. Customer unread-count >= 1 after merchant reply');
  const custRead = await request(
    { ...H, path: `/api/customer/conversations/${convId}/read`, method: 'PATCH', headers: auth(custA.token) }
  );
  expect(custRead.status === 200 && custRead.body.success, '10e. Customer marks conversation read');
  const custList = await request(
    { ...H, path: '/api/customer/conversations', method: 'GET', headers: auth(custA.token) }
  );
  const custConvo = custList.body.conversations.find((c) => c.id === convId);
  expect(custConvo && custConvo.unread_count === 0, '10f. Customer unread count is 0 after marking read');

  // --- Extra: creating a conversation with a non-existent shop is rejected ---
  const badShop = await request(
    { ...H, path: '/api/customer/conversations', method: 'POST', headers: { ...jsonHeaders, ...auth(custA.token) } },
    { shop_id: 999999 }
  );
  expect(badShop.status === 404, 'Extra. Conversation creation with non-existent shop rejected (404)');

  console.log('\n🎉 All chat tests passed!');
}

run().catch((err) => {
  console.error('\n' + (err && err.message ? err.message : err));
  process.exit(1);
});
