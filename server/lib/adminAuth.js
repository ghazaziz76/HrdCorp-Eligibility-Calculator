// Shared admin auth: header x-admin-password (or body.password) vs ADMIN_PASSWORD.
// The password is read per request so tests and env changes take effect.
// Fails closed: with no ADMIN_PASSWORD set, every admin request is rejected.
// Failed attempts are rate limited per IP; once over the limit even the right password gets 429.
const crypto = require('crypto');
const { createLimiter, clientKey } = require('./rateLimit');

const failures = createLimiter({ name: 'admin-auth' });
let warnedMissing = false;

const adminPassword = () => process.env.ADMIN_PASSWORD || '';

const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();

// Constant-time compare (hashing first makes the lengths equal).
function checkPassword(given) {
    const expected = adminPassword();
    if (!expected) {
        if (!warnedMissing) {
            console.error('[adminAuth] ADMIN_PASSWORD is not set: all admin logins are rejected.');
            warnedMissing = true;
        }
        return false;
    }
    warnedMissing = false;
    if (typeof given !== 'string' || !given) return false;
    return crypto.timingSafeEqual(digest(given), digest(expected));
}

const TOO_MANY = 'Too many failed attempts. Try again later.';

// Returns true when the request may proceed; otherwise sends 401/429 itself.
function verifyAdmin(req, res, given) {
    const key = clientKey(req);
    if (failures.blocked(key)) {
        res.status(429).json({ error: TOO_MANY });
        return false;
    }
    if (!checkPassword(given)) {
        failures.hit(key);
        res.status(401).json({ error: 'Invalid password' });
        return false;
    }
    return true;
}

const auth = (req, res, next) => {
    const pw = req.headers['x-admin-password'] || (req.body && req.body.password);
    if (verifyAdmin(req, res, pw)) next();
};

module.exports = { auth, adminPassword, checkPassword, verifyAdmin };
