const API_BASE = window.location.origin;
const ADMIN_EMAIL = 'admin@milleniumrx.biz';
const NEWSLETTER_URL = 'https://www.milleniumrx.biz/newsletter.html';

export const LOCKED_MESSAGE = 'This code is no longer active. Contact admin@milleniumrx.biz';

// Returns the Access object, or null on a network error / unknown code / bad reply.
export async function fetchAccess(code) {
    try {
        const res = await fetch(`${API_BASE}/api/employer/access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        return data && data.success && data.data ? data.data : null;
    } catch {
        return null;
    }
}

// Fired on window whenever a reply carries a fresh AI allowance, so every
// "uploads left" line (the upload box, the page footer) shows the same number.
export const AI_ALLOWANCE_EVENT = 'tge-ai-allowance-changed';
export function announceAiAllowance(ai) {
    if (!ai) return;
    try { window.dispatchEvent(new CustomEvent(AI_ALLOWANCE_EVENT, { detail: ai })); } catch {}
}

export function uploadsLeftText(ai) {
    return `${ai.remaining} of ${ai.limit} uploads left this month`;
}

export function clearStoredActivation() {
    try {
        localStorage.removeItem('hrd_activation_token');
        localStorage.removeItem('hrd_activation_code');
    } catch {}
}

// Sends one brochure to the server. Never throws.
// -> { ok: true, fields, ai } | { ok: false, status, reason?, ai?, message }
export async function uploadBrochure(file, code) {
    const body = new FormData();
    body.append('file', file);
    let res;
    try {
        res = await fetch(`${API_BASE}/api/employer/ai-brochure`, {
            method: 'POST',
            headers: { 'x-tge-code': code },
            body,
        });
    } catch {
        return { ok: false, status: 0, message: 'Network error' };
    }
    let data = null;
    try { data = await res.json(); } catch {}
    if (res.ok && data && data.success && data.data) {
        return { ok: true, fields: data.data.fields || {}, ai: data.data.ai || null };
    }
    return {
        ok: false,
        status: res.status,
        reason: data && data.reason,
        ai: data && data.ai,
        message: (data && data.message) || '',
    };
}

const adminLink = { label: ADMIN_EMAIL, href: `mailto:${ADMIN_EMAIL}` };
const newsletterLink = { label: 'Subscribe to the Business & People Management Newsletter', href: NEWSLETTER_URL };

const notAvailable = () => ({
    title: 'AI uploads unavailable',
    body: "AI uploads aren't available for this code.",
    links: [adminLink],
});

// App wording must never mention the newsletter, subscribing, prices or URLs
// (Play policy), so the upgrade wording below is web only.
export function aiBlockedMessage(reason, platform) {
    const isApp = platform === 'app';
    switch (reason) {
        case 'limit_reached':
            return {
                title: 'No AI uploads left',
                body: isApp
                    ? "You've used all your AI uploads for this month — come back next month."
                    : "You've used all your AI uploads for this month — come back next month. Upgrade to the yearly newsletter for 50 uploads a month.",
                links: isApp ? [adminLink] : [newsletterLink, adminLink],
            };
        case 'not_paying':
        case 'play_unverified':
            if (isApp) return notAvailable();
            return {
                title: 'Upgrade for AI uploads',
                body: 'AI brochure uploads come with the yearly Business & People Management Newsletter: 50 uploads a month.',
                links: [newsletterLink, adminLink],
            };
        case 'rate_limited':
            return {
                title: 'Too many tries',
                body: 'Too many uploads from this connection in the last hour — please try again later. This did not use one of your uploads.',
                links: [],
            };
        case 'pending_verification':
            return {
                title: 'Purchase being verified',
                body: 'Your purchase is being verified. Open the app once with internet, then try again.',
                links: [],
            };
        case 'spend_paused':
            return {
                title: 'AI uploads paused',
                body: 'AI uploads are paused for everyone until next month. Everything else in the estimator works as normal.',
                links: [],
            };
        case 'failed_cap':
            return {
                title: 'Too many unreadable files',
                body: 'Too many unreadable files today — try again tomorrow.',
                links: [],
            };
        default:
            return notAvailable();
    }
}
