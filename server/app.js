const express = require('express');
const cors    = require('cors');
const path    = require('path');
const adminRoutes      = require('./routes/admin');
const tgeAdminRoutes   = require('./routes/tgeAdmin');
const activationRoutes = require('./routes/activation');
const newsletterRoutes = require('./routes/newsletter');
const { createAiRouter } = require('./routes/ai');
const { extractBrochure } = require('./ai/extractor');

// options.extract lets tests inject a fake extractor; defaults to the real one.
function createApp(options = {}) {
    const app = express();

    // Client IP for rate limits: trust loopback (nginx on this box) and the cPanel proxy
    // in front of it. Override with TRUST_PROXY (any Express 'trust proxy' value).
    app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, 103.191.76.181');

    app.use(cors());
    // The newsletter router needs the raw body for HMAC verification, so it
    // must be mounted before the global JSON parser.
    app.use('/api/newsletter', newsletterRoutes);

    app.use(express.json());
    app.use('/api', createAiRouter({ extract: options.extract || extractBrochure }));

    // ── API routes ────────────────────────────────────────
    app.use('/api', adminRoutes);
    app.use('/api', tgeAdminRoutes);
    app.use('/api', activationRoutes);

    // ── Serve built React app (production) ───────────────
    const buildPath = path.join(__dirname, '../build');
    app.use(express.static(buildPath));
    app.get('/{*path}', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
    });

    // JSON errors only, never a stack trace (e.g. a corrupt data file -> 500, process keeps running).
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        const status = Number(err && (err.status || err.statusCode));
        const code = status >= 400 && status < 500 ? status : 500;
        if (code === 500) console.error('[server] request failed:', (err && (err.code || err.message)) || err);
        if (res.headersSent) return;
        res.status(code).json({ success: false, message: code === 500 ? 'Server error' : 'Bad request' });
    });

    return app;
}

module.exports = { createApp };
