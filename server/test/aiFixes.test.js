const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer, signedPost } = require('./helpers');
const usage = require('../lib/usage');

const OK = async () => ({ fields: { days: 2 }, usage: { input_tokens: 1000, output_tokens: 500 } });
const holder = { fn: OK };
let srv;
before(async () => { srv = await startTestServer({ extract: (a) => holder.fn(a) }); });
after(async () => { await srv.close(); });
beforeEach(() => { holder.fn = OK; });

const sync = async (o) => (await (await signedPost(srv.base, '/api/newsletter/entitlement', {
    code: null, email: 'x@y.com', name: 'X', status: 'paid', plan_source: 'yearly', paying: true,
    permanent: false, locked_reason: null, refunded_at: null, anchor_date: '2026-10-17', ...o,
})).json()).data;
const PDF = Buffer.from('%PDF-1.4 fake');
const upload = (code, { type = 'application/pdf', name = 'b.pdf', bytes = PDF } = {}) => {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], type === null ? {} : { type }), name);
    return fetch(srv.base + '/api/employer/ai-brochure', { method: 'POST', headers: { 'x-tge-code': code }, body: fd });
};
const access = async (code) => (await (await fetch(srv.base + '/api/employer/access', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
})).json()).data;
const month = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const dataFile = (f) => path.join(srv.dataDir, f);
const readData = (f) => JSON.parse(fs.readFileSync(dataFile(f), 'utf8'));
const setSpend = (usd) => fs.writeFileSync(dataFile('tge-spend.json'), JSON.stringify({ month: month(), usd }));
const failedCount = (code) => { try { return ((readData('tge-usage.json')[code] || {}).failed || {}).count || 0; } catch { return 0; } };

test('provider error -> 503 ai_unavailable, no failure and no spend recorded', async () => {
    const d = await sync({ email: 'prov@y.com' });
    setSpend(1);
    holder.fn = async () => { throw Object.assign(new Error('overloaded'), { code: 'provider_error' }); };
    const r = await upload(d.code);
    assert.strictEqual(r.status, 503);
    const j = await r.json();
    assert.strictEqual(j.success, false);
    assert.strictEqual(j.reason, 'ai_unavailable');
    assert.strictEqual(failedCount(d.code), 0);
    assert.strictEqual(readData('tge-spend.json').usd, 1);
    assert.strictEqual((await access(d.code)).ai.used, 0);
});

test('missing API key (real extractor) -> 503 ai_unavailable, nothing counted', async () => {
    const d = await sync({ email: 'nokey@y.com' });
    const { extractBrochure } = require('../ai/extractor');
    holder.fn = (a) => extractBrochure(a, { apiKey: '' });
    const r = await upload(d.code);
    assert.strictEqual(r.status, 503);
    assert.strictEqual((await r.json()).reason, 'ai_unavailable');
    assert.strictEqual(failedCount(d.code), 0);
});

test('application/octet-stream with a .pdf name reaches the extractor with the sniffed type', async () => {
    const d = await sync({ email: 'oct@y.com' });
    let seen;
    holder.fn = async (a) => { seen = a.mimeType; return OK(); };
    const r = await upload(d.code, { type: 'application/octet-stream', name: 'brochure.PDF' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(seen, 'application/pdf');
});

test('empty mimetype with a .jpg name is allowed through when bytes are a JPEG', async () => {
    const d = await sync({ email: 'emp@y.com' });
    let seen;
    holder.fn = async (a) => { seen = a.mimeType; return OK(); };
    const r = await upload(d.code, { type: null, name: 'photo.jpg', bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(seen, 'image/jpeg');
});

test('octet-stream with an allowed name but unknown bytes -> 400, extractor not called, nothing counted', async () => {
    const d = await sync({ email: 'unk@y.com' });
    let calls = 0;
    holder.fn = async () => { calls++; return OK(); };
    const r = await upload(d.code, { type: 'application/octet-stream', name: 'a.pdf', bytes: Buffer.from('hello world') });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).message, 'Unsupported file type');
    assert.strictEqual(calls, 0);
    assert.strictEqual(failedCount(d.code), 0);
});

test('octet-stream with a disallowed extension -> 400', async () => {
    const d = await sync({ email: 'exe@y.com' });
    const r = await upload(d.code, { type: 'application/octet-stream', name: 'a.exe' });
    assert.strictEqual(r.status, 400);
});

test('parallel uploads cannot overshoot the failed-read cap', async () => {
    const d = await sync({ email: 'fcap@y.com' });
    setSpend(0);
    // 9 failures already today: only one more read may be in flight.
    holder.fn = async () => { throw Object.assign(new Error('bad'), { usage: { input_tokens: 10, output_tokens: 0 } }); };
    for (let i = 0; i < 9; i++) assert.strictEqual((await upload(d.code)).status, 422);
    let release;
    const gate = new Promise((res) => { release = res; });
    let calls = 0;
    holder.fn = async () => { calls++; await gate; throw Object.assign(new Error('bad'), { usage: { input_tokens: 10, output_tokens: 0 } }); };
    const p1 = upload(d.code);
    const p2 = upload(d.code);
    // If a regression lets both in, neither returns before release: fail instead of hanging.
    await Promise.race([p1, p2, new Promise((r) => setTimeout(r, 3000))]);
    release();
    const statuses = (await Promise.all([p1, p2])).map((r) => r.status).sort();
    assert.deepStrictEqual(statuses, [403, 422]);
    assert.strictEqual(calls, 1);
    assert.strictEqual(failedCount(d.code), 10);
});

test('parallel uploads cannot overshoot the monthly spend limit', async () => {
    const d1 = await sync({ email: 'sp1@y.com' });
    const d2 = await sync({ email: 'sp2@y.com' });
    const s = usage.getSettings();
    // One reserved call fits under the limit, two do not.
    setSpend(s.monthly_spend_limit_usd - 1.5 * s.cost.fallback_per_call_usd);
    let release;
    const gate = new Promise((res) => { release = res; });
    let calls = 0;
    holder.fn = async () => { calls++; await gate; return { fields: { days: 1 }, usage: { input_tokens: 1, output_tokens: 1 } }; };
    const p1 = upload(d1.code);
    const p2 = upload(d2.code);
    // If a regression lets both in, neither returns before release: fail instead of hanging.
    await Promise.race([p1, p2, new Promise((r) => setTimeout(r, 3000))]);
    release();
    const rs = await Promise.all([p1, p2]);
    const statuses = rs.map((r) => r.status).sort();
    assert.deepStrictEqual(statuses, [200, 403]);
    const blocked = rs.find((r) => r.status === 403);
    assert.strictEqual((await blocked.json()).reason, 'spend_paused');
    assert.strictEqual(calls, 1);
    setSpend(0);
});

test('recordSuccess throwing after a good read still returns the fields', async () => {
    const d = await sync({ email: 'rs@y.com' });
    const real = usage.recordSuccess;
    usage.recordSuccess = () => { throw new Error('disk full'); };
    try {
        const r = await upload(d.code);
        assert.strictEqual(r.status, 200);
        const j = await r.json();
        assert.strictEqual(j.success, true);
        assert.deepStrictEqual(j.data.fields, { days: 2 });
    } finally {
        usage.recordSuccess = real;
    }
});

test('corrupt activation-codes.json -> 500 JSON, file left untouched, server keeps running', async () => {
    const f = dataFile('activation-codes.json');
    const good = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(f, '{"broken": ');
    try {
        const r = await upload('HRD-AAAA-BBBB-CCCC');
        assert.strictEqual(r.status, 500);
        assert.strictEqual((await r.json()).success, false);
        const reg = await fetch(srv.base + '/api/employer/activation-codes', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ code: 'HRD-CORR-UPTT-0001', feature_key: 'hrd_grant_calculator' }),
        });
        assert.strictEqual(reg.status, 500);
        assert.strictEqual((await reg.json()).success, false);
        const v = await fetch(srv.base + '/api/employer/validate-code', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'HRD-CORR-UPTT-0001' }),
        });
        assert.strictEqual(v.status, 500);
        assert.strictEqual(fs.readFileSync(f, 'utf8'), '{"broken": ');
    } finally {
        fs.writeFileSync(f, good);
    }
    const ok = await fetch(srv.base + '/api/version');
    assert.strictEqual(ok.status, 200);
});
