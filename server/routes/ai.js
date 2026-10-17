// The only AI entry point. Enforces access, limits, failed-read cap and spend.
const express = require('express');
const multer = require('multer');
const store = require('../lib/store');
const usage = require('../lib/usage');
const brochureStats = require('../lib/brochureStats');

const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
]);

// In-flight extractions per code (module-level, single process).
const inFlight = new Map();

function createAiRouter({ extract }) {
    const router = express.Router();
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }).single('file');

    const findEntry = (code) => (store.readJSON('activation-codes.json', []) || []).find((c) => c.code === code);

    router.post('/employer/ai-brochure', (req, res, next) => {
        const code = String(req.get('x-tge-code') || '').trim();
        if (!code) return res.status(400).json({ success: false, message: 'Missing x-tge-code header' });
        if (!findEntry(code)) return res.status(404).json({ success: false, message: 'Code not found' });
        upload(req, res, (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'File too large (max 10 MB)' });
                return res.status(400).json({ success: false, message: 'Invalid upload' });
            }
            next();
        });
    }, async (req, res) => {
        const file = req.file;
        let buffer = file && file.buffer;
        const code = String(req.get('x-tge-code')).trim();
        let counted = false;
        try {
            if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });
            if (!ALLOWED_MIME.has(file.mimetype)) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }

            // Access check, in-flight check and increment are synchronous (no await between them).
            const now = new Date();
            const entry = findEntry(code);
            if (!entry) return res.status(404).json({ success: false, message: 'Code not found' });
            const access = usage.accessFor(entry, now);
            if (access.ai.reason !== 'ok') {
                return res.status(403).json({ success: false, reason: access.ai.reason, ai: access.ai });
            }
            const n = inFlight.get(code) || 0;
            if (access.ai.used + n >= access.ai.limit) {
                return res.status(429).json({ success: false, reason: 'limit_reached', ai: access.ai });
            }
            inFlight.set(code, n + 1);
            counted = true;

            let result;
            try {
                result = await extract({ buffer, mimeType: file.mimetype, originalName: file.originalname });
            } catch (err) {
                const at = new Date();
                if (err && err.code === 'not_configured') {
                    return res.status(503).json({ success: false, reason: 'not_configured', ai: usage.accessFor(entry, at).ai });
                }
                if (err && err.code === 'image_too_large') {
                    return res.status(413).json({ success: false, message: 'Image too large (max 4.5 MB)' });
                }
                usage.recordFailure(entry, usage.estimateCostUsd(err && err.usage, usage.getSettings()), at);
                return res.status(422).json({ success: false, reason: 'read_failed', ai: usage.accessFor(entry, at).ai });
            }

            const at = new Date();
            const fields = (result && result.fields) || {};
            usage.recordSuccess(entry, usage.estimateCostUsd(result && result.usage, usage.getSettings()), at);
            try { brochureStats.append(fields, at); } catch (e) { console.error('[ai] stats append failed:', e.message); }
            return res.json({ success: true, data: { fields, ai: usage.accessFor(entry, at).ai } });
        } catch (err) {
            console.error('[ai] unexpected error:', err && err.message);
            if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error' });
        } finally {
            if (counted) {
                const left = (inFlight.get(code) || 1) - 1;
                if (left > 0) inFlight.set(code, left); else inFlight.delete(code);
            }
            buffer = null;
            if (req.file) req.file.buffer = null;
            usage.checkSpendAlerts(new Date()).catch((e) => console.error('[ai] spend alert failed:', e && e.message));
        }
    });

    return router;
}

module.exports = { createAiRouter };
