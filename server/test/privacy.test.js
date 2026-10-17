const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer } = require('./helpers');

const built = fs.existsSync(path.join(__dirname, '../../build/privacy.html'));
const skip = built ? false : 'build/privacy.html absent: run `npm run build` to exercise this test';

let srv;
before(async () => { if (built) srv = await startTestServer(); });
after(async () => { if (srv) await srv.close(); });

test('GET /privacy.html serves the policy', { skip }, async () => {
    const res = await fetch(srv.base + '/privacy.html');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const html = await res.text();
    assert.ok(html.includes('deleted'), 'mentions deletion');
    assert.ok(html.includes('admin@milleniumrx.biz'), 'has contact email');
    assert.ok(html.includes('<title>Privacy Policy'), 'is the policy page, not the SPA shell');
    assert.ok(html.includes('Anthropic'), 'names Anthropic as the AI provider');
});

test('policy source names Anthropic for brochure uploads', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../public/privacy.html'), 'utf8');
    assert.ok(html.includes('Anthropic'), 'names Anthropic');
    assert.ok(!html.includes('T11:'), 'no leftover placeholder');
});
