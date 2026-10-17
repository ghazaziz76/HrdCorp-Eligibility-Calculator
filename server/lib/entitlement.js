// Pure entitlement rules. No I/O. All day/month math is Malaysia time, UTC+8 fixed.

const PLAN_LIMITS = { play: 10, yearly: 50, monthly: 3, vip: 5 };
const FAILED_DAILY_CAP = 10;
const MY_OFFSET_MS = 8 * 3600e3;

const pad = (n, w = 2) => String(n).padStart(w, '0');
const ymd = (y, m, d) => `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`; // m is 0-based

// Date shifted so that the getUTC* getters read Malaysia wall-clock time.
function myDate(now) {
  return new Date(now.getTime() + MY_OFFSET_MS);
}

function myDay(now) {
  const d = myDate(now);
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function myMonth(now) {
  return myDay(now).slice(0, 7);
}

const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Reset day `d` clamped to the length of month (y, m).
const clampedDay = (y, m, d) => ymd(y, m, Math.min(d, daysInMonth(y, m)));

function parseAnchor(anchorDate, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(anchorDate || ''));
  if (!m) {
    // No usable anchor: treat today as the anchor.
    const t = myDay(now);
    return { iso: t, day: Number(t.slice(8, 10)) };
  }
  return { iso: `${m[1]}-${m[2]}-${m[3]}`, day: Number(m[3]) };
}

// Start of the current period: the latest reset date <= today (never before the anchor).
function periodStart(anchorDate, now) {
  const a = parseAnchor(anchorDate, now);
  const today = myDay(now);
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7)) - 1;
  let cand = clampedDay(y, m, a.day);
  if (cand > today) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
    cand = clampedDay(y, m, a.day);
  }
  return cand < a.iso ? a.iso : cand;
}

// First reset date strictly after today.
function nextReset(anchorDate, now) {
  const a = parseAnchor(anchorDate, now);
  const today = myDay(now);
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7)) - 1;
  let cand = clampedDay(y, m, a.day);
  if (cand <= today) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    cand = clampedDay(y, m, a.day);
  }
  return cand > a.iso ? cand : a.iso;
}

const isNewsletter = (entry) => entry.source === 'newsletter';

function anchorFor(entry) {
  if (isNewsletter(entry)) return (entry.newsletter && entry.newsletter.anchor_date) || null;
  const p = entry.play || {};
  return String(p.purchase_date || entry.registered_at || '').slice(0, 10) || null;
}

function computeAccess(entry, usage, ctx) {
  const admin = entry.admin || {};
  const nl = entry.newsletter || {};
  const pl = entry.play || {};
  const newsletter = isNewsletter(entry);
  const used = (usage && usage.used) || 0;

  let tge;
  if (admin.revoked) tge = 'locked';
  else if (newsletter) tge = !nl.locked_reason && (nl.paying || nl.permanent) ? 'activated' : 'locked';
  else tge = 'activated';

  let base = 0;
  if (newsletter) { if (nl.paying) base = PLAN_LIMITS[nl.plan_source] || 0; }
  else if (pl.verified_at) base = PLAN_LIMITS.play;

  const planKey = newsletter ? nl.plan_source : 'play';
  const limit = admin.monthly_limit != null
    ? admin.monthly_limit
    : (admin.ai_enabled === true ? (PLAN_LIMITS[planKey] || 0) : base);

  let reason;
  if (tge === 'locked') reason = 'locked';
  else if (admin.ai_enabled === false) reason = 'admin_off';
  else if (limit <= 0) reason = newsletter ? 'not_paying' : 'play_unverified';
  else if (ctx.spendPaused) reason = 'spend_paused';
  else if (used >= limit) reason = 'limit_reached';
  else if (ctx.failedToday >= FAILED_DAILY_CAP) reason = 'failed_cap';
  else reason = 'ok';

  const effective = tge === 'locked' ? 0 : limit;
  return {
    tge,
    ai: {
      enabled: reason === 'ok',
      limit: effective,
      used,
      remaining: Math.max(0, effective - used),
      resets_on: nextReset(anchorFor(entry), ctx.now),
      reason,
    },
  };
}

module.exports = {
  PLAN_LIMITS, FAILED_DAILY_CAP, myDay, myMonth, periodStart, nextReset, anchorFor, computeAccess,
};
