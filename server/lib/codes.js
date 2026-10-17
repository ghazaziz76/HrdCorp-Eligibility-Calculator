const crypto = require('crypto');

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const block = () => Array.from({ length: 4 }, () => CHARS[crypto.randomInt(CHARS.length)]).join('');

// HRD-XXXX-XXXX-XXXX, [A-Z0-9], unique against `existing`.
function generateCode(existing) {
    for (;;) {
        const code = `HRD-${block()}-${block()}-${block()}`;
        if (!existing || !existing.has(code)) return code;
    }
}

module.exports = { generateCode };
