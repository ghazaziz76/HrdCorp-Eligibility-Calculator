const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const multer   = require('multer');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DATA_DIR       = path.join(__dirname, '../data');
const UPLOADS_DIR    = path.join(__dirname, '../uploads');

// ── Multer — PDF uploads only ─────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename:    (req, file, cb) => {
        const name = req.params.type === 'guide' ? 'acm-guide.pdf' : 'acm-table.pdf';
        cb(null, name);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed'));
    },
    limits: { fileSize: 20 * 1024 * 1024 }  // 20 MB max
});

// ── Auth middleware ───────────────────────────────────────
const auth = (req, res, next) => {
    const pw = req.headers['x-admin-password'] || (req.body && req.body.password);
    if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
    next();
};

const readJSON  = (file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));

// ── Public endpoints ──────────────────────────────────────
router.get('/rates',   (req, res) => res.json(readJSON('acm-rates.json')));
router.get('/docs',    (req, res) => res.json(readJSON('acm-documents.json')));
router.get('/version', (req, res) => res.json(readJSON('version.json')));

// PDF files — check if they exist before redirecting
router.get('/pdf/:type', (req, res) => {
    const filename = req.params.type === 'guide' ? 'acm-guide.pdf' : 'acm-table.pdf';
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        // Fall back to public/ folder PDFs shipped with the app
        const publicPath = path.join(__dirname, '../../public', filename);
        if (fs.existsSync(publicPath)) res.sendFile(publicPath);
        else res.status(404).json({ error: 'PDF not yet uploaded' });
    }
});

// ── Admin: login check ────────────────────────────────────
router.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
    res.json({ success: true });
});

// ── Admin: update rates ───────────────────────────────────
router.post('/admin/rates', auth, (req, res) => {
    writeJSON('acm-rates.json', req.body);
    res.json({ success: true });
});

// ── Admin: update documents ───────────────────────────────
router.post('/admin/docs', auth, (req, res) => {
    writeJSON('acm-documents.json', req.body);
    res.json({ success: true });
});

// ── Admin: update version stamp ───────────────────────────
router.post('/admin/version', auth, (req, res) => {
    writeJSON('version.json', req.body);
    res.json({ success: true });
});

// ── Admin: upload PDF ─────────────────────────────────────
router.post('/admin/upload/:type', auth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const version = readJSON('version.json');
    const key     = req.params.type === 'guide' ? 'guide_uploaded_at' : 'table_uploaded_at';
    version[key]  = new Date().toISOString();
    writeJSON('version.json', version);
    res.json({ success: true, filename: req.file.filename });
});

module.exports = router;
