const express = require('express');
const crypto  = require('crypto');
const store   = require('../lib/store');
const usage   = require('../lib/usage');
const { generateCode } = require('../lib/codes');

const router = express.Router();

const WINDOW_S = 300;
const MIN_SECRET = 32;
const seen = new Map(); // accepted signature -> expiry (ms)

const fail = (res, status, message) => res.status(status).json({ success: false, message });

function prune(nowMs) {
    for (const [sig, exp] of seen) if (exp <= nowMs) seen.delete(sig);
}

// HMAC-SHA256(secret, timestamp + "." + rawBody), lowercase hex. Fails closed.
function requireNewsletterSignature(req, res, next) {
    const secret = process.env.TGE_NEWSLETTER_SECRET;
    if (typeof secret !== 'string' || secret.length < MIN_SECRET) {
        return fail(res, 503, 'Newsletter API not configured');
    }
    const ts = req.get('x-tge-timestamp');
    const sig = req.get('x-tge-signature');
    if (!ts || !sig || !/^\d{1,12}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) {
        return fail(res, 401, 'Unauthorized');
    }
    const nowMs = Date.now();
    if (Math.abs(nowMs / 1000 - Number(ts)) > WINDOW_S) return fail(res, 401, 'Unauthorized');

    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const expected = crypto.createHmac('sha256', secret).update(ts + '.').update(raw).digest();
    const given = Buffer.from(sig, 'hex');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        return fail(res, 401, 'Unauthorized');
    }
    prune(nowMs);
    if (seen.has(sig)) return fail(res, 401, 'Unauthorized');
    seen.set(sig, nowMs + WINDOW_S * 1000);

    try {
        req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
        return fail(res, 400, 'Invalid JSON body');
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return fail(res, 400, 'Invalid body');
    }
    next();
}

// Raw bytes are needed for the signature, so no JSON parsing before auth.
router.use(express.raw({ type: () => true, limit: '1mb' }));
router.use(requireNewsletterSignature);

const readCodes  = () => store.readJSON('activation-codes.json', []);
const writeCodes = (c) => store.writeJSON('activation-codes.json', c);

const STATUSES = ['paid', 'free', 'vip', 'past_due', 'cancelled', 'blocked', 'deleted'];
const PLANS = ['yearly', 'monthly', 'vip', 'none'];
const LOCKS = [null, 'blocked', 'refund', 'deleted', 'not_entitled'];

router.post('/entitlement', (req, res) => {
    const b = req.body;
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !email.includes('@')) return fail(res, 400, 'Invalid email');
    if (!STATUSES.includes(b.status)) return fail(res, 400, 'Invalid status');
    if (!PLANS.includes(b.plan_source)) return fail(res, 400, 'Invalid plan_source');
    const locked = b.locked_reason === undefined ? null : b.locked_reason;
    if (!LOCKS.includes(locked)) return fail(res, 400, 'Invalid locked_reason');
    if (typeof b.paying !== 'boolean' || typeof b.permanent !== 'boolean') return fail(res, 400, 'Invalid flags');
    if (b.code != null && typeof b.code !== 'string') return fail(res, 400, 'Invalid code');
    if (b.anchor_date != null && !/^\d{4}-\d{2}-\d{2}/.test(String(b.anchor_date))) return fail(res, 400, 'Invalid anchor_date');

    const now = new Date();
    const codes = readCodes();
    let entry = b.code ? codes.find(c => c.code === b.code) : null;
    if (!entry) entry = codes.find(c => c.source === 'newsletter' && String(c.email || '').toLowerCase() === email);
    let created = false;
    if (!entry) {
        created = true;
        entry = {
            code: generateCode(new Set(codes.map(c => c.code))),
            feature_key: 'tge',
            source: 'newsletter',
            registered_at: now.toISOString(),
            activated: false,
            activated_at: null,
            session_token: null,
            admin: { ai_enabled: null, monthly_limit: null, revoked: false },
        };
        codes.push(entry);
    }
    entry.email = email;
    entry.name = typeof b.name === 'string' ? b.name : '';
    entry.newsletter = {
        status: b.status,
        plan_source: b.plan_source,
        paying: b.paying,
        permanent: b.permanent,
        locked_reason: locked,
        refunded_at: b.refunded_at || null,
        anchor_date: b.anchor_date || null,
    };
    entry.synced_at = now.toISOString();
    writeCodes(codes);

    res.json({ success: true, data: { code: entry.code, created, access: usage.accessFor(entry, now) } });
});

router.post('/entitlements/lookup', (req, res) => {
    const emails = req.body.emails;
    if (!Array.isArray(emails) || emails.length > 500 || !emails.every(e => typeof e === 'string')) {
        return fail(res, 400, 'emails must be an array of at most 500 strings');
    }
    const want = new Set(emails.map(e => e.trim().toLowerCase()));
    const now = new Date();
    const data = {};
    for (const c of readCodes()) {
        if (c.source !== 'newsletter') continue;
        const e = String(c.email || '').toLowerCase();
        if (!want.has(e)) continue;
        const a = usage.accessFor(c, now);
        data[e] = { code: c.code, tge: a.tge, ai: a.ai };
    }
    res.json({ success: true, data });
});

module.exports = router;
module.exports.requireNewsletterSignature = requireNewsletterSignature;
