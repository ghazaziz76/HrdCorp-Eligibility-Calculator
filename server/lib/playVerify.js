const store = require('./store');

const RC_BASE = 'https://api.revenuecat.com/v1/subscribers/';
const no = (reason) => ({ verified: false, reason });

const usedElsewhere = (all, code, txn) => (all || []).some((o) => o && o.code !== code
    && o.play && o.play.verified_at && o.play.store_transaction_id === txn);

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
    const isUsed = (txn) => usedElsewhere(allEntries, entry.code, txn);
    const candidates = items.filter((i) => i && i.store_transaction_id
        && (orderId === 'unknown' || i.store_transaction_id === orderId));
    if (!candidates.length) return no('not_found');
    const match = candidates.find((i) => !isUsed(i.store_transaction_id));
    if (!match) return no('transaction_already_used');

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
    const before = store.readJSON('activation-codes.json', []);
    const entry = before.find((c) => c.code === code);
    if (!entry) return no('not_found');
    const result = await verifyPlayPurchase(entry, before, o);
    if (!result.verified) return result;
    // Re-read after the network call and re-check synchronously before writing,
    // so concurrent verifications cannot both claim one transaction.
    const codes = store.readJSON('activation-codes.json', []);
    const fresh = codes.find((c) => c.code === code);
    if (!fresh) return no('not_found');
    if (usedElsewhere(codes, code, result.store_transaction_id)) return no('transaction_already_used');
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
