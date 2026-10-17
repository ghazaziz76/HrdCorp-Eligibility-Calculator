const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { startTestServer, signedPost } = require('./helpers');

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

const P = '/api/newsletter/entitlement';
const base = (o = {}) => ({
    code: null, email: 'A@B.com', name: 'Ann', status: 'paid', plan_source: 'yearly',
    paying: true, permanent: false, locked_reason: null, refunded_at: null,
    anchor_date: '2026-10-17', ...o,
});

test('rejects missing headers, wrong signature, timestamp 301 s old, and a replayed signature with 401', async () => {
    const b = base({ email: 'rej@b.com' });
    const now = Math.floor(Date.now() / 1000);
    let r = await signedPost(srv.base, P, b, { omitTimestamp: true });
    assert.strictEqual(r.status, 401);
    r = await signedPost(srv.base, P, b, { omitSignature: true });
    assert.strictEqual(r.status, 401);
    r = await signedPost(srv.base, P, b, { signature: 'a'.repeat(64) });
    assert.strictEqual(r.status, 401);
    r = await signedPost(srv.base, P, b, { signature: 'zz' });
    assert.strictEqual(r.status, 401);
    r = await signedPost(srv.base, P, b, { secret: 'x'.repeat(40) });
    assert.strictEqual(r.status, 401);
    r = await signedPost(srv.base, P, b, { timestamp: now - 301 });
    assert.strictEqual(r.status, 401);
    r = await signedPost(srv.base, P, b, { timestamp: now + 301 });
    assert.strictEqual(r.status, 401);
    const j = await r.json();
    assert.strictEqual(j.success, false);
    assert.ok(!JSON.stringify(j).includes(process.env.TGE_NEWSLETTER_SECRET));
    // the old header scheme is not accepted
    r = await fetch(srv.base + P, { method: 'POST', headers: { 'content-type': 'application/json', 'x-tge-secret': process.env.TGE_NEWSLETTER_SECRET }, body: JSON.stringify(b) });
    assert.strictEqual(r.status, 401);
    // replay
    const ts = String(now);
    const raw = JSON.stringify(b);
    const sig = crypto.createHmac('sha256', process.env.TGE_NEWSLETTER_SECRET).update(ts + '.' + raw).digest('hex');
    const ok = await signedPost(srv.base, P, b, { timestamp: ts, signature: sig });
    assert.strictEqual(ok.status, 200);
    const again = await signedPost(srv.base, P, b, { timestamp: ts, signature: sig });
    assert.strictEqual(again.status, 401);
});

test('accepts a correctly signed request', async () => {
    const r = await signedPost(srv.base, P, base({ email: 'ok@b.com' }));
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.success, true);
    assert.match(j.data.code, /^HRD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.strictEqual(j.data.created, true);
    assert.strictEqual(j.data.access.tge, 'activated');
});

test('bad body → 400', async () => {
    let r = await signedPost(srv.base, P, { email: '' });
    assert.strictEqual(r.status, 400);
    r = await signedPost(srv.base, P, null, { rawBody: '{not json' });
    assert.strictEqual(r.status, 400);
});

test('creates code once per email (second call with same email returns same code, created:false)', async () => {
    const a = await (await signedPost(srv.base, P, base({ email: 'Once@B.com' }))).json();
    const b = await (await signedPost(srv.base, P, base({ email: 'once@b.COM', name: 'New' }))).json();
    assert.strictEqual(a.data.created, true);
    assert.strictEqual(b.data.created, false);
    assert.strictEqual(a.data.code, b.data.code);
});

test('update by code changes email (rename) and keeps code', async () => {
    const a = await (await signedPost(srv.base, P, base({ email: 'old@b.com' }))).json();
    const b = await (await signedPost(srv.base, P, base({ code: a.data.code, email: 'New@B.com' }))).json();
    assert.strictEqual(b.data.code, a.data.code);
    assert.strictEqual(b.data.created, false);
    const l = await (await signedPost(srv.base, '/api/newsletter/entitlements/lookup', { emails: ['new@b.com', 'old@b.com'] })).json();
    assert.strictEqual(l.data['new@b.com'].code, a.data.code);
    assert.strictEqual(l.data['old@b.com'], undefined);
});

test('monthly past_due sync → access.tge locked', async () => {
    const r = await (await signedPost(srv.base, P, base({
        email: 'pd@b.com', status: 'past_due', plan_source: 'monthly', paying: false,
        locked_reason: 'not_entitled',
    }))).json();
    assert.strictEqual(r.data.access.tge, 'locked');
    assert.strictEqual(r.data.access.ai.enabled, false);
});

test('lookup returns code/tge/ai keyed by lowercased email', async () => {
    const a = await (await signedPost(srv.base, P, base({ email: 'Look@B.com' }))).json();
    const l = await (await signedPost(srv.base, '/api/newsletter/entitlements/lookup', { emails: ['LOOK@b.com', 'none@b.com'] })).json();
    assert.strictEqual(l.success, true);
    assert.deepStrictEqual(Object.keys(l.data), ['look@b.com']);
    assert.strictEqual(l.data['look@b.com'].code, a.data.code);
    assert.strictEqual(l.data['look@b.com'].tge, 'activated');
    assert.strictEqual(l.data['look@b.com'].ai.limit, 50);
    const bad = await signedPost(srv.base, '/api/newsletter/entitlements/lookup', { emails: 'x' });
    assert.strictEqual(bad.status, 400);
});

test('503 when secret env unset or short', async () => {
    const saved = process.env.TGE_NEWSLETTER_SECRET;
    try {
        delete process.env.TGE_NEWSLETTER_SECRET;
        let r = await signedPost(srv.base, P, base(), { secret: saved });
        assert.strictEqual(r.status, 503);
        process.env.TGE_NEWSLETTER_SECRET = 'short';
        r = await signedPost(srv.base, P, base(), { secret: 'short' });
        assert.strictEqual(r.status, 503);
    } finally {
        process.env.TGE_NEWSLETTER_SECRET = saved;
    }
});
