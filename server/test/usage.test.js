const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

let dir, mailLog;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tge-usage-'));
  process.env.TGE_DATA_DIR = dir;
  mailLog = path.join(dir, 'mail.log');
  process.env.TGE_MAIL_LOG = mailLog;
});
const U = require('../lib/usage');
const mails = () => (fs.existsSync(mailLog)
  ? fs.readFileSync(mailLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

const NOW = new Date('2026-10-16T12:00:00+08:00');
const entry = (o = {}) => ({
  code: 'HRD-AAAA-BBBB-CCCC', source: 'newsletter',
  newsletter: { plan_source: 'yearly', paying: true, permanent: false, locked_reason: null, anchor_date: '2026-09-17' },
  ...o,
});

test('failure does not count toward used but adds spend', () => {
  const e = entry();
  U.recordFailure(e, 0.5, NOW);
  const u = U.getUsage(e, NOW);
  assert.equal(u.used, 0);
  assert.equal(u.failed.count, 1);
  assert.equal(u.cost.usd, 0.5);
  assert.equal(U.getSpend(NOW).usd, 0.5);
  U.recordSuccess(e, 0.25, NOW);
  const v = U.getUsage(e, NOW);
  assert.equal(v.used, 1);
  assert.equal(v.total, 1);
  assert.ok(v.last_used_at);
  assert.equal(U.getSpend(NOW).usd, 0.75);
});

test("usage rolls over on the code's anchor day (anchor 2026-09-17: used 5 on 2026-10-16 → 0 on 2026-10-17)", () => {
  const e = entry();
  for (let i = 0; i < 5; i++) U.recordSuccess(e, 0, NOW);
  assert.equal(U.getUsage(e, NOW).used, 5);
  assert.equal(U.accessFor(e, NOW).ai.used, 5);
  const next = new Date('2026-10-17T00:30:00+08:00');
  assert.equal(U.getUsage(e, next).used, 0);
  assert.equal(U.getUsage(e, next).total, 5);
  U.recordSuccess(e, 0, next);
  assert.equal(U.getUsage(e, next).used, 1);
});

test('spend resets on calendar month', () => {
  const e = entry();
  U.recordSuccess(e, 3, NOW);
  assert.equal(U.getSpend(NOW).usd, 3);
  const nov = new Date('2026-11-01T00:10:00+08:00');
  assert.equal(U.getSpend(nov).usd, 0);
  assert.equal(U.getUsage(e, nov).cost.usd, 0);
  U.recordSuccess(e, 1, nov);
  assert.equal(U.getSpend(nov).usd, 1);
});

test('spend at $16 of $20 sends exactly one 80% mail across two calls', async () => {
  U.recordSuccess(entry(), 16, NOW);
  await U.checkSpendAlerts(NOW);
  await U.checkSpendAlerts(NOW);
  const m = mails();
  assert.equal(m.length, 1);
  assert.match(m[0].subject, /80%/);
  assert.equal(U.getSpend(NOW).paused, false);
});

test('spend at $20 → paused true and one pause mail', async () => {
  U.recordSuccess(entry(), 20, NOW);
  assert.equal(U.getSpend(NOW).paused, true);
  assert.equal(U.accessFor(entry(), NOW).ai.reason, 'spend_paused');
  await U.checkSpendAlerts(NOW);
  await U.checkSpendAlerts(NOW);
  const m = mails();
  assert.equal(m.filter((x) => /paused/i.test(x.subject)).length, 1);
  assert.equal(m.length, 1);
});

test('raising limit to 40 unpauses', () => {
  U.recordSuccess(entry(), 20, NOW);
  assert.equal(U.getSpend(NOW).paused, true);
  U.saveSettings({ monthly_spend_limit_usd: 40 });
  const s = U.getSpend(NOW);
  assert.equal(s.paused, false);
  assert.equal(s.limit_usd, 40);
  assert.equal(s.pct, 50);
});

test('estimateCostUsd defaults are Haiku prices: 1e6 in = 0.10, 1e6 out = 0.50; undefined → 0.002', () => {
  const s = U.getSettings();
  assert.deepEqual(U.DEFAULT_SETTINGS.cost, { input_per_mtok: 0.10, output_per_mtok: 0.50, fallback_per_call_usd: 0.002 });
  assert.equal(U.estimateCostUsd({ input_tokens: 1e6, output_tokens: 0 }, s), 0.1);
  assert.equal(U.estimateCostUsd({ input_tokens: 0, output_tokens: 1e6 }, s), 0.5);
  assert.equal(U.estimateCostUsd(undefined, s), 0.002);
});

test('settings merge cost patch; resetCount zeroes used', () => {
  assert.equal(U.getSettings().monthly_spend_limit_usd, 20);
  U.saveSettings({ cost: { input_per_mtok: 1 } });
  assert.deepEqual(U.getSettings().cost, { input_per_mtok: 1, output_per_mtok: 0.5, fallback_per_call_usd: 0.002 });
  const e = entry();
  U.recordSuccess(e, 0, NOW);
  U.recordFailure(e, 0, NOW);
  U.resetCount(e.code, NOW);
  assert.equal(U.getUsage(e, NOW).used, 0);
  assert.equal(U.getUsage(e, NOW).failed.count, 0);
});

test('accessFor trips failed_cap after 10 failures today', () => {
  const e = entry();
  for (let i = 0; i < 10; i++) U.recordFailure(e, 0, NOW);
  assert.equal(U.accessFor(e, NOW).ai.reason, 'failed_cap');
});

test('mail failure clears the alert flag and a later call retries', async () => {
  U.recordSuccess(entry(), 16, NOW);
  const saved = { log: process.env.TGE_MAIL_LOG, u: process.env.SMTP_USER, p: process.env.SMTP_PASS };
  delete process.env.TGE_MAIL_LOG; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
  const origErr = console.error; console.error = () => {};
  try { await U.checkSpendAlerts(NOW); } finally { console.error = origErr; }
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'tge-spend.json'), 'utf8')).warned80_at, null);
  process.env.TGE_MAIL_LOG = saved.log;
  await U.checkSpendAlerts(NOW);
  await U.checkSpendAlerts(NOW);
  assert.equal(mails().length, 1);
});

test('non-finite cost falls back to the per-call fallback', () => {
  U.recordFailure(entry(), NaN, NOW);
  U.recordSuccess(entry(), undefined, NOW);
  assert.equal(U.getSpend(NOW).usd, 0.004);
});
