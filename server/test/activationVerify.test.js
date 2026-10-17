const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer } = require('./helpers');
const playVerify = require('../lib/playVerify');
const store = require('../lib/store');

const PENDING_MESSAGE = 'Your purchase is being verified. Open the app once with internet, then try again.';
const FK = 'hrd_grant_calculator';

let srv;
const realApply = playVerify.applyVerification;
before(async () => {
    // Today's date may be before the real cutoff; move it back so new registrations are checked.
    process.env.TGE_PLAY_VERIFY_CUTOFF = '2026-01-01T00:00:00Z';
    srv = await startTestServer();
    process.env.REVENUECAT_SECRET_KEY = 'test-rc-key';
});
after(async () => {
    playVerify.applyVerification = realApply;
    delete process.env.REVENUECAT_SECRET_KEY;
    delete process.env.TGE_PLAY_VERIFY_CUTOFF;
    await srv.close();
});

// Default stub: RevenueCat never confirms. Never reaches the network.
const calls = [];
beforeEach(() => {
    calls.length = 0;
    playVerify.applyVerification = async (code) => { calls.push(code); return { verified: false, reason: 'not_found' }; };
});

// Stub that marks the entry verified, like the real applyVerification on success.
const verifyingStub = async (code) => {
    calls.push(code);
    const codes = store.readJSON('activation-codes.json', []);
    const e = codes.find((c) => c.code === code);
    e.play = { ...(e.play || {}), verified_at: new Date().toISOString(), purchase_date: '2026-10-20', store_transaction_id: 'GPA.1' };
    store.writeJSON('activation-codes.json', codes);
    return { verified: true, reason: 'ok' };
};

const post = (p, body) => fetch(srv.base + p, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const register = (body) => post('/api/employer/activation-codes', body);
const readCodes = () => {
    const f = path.join(srv.dataDir, 'activation-codes.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
};

test('registration rejects a bad code format with 400', async () => {
    for (const code of ['hrd-aaaa-bbbb-cccc', 'HRD-AAAA-BBBB', 'X', 'HRD-AAAA-BBBB-CCCC-DDDD', 123]) {
        const r = await register({ code, feature_key: FK });
        assert.strictEqual(r.status, 400, String(code));
        assert.strictEqual((await r.json()).success, false);
    }
});

test('registration rejects a wrong feature_key with 400', async () => {
    const r = await register({ code: 'HRD-FKFK-FKFK-FKFK', feature_key: 'tge' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).success, false);
    assert.ok(!(readCodes().some((c) => c.code === 'HRD-FKFK-FKFK-FKFK')));
});

test('new unverified play code: validate-code 403 pending, access tge pending', async () => {
    const code = 'HRD-PEND-0000-0001';
    const reg = await register({ code, feature_key: FK });
    assert.strictEqual(reg.status, 200);
    assert.deepStrictEqual(await reg.json(), { success: true, data: { code, feature_key: FK } });

    const v = await post('/api/employer/validate-code', { code });
    assert.strictEqual(v.status, 403);
    assert.deepStrictEqual(await v.json(), { success: false, message: PENDING_MESSAGE, reason: 'pending_verification' });
    const e = readCodes().find((c) => c.code === code);
    assert.strictEqual(e.activated, false);
    assert.strictEqual(e.session_token, null);

    const a = await (await post('/api/employer/access', { code })).json();
    assert.strictEqual(a.success, true);
    assert.strictEqual(a.data.tge, 'pending');
    assert.strictEqual(a.data.ai.reason, 'pending_verification');
    // No rc_app_user_id: nothing to verify against.
    assert.deepStrictEqual(calls, []);
});

test('validate-code on an unverified code with rc_app_user_id verifies and unlocks', async () => {
    const code = 'HRD-PEND-0000-0002';
    playVerify.applyVerification = async () => ({ verified: false, reason: 'not_found' });
    await register({ code, feature_key: FK, rc_app_user_id: 'rc-2' });
    playVerify.applyVerification = verifyingStub;
    const v = await post('/api/employer/validate-code', { code });
    assert.strictEqual(v.status, 200);
    const j = await v.json();
    assert.strictEqual(j.success, true);
    assert.match(j.data.session_token, /^[0-9a-f]{64}$/);
    assert.deepStrictEqual(calls, [code]);
});

test('access on an unverified code with rc_app_user_id triggers verification', async () => {
    const code = 'HRD-PEND-0000-0003';
    playVerify.applyVerification = async () => ({ verified: false, reason: 'not_found' });
    await register({ code, feature_key: FK, rc_app_user_id: 'rc-3' });
    playVerify.applyVerification = verifyingStub;
    const a = await (await post('/api/employer/access', { code })).json();
    assert.strictEqual(a.data.tge, 'activated');
    assert.deepStrictEqual(calls, [code]);
});

test('verification is not retried more than once per short window', async () => {
    const code = 'HRD-PEND-0000-0004';
    await register({ code, feature_key: FK, rc_app_user_id: 'rc-4' });
    calls.length = 0;
    await post('/api/employer/validate-code', { code });
    await post('/api/employer/validate-code', { code });
    await post('/api/employer/access', { code });
    assert.ok(calls.length <= 1, `called ${calls.length} times`);
});

test('activate-qr on a pending code -> 403 pending, session not linked', async () => {
    const code = 'HRD-PEND-0000-0005';
    await register({ code, feature_key: FK });
    const r = await post('/api/employer/activate-qr', { session_token: 'tok-pend', activation_code: code });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).reason, 'pending_verification');
    const c = await fetch(srv.base + '/api/employer/check-session?session_token=tok-pend');
    assert.strictEqual(c.status, 200);
    assert.strictEqual((await c.json()).success, false);
});

test('grandfathered code registered before the cutoff still validates', async () => {
    const codes = readCodes();
    codes.push({ code: 'HRD-OLDD-OLDD-OLDD', feature_key: FK, registered_at: '2025-12-01T00:00:00Z', activated: false, activated_at: null, session_token: null });
    fs.writeFileSync(path.join(srv.dataDir, 'activation-codes.json'), JSON.stringify(codes));
    const v = await post('/api/employer/validate-code', { code: 'HRD-OLDD-OLDD-OLDD' });
    assert.strictEqual(v.status, 200);
});

test('re-registering a newsletter code never attaches an rc_app_user_id', async () => {
    const codes = readCodes();
    codes.push({ code: 'HRD-NEWS-NEWS-NEWS', feature_key: 'tge', source: 'newsletter', registered_at: '2026-10-19T00:00:00Z',
        newsletter: { paying: true, plan_source: 'yearly', locked_reason: null } });
    fs.writeFileSync(path.join(srv.dataDir, 'activation-codes.json'), JSON.stringify(codes));
    const r = await register({ code: 'HRD-NEWS-NEWS-NEWS', feature_key: FK, rc_app_user_id: 'attacker' });
    assert.strictEqual(r.status, 200);
    const e = readCodes().find((c) => c.code === 'HRD-NEWS-NEWS-NEWS');
    assert.strictEqual(e.play, undefined);
});
