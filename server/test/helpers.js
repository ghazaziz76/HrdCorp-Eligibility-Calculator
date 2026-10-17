const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

module.exports = { startTestServer };
