const fs   = require('fs');
const path = require('path');

// Read at call time so tests can point each server at a fresh temp directory.
const dataDir = () => process.env.TGE_DATA_DIR || path.join(__dirname, '..', 'data');

const readJSON = (name, fallback) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(dataDir(), name), 'utf8'));
    } catch {
        return fallback;
    }
};

// Atomic: write a sibling temp file, then rename over the target.
const writeJSON = (name, data) => {
    const file = path.join(dataDir(), name);
    const tmp  = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
};

module.exports = { dataDir, readJSON, writeJSON };
