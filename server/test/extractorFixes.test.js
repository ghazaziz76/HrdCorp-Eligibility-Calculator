const { test } = require('node:test');
const assert = require('node:assert');
const { extractBrochure, validateFields, SYSTEM_PROMPT, IMAGE_MAX_BYTES } = require('../ai/extractor');

function fakeFetch(responseBody, status = 200) {
    const f = async (url, init) => {
        f.calls.push({ url, init });
        return { ok: status >= 200 && status < 300, status, json: async () => responseBody };
    };
    f.calls = [];
    return f;
}
const reply = (text, usage = { input_tokens: 10, output_tokens: 5 }) => ({ content: [{ type: 'text', text }], usage });
const GOOD = { trainingProgrammeName: 'X', trainingType: 'public', venue: null, days: 2, duration: 'full_day', actualCourseFee: 1000 };
const pdf = { buffer: Buffer.from('%PDF-1.4'), mimeType: 'application/pdf', originalName: 'a.pdf' };
const deps = (fetch) => ({ fetch, apiKey: 'k', timeoutMs: 1000 });
const isProvider = (e) => e.code === 'provider_error' && e.usage === undefined;
const isReadFailure = (e) => e.code !== 'provider_error' && e.code !== 'image_too_large';

test('missing API key -> provider_error, no API call', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await assert.rejects(extractBrochure(pdf, { fetch: f, apiKey: '' }), isProvider);
    assert.strictEqual(f.calls.length, 0);
});

test('provider HTTP errors -> provider_error', async () => {
    for (const status of [401, 403, 404, 408, 429, 500, 502, 503, 529]) {
        const f = fakeFetch({ type: 'error', error: { type: 'x' } }, status);
        await assert.rejects(extractBrochure(pdf, deps(f)), isProvider, String(status));
    }
});

test('network error and timeout -> provider_error', async () => {
    const boom = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(extractBrochure(pdf, deps(boom)), isProvider);
    const hanging = (url, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    await assert.rejects(extractBrochure(pdf, { fetch: hanging, apiKey: 'k', timeoutMs: 20 }), isProvider);
});

test('unreadable response body from the API -> provider_error', async () => {
    const f = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } });
    await assert.rejects(extractBrochure(pdf, deps(f)), isProvider);
});

test('400 from the API (file the API cannot take) is a read failure, not a provider error', async () => {
    const f = fakeFetch({ type: 'error', error: { type: 'invalid_request_error' } }, 400);
    await assert.rejects(extractBrochure(pdf, deps(f)), isReadFailure);
});

test('model replied but nothing usable -> read failure (counts)', async () => {
    const f = fakeFetch(reply('Sorry'));
    await assert.rejects(extractBrochure(pdf, deps(f)), (e) => isReadFailure(e) && !!e.usage);
});

test('fee bounds: > 0 and <= 1,000,000', () => {
    const fee = (v) => validateFields({ ...GOOD, actualCourseFee: v }).actualCourseFee;
    assert.strictEqual(fee(0), null);
    assert.strictEqual(fee(-1), null);
    assert.strictEqual(fee(1000000), 1000000);
    assert.strictEqual(fee(1000000.01), null);
    assert.strictEqual(fee('RM 2,000,000'), null);
    assert.strictEqual(fee(0.5), 0.5);
});

test('days must be an integer 1..365', () => {
    const days = (v) => validateFields({ ...GOOD, days: v }).days;
    assert.strictEqual(days(1), 1);
    assert.strictEqual(days(365), 365);
    assert.strictEqual(days(366), null);
    assert.strictEqual(days(0), null);
    assert.strictEqual(days('400 days'), null);
    assert.strictEqual(days(1.5), null);
});

test('sst_rate: fraction 0<r<1 is a percentage x100; (0,30] accepted; else may-include flag', () => {
    const at = (rate, inc = true) => validateFields({ ...GOOD, actualCourseFee: 108, sst_included: inc, sst_rate: rate });
    assert.strictEqual(at(0.08).actualCourseFee, 100);
    assert.strictEqual(at(0.08).feeMayIncludeSst, undefined);
    assert.strictEqual(at(8).actualCourseFee, 100);
    assert.strictEqual(at('8%').actualCourseFee, 100);
    for (const bad of [0, 31, 800, -8]) {
        assert.strictEqual(at(bad).actualCourseFee, 108, String(bad));
        assert.strictEqual(at(bad).feeMayIncludeSst, true, String(bad));
    }
});

test('sst_included accepts "true"/"false" strings', () => {
    const r = validateFields({ ...GOOD, actualCourseFee: 108, sst_included: 'true', sst_rate: 8 });
    assert.strictEqual(r.actualCourseFee, 100);
    const r2 = validateFields({ ...GOOD, actualCourseFee: 108, sst_included: ' TRUE ', sst_rate: null });
    assert.strictEqual(r2.feeMayIncludeSst, true);
    const r3 = validateFields({ ...GOOD, actualCourseFee: 108, sst_included: 'false', sst_rate: 8 });
    assert.strictEqual(r3.actualCourseFee, 108);
    assert.ok(!('feeMayIncludeSst' in r3));
    const r4 = validateFields({ ...GOOD, actualCourseFee: 108, sst_included: 'yes', sst_rate: 8 });
    assert.strictEqual(r4.actualCourseFee, 108);
});

test('prompt: per-person whole-course fee; per-group or per-day only -> null; ROT only when online', () => {
    assert.match(SYSTEM_PROMPT, /per-person/i);
    assert.match(SYSTEM_PROMPT, /whole course/i);
    assert.match(SYSTEM_PROMPT, /per group/i);
    assert.match(SYSTEM_PROMPT, /per-day|per day/i);
    assert.match(SYSTEM_PROMPT, /rot_public \/ rot_inhouse ONLY when the brochure's text says the training is delivered online/);
});

test('image limit keeps base64 under 5 MB', () => {
    assert.ok(IMAGE_MAX_BYTES <= 3.7 * 1024 * 1024);
    assert.ok(4 * Math.ceil(IMAGE_MAX_BYTES / 3) < 5 * 1024 * 1024);
});

test('image just over the limit -> image_too_large, at the limit is sent', async () => {
    const jpeg = (n) => { const b = Buffer.alloc(n); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b; };
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await assert.rejects(extractBrochure({ buffer: jpeg(IMAGE_MAX_BYTES + 1), mimeType: 'image/jpeg' }, deps(f)),
        (e) => e.code === 'image_too_large');
    assert.strictEqual(f.calls.length, 0);
    await extractBrochure({ buffer: jpeg(IMAGE_MAX_BYTES), mimeType: 'image/jpeg' }, deps(f));
    assert.strictEqual(f.calls.length, 1);
});
