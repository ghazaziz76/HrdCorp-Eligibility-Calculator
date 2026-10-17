const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('./helpers');
const rateLimit = require('../lib/rateLimit');

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });
beforeEach(() => {
    rateLimit._resetAll();
    process.env.RATE_LIMIT_PER_HOUR = '100000';
    process.env.ADMIN_PASSWORD = 'test-admin';
});

// Requests come from a normal outside address (via the trusted local proxy), as in production.
const XFF = { 'x-forwarded-for': '203.0.113.9' };
const post = (p, body, headers = {}) => fetch(srv.base + p, {
    method: 'POST', headers: { 'content-type': 'application/json', ...XFF, ...headers }, body: JSON.stringify(body),
});
const login = (password) => post('/api/admin/login', { password });

test('missing ADMIN_PASSWORD: no admin login or admin route works, not even admin123', async () => {
    delete process.env.ADMIN_PASSWORD;
    for (const pw of ['admin123', '', undefined]) {
        assert.strictEqual((await login(pw)).status, 401, String(pw));
    }
    const r = await fetch(srv.base + '/api/admin/tge-users', { headers: { 'x-admin-password': 'admin123' } });
    assert.strictEqual(r.status, 401);
    const r2 = await fetch(srv.base + '/api/admin/tge-users', { headers: {} });
    assert.strictEqual(r2.status, 401);
});

test('correct password logs in; wrong password and different-length password are rejected', async () => {
    assert.strictEqual((await login('test-admin')).status, 200);
    assert.strictEqual((await login('test-admiN')).status, 401);
    assert.strictEqual((await login('x')).status, 401);
    assert.strictEqual((await login({ not: 'a string' })).status, 401);
    const ok = await fetch(srv.base + '/api/admin/tge-users', { headers: { 'x-admin-password': 'test-admin' } });
    assert.strictEqual(ok.status, 200);
});

test('admin login: after too many failures the IP gets 429, even with the right password', async () => {
    process.env.RATE_LIMIT_PER_HOUR = '3';
    for (let i = 0; i < 3; i++) assert.strictEqual((await login('wrong')).status, 401);
    const r = await login('test-admin');
    assert.strictEqual(r.status, 429);
    assert.ok((await r.json()).error);
    const h = await fetch(srv.base + '/api/admin/tge-users', { headers: { ...XFF, 'x-admin-password': 'test-admin' } });
    assert.strictEqual(h.status, 429);
});

test('successful admin requests do not use up the failure budget', async () => {
    process.env.RATE_LIMIT_PER_HOUR = '3';
    for (let i = 0; i < 6; i++) assert.strictEqual((await login('test-admin')).status, 200);
});

test('registration is rate limited per IP: 429 rate_limited', async () => {
    process.env.RATE_LIMIT_PER_HOUR = '3';
    for (let i = 0; i < 3; i++) {
        const r = await post('/api/employer/activation-codes', { code: `HRD-RATE-0000-000${i}`, feature_key: 'hrd_grant_calculator' });
        assert.strictEqual(r.status, 200);
    }
    const r = await post('/api/employer/activation-codes', { code: 'HRD-RATE-0000-0009', feature_key: 'hrd_grant_calculator' });
    assert.strictEqual(r.status, 429);
    const j = await r.json();
    assert.strictEqual(j.success, false);
    assert.strictEqual(j.reason, 'rate_limited');
    assert.ok(j.message);
});

test('validate-code is rate limited per IP', async () => {
    process.env.RATE_LIMIT_PER_HOUR = '2';
    assert.strictEqual((await post('/api/employer/validate-code', { code: 'HRD-NOPE-NOPE-NOPE' })).status, 404);
    assert.strictEqual((await post('/api/employer/validate-code', { code: 'HRD-NOPE-NOPE-NOPE' })).status, 404);
    const r = await post('/api/employer/validate-code', { code: 'HRD-NOPE-NOPE-NOPE' });
    assert.strictEqual(r.status, 429);
    assert.strictEqual((await r.json()).reason, 'rate_limited');
});

test('ai-brochure is rate limited per IP', async () => {
    process.env.RATE_LIMIT_PER_HOUR = '1';
    const up = () => fetch(srv.base + '/api/employer/ai-brochure', { method: 'POST', headers: { ...XFF, 'x-tge-code': 'HRD-NOPE-NOPE-NOPE' } });
    assert.strictEqual((await up()).status, 404);
    const r = await up();
    assert.strictEqual(r.status, 429);
    assert.strictEqual((await r.json()).reason, 'rate_limited');
});

test('limiter unit: separate keys, window expiry', () => {
    let t = 0;
    const lim = rateLimit.createLimiter({ name: 'unit', windowMs: 1000, max: () => 2, clock: () => t });
    assert.strictEqual(lim.hit('a'), true);
    assert.strictEqual(lim.hit('a'), true);
    assert.strictEqual(lim.hit('a'), false);
    assert.strictEqual(lim.hit('b'), true);
    t = 1001;
    assert.strictEqual(lim.hit('a'), true);
});
