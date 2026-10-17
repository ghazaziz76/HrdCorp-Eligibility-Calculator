const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const store   = require('../lib/store');
const usage   = require('../lib/usage');
const playVerify = require('../lib/playVerify');
const { createLimiter } = require('../lib/rateLimit');

const readCodes  = () => store.readJSON('activation-codes.json', []);
const writeCodes = (codes) => store.writeJSON('activation-codes.json', codes);
const findCode   = (code) => readCodes().find(c => c.code === code);

// Same format as the app's generator (hrdcorp-mobile-app/services/activation.js) and lib/codes.js.
const CODE_RE = /^HRD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
// The Android app's ACTIVATION_FEATURE_KEY (hrdcorp-mobile-app/config.js).
const FEATURE_KEY = 'hrd_grant_calculator';
const MAX_ID_LEN = 200;

const registerLimit = createLimiter({ name: 'register' }).middleware();
const validateLimit = createLimiter({ name: 'validate-code' }).middleware();

const PENDING_MESSAGE = 'Your purchase is being verified. Open the app once with internet, then try again.';
const pendingBody = { success: false, message: PENDING_MESSAGE, reason: 'pending_verification' };

// RevenueCat check for a pending Play code from validate-code / access / activate-qr:
// at most one in flight per code, and not retried within VERIFY_RETRY_MS.
const VERIFY_RETRY_MS = 15000;
const VERIFY_WAIT_MS = 8000;
const verifying = new Map();
const lastVerify = new Map();

const lockedReason = (entry) => {
    if (entry.admin && entry.admin.revoked) return 'revoked';
    return (entry.newsletter && entry.newsletter.locked_reason) || 'not_entitled';
};
const lockedResponse = (res, entry) => res.status(403).json({
    success: false,
    message: 'This code is no longer active. Contact admin@milleniumrx.biz',
    reason: lockedReason(entry),
});

// Fire-and-forget RevenueCat verification; only when a key is configured.
const triggerVerification = (code) => {
    if (!process.env.REVENUECAT_SECRET_KEY) return;
    playVerify.applyVerification(code).catch((err) => {
        console.error('[playVerify] verification failed:', err && err.message);
    });
};

// Resolves to the verification result, or null when skipped / timed out. Never rejects.
function verifyPending(entry) {
    if (!process.env.REVENUECAT_SECRET_KEY) return Promise.resolve(null);
    if (!entry.play || !entry.play.rc_app_user_id || entry.play.verified_at) return Promise.resolve(null);
    const code = entry.code;
    let p = verifying.get(code);
    if (!p) {
        const last = lastVerify.get(code);
        if (last && Date.now() - last < VERIFY_RETRY_MS) return Promise.resolve(null);
        lastVerify.set(code, Date.now());
        p = Promise.resolve()
            .then(() => playVerify.applyVerification(code))
            .catch((err) => {
                console.error('[playVerify] verification failed:', err && err.message);
                return null;
            })
            .finally(() => verifying.delete(code));
        verifying.set(code, p);
    }
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(resolve, VERIFY_WAIT_MS, null); });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

// Access for an entry; a pending Play code gets one verification attempt first.
// Returns { entry, access } with the entry re-read after a successful verification.
async function accessWithVerify(entry) {
    let access = usage.accessFor(entry, new Date());
    if (access.tge !== 'pending') return { entry, access };
    const result = await verifyPending(entry);
    if (!result || !result.verified) return { entry, access };
    const fresh = findCode(entry.code) || entry;
    return { entry: fresh, access: usage.accessFor(fresh, new Date()) };
}

// ── POST /api/employer/activation-codes ──────────────────
// Mobile app registers a new activation code after purchase
// A code registered from PLAY_VERIFY_CUTOFF on unlocks the TGE only after RevenueCat
// verification (play.verified_at), which needs rc_app_user_id.
router.post('/employer/activation-codes', registerLimit, (req, res) => {
    const { code, feature_key, google_play_order_id, rc_app_user_id } = req.body || {};
    const cleanId = (v) => (typeof v === 'string' && v.trim().length <= MAX_ID_LEN ? v.trim() : '');
    const rcId = cleanId(rc_app_user_id);
    const orderId = cleanId(google_play_order_id);

    if (!code || !feature_key) {
        return res.status(400).json({ success: false, message: 'Missing code or feature_key' });
    }
    if (typeof code !== 'string' || !CODE_RE.test(code)) {
        return res.status(400).json({ success: false, message: 'Invalid code format' });
    }
    if (feature_key !== FEATURE_KEY) {
        return res.status(400).json({ success: false, message: 'Invalid feature_key' });
    }

    const codes = readCodes();

    // Check if code already registered
    const existing = codes.find(c => c.code === code);
    if (existing) {
        // Store the RevenueCat id only if empty; never overwrite. Newsletter codes never get one.
        if (rcId && existing.source !== 'newsletter' && !(existing.play && existing.play.rc_app_user_id)) {
            existing.play = { ...(existing.play || {}), rc_app_user_id: rcId };
            writeCodes(codes);
            triggerVerification(existing.code);
        }
        return res.json({ success: true, data: { code: existing.code, feature_key: existing.feature_key } });
    }

    const entry = {
        code,
        feature_key,
        google_play_order_id: orderId || 'unknown',
        registered_at: new Date().toISOString(),
        activated: false,
        activated_at: null,
        session_token: null,
    };

    if (rcId) entry.play = { rc_app_user_id: rcId };
    codes.push(entry);
    writeCodes(codes);
    if (rcId) triggerVerification(code);

    res.json({ success: true, data: { code, feature_key } });
});

// ── POST /api/employer/activate-qr ───────────────────────
// Web app scanned QR → mobile sends this to link the session
router.post('/employer/activate-qr', async (req, res) => {
    const { session_token, activation_code, google_play_order_id } = req.body || {};

    if (!session_token || !activation_code || typeof activation_code !== 'string') {
        return res.status(400).json({ success: false, message: 'Missing session_token or activation_code' });
    }

    const found = findCode(activation_code);
    if (!found) {
        return res.status(404).json({ success: false, message: 'Activation code not found' });
    }
    const { access } = await accessWithVerify(found);
    if (access.tge === 'locked') return lockedResponse(res, found);
    if (access.tge === 'pending') return res.status(403).json(pendingBody);

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
router.post('/employer/validate-code', validateLimit, async (req, res) => {
    const { code } = req.body || {};

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, message: 'Missing code' });
    }

    const found = findCode(code);
    if (!found) {
        return res.status(404).json({ success: false, message: 'Invalid activation code' });
    }
    const { access } = await accessWithVerify(found);
    if (access.tge === 'locked') return lockedResponse(res, found);
    if (access.tge === 'pending') return res.status(403).json(pendingBody);

    // Re-read: verification may have written the file while we waited.
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
        const tge = usage.accessFor(entry, new Date()).tge;
        if (tge === 'locked') return lockedResponse(res, entry);
        // 200 so the web page keeps polling; the code unlocks once the purchase is verified.
        if (tge === 'pending') return res.json(pendingBody);
        res.json({ success: true, data: { validated: true, feature_key: entry.feature_key, code: entry.code } });
    } else {
        res.json({ success: false, message: 'Not yet activated' });
    }
});

// ── POST /api/employer/access ────────────────────────────
// Current access (TGE state + AI allowance) for a code
// tge is 'activated' | 'locked' | 'pending' (Play purchase not yet verified).
router.post('/employer/access', async (req, res) => {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, message: 'Missing code' });
    }
    const entry = findCode(code);
    if (!entry) return res.status(404).json({ success: false, message: 'Invalid activation code' });
    const { access } = await accessWithVerify(entry);
    res.json({ success: true, data: access });
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
