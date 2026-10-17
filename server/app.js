const express = require('express');
const cors    = require('cors');
const path    = require('path');
const adminRoutes      = require('./routes/admin');
const activationRoutes = require('./routes/activation');
const newsletterRoutes = require('./routes/newsletter');
const { createAiRouter } = require('./routes/ai');
const { extractBrochure } = require('./ai/extractor');

// options.extract lets tests inject a fake extractor; defaults to the real one.
function createApp(options = {}) {
    const app = express();

    app.use(cors());
    // The newsletter router needs the raw body for HMAC verification, so it
    // must be mounted before the global JSON parser.
    app.use('/api/newsletter', newsletterRoutes);

    app.use(express.json());
    app.use('/api', createAiRouter({ extract: options.extract || extractBrochure }));

    // ── API routes ────────────────────────────────────────
    app.use('/api', adminRoutes);
    app.use('/api', activationRoutes);

    // ── Serve built React app (production) ───────────────
    const buildPath = path.join(__dirname, '../build');
    app.use(express.static(buildPath));
    app.get('/{*path}', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
    });

    return app;
}

module.exports = { createApp };
