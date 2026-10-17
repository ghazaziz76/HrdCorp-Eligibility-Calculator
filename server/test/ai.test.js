const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer, signedPost } = require('./helpers');

// The fake extractor is swapped per test through this holder.
const OK = async () => ({ fields: {}, usage: { input_tokens: 1000, output_tokens: 500 } });
const holder = { fn: OK };
let srv;
before(async () => { srv = await startTestServer({ extract: (a) => holder.fn(a) }); });
after(async () => { await srv.close(); });
beforeEach(() => { holder.fn = OK; });

const sync = async (o) => (await (await signedPost(srv.base, '/api/newsletter/entitlement', {
    code: null, email: 'x@y.com', name: 'X', status: 'paid', plan_source: 'yearly', paying: true,
    permanent: false, locked_reason: null, refunded_at: null, anchor_date: '2026-10-17', ...o,
})).json()).data;

const upload = (code, { type = 'application/pdf', name = 'b.pdf' } = {}) => {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from('%PDF-fake')], { type }), name);
    return fetch(srv.base + '/api/employer/ai-brochure', { method: 'POST', headers: { 'x-tge-code': code }, body: fd });
};
const access = async (code) => (await (await fetch(srv.base + '/api/employer/access', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
})).json()).data;
const month = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const readData = (f) => JSON.parse(fs.readFileSync(path.join(srv.dataDir, f), 'utf8'));
const setSpend = (usd) => fs.writeFileSync(path.join(srv.dataDir, 'tge-spend.json'), JSON.stringify({ month: month(), usd }));

test('403 locked for refunded gift code', async () => {
    const d = await sync({ email: 'rf@y.com', paying: false, locked_reason: 'refund', refunded_at: '2026-10-01' });
    const r = await upload(d.code);
    assert.strictEqual(r.status, 403);
    const j = await r.json();
    assert.strictEqual(j.success, false);
    assert.strictEqual(j.reason, 'locked');
    assert.strictEqual(j.ai.enabled, false);
});

test('unknown code 404', async () => {
    assert.strictEqual((await upload('HRD-NOPE-NOPE-NOPE')).status, 404);
});

test('success counts 1 and returns remaining', async () => {
    const d = await sync({ email: 'ok@y.com' });
    holder.fn = async () => ({ fields: { title: 'T' }, usage: { input_tokens: 1000, output_tokens: 500 } });
    const r = await upload(d.code);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.success, true);
    assert.deepStrictEqual(j.data.fields, { title: 'T' });
    assert.strictEqual(j.data.ai.used, 1);
    assert.strictEqual(j.data.ai.remaining, 49);
});

test('failed read does not count, adds spend, 11th failure same day → 403 failed_cap', async () => {
    const d = await sync({ email: 'fl@y.com' });
    setSpend(0);
    // 100k input tokens = $0.30 each, so ten failures stay under the $20 ceiling.
    holder.fn = async () => { throw Object.assign(new Error('bad read'), { usage: { input_tokens: 100000, output_tokens: 0 } }); };
    for (let i = 0; i < 10; i++) {
        const r = await upload(d.code);
        assert.strictEqual(r.status, 422);
        const j = await r.json();
        assert.strictEqual(j.reason, 'read_failed');
        assert.strictEqual(j.ai.used, 0);
    }
    assert.ok(Math.abs(readData('tge-spend.json').usd - 3) < 1e-6, 'failed reads count toward spend');
    const r = await upload(d.code);
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).reason, 'failed_cap');
    assert.strictEqual((await access(d.code)).ai.used, 0);
});

test('spend paused → 403 spend_paused for everyone, access endpoint still works', async () => {
    const d = await sync({ email: 'sp@y.com' });
    setSpend(999);
    const r = await upload(d.code);
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).reason, 'spend_paused');
    const a = await access(d.code);
    assert.strictEqual(a.tge, 'activated');
    assert.strictEqual(a.ai.reason, 'spend_paused');
    setSpend(0);
});

test('concurrent uploads at limit-1 allow exactly one', async () => {
    const d = await sync({ email: 'cc@y.com', plan_source: 'monthly' }); // limit 3
    assert.strictEqual((await upload(d.code)).status, 200);
    assert.strictEqual((await upload(d.code)).status, 200); // used = 2
    let release;
    const gate = new Promise((res) => { release = res; });
    let calls = 0;
    holder.fn = async () => { calls++; await gate; return { fields: {}, usage: { input_tokens: 1, output_tokens: 1 } }; };
    const p1 = upload(d.code);
    const p2 = upload(d.code);
    // One of the two is rejected while the other is still inside extract.
    await Promise.race([p1, p2]);
    release();
    const statuses = (await Promise.all([p1, p2])).map((r) => r.status).sort();
    assert.deepStrictEqual(statuses, [200, 429]);
    assert.strictEqual(calls, 1);
    assert.strictEqual((await access(d.code)).ai.used, 3);
});

test('rejects .exe mime with 400', async () => {
    const d = await sync({ email: 'ex@y.com' });
    const r = await upload(d.code, { type: 'application/x-msdownload', name: 'a.exe' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).success, false);
});

test('doc file -> 400 Unsupported file type, nothing counted', async () => {
    const d = await sync({ email: 'doc@y.com' });
    let calls = 0;
    holder.fn = async () => { calls++; return { fields: {}, usage: { input_tokens: 1, output_tokens: 1 } }; };
    const r = await upload(d.code, { type: 'application/msword', name: 'b.doc' });
    assert.strictEqual(r.status, 400);
    const j = await r.json();
    assert.strictEqual(j.success, false);
    assert.strictEqual(j.message, 'Unsupported file type');
    assert.strictEqual(calls, 0);
    assert.strictEqual((await access(d.code)).ai.used, 0);
});

test('missing file 400', async () => {
    const d = await sync({ email: 'mf@y.com' });
    const fd = new FormData(); fd.append('other', 'x');
    const r = await fetch(srv.base + '/api/employer/ai-brochure', { method: 'POST', headers: { 'x-tge-code': d.code }, body: fd });
    assert.strictEqual(r.status, 400);
});

test('file over 10 MB → 413 JSON', async () => {
    const d = await sync({ email: 'big@y.com' });
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.alloc(10 * 1024 * 1024 + 10)], { type: 'application/pdf' }), 'big.pdf');
    const r = await fetch(srv.base + '/api/employer/ai-brochure', { method: 'POST', headers: { 'x-tge-code': d.code }, body: fd });
    assert.strictEqual(r.status, 413);
    assert.strictEqual((await r.json()).success, false);
});

test('stats file contains only the 4 fields + month', async () => {
    const d = await sync({ email: 'st@y.com' });
    holder.fn = async () => ({ fields: {
        trainingProgrammeName: 'Lean Mgmt', trainingType: 'inhouse', days: 2, duration: 'full_day', actualCourseFee: 1500,
        email: 'secret@x.com', trainer: 'Bob', code: 'HRD-X',
    }, usage: { input_tokens: 1, output_tokens: 1 } });
    assert.strictEqual((await upload(d.code)).status, 200);
    const stats = readData('brochure-stats.json');
    const last = stats[stats.length - 1];
    assert.deepStrictEqual(Object.keys(last).sort(), ['course_fee', 'delivery', 'duration', 'month', 'training_title']);
    assert.strictEqual(last.training_title, 'Lean Mgmt');
    assert.strictEqual(last.delivery, 'inhouse');
    assert.strictEqual(last.duration, '2 x full_day');
    assert.strictEqual(last.course_fee, 1500);
    assert.match(last.month, /^\d{4}-\d{2}$/);
});

test('stub extractor → 503 not_configured and nothing counted toward used', async () => {
    const d = await sync({ email: 'stub@y.com' });
    setSpend(1);
    // Explicit empty key so a key in the environment never reaches the real API from a test.
    const { extractBrochure } = require('../ai/extractor');
    holder.fn = (a) => extractBrochure(a, { apiKey: '' });
    const r = await upload(d.code);
    assert.strictEqual(r.status, 503);
    const j = await r.json();
    assert.strictEqual(j.reason, 'not_configured');
    assert.strictEqual(j.ai.used, 0);
    assert.strictEqual(readData('tge-spend.json').usd, 1);
    assert.strictEqual((await access(d.code)).ai.used, 0);
    assert.strictEqual(readData('tge-usage.json')[d.code], undefined);
});
