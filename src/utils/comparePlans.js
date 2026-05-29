// Pure data builder: turns Plan[] into a comparison structure ready for rendering
// or PDF export. Designed for HCC/SBL/SLB plans; the caller (MyPlansTab) is
// responsible for refusing to call this on cross-scheme selections.

const TRAINING_TYPE_LABELS = {
  inhouse: 'In-House', rot_inhouse: 'ROT In-House', coaching_mentoring: 'Coaching & Mentoring',
  rot_public: 'ROT Public', public: 'Public', seminar_conference: 'Seminar & Conference',
  elearning: 'E-Learning', mobile_elearning: 'Mobile E-Learning',
  overseas: 'Overseas', overseas_seminar: 'Overseas Seminar', development: 'Development Programme',
};
const TRAINER_TYPE_LABELS = { internal: 'Internal', external: 'External', overseas: 'Overseas' };
const VENUE_LABELS = { employer_premises: "Employer's Premises", external_hotel: 'Hotel / External' };
const COURSE_CAT_LABELS = {
  general_non_technical: 'General (Non-Tech)', general_technical: 'General (Tech)',
  focus_area: 'Focus Area', industry_specific: 'Industry Specific', certification: 'Certification',
};
const DURATION_LABELS = { full_day: 'Full Day', half_day: 'Half Day' };

const NUM = (v) => parseInt(v, 10) || 0;

const totalPaxOf = (inputs) => {
  const host = NUM(inputs?.host?.pax);
  const br = (inputs?.branches || []).reduce((s, b) => s + NUM(b?.pax), 0);
  const sub = (inputs?.subsidiaries || []).reduce((s, c) => s + NUM(c?.pax), 0);
  return host + br + sub;
};

const formatScheme = (id) => (id || '').toUpperCase() || '—';

const formatLtm = (inputs) => {
  if (!inputs?.hasLTM) return 'No';
  const c = parseFloat(inputs?.ltmActualCost);
  return Number.isFinite(c) && c > 0 ? `Yes (RM ${c.toLocaleString()})` : 'Yes';
};

const formatActualFee = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? `RM ${n.toLocaleString()}` : '—';
};

const lookupOrSelf = (map, value) => map[value] || value || '—';

// Fixed ordered list of "headline" fields for HCC/SBL/SLB plans.
const INPUT_FIELDS = [
  { label: 'Scheme',             read: (i) => formatScheme(i.scheme) },
  { label: 'Training Type',      read: (i) => lookupOrSelf(TRAINING_TYPE_LABELS, i.trainingType) },
  { label: 'Trainer Type',       read: (i) => lookupOrSelf(TRAINER_TYPE_LABELS, i.trainerType) },
  { label: 'Number of Trainers', read: (i) => (i.numberOfTrainers != null && i.numberOfTrainers !== '' ? String(i.numberOfTrainers) : '—') },
  { label: 'Venue',              read: (i) => lookupOrSelf(VENUE_LABELS, i.venue) },
  { label: 'Course Category',    read: (i) => lookupOrSelf(COURSE_CAT_LABELS, i.courseCategory) },
  { label: 'Session',            read: (i) => lookupOrSelf(DURATION_LABELS, i.duration) },
  { label: 'Days',               read: (i) => (i.days != null && i.days !== '' ? String(i.days) : '—') },
  { label: 'Total Pax',          read: (i) => String(totalPaxOf(i)) },
  { label: 'Actual Course Fee',  read: (i) => formatActualFee(i.actualCourseFee) },
  { label: 'LTM',                read: (i) => formatLtm(i) },
  { label: '# Branches',         read: (i) => String((i.branches || []).length) },
  { label: '# Subsidiaries',     read: (i) => String((i.subsidiaries || []).length) },
];

const interesting = (values) => values.some(v => v !== '—' && v !== '0' && v !== '');

const subtitleFor = (inputs) => {
  const pax = totalPaxOf(inputs);
  const days = NUM(inputs?.days);
  if (pax > 0 || days > 0) return `${pax} pax · ${days}d`;
  return '';
};

export function comparePlans(plans) {
  const safe = Array.isArray(plans) ? plans : [];

  const planHeaders = safe.map(p => ({
    id: p.id,
    name: p.name || '(Untitled)',
    schemeId: p.schemeId,
    schemeLabel: p.schemeLabel,
    subtitle: subtitleFor(p.inputs),
  }));

  const inputRows = INPUT_FIELDS
    .map(f => {
      const values = safe.map(p => f.read(p.inputs || {}));
      return { label: f.label, values, differ: new Set(values).size > 1 };
    })
    .filter(row => interesting(row.values));

  const labelOrder = [];
  const seen = new Set();
  for (const p of safe) {
    for (const it of (p.resultSnapshot?.items || [])) {
      if (it?.label && !seen.has(it.label)) { seen.add(it.label); labelOrder.push(it.label); }
    }
  }
  const itemRows = labelOrder.map(label => ({
    label,
    amounts: safe.map(p => {
      const match = (p.resultSnapshot?.items || []).find(it => it?.label === label);
      if (!match) return null;
      if (match.amount != null) return match.amount;
      if (match.entitledCount != null) return `${match.entitledCount} person(s)`;
      return null;
    }),
  }));

  const totals = safe.map(p => Number(p.resultSnapshot?.totalClaimable || 0));
  let highestIndex = null;
  if (totals.length > 0) {
    const max = Math.max(...totals);
    if (max > 0) highestIndex = totals.indexOf(max);
  }

  return { planHeaders, inputRows, itemRows, totals, highestIndex };
}
