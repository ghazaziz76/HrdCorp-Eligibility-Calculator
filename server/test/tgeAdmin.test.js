const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer, signedPost } = require('./helpers');

const OVER50 = 'More than 50 AI users — review the $20 monthly AI limit';
let srv, mailLog;
before(async () => {
    srv = await startTestServer();
    mailLog = path.join(srv.dataDir, 'mail.log');
    process.env.TGE_MAIL_LOG = mailLog;
});
after(async () => { delete process.env.TGE_MAIL_LOG; await srv.close(); });
beforeEach(() => {
    for (const f of ['activation-codes.json', 'tge-usage.json', 'tge-spend.json', 'tge-settings.json', 'tge-admin-log.json', 'mail.log']) {
        fs.rmSync(path.join(srv.dataDir, f), { force: true });
    }
});

const H = { 'content-type': 'application/json', 'x-admin-password': 'test-admin' };
const get = (p, headers = H) => fetch(srv.base + p, { headers });
const post = (p, body, headers = H) => fetch(srv.base + p, { method: 'POST', headers, body: JSON.stringify(body || {}) });
const pub = (p, body) => fetch(srv.base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const mails = () => (fs.existsSync(mailLog)
    ? fs.readFileSync(mailLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const codesFile = () => path.join(srv.dataDir, 'activation-codes.json');
const readCodes = () => JSON.parse(fs.readFileSync(codesFile(), 'utf8'));
const seed = (codes) => fs.writeFileSync(codesFile(), JSON.stringify(codes));
const usage = require('../lib/usage');
let seq = 0;
const sync = async (o) => (await (await signedPost(srv.base, '/api/newsletter/entitlement', {
    code: null, email: `u${++seq}@y.com`, name: 'X', status: 'paid', plan_source: 'yearly', paying: true,
    permanent: false, locked_reason: null, refunded_at: null, anchor_date: '2026-01-17', ...o,
})).json()).data;
const play = (n, verified = true) => ({
    code: `HRD-PLAY-0000-${String(n).padStart(4, '0')}`, feature_key: 'tge', registered_at: '2026-01-05T00:00:00Z',
    activated: false, play: verified ? { verified_at: '2026-01-05T00:00:00Z', purchase_date: '2026-01-05T00:00:00Z' } : {},
});
const plays = (n) => Array.from({ length: n }, (_, i) => play(i));

test('401 without x-admin-password', async () => {
    assert.equal((await get('/api/admin/tge-users', {})).status, 401);
    assert.equal((await get('/api/admin/tge-users', { 'x-admin-password': 'nope' })).status, 401);
    assert.equal((await post('/api/admin/tge-users/X', {}, {})).status, 401);
    assert.equal((await post('/api/admin/tge-users/X/reset-count', {}, {})).status, 401);
    assert.equal((await post('/api/admin/tge-users/X/verify-play', {}, {})).status, 401);
    assert.equal((await post('/api/admin/ai-settings', {}, {})).status, 401);
    assert.equal((await get('/api/admin/tge-log', {})).status, 401);
});

test('lists play and gift codes with usage and cost', async () => {
    const d = await sync({ email: 'yr@y.com', name: 'Yr' });
    const p = play(1);
    seed([...readCodes(), p]);
    usage.recordSuccess(readCodes()[0], 0.4, new Date());
    const j = await (await get('/api/admin/tge-users')).json();
    assert.equal(j.users.length, 2);
    const g = j.users.find((u) => u.code === d.code);
    assert.equal(g.source, 'yearly');
    assert.equal(g.email, 'yr@y.com');
    assert.equal(g.name, 'Yr');
    assert.equal(g.newsletter_status, 'paid');
    assert.equal(g.tge, 'activated');
    assert.equal(g.ai.limit, 50);
    assert.equal(g.ai.used, 1);
    assert.equal(g.total, 1);
    assert.equal(g.cost_month_usd, 0.4);
    assert.ok(g.last_used_at);
    assert.deepEqual(g.admin, { ai_enabled: null, monthly_limit: null, revoked: false });
    assert.equal(g.play_verified, false);
    assert.equal(g.refunded_at, null);
    assert.ok(g.registered_at);
    const pr = j.users.find((u) => u.code === p.code);
    assert.equal(pr.source, 'play');
    assert.equal(pr.play_verified, true);
    assert.equal(pr.ai.limit, 10);
    assert.equal(pr.total, 0);
    assert.equal(pr.cost_month_usd, 0);
    assert.equal(j.totals.limit_usd, 20);
    assert.equal(j.totals.spend_month_usd, 0.4);
    assert.equal(j.totals.spend_pct, 2);
    assert.equal(j.totals.ai_users, 2);
    assert.equal(j.totals.over50, false);
    assert.equal(j.settings.monthly_spend_limit_usd, 20);
    assert.deepEqual(j.warnings, []);
});

test('newsletter entry with plan_source none is newsletter-none', async () => {
    await sync({ email: 'n@y.com', plan_source: 'none', paying: false, status: 'free' });
    const j = await (await get('/api/admin/tge-users')).json();
    assert.equal(j.users[0].source, 'newsletter-none');
});

test('ai_enabled=false then access endpoint shows admin_off', async () => {
    const d = await sync({});
    const r = await post(`/api/admin/tge-users/${d.code}`, { ai_enabled: false });
    assert.equal(r.status, 200);
    const row = await r.json();
    assert.equal(row.code, d.code);
    assert.equal(row.admin.ai_enabled, false);
    assert.equal(row.ai.reason, 'admin_off');
    const a = await (await pub('/api/employer/access', { code: d.code })).json();
    assert.equal(a.data.ai.reason, 'admin_off');
    assert.equal(a.data.ai.enabled, false);
});

test('custom limit applies', async () => {
    const d = await sync({});
    const row = await (await post(`/api/admin/tge-users/${d.code}`, { monthly_limit: 7 })).json();
    assert.equal(row.ai.limit, 7);
    const a = await (await pub('/api/employer/access', { code: d.code })).json();
    assert.equal(a.data.ai.limit, 7);
    const back = await (await post(`/api/admin/tge-users/${d.code}`, { monthly_limit: null })).json();
    assert.equal(back.ai.limit, 50);
});

test('reset-count zeroes used', async () => {
    const d = await sync({});
    usage.recordSuccess(readCodes()[0], 0, new Date());
    usage.recordSuccess(readCodes()[0], 0, new Date());
    const j = await (await get('/api/admin/tge-users')).json();
    assert.equal(j.users[0].ai.used, 2);
    const r = await post(`/api/admin/tge-users/${d.code}/reset-count`);
    assert.equal(r.status, 200);
    const row = await r.json();
    assert.equal(row.ai.used, 0);
    assert.equal(row.total, 2);
    const log = await (await get('/api/admin/tge-log')).json();
    assert.equal(log[0].action, 'reset-count');
    assert.equal(log[0].code, d.code);
    assert.deepEqual(log[0].changes.used, [2, 0]);
});

test('revoke locks validate-code', async () => {
    const d = await sync({});
    assert.equal((await pub('/api/employer/validate-code', { code: d.code })).status, 200);
    const row = await (await post(`/api/admin/tge-users/${d.code}`, { revoked: true })).json();
    assert.equal(row.tge, 'locked');
    const v = await pub('/api/employer/validate-code', { code: d.code });
    assert.equal(v.status, 403);
    assert.equal((await v.json()).reason, 'revoked');
    const un = await (await post(`/api/admin/tge-users/${d.code}`, { revoked: false })).json();
    assert.equal(un.tge, 'activated');
});

test('every change appends a log entry with before/after', async () => {
    const d = await sync({});
    await post(`/api/admin/tge-users/${d.code}`, { ai_enabled: false, monthly_limit: 9 });
    await post(`/api/admin/tge-users/${d.code}`, { revoked: true });
    await post('/api/admin/ai-settings', { monthly_spend_limit_usd: 30 });
    const log = await (await get('/api/admin/tge-log')).json();
    assert.equal(log.length, 3);
    assert.equal(log[0].action, 'ai-settings');
    assert.equal(log[0].code, null);
    assert.equal(log[0].who, 'admin');
    assert.ok(log[0].at);
    assert.deepEqual(log[0].changes.monthly_spend_limit_usd, [20, 30]);
    assert.equal(log[1].code, d.code);
    assert.deepEqual(log[1].changes.revoked, [false, true]);
    assert.deepEqual(log[2].changes.ai_enabled, [null, false]);
    assert.deepEqual(log[2].changes.monthly_limit, [null, 9]);
    const lim = await (await get('/api/admin/tge-log?limit=1')).json();
    assert.equal(lim.length, 1);
    assert.equal(lim[0].action, 'ai-settings');
});

test('51 AI users → warning text exactly and one mail across two GETs', async () => {
    seed(plays(51));
    const j1 = await (await get('/api/admin/tge-users')).json();
    assert.equal(j1.totals.ai_users, 51);
    assert.equal(j1.totals.over50, true);
    assert.ok(j1.warnings.includes(OVER50));
    assert.equal(OVER50, 'More than 50 AI users — review the $20 monthly AI limit');
    const j2 = await (await get('/api/admin/tge-users')).json();
    assert.ok(j2.warnings.includes(OVER50));
    assert.equal(mails().length, 1);
    assert.ok(j2.settings.over50_emailed_at);
    // drop to 50: warning gone and email re-armed
    seed(plays(50));
    const j3 = await (await get('/api/admin/tge-users')).json();
    assert.deepEqual(j3.warnings, []);
    assert.equal(j3.settings.over50_emailed_at, null);
    seed(plays(51));
    await get('/api/admin/tge-users');
    assert.equal(mails().length, 2);
});

test('admin_off users are not counted as AI users', async () => {
    const codes = plays(51);
    codes[0].admin = { ai_enabled: false, monthly_limit: null, revoked: false };
    seed(codes);
    const j = await (await get('/api/admin/tge-users')).json();
    assert.equal(j.totals.ai_users, 50);
    assert.equal(j.totals.over50, false);
});

test('spend warnings at 80% and 100%', async () => {
    const d = await sync({});
    usage.recordSuccess(readCodes()[0], 17, new Date());
    let j = await (await get('/api/admin/tge-users')).json();
    assert.equal(j.warnings.length, 1);
    assert.match(j.warnings[0], /85%/);
    usage.recordSuccess(readCodes()[0], 3, new Date());
    j = await (await get('/api/admin/tge-users')).json();
    assert.equal(j.warnings.length, 1);
    assert.match(j.warnings[0], /paused/);
    assert.equal(j.totals.spend_pct, 100);
    const a = await (await pub('/api/employer/access', { code: d.code })).json();
    assert.equal(a.data.ai.reason, 'spend_paused');
});

test('ai-settings limit change logged and unpauses', async () => {
    const d = await sync({});
    usage.recordSuccess(readCodes()[0], 20, new Date());
    let a = await (await pub('/api/employer/access', { code: d.code })).json();
    assert.equal(a.data.ai.reason, 'spend_paused');
    const r = await post('/api/admin/ai-settings', { monthly_spend_limit_usd: 40, cost: { input_per_mtok: 4 } });
    assert.equal(r.status, 200);
    const s = await r.json();
    assert.equal(s.monthly_spend_limit_usd, 40);
    assert.equal(s.cost.input_per_mtok, 4);
    assert.equal(s.cost.output_per_mtok, 15);
    a = await (await pub('/api/employer/access', { code: d.code })).json();
    assert.equal(a.data.ai.reason, 'ok');
    const log = await (await get('/api/admin/tge-log')).json();
    assert.equal(log[0].action, 'ai-settings');
    assert.deepEqual(log[0].changes.monthly_spend_limit_usd, [20, 40]);
    assert.deepEqual(log[0].changes['cost.input_per_mtok'], [3, 4]);
});

test('validation: bad input is 400, unknown code is 404', async () => {
    const d = await sync({});
    for (const b of [{ monthly_spend_limit_usd: -1 }, { monthly_spend_limit_usd: 'x' }, { monthly_spend_limit_usd: null },
        { cost: { input_per_mtok: -2 } }, { cost: { output_per_mtok: 'a' } }, { cost: 5 }, {}]) {
        assert.equal((await post('/api/admin/ai-settings', b)).status, 400, JSON.stringify(b));
    }
    for (const b of [{ ai_enabled: 'yes' }, { monthly_limit: 1.5 }, { monthly_limit: -1 }, { monthly_limit: 10001 },
        { monthly_limit: '5' }, { revoked: 'true' }, {}]) {
        const r = await post(`/api/admin/tge-users/${d.code}`, b);
        assert.equal(r.status, 400, JSON.stringify(b));
        assert.ok((await r.json()).error);
    }
    assert.equal((await post('/api/admin/tge-users/HRD-NOPE', { revoked: true })).status, 404);
    assert.equal((await post('/api/admin/tge-users/HRD-NOPE/reset-count')).status, 404);
    assert.equal((await post('/api/admin/tge-users/HRD-NOPE/verify-play')).status, 404);
    assert.deepEqual(await (await get('/api/admin/tge-log')).json(), []);
});

test('verify-play returns result and row, and is logged', async () => {
    const p = play(1, false);
    seed([p]);
    const r = await post(`/api/admin/tge-users/${p.code}/verify-play`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.result.verified, false);
    assert.equal(j.result.reason, 'no_rc_user');
    assert.equal(j.row.code, p.code);
    const log = await (await get('/api/admin/tge-log')).json();
    assert.equal(log[0].action, 'verify-play');
    assert.equal(log[0].code, p.code);
});

test('raising the limit re-arms spend alerts: one new 80% mail after re-crossing', async () => {
    await sync({});
    usage.recordSuccess(readCodes()[0], 16, new Date());
    await usage.checkSpendAlerts(new Date());
    assert.equal(mails().length, 1);
    await usage.checkSpendAlerts(new Date());
    assert.equal(mails().length, 1);
    await post('/api/admin/ai-settings', { monthly_spend_limit_usd: 40 });
    const sp = JSON.parse(fs.readFileSync(path.join(srv.dataDir, 'tge-spend.json'), 'utf8'));
    assert.equal(sp.warned80_at, null);
    const log = await (await get('/api/admin/tge-log')).json();
    assert.deepEqual(log[0].changes.warned80_at, ['set', null]);
    usage.recordSuccess(readCodes()[0], 16, new Date());
    await usage.checkSpendAlerts(new Date());
    assert.equal(mails().length, 2);
    await usage.checkSpendAlerts(new Date());
    assert.equal(mails().length, 2);
});

test('admin log keeps only the newest 5000 entries', () => {
    const adminLog = require('../lib/adminLog');
    for (let i = 0; i < 5005; i++) adminLog.append('x', null, { i: [i, i + 1] });
    const all = JSON.parse(fs.readFileSync(path.join(srv.dataDir, 'tge-admin-log.json'), 'utf8'));
    assert.equal(all.length, 5000);
    assert.deepEqual(all[0].changes.i, [5, 6]);
});
