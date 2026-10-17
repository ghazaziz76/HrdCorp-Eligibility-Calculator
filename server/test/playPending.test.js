const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/entitlement');

const NOW = new Date('2026-11-17T05:00:00+08:00');
const ctx = { now: NOW, spendPaused: false, failedToday: 0 };
const run = (entry) => E.computeAccess(entry, { used: 0 }, ctx);
const playEntry = (registered_at, play, admin) => ({
    code: 'HRD-AAAA-BBBB-CCCC', feature_key: 'hrd_grant_calculator', registered_at,
    ...(play ? { play } : {}), ...(admin ? { admin } : {}),
});

test('cutoff constant is 2026-11-15T00:00:00Z', () => {
    assert.equal(E.PLAY_VERIFY_CUTOFF, '2026-11-15T00:00:00Z');
});

test('play code registered after the cutoff and not verified -> pending, AI off', () => {
    const a = run(playEntry('2026-11-15T00:00:00Z', { rc_app_user_id: 'rc1' }));
    assert.equal(a.tge, 'pending');
    assert.equal(a.ai.enabled, false);
    assert.equal(a.ai.reason, 'pending_verification');
});

test('pending even when admin turned AI on', () => {
    const a = run(playEntry('2026-11-16T00:00:00Z', null, { ai_enabled: true }));
    assert.equal(a.tge, 'pending');
    assert.equal(a.ai.enabled, false);
    assert.equal(a.ai.reason, 'pending_verification');
});

test('play code registered after the cutoff and verified -> activated', () => {
    const a = run(playEntry('2026-11-16T00:00:00Z', { rc_app_user_id: 'rc1', verified_at: '2026-11-16T01:00:00Z', purchase_date: '2026-11-16' }));
    assert.equal(a.tge, 'activated');
    assert.equal(a.ai.enabled, true);
});

test('play code registered before the cutoff stays activated without verification', () => {
    const a = run(playEntry('2026-11-14T23:59:59Z'));
    assert.equal(a.tge, 'activated');
    assert.equal(a.ai.reason, 'play_unverified');
});

test('play code with no or bad registered_at is grandfathered', () => {
    assert.equal(run(playEntry(undefined)).tge, 'activated');
    assert.equal(run(playEntry('garbage')).tge, 'activated');
});

test('revoked pending code -> locked', () => {
    assert.equal(run(playEntry('2026-11-16T00:00:00Z', null, { revoked: true })).tge, 'locked');
});

test('newsletter entries are never pending', () => {
    const a = run({ source: 'newsletter', registered_at: '2026-11-16T00:00:00Z',
        newsletter: { paying: true, plan_source: 'yearly', locked_reason: null, anchor_date: '2026-11-16' } });
    assert.equal(a.tge, 'activated');
});
