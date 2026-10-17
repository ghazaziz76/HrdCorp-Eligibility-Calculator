const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const store   = require('../lib/store');
const usage   = require('../lib/usage');

const readCodes  = () => store.readJSON('activation-codes.json', []);
const writeCodes = (codes) => store.writeJSON('activation-codes.json', codes);

const lockedReason = (entry) => {
    if (entry.admin && entry.admin.revoked) return 'revoked';
    return (entry.newsletter && entry.newsletter.locked_reason) || 'not_entitled';
};
const lockedResponse = (res, entry) => res.status(403).json({
    success: false,
    message: 'This code is no longer active. Contact admin@milleniumrx.biz',
    reason: lockedReason(entry),
});

// ── POST /api/employer/activation-codes ──────────────────
// Mobile app registers a new activation code after purchase
router.post('/employer/activation-codes', (req, res) => {
    const { code, feature_key, google_play_order_id } = req.body;

    if (!code || !feature_key) {
        return res.status(400).json({ success: false, message: 'Missing code or feature_key' });
    }

    const codes = readCodes();

    // Check if code already registered
    const existing = codes.find(c => c.code === code);
    if (existing) {
        return res.json({ success: true, data: { code: existing.code, feature_key: existing.feature_key } });
    }

    const entry = {
        code,
        feature_key,
        google_play_order_id: google_play_order_id || 'unknown',
        registered_at: new Date().toISOString(),
        activated: false,
        activated_at: null,
        session_token: null,
    };

    codes.push(entry);
    writeCodes(codes);

    res.json({ success: true, data: { code, feature_key } });
});

// ── POST /api/employer/activate-qr ───────────────────────
// Web app scanned QR → mobile sends this to link the session
router.post('/employer/activate-qr', (req, res) => {
    const { session_token, activation_code, google_play_order_id } = req.body;

    if (!session_token || !activation_code) {
        return res.status(400).json({ success: false, message: 'Missing session_token or activation_code' });
    }

    const codes = readCodes();
    const entry = codes.find(c => c.code === activation_code);

    if (!entry) {
        return res.status(404).json({ success: false, message: 'Activation code not found' });
    }

    // Mark as activated with this session
    entry.activated = true;
    entry.activated_at = new Date().toISOString();
    entry.session_token = session_token;
    if (google_play_order_id) entry.google_play_order_id = google_play_order_id;
    writeCodes(codes);

    res.json({ success: true, data: { validated: true, feature_key: entry.feature_key } });
});

// ── POST /api/employer/validate-code ─────────────────────
// Web app validates a manually entered activation code
router.post('/employer/validate-code', (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ success: false, message: 'Missing code' });
    }

    const codes = readCodes();
    const entry = codes.find(c => c.code === code);

    if (!entry) {
        return res.status(404).json({ success: false, message: 'Invalid activation code' });
    }

    if (usage.accessFor(entry, new Date()).tge === 'locked') return lockedResponse(res, entry);

    // Generate a session token for this web session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    entry.activated = true;
    entry.activated_at = new Date().toISOString();
    entry.session_token = sessionToken;
    writeCodes(codes);

    res.json({
        success: true,
        data: {
            validated: true,
            feature_key: entry.feature_key,
            session_token: sessionToken,
        },
    });
});

// ── GET /api/employer/check-session ──────────────────────
// Web app checks if a QR session has been activated (polling)
router.get('/employer/check-session', (req, res) => {
    const { session_token } = req.query;

    if (!session_token) {
        return res.status(400).json({ success: false, message: 'Missing session_token' });
    }

    const codes = readCodes();
    const entry = codes.find(c => c.session_token === session_token && c.activated);

    if (entry) {
        if (usage.accessFor(entry, new Date()).tge === 'locked') return lockedResponse(res, entry);
        res.json({ success: true, data: { validated: true, feature_key: entry.feature_key, code: entry.code } });
    } else {
        res.json({ success: false, message: 'Not yet activated' });
    }
});

// ── POST /api/employer/access ────────────────────────────
// Current access (TGE state + AI allowance) for a code
router.post('/employer/access', (req, res) => {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, message: 'Missing code' });
    }
    const entry = readCodes().find(c => c.code === code);
    if (!entry) return res.status(404).json({ success: false, message: 'Invalid activation code' });
    res.json({ success: true, data: usage.accessFor(entry, new Date()) });
});

// ── POST /api/employer/generate-qr-session ───────────────
// Web app requests a new QR session token for display
router.post('/employer/generate-qr-session', (req, res) => {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    // The QR's callback URL must use the public domain (valid TLS cert), not the
    // raw server IP that the reverse proxy reports in x-forwarded-host.
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://www.milleniumrx.biz';
    res.json({
        success: true,
        data: {
            session_token: sessionToken,
            activation_url: `${baseUrl}/api/employer/activate-qr`,
        },
    });
});

module.exports = router;
