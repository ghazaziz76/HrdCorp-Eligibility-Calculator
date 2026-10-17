// Append-only admin audit log (newest 5000 entries kept), stored as tge-admin-log.json.
const store = require('./store');

const FILE = 'tge-admin-log.json';
const MAX = 5000;

function append(action, code, changes) {
    const all = store.readJSON(FILE, []);
    const list = Array.isArray(all) ? all : [];
    list.push({ at: new Date().toISOString(), who: 'admin', action, code: code || null, changes: changes || {} });
    store.writeJSON(FILE, list.length > MAX ? list.slice(-MAX) : list);
}

// Newest first.
function list(limit) {
    const all = store.readJSON(FILE, []);
    return (Array.isArray(all) ? all : []).slice().reverse().slice(0, limit);
}

module.exports = { append, list };
