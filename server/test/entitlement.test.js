const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/entitlement');

const NOW = new Date('2026-10-17T05:00:00+08:00');
const ctx = (o = {}) => ({ now: NOW, spendPaused: false, failedToday: 0, ...o });
const nl = (o = {}, admin) => ({
  source: 'newsletter',
  newsletter: { status: 'paid', plan_source: 'yearly', paying: true, permanent: false,
    locked_reason: null, refunded_at: null, anchor_date: '2026-10-17', ...o },
  ...(admin ? { admin } : {}),
});
const play = (o = {}, admin) => ({
  source: 'play', registered_at: '2026-09-01T10:00:00Z',
  play: { verified_at: '2026-09-01T10:00:00Z', purchase_date: '2026-09-01', ...o },
  ...(admin ? { admin } : {}),
});
const sum = (a) => ({ tge: a.tge, enabled: a.ai.enabled, limit: a.ai.limit });
const run = (entry, used = 0, c = ctx()) => E.computeAccess(entry, { used }, c);

test('constants', () => {
  assert.deepEqual(E.PLAN_LIMITS, { play: 10, yearly: 50, monthly: 3, vip: 5 });
  assert.equal(E.FAILED_DAILY_CAP, 10);
});

test('play verified -> activated, 10', () => {
  assert.deepEqual(sum(run(play())), { tge: 'activated', enabled: true, limit: 10 });
});
test('play unverified (existing codes) -> activated, AI off reason play_unverified', () => {
  const a = run(play({ verified_at: null }));
  assert.deepEqual(sum(a), { tge: 'activated', enabled: false, limit: 0 });
  assert.equal(a.ai.reason, 'play_unverified');
});
test('legacy entry with no fields is Play unverified', () => {
  const a = run({ code: 'HRD-X', registered_at: '2026-09-01T10:00:00Z' });
  assert.equal(a.tge, 'activated');
  assert.equal(a.ai.reason, 'play_unverified');
});
test('yearly paid -> 50', () => {
  const a = run(nl());
  assert.deepEqual(sum(a), { tge: 'activated', enabled: true, limit: 50 });
  assert.equal(a.ai.reason, 'ok');
});
test('yearly past_due/cancelled permanent -> activated, 0, not_paying', () => {
  for (const status of ['past_due', 'cancelled']) {
    const a = run(nl({ status, paying: false, permanent: true }));
    assert.deepEqual(sum(a), { tge: 'activated', enabled: false, limit: 0 });
    assert.equal(a.ai.reason, 'not_paying');
  }
});
test('monthly paid -> 3', () => {
  assert.deepEqual(sum(run(nl({ plan_source: 'monthly' }))), { tge: 'activated', enabled: true, limit: 3 });
});
test('monthly past_due -> locked', () => {
  const a = run(nl({ plan_source: 'monthly', status: 'past_due', paying: false }));
  assert.deepEqual(sum(a), { tge: 'locked', enabled: false, limit: 0 });
  assert.equal(a.ai.reason, 'locked');
});
test('vip -> 5', () => {
  assert.deepEqual(sum(run(nl({ plan_source: 'vip', status: 'vip' }))), { tge: 'activated', enabled: true, limit: 5 });
});
test('refund -> locked', () => {
  const a = run(nl({ locked_reason: 'refund', refunded_at: '2026-10-01', paying: false, permanent: true }));
  assert.deepEqual(sum(a), { tge: 'locked', enabled: false, limit: 0 });
});
test('blocked -> locked even if permanent:true', () => {
  const a = run(nl({ status: 'blocked', locked_reason: 'blocked', permanent: true, paying: true }));
  assert.deepEqual(sum(a), { tge: 'locked', enabled: false, limit: 50 });
});
test('not_entitled (VIP removed / reactivated free) -> locked', () => {
  const a = run(nl({ status: 'free', plan_source: 'none', paying: false, permanent: false, locked_reason: 'not_entitled' }));
  assert.deepEqual(sum(a), { tge: 'locked', enabled: false, limit: 0 });
});
test('free, not paying, not permanent, no reason -> locked', () => {
  assert.equal(run(nl({ status: 'free', paying: false })).tge, 'locked');
});

test('admin.revoked paid yearly -> tge locked, reason locked, enabled false, limit 50', () => {
  const a = run(nl({}, { revoked: true }));
  assert.deepEqual(sum(a), { tge: 'locked', enabled: false, limit: 50 });
  assert.equal(a.ai.reason, 'locked');
});
test('admin.revoked locks a Play entry', () => {
  assert.equal(run(play({}, { revoked: true })).tge, 'locked');
});
test('admin.ai_enabled=false beats paid', () => {
  const a = run(nl({}, { ai_enabled: false }));
  assert.equal(a.tge, 'activated');
  assert.equal(a.ai.enabled, false);
  assert.equal(a.ai.reason, 'admin_off');
});
test('admin.ai_enabled=true on lapsed yearly gives 50 (R1)', () => {
  const a = run(nl({ status: 'cancelled', paying: false, permanent: true }, { ai_enabled: true }));
  assert.deepEqual(sum(a), { tge: 'activated', enabled: true, limit: 50 });
  assert.equal(a.ai.reason, 'ok');
});
test('admin overrides never unlock a locked entry', () => {
  const a = run(nl({ locked_reason: 'blocked' }, { ai_enabled: true, monthly_limit: 20 }));
  assert.equal(a.tge, 'locked');
  assert.equal(a.ai.reason, 'locked');
});
test('admin.ai_enabled=true on unverified Play gives 10', () => {
  assert.equal(run(play({ verified_at: null }, { ai_enabled: true })).ai.limit, 10);
});
test('admin.monthly_limit=7 overrides plan', () => {
  const a = run(nl({}, { monthly_limit: 7 }));
  assert.equal(a.ai.limit, 7);
  assert.equal(a.ai.enabled, true);
});
test('admin.monthly_limit=0 gives not_paying', () => {
  const a = run(nl({}, { monthly_limit: 0 }));
  assert.equal(a.ai.limit, 0);
  assert.equal(a.ai.reason, 'not_paying');
});
test('spendPaused -> spend_paused', () => {
  const a = run(nl(), 0, ctx({ spendPaused: true }));
  assert.equal(a.ai.reason, 'spend_paused');
  assert.equal(a.ai.enabled, false);
  assert.equal(a.ai.limit, 50);
});
test('used 50 of 50 -> limit_reached, remaining 0', () => {
  const a = run(nl(), 50);
  assert.equal(a.ai.reason, 'limit_reached');
  assert.equal(a.ai.remaining, 0);
  assert.equal(a.ai.enabled, false);
});
test('used above limit never gives negative remaining', () => {
  assert.equal(run(nl(), 60).ai.remaining, 0);
});
test('remaining and used reported', () => {
  const a = run(nl(), 3);
  assert.equal(a.ai.used, 3);
  assert.equal(a.ai.remaining, 47);
});
test('failedToday 10 -> failed_cap', () => {
  const a = run(nl(), 0, ctx({ failedToday: 10 }));
  assert.equal(a.ai.reason, 'failed_cap');
  assert.equal(a.ai.enabled, false);
  assert.equal(run(nl(), 0, ctx({ failedToday: 9 })).ai.enabled, true);
});
test('reason precedence: spend_paused > limit_reached > failed_cap', () => {
  assert.equal(run(nl(), 50, ctx({ failedToday: 10 })).ai.reason, 'limit_reached');
  assert.equal(run(nl(), 50, ctx({ spendPaused: true })).ai.reason, 'spend_paused');
});
test('resets_on follows the anchor', () => {
  assert.equal(run(nl({ anchor_date: '2026-09-17' })).ai.resets_on, '2026-11-17');
  assert.equal(run(nl({ anchor_date: '2026-09-20' })).ai.resets_on, '2026-10-20');
});

test('anchorFor: newsletter and play', () => {
  assert.equal(E.anchorFor(nl({ anchor_date: '2026-03-05' })), '2026-03-05');
  assert.equal(E.anchorFor(play()), '2026-09-01');
  assert.equal(E.anchorFor(play({ purchase_date: null })), '2026-09-01');
  assert.equal(E.anchorFor(play({ purchase_date: '2026-08-15T12:00:00Z' })), '2026-08-15');
});

test('anchorFor: Play anchor from an instant is the MYT date', () => {
  assert.equal(E.anchorFor({ ...play({ purchase_date: null }), registered_at: '2026-10-16T20:00:00Z' }), '2026-10-17');
  assert.equal(E.anchorFor(play({ purchase_date: '2026-10-16T20:00:00Z' })), '2026-10-17');
});

test('periodStart clamps: anchor 2026-01-31', () => {
  assert.equal(E.periodStart('2026-01-31', new Date('2026-02-28T05:00:00+08:00')), '2026-02-28');
  assert.equal(E.periodStart('2026-01-31', new Date('2026-02-27T05:00:00+08:00')), '2026-01-31');
  assert.equal(E.periodStart('2026-01-31', new Date('2026-03-31T00:30:00+08:00')), '2026-03-31');
});
test('periodStart before the anchor returns the anchor; year rollover', () => {
  assert.equal(E.periodStart('2026-10-17', new Date('2026-10-10T05:00:00+08:00')), '2026-10-17');
  assert.equal(E.periodStart('2025-12-20', new Date('2026-01-05T05:00:00+08:00')), '2025-12-20');
});
test('nextReset anchor 2026-01-31 from 2026-02-28 -> 2026-03-31', () => {
  assert.equal(E.nextReset('2026-01-31', new Date('2026-02-28T05:00:00+08:00')), '2026-03-31');
  assert.equal(E.nextReset('2026-01-31', new Date('2026-02-27T05:00:00+08:00')), '2026-02-28');
});
test('nextReset year rollover', () => {
  assert.equal(E.nextReset('2026-01-15', new Date('2026-12-20T05:00:00+08:00')), '2027-01-15');
});
test('myDay uses UTC+8: 2026-10-17T17:00Z -> 2026-10-18', () => {
  assert.equal(E.myDay(new Date('2026-10-17T17:00:00Z')), '2026-10-18');
  assert.equal(E.myDay(new Date('2026-10-17T15:59:59Z')), '2026-10-17');
});
test('myMonth uses UTC+8 across month end', () => {
  assert.equal(E.myMonth(new Date('2026-10-31T16:00:00Z')), '2026-11');
  assert.equal(E.myMonth(new Date('2026-10-31T15:59:00Z')), '2026-10');
});
