const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const adminRoutes = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ── API routes ────────────────────────────────────────────
app.use('/api', adminRoutes);

// ── Serve built React app (production) ───────────────────
const buildPath = path.join(__dirname, '../build');
app.use(express.static(buildPath));
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ HRD Corp Calculator server running on port ${PORT}`);
    console.log(`   Admin panel: http://localhost:${PORT}/admin`);
});
