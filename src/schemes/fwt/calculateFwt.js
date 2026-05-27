// FWT — Future Workers Training.
// Source: ACM Guide Jan 2026, section H.
// Funds pre-employment training (employment upon completion). Three sub-types:
//   in-house, public certification, general public.
const num = (v) => parseFloat(v) || 0;
const doc = (text) => ({ text });

export function calculateFwt({
  subType = 'inhouse',          // 'inhouse' | 'public_cert' | 'general_public'
  courseCategory = 'soft_skills', // in-house: 'technical' (max 25) | 'soft_skills' (max 50)
  trainerType = 'internal',     // in-house: 'internal' (trainer allowance) | 'external' (course fee)
  numberOfTrainees = '',
  numberOfTrainers = '1',       // in-house internal: groups for trainer allowance
  trainingDays = '',
  dailyDuration = 'full_day',   // in-house internal trainer allowance: 'full_day' (1,400) | 'half_day' (800)
  distance = 'under_100',       // <1 month trainee daily allowance: under_100 (250) | over_100 (500)
  courseFee = '',               // external training-provider course fee
  durationType = 'less_than_month', // 'less_than_month' | 'more_than_month'
  months = '',
  monthlyAllowancePerTrainee = '',
  consumableCost = '',
} = {}) {
  const isInhouse = subType === 'inhouse';
  const isInternal = isInhouse && trainerType === 'internal';
  const isLess = durationType !== 'more_than_month';
  const trainees = Math.max(0, parseInt(numberOfTrainees, 10) || 0);
  const trainers = Math.max(1, parseInt(numberOfTrainers, 10) || 1);
  const days = Math.max(0, parseInt(trainingDays, 10) || 0);

  const items = [];

  // Trainer cost: in-house INTERNAL trainer → trainer allowance.
  // In-house EXTERNAL trainer (or any public course) → training-provider course fee.
  if (isInternal) {
    const rate = dailyDuration === 'half_day' ? 800 : 1400;
    const trainerAllow = rate * days * trainers;
    if (trainerAllow > 0) {
      items.push({
        label: 'Internal Trainer Allowance',
        note: `RM ${rate.toLocaleString()}/${dailyDuration === 'half_day' ? 'half-day' : 'day'}/group × ${days} day(s) × ${trainers} group(s)`,
        amount: trainerAllow,
      });
    }
  } else {
    const fee = num(courseFee);
    if (fee > 0) {
      items.push({
        label: 'Course Fee',
        note: isInhouse ? 'Per ACM (prorated if fewer than 5 trainees)' : 'Local course fee, as charged',
        amount: fee,
      });
    }
  }

  if (isLess) {
    // Short programme: daily trainee allowance + meal allowance.
    if (days > 0 && trainees > 0) {
      const dRate = distance === 'over_100' ? 500 : 250;
      items.push({
        label: 'Trainee Daily Allowance',
        note: `RM ${dRate}/day × ${trainees} pax × ${days} day(s) (or actual paid, whichever is lower)`,
        amount: dRate * trainees * days,
      });
      items.push({
        label: 'Meal Allowance',
        note: `RM 100/day × ${trainees} pax × ${days} day(s)`,
        amount: 100 * trainees * days,
      });
    }
  } else {
    // Programme longer than 1 month: monthly allowance paid by employer.
    const mo = num(months);
    const mAllow = num(monthlyAllowancePerTrainee);
    if (mAllow > 0 && mo > 0 && trainees > 0) {
      items.push({
        label: 'Trainees Monthly Allowance',
        note: `RM ${mAllow.toLocaleString()}/mth × ${mo} mth × ${trainees} pax (paid by employer)`,
        amount: mAllow * mo * trainees,
      });
    }
    if (isInternal && days > 0) {
      items.push({
        label: 'Internal Trainer Meal Allowance',
        note: `RM 100/day × ${days} day(s) × ${trainers} trainer(s)`,
        amount: 100 * days * trainers,
      });
    }
    if (isInhouse) {
      const cons = num(consumableCost);
      if (cons > 0) items.push({ label: 'Consumable Training Materials', note: 'As claimed', amount: cons });
    }
  }

  const totalClaimable = items.reduce((s, i) => s + i.amount, 0);

  const warnings = [];
  if (totalClaimable === 0) warnings.push('Enter the training details to calculate.');

  // Sub-type pax rules.
  if (isInhouse) {
    const perGroup = courseCategory === 'technical' ? 25 : 50;
    const max = perGroup * trainers;
    if (trainees > max) warnings.push(`In-house FWT allows a maximum of ${perGroup} trainees per group/trainer for ${courseCategory === 'technical' ? 'technical' : 'soft skills'} courses. With ${trainers} trainer(s) the maximum is ${max}. You entered ${trainees} — add more trainers or reduce trainees.`);
    if (trainees > 0 && trainees < 2) warnings.push('In-house FWT requires a minimum of 2 trainees.');
  }
  if (subType === 'general_public' && trainees > 9) warnings.push('General public FWT allows a maximum of 9 trainees per employer.');

  warnings.push('FWT funds pre-employment training, with the aim of employing the trainees upon completion. Each training session must be at least 4 hours.');
  if (isInhouse) warnings.push('Internal trainer allowance: RM1,400/full day or RM800/half day per group (full day capped at 7 hours). Course fee follows the ACM and is prorated if fewer than 5 trainees.');
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
