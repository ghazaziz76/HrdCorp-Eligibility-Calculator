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

const PROTECTED = ['activation-codes.json', 'tge-usage.json', 'tge-spend.json'];

test('corrupt protected file: readJSON throws store_corrupt instead of returning the fallback', () => {
    withTempDir((dir) => {
        const errs = [];
        const realErr = console.error;
        console.error = (...a) => errs.push(a.join(' '));
        try {
            for (const name of PROTECTED) {
                fs.writeFileSync(path.join(dir, name), '{"half": ');
                assert.throws(() => store.readJSON(name, []), (e) => e.code === 'store_corrupt', name);
            }
        } finally {
            console.error = realErr;
        }
        assert.ok(errs.length >= PROTECTED.length, 'logged loudly');
    });
});

test('corrupt protected file: writeJSON refuses to overwrite it', () => {
    withTempDir((dir) => {
        const realErr = console.error;
        console.error = () => {};
        try {
            for (const name of PROTECTED) {
                fs.writeFileSync(path.join(dir, name), '{"half": ');
                assert.throws(() => store.writeJSON(name, []), (e) => e.code === 'store_corrupt', name);
                assert.strictEqual(fs.readFileSync(path.join(dir, name), 'utf8'), '{"half": ');
            }
        } finally {
            console.error = realErr;
        }
    });
});

test('missing protected file still returns the fallback and can be written', () => {
    withTempDir(() => {
        for (const name of PROTECTED) {
            assert.deepStrictEqual(store.readJSON(name, []), []);
            store.writeJSON(name, { ok: 1 });
            assert.deepStrictEqual(store.readJSON(name, null), { ok: 1 });
        }
    });
});
