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

export function uploadsLeftText(ai) {
    return `${ai.remaining} of ${ai.limit} uploads left this month`;
}

export function clearStoredActivation() {
    try {
        localStorage.removeItem('hrd_activation_token');
        localStorage.removeItem('hrd_activation_code');
    } catch {}
}

const adminLink = { label: ADMIN_EMAIL, href: `mailto:${ADMIN_EMAIL}` };

export function aiBlockedMessage(reason, platform) {
    switch (reason) {
        case 'limit_reached': {
            const links = platform === 'app'
                ? [adminLink]
                : [{ label: 'Subscribe to the Business & People Management Newsletter', href: NEWSLETTER_URL }, adminLink];
            return {
                title: 'No AI uploads left',
                body: "You've used all your AI uploads for this month — come back next month.",
                links,
            };
        }
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
            return {
                title: 'AI uploads unavailable',
                body: "AI uploads aren't available for this code.",
                links: [adminLink],
            };
    }
}
