const { test } = require('node:test');
const assert = require('node:assert');
const { extractBrochure, validateFields, parseModelJson } = require('../ai/extractor');

// Fake fetch: records the request, answers like the Messages API.
function fakeFetch(responseBody, status = 200) {
    const f = async (url, init) => {
        f.calls.push({ url, init, body: JSON.parse(init.body) });
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => responseBody,
        };
    };
    f.calls = [];
    return f;
}

const reply = (text, usage = { input_tokens: 10, output_tokens: 5 }) => ({
    content: [{ type: 'text', text }], usage,
});
const GOOD = {
    trainingProgrammeName: 'Associate HR Professional Certificate (AHRP)',
    trainingType: 'rot_public', venue: null, days: 7, duration: 'full_day', actualCourseFee: 129,
};
const deps = (fetch) => ({ fetch, apiKey: 'test-key', timeoutMs: 1000 });
const blocks = (f) => f.calls[0].body.messages[0].content;

// Minimal .docx (stored zip, no compression) so the test needs no extra dependency.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
        const nameBuf = Buffer.from(name);
        const data = Buffer.from(content);
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
        locals.push(local, nameBuf, data);
        centrals.push(central, nameBuf);
        offset += 30 + nameBuf.length + data.length;
    }
    const cd = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
}
function buildDocx(text) {
    return zip({
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        'word/document.xml': '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            + `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
    });
}
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('no api key -> not_configured', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await assert.rejects(
        extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, { fetch: f, apiKey: '' }),
        (e) => e.code === 'not_configured',
    );
    assert.strictEqual(f.calls.length, 0);
});

test('pdf sent as document block', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: Buffer.from('%PDF-1.4'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(f));
    const { url, init, body } = f.calls[0];
    assert.strictEqual(url, 'https://api.anthropic.com/v1/messages');
    assert.strictEqual(init.method, 'POST');
    assert.strictEqual(body.model, 'claude-haiku-5-5');
    assert.strictEqual(body.max_tokens, 2000);
    assert.deepStrictEqual(body.thinking, { type: 'disabled' });
    assert.strictEqual(init.headers['x-api-key'], 'test-key');
    assert.strictEqual(init.headers['anthropic-version'], '2023-06-01');
    const doc = blocks(f).find((b) => b.type === 'document');
    assert.ok(doc, 'has a document block');
    assert.strictEqual(doc.source.type, 'base64');
    assert.strictEqual(doc.source.media_type, 'application/pdf');
    assert.strictEqual(doc.source.data, Buffer.from('%PDF-1.4').toString('base64'));
});

test('image sent as image block', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg', originalName: 'a.jpg' }, deps(f));
    const img = blocks(f).find((b) => b.type === 'image');
    assert.ok(img, 'has an image block');
    assert.strictEqual(img.source.type, 'base64');
    assert.strictEqual(img.source.media_type, 'image/jpeg');
});

test('docx sent as text', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: buildDocx('Lean Management 2 days RM1500'), mimeType: DOCX, originalName: 'b.docx' }, deps(f));
    assert.ok(!blocks(f).some((b) => b.type === 'document' || b.type === 'image'));
    const txt = blocks(f).find((b) => b.type === 'text' && b.text.includes('Lean Management'));
    assert.ok(txt, 'text block carries the docx text');
    assert.ok(txt.text.includes('RM1500'));
});

test('docx text capped at 50,000 chars', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: buildDocx('A'.repeat(60000) + 'TAILMARK'), mimeType: DOCX, originalName: 'b.docx' }, deps(f));
    const txt = blocks(f).find((b) => b.type === 'text' && b.text.includes('AAAA'));
    assert.ok(txt);
    assert.ok(!txt.text.includes('TAILMARK'));
    assert.strictEqual((txt.text.match(/A{100,}/)[0]).length, 50000);
});

test('returns the six fields and usage', async () => {
    const usage = { input_tokens: 1200, output_tokens: 80 };
    const f = fakeFetch(reply('{"trainingProgrammeName":"Associate HR Professional Certificate (AHRP)","trainingType":"rot_public","venue":null,"days":7,"duration":"full_day","actualCourseFee":129}', usage));
    const r = await extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(f));
    assert.deepStrictEqual(r.fields, GOOD);
    assert.deepStrictEqual(r.usage, usage);
});

test('validates and coerces model output', () => {
    assert.deepStrictEqual(
        validateFields({ trainingProgrammeName: '  X  ', trainingType: 'Public', venue: 'hotel', days: '3 days', duration: 'Full Day', actualCourseFee: 'RM 1,500.00', extra: 1 }),
        { trainingProgrammeName: 'X', trainingType: 'public', venue: null, days: 3, duration: 'full_day', actualCourseFee: 1500 },
    );
    assert.strictEqual(validateFields({ ...GOOD, days: 0 }).days, null);
    assert.strictEqual(validateFields({ ...GOOD, days: 2.5 }).days, null);
    assert.strictEqual(validateFields({ ...GOOD, actualCourseFee: -5 }).actualCourseFee, null);
    assert.strictEqual(validateFields({ ...GOOD, trainingProgrammeName: 'x'.repeat(201) }).trainingProgrammeName, null);
    assert.strictEqual(validateFields({ ...GOOD, trainingType: 'webinar' }).trainingType, null);
    assert.strictEqual(validateFields({ ...GOOD, duration: '3 hours' }).duration, null);
    // Venue only for types that have the Venue box.
    assert.strictEqual(validateFields({ ...GOOD, trainingType: 'inhouse', venue: 'external_hotel' }).venue, 'external_hotel');
    assert.strictEqual(validateFields({ ...GOOD, trainingType: 'public', venue: 'external_hotel' }).venue, null);
    assert.deepStrictEqual(Object.keys(validateFields({})).sort(),
        ['actualCourseFee', 'days', 'duration', 'trainingProgrammeName', 'trainingType', 'venue']);
});

test('sst backed out when rate stated', () => {
    const a = validateFields({ ...GOOD, actualCourseFee: 108, sst_included: true, sst_rate: 8 });
    assert.strictEqual(a.actualCourseFee, 100);
    assert.strictEqual(a.feeMayIncludeSst, undefined);
    const b = validateFields({ ...GOOD, actualCourseFee: 129, sst_included: true, sst_rate: null });
    assert.strictEqual(b.actualCourseFee, 129);
    assert.strictEqual(b.feeMayIncludeSst, true);
    const c = validateFields({ ...GOOD, actualCourseFee: 129, sst_included: false, sst_rate: null });
    assert.ok(!('feeMayIncludeSst' in c));
});

test('parses fenced JSON', () => {
    assert.deepStrictEqual(parseModelJson('Here you go:\n```json\n{"days":2}\n```'), { days: 2 });
    assert.deepStrictEqual(parseModelJson('{"days":3}'), { days: 3 });
    assert.deepStrictEqual(parseModelJson('Answer: {"days":4} done'), { days: 4 });
    assert.throws(() => parseModelJson('no json here'));
});

test('all null -> read failure with usage', async () => {
    const usage = { input_tokens: 900, output_tokens: 40 };
    const allNull = { trainingProgrammeName: null, trainingType: null, venue: null, days: null, duration: null, actualCourseFee: null };
    const f = fakeFetch(reply(JSON.stringify(allNull), usage));
    await assert.rejects(
        extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(f)),
        (e) => e.code !== 'not_configured' && e.usage === usage,
    );
});

test('unparseable reply -> read failure with usage', async () => {
    const usage = { input_tokens: 900, output_tokens: 40 };
    const f = fakeFetch(reply('Sorry, I cannot read this.', usage));
    await assert.rejects(
        extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(f)),
        (e) => e.code !== 'not_configured' && e.usage === usage,
    );
});

test('api error throws read failure', async () => {
    const f = fakeFetch({ type: 'error', error: { type: 'overloaded_error' } }, 529);
    await assert.rejects(
        extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(f)),
        (e) => e.code !== 'not_configured',
    );
    const rejecting = async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); };
    await assert.rejects(
        extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(rejecting)),
        (e) => e.code !== 'not_configured',
    );
});

test('timeout aborts the request -> read failure', async () => {
    let signal;
    const hanging = (url, init) => new Promise((resolve, reject) => {
        signal = init.signal;
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    await assert.rejects(
        extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, { fetch: hanging, apiKey: 'k', timeoutMs: 20 }),
        (e) => e.code !== 'not_configured',
    );
    assert.strictEqual(signal.aborted, true);
});

test('request turns thinking off and allows 2000 tokens', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: Buffer.from('%PDF-1.4'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(f));
    assert.deepStrictEqual(f.calls[0].body.thinking, { type: 'disabled' });
    assert.strictEqual(f.calls[0].body.max_tokens, 2000);
});

test("stop_reason 'max_tokens' -> read failure with usage", async () => {
    const usage = { input_tokens: 900, output_tokens: 2000 };
    const f = fakeFetch({ ...reply(JSON.stringify(GOOD), usage), stop_reason: 'max_tokens' });
    await assert.rejects(
        extractBrochure({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', originalName: 'a.pdf' }, deps(f)),
        (e) => e.code !== 'not_configured' && e.usage === usage,
    );
});

const IMAGE_MAX = 4.5 * 1024 * 1024;
const jpegOf = (size) => { const b = Buffer.alloc(size); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b; };

test('image over 4.5 MB -> image_too_large before calling the API', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await assert.rejects(
        extractBrochure({ buffer: jpegOf(IMAGE_MAX + 1), mimeType: 'image/jpeg', originalName: 'a.jpg' }, deps(f)),
        (e) => e.code === 'image_too_large' && e.usage === undefined,
    );
    assert.strictEqual(f.calls.length, 0);
});

test('image of exactly 4.5 MB is sent', async () => {
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: jpegOf(IMAGE_MAX), mimeType: 'image/jpeg', originalName: 'a.jpg' }, deps(f));
    assert.strictEqual(f.calls.length, 1);
});

test('real file type wins over the browser mimetype', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const f = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: png, mimeType: 'image/jpeg', originalName: 'a.jpg' }, deps(f));
    const img = blocks(f).find((b) => b.type === 'image');
    assert.strictEqual(img.source.media_type, 'image/png');

    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
    const g = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: webp, mimeType: 'image/png', originalName: 'a.png' }, deps(g));
    assert.strictEqual(blocks(g).find((b) => b.type === 'image').source.media_type, 'image/webp');

    const h = fakeFetch(reply(JSON.stringify(GOOD)));
    await extractBrochure({ buffer: Buffer.from('%PDF-1.7'), mimeType: 'image/jpeg', originalName: 'a.jpg' }, deps(h));
    assert.ok(blocks(h).find((b) => b.type === 'document'), 'a PDF named .jpg goes as a document');
});

test('unknown signature for a claimed image or pdf -> read failure, API not called', async () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
        const f = fakeFetch(reply(JSON.stringify(GOOD)));
        await assert.rejects(
            extractBrochure({ buffer: Buffer.from('hello world'), mimeType, originalName: 'x' }, deps(f)),
            (e) => e.code !== 'not_configured' && e.code !== 'image_too_large',
        );
        assert.strictEqual(f.calls.length, 0, mimeType);
    }
});

test('sst_rate accepted only in (0, 30]', () => {
    const at = (rate) => validateFields({ ...GOOD, actualCourseFee: 108, sst_included: true, sst_rate: rate });
    // 0.08 is inside (0, 30], so it is used as a 0.08 % rate.
    assert.strictEqual(at(0.08).actualCourseFee, 107.91);
    assert.strictEqual(at(0.08).feeMayIncludeSst, undefined);
    for (const bad of [800, 0]) {
        const r = at(bad);
        assert.strictEqual(r.actualCourseFee, 108, String(bad));
        assert.strictEqual(r.feeMayIncludeSst, true, String(bad));
    }
    assert.strictEqual(at('8%').actualCourseFee, 100);
    assert.strictEqual(at('8%').feeMayIncludeSst, undefined);
    assert.strictEqual(at(30).actualCourseFee, round2(108 / 1.3));
});

test('name whitespace collapsed', () => {
    assert.strictEqual(validateFields({ ...GOOD, trainingProgrammeName: '  Lean\n Management   Basics ' }).trainingProgrammeName,
        'Lean Management Basics');
});

const round2 = (n) => Math.round(n * 100) / 100;
