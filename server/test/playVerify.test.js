const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

let srv, store, pv;
before(async () => {
    delete process.env.REVENUECAT_SECRET_KEY; // route test must never reach RevenueCat
    srv = await startTestServer();
    store = require('../lib/store');
    pv = require('../lib/playVerify');
});
after(async () => { await srv.close(); });

const entry = (o = {}) => ({
    code: 'HRD-AAAA-BBBB-CCCC', feature_key: 'tge', google_play_order_id: 'GPA.1111',
    play: { rc_app_user_id: 'rc-user-1' }, ...o,
});
const rcBody = (items) => ({ subscriber: { non_subscriptions: { full_access: items } } });
const fakeFetch = (status, body, calls = []) => async (url, opts) => {
    calls.push({ url, opts });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
};
const item = (id, date = '2026-10-01T00:00:00Z') => ({ store_transaction_id: id, purchase_date: date });

test('verifies matching order id', async () => {
    const calls = [];
    const r = await pv.verifyPlayPurchase(entry(), [], {
        apiKey: 'sk_x', fetchImpl: fakeFetch(200, rcBody([item('GPA.0000'), item('GPA.1111', '2026-10-02T00:00:00Z')]), calls),
    });
    assert.deepEqual(r, { verified: true, reason: 'ok', purchase_date: '2026-10-02T00:00:00Z', store_transaction_id: 'GPA.1111' });
    assert.equal(calls[0].url, 'https://api.revenuecat.com/v1/subscribers/rc-user-1');
    assert.equal(calls[0].opts.headers.Authorization, 'Bearer sk_x');
});

test('encodes the rc user id and accepts any item for order id unknown', async () => {
    const calls = [];
    const r = await pv.verifyPlayPurchase(entry({ google_play_order_id: 'unknown', play: { rc_app_user_id: 'a/b c' } }), [], {
        apiKey: 'k', fetchImpl: fakeFetch(200, rcBody([item('GPA.9')]), calls),
    });
    assert.equal(r.verified, true);
    assert.equal(r.store_transaction_id, 'GPA.9');
    assert.ok(calls[0].url.endsWith('/a%2Fb%20c'));
});

test('rejects mismatched order id', async () => {
    const r = await pv.verifyPlayPurchase(entry(), [], { apiKey: 'k', fetchImpl: fakeFetch(200, rcBody([item('GPA.2222')])) });
    assert.equal(r.verified, false);
    assert.equal(r.reason, 'not_found');
});

test('RC 404 -> not_found', async () => {
    const r = await pv.verifyPlayPurchase(entry(), [], { apiKey: 'k', fetchImpl: fakeFetch(404, {}) });
    assert.deepEqual([r.verified, r.reason], [false, 'not_found']);
});

test('rejects transaction already used by another code', async () => {
    const other = entry({ code: 'HRD-ZZZZ-ZZZZ-ZZZZ', play: { rc_app_user_id: 'u2', verified_at: '2026-10-01T00:00:00Z', store_transaction_id: 'GPA.1111' } });
    const r = await pv.verifyPlayPurchase(entry(), [other, entry()], { apiKey: 'k', fetchImpl: fakeFetch(200, rcBody([item('GPA.1111')])) });
    assert.deepEqual([r.verified, r.reason], [false, 'transaction_already_used']);
});

test('no rc user -> no_rc_user, no network call', async () => {
    const calls = [];
    const r = await pv.verifyPlayPurchase(entry({ play: {} }), [], { apiKey: 'k', fetchImpl: fakeFetch(200, {}, calls) });
    assert.deepEqual([r.verified, r.reason], [false, 'no_rc_user']);
    assert.equal(calls.length, 0);
});

test('no api key -> no_api_key, no network call', async () => {
    const calls = [];
    const r = await pv.verifyPlayPurchase(entry(), [], { apiKey: '', fetchImpl: fakeFetch(200, {}, calls) });
    assert.deepEqual([r.verified, r.reason], [false, 'no_api_key']);
    assert.equal(calls.length, 0);
});

test('RC 500 -> rc_error', async () => {
    const r = await pv.verifyPlayPurchase(entry(), [], { apiKey: 'k', fetchImpl: fakeFetch(500, {}) });
    assert.deepEqual([r.verified, r.reason], [false, 'rc_error']);
});

test('thrown fetch -> rc_error', async () => {
    const r = await pv.verifyPlayPurchase(entry(), [], { apiKey: 'k', fetchImpl: async () => { throw new Error('boom'); } });
    assert.deepEqual([r.verified, r.reason], [false, 'rc_error']);
});

test('applyVerification writes play fields on success only', async () => {
    store.writeJSON('activation-codes.json', [entry(), entry({ code: 'HRD-1111-1111-1111', google_play_order_id: 'GPA.5555' })]);
    const ok = await pv.applyVerification('HRD-AAAA-BBBB-CCCC', { apiKey: 'k', fetchImpl: fakeFetch(200, rcBody([item('GPA.1111', '2026-10-02T00:00:00Z')])) });
    assert.equal(ok.verified, true);
    let codes = store.readJSON('activation-codes.json', []);
    const p = codes[0].play;
    assert.ok(p.verified_at);
    assert.equal(p.purchase_date, '2026-10-02T00:00:00Z');
    assert.equal(p.store_transaction_id, 'GPA.1111');
    assert.equal(p.rc_app_user_id, 'rc-user-1');

    const bad = await pv.applyVerification('HRD-1111-1111-1111', { apiKey: 'k', fetchImpl: fakeFetch(200, rcBody([item('GPA.1111')])) });
    assert.equal(bad.reason, 'not_found');
    codes = store.readJSON('activation-codes.json', []);
    assert.equal(codes[1].play.verified_at, undefined);

    const missing = await pv.applyVerification('HRD-NOPE-NOPE-NOPE', { apiKey: 'k', fetchImpl: fakeFetch(200, {}) });
    assert.deepEqual([missing.verified, missing.reason], [false, 'not_found']);
});

test('route stores rc_app_user_id once and never overwrites', async () => {
    const post = (body) => fetch(srv.base + '/api/employer/activation-codes', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const code = 'HRD-RCRC-RCRC-RCRC';
    const r1 = await post({ code, feature_key: 'tge', rc_app_user_id: 'first' });
    assert.deepEqual(await r1.json(), { success: true, data: { code, feature_key: 'tge' } });
    const find = () => store.readJSON('activation-codes.json', []).find((c) => c.code === code);
    assert.equal(find().play.rc_app_user_id, 'first');
    await post({ code, feature_key: 'tge', rc_app_user_id: 'second' });
    assert.equal(find().play.rc_app_user_id, 'first');

    // existing entry with empty rc id gets it filled
    const code2 = 'HRD-RCR2-RCR2-RCR2';
    await post({ code: code2, feature_key: 'tge' });
    await post({ code: code2, feature_key: 'tge', rc_app_user_id: 'late' });
    assert.equal(store.readJSON('activation-codes.json', []).find((c) => c.code === code2).play.rc_app_user_id, 'late');
});

test('unknown order id skips a used first item and verifies the unused second', async () => {
    const other = entry({ code: 'HRD-ZZZZ-ZZZZ-ZZZZ', play: { rc_app_user_id: 'u2', verified_at: 'x', store_transaction_id: 'GPA.A' } });
    const r = await pv.verifyPlayPurchase(entry({ google_play_order_id: 'unknown' }), [other], {
        apiKey: 'k', fetchImpl: fakeFetch(200, rcBody([item('GPA.A'), item('GPA.B')])),
    });
    assert.deepEqual([r.verified, r.store_transaction_id], [true, 'GPA.B']);
});

test('applyVerification: transaction held by another verified entry -> transaction_already_used', async () => {
    store.writeJSON('activation-codes.json', [
        entry({ code: 'HRD-HOLD-HOLD-HOLD', play: { rc_app_user_id: 'u0', verified_at: 'x', store_transaction_id: 'GPA.1111' } }),
        entry({ code: 'HRD-NEWW-NEWW-NEWW' }),
    ]);
    const r = await pv.applyVerification('HRD-NEWW-NEWW-NEWW', { apiKey: 'k', fetchImpl: fakeFetch(200, rcBody([item('GPA.1111')])) });
    assert.deepEqual([r.verified, r.reason], [false, 'transaction_already_used']);
    assert.equal(store.readJSON('activation-codes.json', [])[1].play.verified_at, undefined);
});

test('concurrent applyVerification sharing one transaction: exactly one verified', async () => {
    store.writeJSON('activation-codes.json', [
        entry({ code: 'HRD-CON1-CON1-CON1', google_play_order_id: 'unknown', play: { rc_app_user_id: 'u1' } }),
        entry({ code: 'HRD-CON2-CON2-CON2', google_play_order_id: 'unknown', play: { rc_app_user_id: 'u2' } }),
    ]);
    const f = async () => { await new Promise((r) => setTimeout(r, 10)); return { ok: true, status: 200, json: async () => rcBody([item('GPA.SAME')]) }; };
    const rs = await Promise.all(['HRD-CON1-CON1-CON1', 'HRD-CON2-CON2-CON2'].map((c) => pv.applyVerification(c, { apiKey: 'k', fetchImpl: f })));
    assert.deepEqual(rs.map((r) => r.reason).sort(), ['ok', 'transaction_already_used']);
    assert.equal(store.readJSON('activation-codes.json', []).filter((c) => c.play.verified_at).length, 1);
});
