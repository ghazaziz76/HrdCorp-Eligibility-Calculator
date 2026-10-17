const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer, signedPost } = require('./helpers');

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

const post = (p, body) => fetch(srv.base + p, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const sync = async (o) => (await (await signedPost(srv.base, '/api/newsletter/entitlement', {
    code: null, email: 'x@y.com', name: 'X', status: 'paid', plan_source: 'yearly', paying: true,
    permanent: false, locked_reason: null, refunded_at: null, anchor_date: '2026-10-17', ...o,
})).json()).data;

test('access for yearly paid → enabled, limit 50, resets_on = anchor day next month', async () => {
    const d = await sync({ email: 'yr@y.com', anchor_date: '2026-01-17' });
    const r = await post('/api/employer/access', { code: d.code });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.success, true);
    assert.strictEqual(j.data.tge, 'activated');
    assert.strictEqual(j.data.ai.enabled, true);
    assert.strictEqual(j.data.ai.limit, 50);
    assert.match(j.data.ai.resets_on, /^\d{4}-\d{2}-17$/);
    assert.ok(j.data.ai.resets_on > new Date().toISOString().slice(0, 10));
});

test('access unknown code → 404, missing code → 400', async () => {
    assert.strictEqual((await post('/api/employer/access', { code: 'HRD-NOPE-NOPE-NOPE' })).status, 404);
    assert.strictEqual((await post('/api/employer/access', {})).status, 400);
});

test('validate-code on a refunded gift code → 403', async () => {
    const d = await sync({ email: 'rf@y.com', paying: false, permanent: false, locked_reason: 'refund', refunded_at: '2026-10-01' });
    const r = await post('/api/employer/validate-code', { code: d.code });
    assert.strictEqual(r.status, 403);
    assert.deepStrictEqual(await r.json(), {
        success: false, message: 'This code is no longer active. Contact admin@milleniumrx.biz', reason: 'refund',
    });
});

test('check-session returns code, and 403 when locked', async () => {
    const d = await sync({ email: 'cs@y.com' });
    const v = await (await post('/api/employer/validate-code', { code: d.code })).json();
    assert.strictEqual(v.success, true);
    const r = await fetch(srv.base + '/api/employer/check-session?session_token=' + v.data.session_token);
    const j = await r.json();
    assert.strictEqual(j.success, true);
    assert.strictEqual(j.data.code, d.code);
    await sync({ code: d.code, email: 'cs@y.com', paying: false, locked_reason: 'blocked', status: 'blocked' });
    const r2 = await fetch(srv.base + '/api/employer/check-session?session_token=' + v.data.session_token);
    assert.strictEqual(r2.status, 403);
    assert.strictEqual((await r2.json()).reason, 'blocked');
});

test('legacy play code (no source field) → activated, ai reason play_unverified', async () => {
    const f = path.join(srv.dataDir, 'activation-codes.json');
    fs.writeFileSync(f, JSON.stringify([{ code: 'HRD-PLAY-PLAY-PLAY', feature_key: 'tge', registered_at: '2026-05-05T00:00:00Z', activated: false }]));
    const j = await (await post('/api/employer/access', { code: 'HRD-PLAY-PLAY-PLAY' })).json();
    assert.strictEqual(j.data.tge, 'activated');
    assert.strictEqual(j.data.ai.reason, 'play_unverified');
    assert.strictEqual((await post('/api/employer/validate-code', { code: 'HRD-PLAY-PLAY-PLAY' })).status, 200);
});

test('activate-qr on a refunded gift code → 403 and entry not activated', async () => {
    const d = await sync({ email: 'qr@y.com', paying: false, locked_reason: 'refund', refunded_at: '2026-10-01' });
    const r = await post('/api/employer/activate-qr', { session_token: 'tok123', activation_code: d.code });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).reason, 'refund');
    const codes = JSON.parse(fs.readFileSync(path.join(srv.dataDir, 'activation-codes.json'), 'utf8'));
    const e = codes.find(c => c.code === d.code);
    assert.strictEqual(e.activated, false);
    assert.strictEqual(e.session_token, null);
});
