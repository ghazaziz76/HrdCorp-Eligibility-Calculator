// FWT — Future Workers Training.
// Source: ACM Guide Jan 2026, section H (+ in-house course-fee rates from the ACM Fees section).
// Three sub-types: in-house, public certification, general public.
const num = (v) => parseFloat(v) || 0;
const doc = (text) => ({ text });

// In-house groups are derived from the number of trainees and the per-group cap
// (25 technical / 50 soft skills). Each group needs its own trainer.
export function groupsFor(trainees, courseCategory) {
  const perGroupMax = courseCategory === 'technical' ? 25 : 50;
  return trainees > 0 ? Math.ceil(trainees / perGroupMax) : 0;
}

export function calculateFwt({
  subType = 'inhouse',          // 'inhouse' | 'public_cert' | 'general_public'
  courseCategory = 'soft_skills', // in-house: 'technical' (25/group) | 'soft_skills' (50/group)
  trainerType = 'internal',     // in-house: 'internal' (trainer allowance) | 'external' (course fee)
  numberOfTrainees = '',
  trainingDays = '',
  dailyDuration = 'full_day',   // in-house: 'full_day' | 'half_day'
  distance = 'under_100',       // <1 month daily allowance: under_100 (250) | over_100 (500)
  allowanceType = 'daily',      // <1 month: 'daily' OR 'meal' — not both
  courseFee = '',               // public courses only: course fee as charged
  durationType = 'less_than_month',
  months = '',
  monthlyAllowancePerTrainee = '',
  consumableCost = '',
} = {}) {
  const isInhouse = subType === 'inhouse';
  const isInternal = isInhouse && trainerType === 'internal';
  const isLess = durationType !== 'more_than_month';
  const fullDay = dailyDuration !== 'half_day';
  const trainees = Math.max(0, parseInt(numberOfTrainees, 10) || 0);
  const days = Math.max(0, parseInt(trainingDays, 10) || 0);
  const perGroupMax = courseCategory === 'technical' ? 25 : 50;
  const groups = isInhouse ? groupsFor(trainees, courseCategory) : 0;

  const items = [];

  if (isInternal) {
    // Internal trainer allowance: RM1,400 full / RM800 half, per group per day.
    const rate = fullDay ? 1400 : 800;
    const trainerAllow = rate * days * groups;
    if (trainerAllow > 0) {
      items.push({
        label: 'Internal Trainer Allowance',
        note: `RM ${rate.toLocaleString()}/${fullDay ? 'day' : 'half-day'}/group × ${days} day(s) × ${groups} group(s)`,
        amount: trainerAllow,
      });
    }
  } else if (isInhouse) {
    // In-house external trainer: ACM per-group course fee (RM10,500 full / RM6,000 half),
    // prorated for a trailing group with fewer than 5 trainees (rate ÷ 5 per trainee).
    const groupRate = fullDay ? 10500 : 6000;
    const perTrainee = groupRate / 5;
    const fullGroups = Math.floor(trainees / perGroupMax);
    const remainder = trainees - fullGroups * perGroupMax;
    let feePerDay = fullGroups * groupRate;
    if (remainder > 0) feePerDay += remainder >= 5 ? groupRate : perTrainee * remainder;
    const fee = feePerDay * days;
    if (fee > 0) {
      const prorated = remainder > 0 && remainder < 5;
      items.push({
        label: 'Training Provider Course Fee',
        note: `RM ${groupRate.toLocaleString()}/${fullDay ? 'day' : 'half-day'}/group × ${days} day(s) × ${groups} group(s)${prorated ? ' (last group prorated — fewer than 5 pax)' : ''}`,
        amount: fee,
      });
    }
  } else {
    // Public certification / general public: local course fee charged PER PARTICIPANT
    // (ACM: public/certification fees are quoted on a per-pax basis), as charged.
    const feePerPax = num(courseFee);
    const fee = feePerPax * trainees;
    if (fee > 0) items.push({ label: 'Course Fee', note: `RM ${feePerPax.toLocaleString()}/pax × ${trainees} pax — as charged`, amount: fee });
  }

  if (isLess) {
    // Short programme: EITHER the distance-based daily allowance OR meal — not both.
    if (days > 0 && trainees > 0) {
      if (allowanceType === 'meal') {
        items.push({ label: 'Meal Allowance', note: `RM 100/day × ${trainees} pax × ${days} day(s)`, amount: 100 * trainees * days });
      } else {
        const dRate = distance === 'over_100' ? 500 : 250;
        items.push({ label: 'Trainee Daily Allowance', note: `RM ${dRate}/day × ${trainees} pax × ${days} day(s) (or actual paid, whichever is lower)`, amount: dRate * trainees * days });
      }
    }
  } else {
    // Programme longer than 1 month: trainees' monthly allowance (employer-paid).
    const mo = num(months);
    const mAllow = num(monthlyAllowancePerTrainee);
    if (mAllow > 0 && mo > 0 && trainees > 0) {
      items.push({ label: 'Trainees Monthly Allowance', note: `RM ${mAllow.toLocaleString()}/mth × ${mo} mth × ${trainees} pax (paid by employer)`, amount: mAllow * mo * trainees });
    }
    if (isInternal && days > 0) {
      items.push({ label: 'Internal Trainer Meal Allowance', note: `RM 100/day × ${days} day(s) × ${groups} trainer(s)`, amount: 100 * days * groups });
    }
    if (isInhouse) {
      const cons = num(consumableCost);
      if (cons > 0) items.push({ label: 'Consumable Training Materials', note: 'As claimed', amount: cons });
    }
  }

  const totalClaimable = items.reduce((s, i) => s + i.amount, 0);

  const warnings = [];
  if (totalClaimable === 0) warnings.push('Enter the training details to calculate.');
  if (isLess && days > 30) warnings.push('For a programme of “less than 1 month”, training days cannot exceed 30. For longer programmes, select “More than 1 month”.');
  if (isInhouse) {
    if (trainees > 0 && trainees < 2) warnings.push('In-house FWT requires a minimum of 2 trainees.');
    if (groups > 0) warnings.push(`${trainees} trainee(s) require ${groups} trainer(s)/group(s) at a maximum of ${perGroupMax} trainees per group (${courseCategory === 'technical' ? 'technical' : 'soft skills'}).`);
  }
  if (subType === 'general_public' && trainees > 9) warnings.push('General public FWT allows a maximum of 9 trainees per employer.');

  warnings.push('FWT funds pre-employment training, with the aim of employing the trainees upon completion. Each training session must be at least 4 hours.');
  if (isInhouse) warnings.push('In-house: internal trainer allowance is RM1,400/full day or RM800/half day per group. External training-provider course fee is capped at RM10,500/full day or RM6,000/half day per group (prorated if a group has fewer than 5 trainees).');
  if (!isLess) warnings.push('For programmes longer than 1 month, the trainees’ monthly allowance is paid by the employer. The salary offered on employment should be at least the monthly allowance paid during training — the claim is based on whichever is lower.');
  warnings.push('Employers must have no legal issues with HRD Corp to apply.');

  return {
    items,
    totalClaimable,
    warnings,
    supportingDocs: {
      grantSubmission: [
        doc('Complete course content.'),
        doc('Complete trainer profiles.'),
        doc('All related invoices or quotations.'),
        doc('Employer declaration letter, including: training title, training date, number of trainees, employment date, training provider name (if any), and training provider MyCoID (if any).'),
      ],
      claimSubmission: [
        doc('Course fee: official receipts and invoices as proof of payment.'),
        doc('Employment letter, plus proof of payment and the related receipts and invoices.'),
        doc('The salary offered on employment must be at least the monthly allowance paid during training; the monthly allowance is paid based on whichever is lower.'),
      ],
    },
  };
}
