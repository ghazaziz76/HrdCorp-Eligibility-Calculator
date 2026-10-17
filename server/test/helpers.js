const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

async function startTestServer() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tge-test-'));
    process.env.TGE_DATA_DIR = dataDir;
    process.env.TGE_NEWSLETTER_SECRET = 'test-secret-32-bytes-minimum-xxxxxxxx';
    process.env.ADMIN_PASSWORD = 'test-admin';

    const { createApp } = require('../app');
    const server = await new Promise((resolve) => {
        const s = createApp().listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;

    return {
        base,
        dataDir,
        close: async () => {
            await new Promise((resolve) => server.close(resolve));
            fs.rmSync(dataDir, { recursive: true, force: true });
        },
    };
}

// POST a JSON body signed per the newsletter HMAC scheme. opts may override
// timestamp / signature / secret / headers, or send rawBody verbatim.
async function signedPost(base, p, body, opts = {}) {
    const raw = opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body);
    const ts = opts.timestamp !== undefined ? String(opts.timestamp) : String(Math.floor(Date.now() / 1000));
    const secret = opts.secret !== undefined ? opts.secret : process.env.TGE_NEWSLETTER_SECRET;
    const sig = opts.signature !== undefined
        ? opts.signature
        : crypto.createHmac('sha256', secret).update(ts + '.' + raw).digest('hex');
    const headers = { 'content-type': 'application/json', ...(opts.headers || {}) };
    if (!opts.omitTimestamp) headers['x-tge-timestamp'] = ts;
    if (!opts.omitSignature) headers['x-tge-signature'] = sig;
    return fetch(base + p, { method: 'POST', headers, body: raw });
}

module.exports = { startTestServer, signedPost };
