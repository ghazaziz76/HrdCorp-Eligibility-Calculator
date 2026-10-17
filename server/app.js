const express = require('express');
const cors    = require('cors');
const path    = require('path');
const adminRoutes      = require('./routes/admin');
const activationRoutes = require('./routes/activation');

function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());

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
