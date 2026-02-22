'use strict';

const cron       = require('node-cron');
const https      = require('https');
const http       = require('http');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const fs         = require('fs');
const path       = require('path');

const MONITOR_FILE = path.join(__dirname, 'data/monitor.json');

// ── Documents to watch ────────────────────────────────────
const WATCH = {
    acm_guide: {
        label: 'ACM Guide (Allowable Cost Matrix)',
        url:   'https://hrdcorp.gov.my/wp-content/uploads/2025/12/Jan-2026-Version_Allowable-Cost-Matrix-2025.pdf',
    },
    acm_table: {
        label: 'ACM Table (November 2025 Edition)',
        url:   'https://hrdcorp.gov.my/wp-content/uploads/2025/11/Attachment-ACM-Table-November-2025-Edition.pdf',
    },
};

// ── Helpers ───────────────────────────────────────────────
function readMonitorData() {
    try { return JSON.parse(fs.readFileSync(MONITOR_FILE, 'utf8')); }
    catch { return {}; }
}

function writeMonitorData(data) {
    fs.writeFileSync(MONITOR_FILE, JSON.stringify(data, null, 2));
}

function fetchBuffer(url, redirectCount = 0) {
    if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, {
            headers: { 'User-Agent': 'HRDCorp-ACM-Monitor/1.0' },
            timeout: 30000,
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchBuffer(res.headers.location, redirectCount + 1));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data',  c => chunks.push(c));
            res.on('end',   () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
        req.on('error',   reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    });
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── Email ─────────────────────────────────────────────────
async function sendAlert(alerts) {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const notifyTo = process.env.NOTIFY_EMAIL || smtpUser;

    if (!smtpUser || !smtpPass) {
        console.error('[Monitor] SMTP credentials not configured. Skipping email.');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass },
    });

    let html = `
        <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#b71c1c">⚠️ HRD Corp ACM Document Update Detected</h2>
        <p>The following document(s) have changed or could not be reached:</p>
        <ul>
    `;

    for (const a of alerts) {
        if (a.isError) {
            html += `
                <li style="margin-bottom:16px">
                    <strong>${a.doc.label}</strong><br>
                    <span style="color:#e65100">Could not fetch — ${a.error}</span><br>
                    Please check <a href="https://hrdcorp.gov.my">hrdcorp.gov.my</a> manually
                    for a new version.
                </li>
            `;
        } else {
            html += `
                <li style="margin-bottom:16px">
                    <strong>${a.doc.label}</strong> — content has changed.<br>
                    <a href="${a.doc.url}">${a.doc.url}</a><br>
                    <span style="color:#1b5e20">Please review the updated document and update
                    the ACM rates in the admin panel.</span>
                </li>
            `;
        }
    }

    html += `
        </ul>
        <hr>
        <p style="color:#888;font-size:12px">
            Sent by HRD Corp Calculator Monitor · Millenium Resource Ltd<br>
            Checked: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} KL time
        </p>
        </div>
    `;

    await transporter.sendMail({
        from:    `"HRD Corp Monitor" <${smtpUser}>`,
        to:      notifyTo,
        subject: '⚠️ HRD Corp ACM Document Update Detected',
        html,
    });

    console.log(`[Monitor] Alert email sent to ${notifyTo}`);
}

// ── Core check ────────────────────────────────────────────
async function runCheck(isStartup = false) {
    console.log('[Monitor] Running ACM document check...');
    const stored  = readMonitorData();
    const updated = { ...stored };
    const alerts  = [];

    for (const [key, doc] of Object.entries(WATCH)) {
        console.log(`[Monitor] Checking ${key}...`);
        try {
            const buffer = await fetchBuffer(doc.url);
            const hash   = sha256(buffer);
            const prev   = stored[key];

            if (!prev || !prev.hash) {
                // First run — store hash, no alert
                console.log(`[Monitor] ${key}: first check — hash stored.`);
            } else if (hash !== prev.hash) {
                console.log(`[Monitor] ${key}: CHANGED ← sending alert.`);
                if (!isStartup) alerts.push({ key, doc, isError: false });
            } else {
                console.log(`[Monitor] ${key}: no change.`);
            }

            updated[key] = {
                url:         doc.url,
                hash,
                lastChecked: new Date().toISOString(),
                lastChanged: (hash !== stored[key]?.hash && !isStartup)
                    ? new Date().toISOString()
                    : (stored[key]?.lastChanged || null),
            };
        } catch (err) {
            console.error(`[Monitor] ${key}: fetch failed — ${err.message}`);
            updated[key] = {
                ...stored[key],
                lastChecked: new Date().toISOString(),
                lastError:   err.message,
            };
            if (!isStartup) alerts.push({ key, doc, isError: true, error: err.message });
        }
    }

    writeMonitorData(updated);

    if (alerts.length > 0) {
        await sendAlert(alerts).catch(err =>
            console.error('[Monitor] Email failed:', err.message)
        );
    }

    console.log('[Monitor] Check complete.');
    return updated;
}

// ── Scheduler ─────────────────────────────────────────────
function startMonitor() {
    // On startup: fetch and store hashes (no email — just baseline)
    setTimeout(() => {
        console.log('[Monitor] Startup baseline check (no alerts sent)...');
        runCheck(true).catch(err => console.error('[Monitor] Startup error:', err));
    }, 3000);

    // Every Monday at 8:00 AM Kuala Lumpur time
    cron.schedule('0 8 * * 1', () => {
        runCheck(false).catch(err => console.error('[Monitor] Weekly check error:', err));
    }, { timezone: 'Asia/Kuala_Lumpur' });

    console.log('📡 ACM monitor started — checks every Monday at 8:00 AM KL time');
}

module.exports = { startMonitor, runCheck };
