// Per-code AI usage and the global monthly spend meter. JSON files via store.
const store = require('./store');
const ent = require('./entitlement');
const { sendAdminMail } = require('./mailer');

const USAGE_FILE = 'tge-usage.json';
const SPEND_FILE = 'tge-spend.json';
const SETTINGS_FILE = 'tge-settings.json';

const DEFAULT_SETTINGS = {
    monthly_spend_limit_usd: 20,
    // claude-haiku-5-5 prices (USD per million tokens); the fallback is used when usage is unknown.
    cost: { input_per_mtok: 0.10, output_per_mtok: 0.50, fallback_per_call_usd: 0.002 },
    over50_emailed_at: null,
};

function getSettings() {
    const s = store.readJSON(SETTINGS_FILE, {}) || {};
    return { ...DEFAULT_SETTINGS, ...s, cost: { ...DEFAULT_SETTINGS.cost, ...(s.cost || {}) } };
}

function saveSettings(patch) {
    const cur = getSettings();
    const next = { ...cur, ...patch, cost: { ...cur.cost, ...((patch && patch.cost) || {}) } };
    store.writeJSON(SETTINGS_FILE, next);
    return next;
}

// Rolled view of a stored row; never writes.
function roll(row, entry, now) {
    const r = row || {};
    const ps = ent.periodStart(ent.anchorFor(entry), now);
    const day = ent.myDay(now);
    const month = ent.myMonth(now);
    const failed = r.failed && r.failed.day === day ? r.failed : { day, count: 0 };
    const cost = r.cost && r.cost.month === month ? r.cost : { month, usd: 0 };
    return {
        period_start: ps,
        used: r.period_start === ps ? (r.used || 0) : 0,
        total: r.total || 0,
        last_used_at: r.last_used_at || null,
        failed: { day: failed.day, count: failed.count },
        cost: { month: cost.month, usd: cost.usd },
    };
}

function getUsage(entry, now) {
    const all = store.readJSON(USAGE_FILE, {}) || {};
    return roll(all[entry.code], entry, now);
}

function spendRow(now) {
    const month = ent.myMonth(now);
    const s = store.readJSON(SPEND_FILE, null);
    if (s && s.month === month) return { warned80_at: null, paused_email_at: null, ...s };
    return { month, usd: 0, warned80_at: null, paused_email_at: null };
}

function getSpend(now) {
    const s = spendRow(now);
    const limit = Number(getSettings().monthly_spend_limit_usd);
    return {
        month: s.month,
        usd: s.usd,
        limit_usd: limit,
        paused: s.usd >= limit,
        pct: limit > 0 ? (s.usd / limit) * 100 : 100,
    };
}

function estimateCostUsd(usage, settings) {
    const c = settings.cost;
    if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') {
        return c.fallback_per_call_usd;
    }
    return (usage.input_tokens * c.input_per_mtok + usage.output_tokens * c.output_per_mtok) / 1e6;
}

function mutate(entry, now, fn, costUsd) {
    const all = store.readJSON(USAGE_FILE, {}) || {};
    const row = roll(all[entry.code], entry, now);
    fn(row);
    row.cost.usd += costUsd;
    all[entry.code] = row;
    store.writeJSON(USAGE_FILE, all);
    const sp = spendRow(now);
    sp.usd += costUsd;
    store.writeJSON(SPEND_FILE, sp);
}

const safeCost = (c) => (Number.isFinite(c) && c >= 0 ? c : getSettings().cost.fallback_per_call_usd);

function recordSuccess(entry, costUsd, now) {
    costUsd = safeCost(costUsd);
    mutate(entry, now, (r) => { r.used += 1; r.total += 1; r.last_used_at = now.toISOString(); }, costUsd);
}

function recordFailure(entry, costUsd, now) {
    costUsd = safeCost(costUsd);
    mutate(entry, now, (r) => { r.failed.count += 1; }, costUsd);
}

function resetCount(code, now) {
    const all = store.readJSON(USAGE_FILE, {}) || {};
    const row = all[code];
    if (!row) return;
    row.used = 0;
    row.failed = { day: ent.myDay(now), count: 0 };
    store.writeJSON(USAGE_FILE, all);
}

function accessFor(entry, now) {
    const usage = getUsage(entry, now);
    return ent.computeAccess(entry, usage, {
        now,
        spendPaused: getSpend(now).paused,
        failedToday: usage.failed.count,
    });
}

// Mail failed: un-set the flag so the next call retries.
function clearFlag(now, key) {
    const r = spendRow(now);
    r[key] = null;
    store.writeJSON(SPEND_FILE, r);
    console.error(`[Usage] spend alert mail failed (${key}); will retry`);
}

async function checkSpendAlerts(now) {
    const sp = getSpend(now);
    const row = spendRow(now);
    const fmt = (n) => `$${n.toFixed(2)}`;
    if (sp.pct >= 100 && !row.paused_email_at) {
        row.paused_email_at = now.toISOString();
        if (!row.warned80_at) row.warned80_at = row.paused_email_at;
        store.writeJSON(SPEND_FILE, row);
        const ok = await sendAdminMail('TGE AI paused: monthly spend limit reached (100%)',
            `AI spend for ${sp.month} is ${fmt(sp.usd)} of the ${fmt(sp.limit_usd)} limit. AI extraction is paused for everyone until next month or until you raise the limit in the TGE admin. The rest of the TGE keeps working.`);
        if (!ok) clearFlag(now, 'paused_email_at');
    } else if (sp.pct >= 80 && sp.pct < 100 && !row.warned80_at) {
        row.warned80_at = now.toISOString();
        store.writeJSON(SPEND_FILE, row);
        const ok = await sendAdminMail('TGE AI spend at 80% of monthly limit',
            `AI spend for ${sp.month} is ${fmt(sp.usd)} of the ${fmt(sp.limit_usd)} limit (80% reached). At 100% AI pauses for everyone.`);
        if (!ok) clearFlag(now, 'warned80_at');
    }
}

// After the limit changes: clear alert flags that no longer apply so the
// 80% / 100% mails can fire again. Returns the flags it cleared.
function rearmSpendAlerts(now) {
    const sp = getSpend(now);
    const row = spendRow(now);
    const cleared = [];
    if (row.warned80_at && sp.pct < 80) { cleared.push('warned80_at'); row.warned80_at = null; }
    if (row.paused_email_at && sp.pct < 100) { cleared.push('paused_email_at'); row.paused_email_at = null; }
    if (cleared.length) store.writeJSON(SPEND_FILE, row);
    return cleared;
}

module.exports = {
    rearmSpendAlerts,
    DEFAULT_SETTINGS, getSettings, saveSettings, getUsage, getSpend, estimateCostUsd,
    recordSuccess, recordFailure, resetCount, accessFor, checkSpendAlerts,
};
