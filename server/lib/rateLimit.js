// Simple in-memory, per-key (per-IP) fixed-window rate limiter. Single process only.
// The limit is read per request from RATE_LIMIT_PER_HOUR (default 20) so it can be tuned
// without a code change. Client IP comes from req.ip, which depends on app 'trust proxy'.

const DEFAULT_MAX = 20;
const HOUR_MS = 3600e3;
const limiters = [];

const envMax = () => {
    const n = Number(process.env.RATE_LIMIT_PER_HOUR);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX;
};

function createLimiter({ name, windowMs = HOUR_MS, max = envMax, clock = Date.now } = {}) {
    const hits = new Map(); // key -> { start, count }
    const maxNow = () => (typeof max === 'function' ? max() : max);

    const current = (key) => {
        const now = clock();
        let row = hits.get(key);
        if (!row || now - row.start >= windowMs) {
            row = { start: now, count: 0 };
            hits.set(key, row);
        }
        // Keep memory bounded: drop expired rows now and then.
        if (hits.size > 10000) {
            for (const [k, r] of hits) if (now - r.start >= windowMs) hits.delete(k);
        }
        return row;
    };

    const limiter = {
        name,
        // Count one hit; false when the key is over the limit. No key (client address
        // unknown) is never limited, so visitors can't end up sharing one bucket.
        hit(key) {
            if (!key) return true;
            const row = current(key);
            row.count += 1;
            return row.count <= maxNow();
        },
        // True when the key has already used up its budget (does not count).
        blocked(key) {
            if (!key) return false;
            return current(key).count >= maxNow();
        },
        reset() { hits.clear(); },
        // Express middleware: counts every request.
        middleware() {
            return (req, res, next) => {
                if (limiter.hit(clientKey(req))) return next();
                res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
                return res.status(429).json({
                    success: false,
                    reason: 'rate_limited',
                    message: 'Too many requests. Please try again later.',
                });
            };
        },
    };
    limiters.push(limiter);
    return limiter;
}

// The client's address, or null when only a local proxy address is visible (the proxy in
// front did not pass the visitor's address on). Limiting by the proxy's address would put
// every visitor in one bucket, so those requests are not limited per IP.
const LOCAL = /^(::1|127\.|::ffff:127\.|localhost$)/;
const clientKey = (req) => {
    const ip = String(req.ip || (req.socket && req.socket.remoteAddress) || '');
    return ip && !LOCAL.test(ip) ? ip : null;
};

function _resetAll() {
    for (const l of limiters) l.reset();
}

module.exports = { createLimiter, clientKey, _resetAll, DEFAULT_MAX };
