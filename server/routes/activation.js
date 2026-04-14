const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const DATA_FILE = path.join(__dirname, '../data/activation-codes.json');

const readCodes = () => {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return [];
    }
};

const writeCodes = (codes) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(codes, null, 2));
};

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
        res.json({ success: true, data: { validated: true, feature_key: entry.feature_key } });
    } else {
        res.json({ success: false, message: 'Not yet activated' });
    }
});

// ── POST /api/employer/generate-qr-session ───────────────
// Web app requests a new QR session token for display
router.post('/employer/generate-qr-session', (req, res) => {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    // Use X-Forwarded headers from reverse proxy, fallback to req.get('host')
    const forwardedHost = req.get('x-forwarded-host') || req.get('host');
    const forwardedProto = req.get('x-forwarded-proto') || req.protocol;
    res.json({
        success: true,
        data: {
            session_token: sessionToken,
            activation_url: `${forwardedProto}://${forwardedHost}/api/employer/activate-qr`,
        },
    });
});

module.exports = router;
