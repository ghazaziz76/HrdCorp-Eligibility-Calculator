// Anonymous brochure statistics: month + 4 fields only. No code, email or timestamp.
const store = require('./store');
const { myMonth } = require('./entitlement');

const FILE = 'brochure-stats.json';

// Field-name mapping is finalised in Task T11.
function pickAnonymous(fields) {
    const f = fields || {};
    const v = (x) => (x === undefined ? null : x);
    return {
        training_title: v(f.training_title),
        duration: v(f.duration),
        delivery: v(f.delivery),
        course_fee: v(f.course_fee),
    };
}

function append(fields, now = new Date()) {
    const all = store.readJSON(FILE, []);
    const list = Array.isArray(all) ? all : [];
    list.push({ month: myMonth(now), ...pickAnonymous(fields) });
    store.writeJSON(FILE, list);
}

module.exports = { pickAnonymous, append };
