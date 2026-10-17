const store = require('./store');

const RC_BASE = 'https://api.revenuecat.com/v1/subscribers/';
const no = (reason) => ({ verified: false, reason });

// Verify a Play Store purchase against RevenueCat. Never throws.
async function verifyPlayPurchase(entry, allEntries, { apiKey, fetchImpl = fetch } = {}) {
    const rcUser = entry && entry.play && entry.play.rc_app_user_id;
    if (!rcUser) return no('no_rc_user');
    if (!apiKey) return no('no_api_key');

    let res;
    try {
        res = await fetchImpl(RC_BASE + encodeURIComponent(rcUser), {
            method: 'GET',
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        });
    } catch {
        return no('rc_error');
    }
    if (res.status === 404) return no('not_found');
    if (!res.ok) return no('rc_error');

    let body;
    try { body = await res.json(); } catch { return no('rc_error'); }
    const raw = body && body.subscriber && body.subscriber.non_subscriptions
        && body.subscriber.non_subscriptions.full_access;
    const items = Array.isArray(raw) ? raw : [];
    const orderId = entry.google_play_order_id;
    const match = orderId === 'unknown'
        ? items.find((i) => i && i.store_transaction_id)
        : items.find((i) => i && i.store_transaction_id === orderId);
    if (!match) return no('not_found');

    const used = (allEntries || []).some((o) => o && o.code !== entry.code && o.play
        && o.play.verified_at && o.play.store_transaction_id === match.store_transaction_id);
    if (used) return no('transaction_already_used');

    return {
        verified: true,
        reason: 'ok',
        purchase_date: match.purchase_date,
        store_transaction_id: match.store_transaction_id,
    };
}

// Load the entry, verify it and persist play.* on success.
async function applyVerification(code, opts = {}) {
    const o = { apiKey: process.env.REVENUECAT_SECRET_KEY, ...opts };
    const entry = store.readJSON('activation-codes.json', []).find((c) => c.code === code);
    if (!entry) return no('not_found');
    const result = await verifyPlayPurchase(entry, store.readJSON('activation-codes.json', []), o);
    if (!result.verified) return result;
    // Re-read so a write that happened during the network call is not lost.
    const codes = store.readJSON('activation-codes.json', []);
    const fresh = codes.find((c) => c.code === code);
    if (!fresh) return no('not_found');
    fresh.play = {
        ...(fresh.play || {}),
        verified_at: new Date().toISOString(),
        purchase_date: result.purchase_date,
        store_transaction_id: result.store_transaction_id,
    };
    store.writeJSON('activation-codes.json', codes);
    return result;
}

module.exports = { verifyPlayPurchase, applyVerification };
