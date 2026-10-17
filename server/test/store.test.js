const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const store = require('../lib/store');

function withTempDir(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tge-store-'));
    const prev = process.env.TGE_DATA_DIR;
    process.env.TGE_DATA_DIR = dir;
    try { return fn(dir); } finally {
        if (prev === undefined) delete process.env.TGE_DATA_DIR; else process.env.TGE_DATA_DIR = prev;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test('writeJSON then readJSON round-trips', () => {
    withTempDir(() => {
        store.writeJSON('x.json', { a: 1, b: [2, 3] });
        assert.deepStrictEqual(store.readJSON('x.json', null), { a: 1, b: [2, 3] });
    });
});

test('readJSON returns fallback for missing and corrupt files', () => {
    withTempDir((dir) => {
        assert.deepStrictEqual(store.readJSON('missing.json', []), []);
        fs.writeFileSync(path.join(dir, 'bad.json'), '{not json');
        assert.strictEqual(store.readJSON('bad.json', 'fb'), 'fb');
    });
});

test('writeJSON leaves no .tmp file behind', () => {
    withTempDir((dir) => {
        store.writeJSON('y.json', { ok: true });
        store.writeJSON('y.json', { ok: false });
        assert.deepStrictEqual(fs.readdirSync(dir), ['y.json']);
    });
});
