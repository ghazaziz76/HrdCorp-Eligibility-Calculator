const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('./helpers');

let srv;
// This file tests the registration flow itself, so move the Play-verification cutoff far
// ahead: codes registered here are grandfathered (see activationVerify.test.js for after it).
before(async () => {
    process.env.TGE_PLAY_VERIFY_CUTOFF = '2999-01-01T00:00:00Z';
    srv = await startTestServer();
});
after(async () => { delete process.env.TGE_PLAY_VERIFY_CUTOFF; await srv.close(); });

const post = (p, body) => fetch(srv.base + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

test('POST /api/employer/activation-codes registers a code', async () => {
    const reg = await post('/api/employer/activation-codes', { code: 'HRD-AAAA-BBBB-CCCC', feature_key: 'hrd_grant_calculator' });
    assert.strictEqual(reg.status, 200);
    assert.deepStrictEqual(await reg.json(), { success: true, data: { code: 'HRD-AAAA-BBBB-CCCC', feature_key: 'hrd_grant_calculator' } });

    const res = await post('/api/employer/validate-code', { code: 'HRD-AAAA-BBBB-CCCC' });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.validated, true);
    assert.match(body.data.session_token, /^[0-9a-f]{64}$/);
});

test('validate-code unknown code → 404 {success:false,message:\'Invalid activation code\'}', async () => {
    const res = await post('/api/employer/validate-code', { code: 'HRD-NOPE-NOPE-NOPE' });
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(await res.json(), { success: false, message: 'Invalid activation code' });
});
