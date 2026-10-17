// TGE Users master control API. Everything here is behind adminAuth.
const express = require('express');
const router = express.Router();
const store = require('../lib/store');
const usage = require('../lib/usage');
const adminLog = require('../lib/adminLog');
const playVerify = require('../lib/playVerify');
const { sendAdminMail } = require('../lib/mailer');
const { auth } = require('../lib/adminAuth');

const OVER50_TEXT = 'More than 50 AI users — review the $20 monthly AI limit';
const COST_KEYS = ['input_per_mtok', 'output_per_mtok', 'fallback_per_call_usd'];

const readCodes = () => store.readJSON('activation-codes.json', []);
const fail = (res, status, error) => res.status(status).json({ error });
const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function sourceOf(entry) {
    if (entry.source !== 'newsletter') return 'play';
    const p = entry.newsletter && entry.newsletter.plan_source;
    return p === 'yearly' || p === 'monthly' || p === 'vip' ? p : 'newsletter-none';
}

function buildRow(entry, now) {
    const nl = entry.newsletter || {};
    const u = usage.getUsage(entry, now);
    const access = usage.accessFor(entry, now);
    return {
        code: entry.code,
        source: sourceOf(entry),
        email: entry.email || null,
        name: entry.name || null,
        newsletter_status: nl.status || null,
        tge: access.tge,
        ai: access.ai,
        last_used_at: u.last_used_at,
        total: u.total,
        cost_month_usd: u.cost.usd,
        admin: { ai_enabled: null, monthly_limit: null, revoked: false, ...(entry.admin || {}) },
        play_verified: !!(entry.play && entry.play.verified_at),
        refunded_at: nl.refunded_at || null,
        registered_at: entry.registered_at || null,
    };
}

let over50Sending = false;

// Email once when first over 50; re-arm when back at <= 50.
async function handleOver50(aiUsers) {
    const settings = usage.getSettings();
    if (aiUsers <= 50) {
        if (settings.over50_emailed_at) usage.saveSettings({ over50_emailed_at: null });
        return;
    }
    if (settings.over50_emailed_at || over50Sending) return;
    over50Sending = true;
    try {
        const ok = await sendAdminMail('TGE: more than 50 AI users',
            `${OVER50_TEXT}. Currently ${aiUsers} users have AI access.`);
        if (ok) usage.saveSettings({ over50_emailed_at: new Date().toISOString() });
    } finally {
        over50Sending = false;
    }
}

router.get('/admin/tge-users', auth, async (req, res) => {
    try {
        const now = new Date();
        const users = readCodes().map((e) => buildRow(e, now));
        const aiUsers = users.filter((r) => r.tge === 'activated' && r.ai.limit > 0 && r.ai.reason !== 'admin_off').length;
        const spend = usage.getSpend(now);
        const warnings = [];
        if (aiUsers > 50) warnings.push(OVER50_TEXT);
        if (spend.pct >= 100) warnings.push('AI spend limit reached — AI uploads are paused for everyone');
        else if (spend.pct >= 80) warnings.push(`AI spend is at ${Math.round(spend.pct)}% of the $${spend.limit_usd} monthly limit`);
        await handleOver50(aiUsers);
        res.json({
            users,
            totals: {
                spend_month_usd: spend.usd,
                limit_usd: spend.limit_usd,
                spend_pct: spend.pct,
                ai_users: aiUsers,
                over50: aiUsers > 50,
            },
            settings: usage.getSettings(),
            warnings,
        });
    } catch (err) {
        console.error('[tgeAdmin] list failed:', err);
        fail(res, 500, 'Could not load TGE users');
    }
});

// Resolve :code to an entry or send 404.
const withEntry = (req, res) => {
    const entry = readCodes().find((c) => c.code === req.params.code);
    if (!entry) fail(res, 404, 'Code not found');
    return entry;
};

router.post('/admin/tge-users/:code', auth, (req, res) => {
    const entry = withEntry(req, res);
    if (!entry) return;
    const b = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    if (has('ai_enabled') && ![true, false, null].includes(b.ai_enabled)) return fail(res, 400, 'ai_enabled must be true, false or null');
    if (has('monthly_limit') && !(b.monthly_limit === null
        || (Number.isInteger(b.monthly_limit) && b.monthly_limit >= 0 && b.monthly_limit <= 10000))) {
        return fail(res, 400, 'monthly_limit must be null or an integer 0..10000');
    }
    if (has('revoked') && typeof b.revoked !== 'boolean') return fail(res, 400, 'revoked must be a boolean');
    const fields = ['ai_enabled', 'monthly_limit', 'revoked'].filter(has);
    if (!fields.length) return fail(res, 400, 'Nothing to update');

    const codes = readCodes();
    const target = codes.find((c) => c.code === req.params.code);
    const before = { ai_enabled: null, monthly_limit: null, revoked: false, ...(target.admin || {}) };
    const after = { ...before };
    const changes = {};
    for (const f of fields) {
        after[f] = b[f];
        changes[f] = [before[f], b[f]];
    }
    target.admin = after;
    store.writeJSON('activation-codes.json', codes);
    adminLog.append('update-user', target.code, changes);
    res.json(buildRow(target, new Date()));
});

router.post('/admin/tge-users/:code/reset-count', auth, (req, res) => {
    const entry = withEntry(req, res);
    if (!entry) return;
    const now = new Date();
    const beforeUsed = usage.getUsage(entry, now).used;
    usage.resetCount(entry.code, now);
    adminLog.append('reset-count', entry.code, { used: [beforeUsed, 0] });
    res.json(buildRow(entry, now));
});

router.post('/admin/tge-users/:code/verify-play', auth, async (req, res) => {
    const entry = withEntry(req, res);
    if (!entry) return;
    try {
        const wasVerified = !!(entry.play && entry.play.verified_at);
        const result = await playVerify.applyVerification(entry.code);
        const fresh = readCodes().find((c) => c.code === entry.code) || entry;
        adminLog.append('verify-play', entry.code, {
            play_verified: [wasVerified, !!(fresh.play && fresh.play.verified_at)],
            result: [null, result.reason],
        });
        res.json({ result, row: buildRow(fresh, new Date()) });
    } catch (err) {
        console.error('[tgeAdmin] verify-play failed:', err);
        fail(res, 500, 'Verification failed');
    }
});

router.post('/admin/ai-settings', auth, (req, res) => {
    const b = req.body || {};
    const patch = {};
    if (b.monthly_spend_limit_usd !== undefined) {
        if (!isNum(b.monthly_spend_limit_usd)) return fail(res, 400, 'monthly_spend_limit_usd must be a number >= 0');
        patch.monthly_spend_limit_usd = b.monthly_spend_limit_usd;
    }
    if (b.cost !== undefined) {
        if (!b.cost || typeof b.cost !== 'object' || Array.isArray(b.cost)) return fail(res, 400, 'cost must be an object');
        patch.cost = {};
        for (const [k, v] of Object.entries(b.cost)) {
            if (!COST_KEYS.includes(k)) return fail(res, 400, `Unknown cost field: ${k}`);
            if (!isNum(v)) return fail(res, 400, `cost.${k} must be a number >= 0`);
            patch.cost[k] = v;
        }
    }
    if (patch.monthly_spend_limit_usd === undefined && !patch.cost) return fail(res, 400, 'Nothing to update');

    const before = usage.getSettings();
    const after = usage.saveSettings(patch);
    const changes = {};
    if (patch.monthly_spend_limit_usd !== undefined) {
        changes.monthly_spend_limit_usd = [before.monthly_spend_limit_usd, after.monthly_spend_limit_usd];
    }
    for (const k of Object.keys(patch.cost || {})) changes[`cost.${k}`] = [before.cost[k], after.cost[k]];
    adminLog.append('ai-settings', null, changes);
    res.json(after);
});

router.get('/admin/tge-log', auth, (req, res) => {
    const n = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 5000) : 200;
    res.json(adminLog.list(limit));
});

module.exports = router;
