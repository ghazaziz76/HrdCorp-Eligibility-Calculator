const fs   = require('fs');
const path = require('path');

// Read at call time so tests can point each server at a fresh temp directory.
const dataDir = () => process.env.TGE_DATA_DIR || path.join(__dirname, '..', 'data');

// Files that are read, changed and written back. If one of them is corrupt, returning the
// fallback would let the next write replace it with near-empty data, so reads throw instead
// and writes refuse. A missing file is fine (fallback).
const PROTECTED = new Set(['activation-codes.json', 'tge-usage.json', 'tge-spend.json']);

function corrupt(name, err) {
    console.error(`[store] !!! ${name} is CORRUPT (${err && err.message}). Refusing to read or overwrite it. `
        + 'Restore it from a backup; requests that need it will fail with 500 until then.');
    return Object.assign(new Error(`Data file ${name} is corrupt`), { code: 'store_corrupt', file: name });
}

const readJSON = (name, fallback) => {
    let text;
    try {
        text = fs.readFileSync(path.join(dataDir(), name), 'utf8');
    } catch (err) {
        if (!PROTECTED.has(name) || (err && err.code === 'ENOENT')) return fallback;
        throw err;
    }
    try {
        return JSON.parse(text);
    } catch (err) {
        if (PROTECTED.has(name)) throw corrupt(name, err);
        return fallback;
    }
};

// Atomic: write a sibling temp file, then rename over the target.
const writeJSON = (name, data) => {
    const file = path.join(dataDir(), name);
    if (PROTECTED.has(name)) readJSON(name, null); // throws if the current file is corrupt
    const tmp  = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
};

module.exports = { dataDir, readJSON, writeJSON, PROTECTED };
