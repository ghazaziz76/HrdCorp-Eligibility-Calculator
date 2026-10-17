// Anonymous brochure statistics: month + 4 fields only. No code, email or timestamp.
const store = require('./store');
const { myMonth } = require('./entitlement');

const FILE = 'brochure-stats.json';

// Maps the extractor's six fields to the four anonymous stats fields.
function pickAnonymous(fields) {
    const f = fields || {};
    const v = (x) => (x === undefined ? null : x);
    return {
        training_title: v(f.trainingProgrammeName),
        duration: f.days && f.duration ? `${f.days} x ${f.duration}` : null,
        delivery: v(f.trainingType),
        course_fee: v(f.actualCourseFee),
    };
}

function append(fields, now = new Date()) {
    const all = store.readJSON(FILE, []);
    const list = Array.isArray(all) ? all : [];
    list.push({ month: myMonth(now), ...pickAnonymous(fields) });
    store.writeJSON(FILE, list);
}

module.exports = { pickAnonymous, append };
