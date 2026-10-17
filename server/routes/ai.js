// The only AI entry point. Enforces access, limits, failed-read cap and spend.
const express = require('express');
const multer = require('multer');
const store = require('../lib/store');
const usage = require('../lib/usage');
const ent = require('../lib/entitlement');
const brochureStats = require('../lib/brochureStats');
const { createLimiter } = require('../lib/rateLimit');
const { sniffType, IMAGE_MAX_BYTES } = require('../ai/extractor');

const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
]);
// Some browsers / phones send no type or a generic one. Then the file name decides whether the
// bytes are looked at, and the bytes (the extractor's sniffer) decide the type.
const GENERIC_MIME = new Set(['', 'application/octet-stream']);
const ALLOWED_EXT = /\.(pdf|docx|jpe?g|jfif|jpe|png|webp)$/i;
const IMAGE_MAX_MB = (IMAGE_MAX_BYTES / 1024 / 1024).toFixed(1);

// In-flight extractions per code, and in total (module-level, single process). They are
// reserved against the monthly limit, the failed-read cap and the spend limit, so parallel
// uploads cannot overshoot any of them.
const inFlight = new Map();
let inFlightTotal = 0;

// Real type for an upload, or null when it is not one we accept.
function uploadType(file) {
    if (ALLOWED_MIME.has(file.mimetype)) return file.mimetype;
    const generic = GENERIC_MIME.has(String(file.mimetype || '').trim().toLowerCase());
    if (!generic || !ALLOWED_EXT.test(String(file.originalname || ''))) return null;
    return sniffType(file.buffer);
}

function safeAi(entry, at) {
    try {
        return usage.accessFor(entry, at).ai;
    } catch (e) {
        console.error('[ai] could not read access:', e && e.message);
        return null;
    }
}

function createAiRouter({ extract }) {
    const router = express.Router();
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }).single('file');
    const rateLimit = createLimiter({ name: 'ai-brochure' }).middleware();

    const findEntry = (code) => (store.readJSON('activation-codes.json', []) || []).find((c) => c.code === code);

    router.post('/employer/ai-brochure', rateLimit, (req, res, next) => {
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
            const mimeType = uploadType(file);
            if (!mimeType) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }

            // Access checks, in-flight checks and the reservation are synchronous (no await between them).
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
            if (usage.getUsage(entry, now).failed.count + n >= ent.FAILED_DAILY_CAP) {
                return res.status(403).json({ success: false, reason: 'failed_cap', ai: { ...access.ai, enabled: false, reason: 'failed_cap' } });
            }
            const spend = usage.getSpend(now);
            const perCall = usage.getSettings().cost.fallback_per_call_usd;
            if (spend.usd + (inFlightTotal + 1) * perCall > spend.limit_usd) {
                return res.status(403).json({ success: false, reason: 'spend_paused', ai: { ...access.ai, enabled: false, reason: 'spend_paused' } });
            }
            inFlight.set(code, n + 1);
            inFlightTotal += 1;
            counted = true;

            let result;
            try {
                result = await extract({ buffer, mimeType, originalName: file.originalname });
            } catch (err) {
                const at = new Date();
                // The AI service is down or not set up: not the user's fault, nothing is recorded.
                if (err && (err.code === 'provider_error' || err.code === 'not_configured')) {
                    console.error('[ai] provider unavailable:', err.detail || err.code);
                    return res.status(503).json({ success: false, reason: 'ai_unavailable', ai: safeAi(entry, at) });
                }
                if (err && err.code === 'image_too_large') {
                    return res.status(413).json({ success: false, message: `Image too large (max ${IMAGE_MAX_MB} MB)` });
                }
                usage.recordFailure(entry, usage.estimateCostUsd(err && err.usage, usage.getSettings()), at);
                return res.status(422).json({ success: false, reason: 'read_failed', ai: safeAi(entry, at) });
            }

            const at = new Date();
            const fields = (result && result.fields) || {};
            // The read worked: the user gets the fields even if bookkeeping fails.
            try {
                usage.recordSuccess(entry, usage.estimateCostUsd(result && result.usage, usage.getSettings()), at);
            } catch (e) {
                console.error('[ai] could not record a successful read:', e && e.message);
            }
            try { brochureStats.append(fields, at); } catch (e) { console.error('[ai] stats append failed:', e.message); }
            return res.json({ success: true, data: { fields, ai: safeAi(entry, at) } });
        } catch (err) {
            console.error('[ai] unexpected error:', err && err.message);
            if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error' });
        } finally {
            if (counted) {
                const left = (inFlight.get(code) || 1) - 1;
                if (left > 0) inFlight.set(code, left); else inFlight.delete(code);
                inFlightTotal = Math.max(0, inFlightTotal - 1);
            }
            buffer = null;
            if (req.file) req.file.buffer = null;
            usage.checkSpendAlerts(new Date()).catch((e) => console.error('[ai] spend alert failed:', e && e.message));
        }
    });

    return router;
}

module.exports = { createAiRouter };
