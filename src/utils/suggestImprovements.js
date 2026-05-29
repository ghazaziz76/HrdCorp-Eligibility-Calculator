// Pure rule engine for HCC/SBL/SLB. Given the form's current inputs and the
// just-computed result, returns suggestions for both blockers and optimisations.
// Each suggestion has { id, severity, message, applyPatch? }.

const NUM = (v) => parseFloat(v) || 0;
const INT = (v) => parseInt(v, 10) || 0;
const fmtRM = (n) => `RM ${Math.round(n).toLocaleString()}`;

const totalPaxOf = (inputs) => {
  const host = INT(inputs?.host?.pax);
  const br = (inputs?.branches || []).reduce((s, b) => s + INT(b?.pax), 0);
  const sub = (inputs?.subsidiaries || []).reduce((s, c) => s + INT(c?.pax), 0);
  return host + br + sub;
};

const IN_HOUSE_TYPES = ['inhouse', 'rot_inhouse', 'coaching_mentoring'];
const GENERAL_COURSE_CATS = ['general_non_technical', 'general_technical', 'general'];

const isInhouseOf = (i) => IN_HOUSE_TYPES.includes(i?.trainingType);
const isGeneralCourseOf = (i) => GENERAL_COURSE_CATS.includes(i?.courseCategory);

export function suggestImprovements(inputs, result) {
  if (!inputs) return [];
  const out = [];

  const totalPax = totalPaxOf(inputs);
  const trainers = INT(inputs.numberOfTrainers) || 1;
  const isInhouse = isInhouseOf(inputs);
  const isGeneralCourse = isGeneralCourseOf(inputs);
  const isTech = inputs.courseCategory === 'general_technical';
  const cap = isTech ? 25 : 50;

  // B1: pax over per-trainer cap (in-house, general courses)
  if (isInhouse && isGeneralCourse && totalPax > cap * trainers) {
    const needed = Math.ceil(totalPax / cap) - trainers;
    const newMax = cap * (trainers + needed);
    out.push({
      id: 'pax-cap-exceeded',
      severity: 'blocker',
      message:
        `You have ${totalPax} trainees with ${trainers} trainer(s). The cap is ${cap}/trainer for ` +
        `${isTech ? 'technical' : 'non-technical'} courses. Add ${needed} more trainer(s) to allow up to ${newMax} pax.`,
      applyPatch: { numberOfTrainers: trainers + needed },
    });
  }

  // B2: actual course fee exceeds ACM ceiling
  const actualPerPax = NUM(inputs.actualCourseFee);
  if (actualPerPax > 0 && totalPax > 0 && result?.items) {
    const courseFeeItem = result.items.find(it => /Course Fee/i.test(it?.label || ''));
    if (courseFeeItem && courseFeeItem.amount > 0) {
      const effectiveCeilingPerPax = courseFeeItem.amount / totalPax;
      if (actualPerPax > effectiveCeilingPerPax + 0.5) {
        const shortfallPerPax = actualPerPax - effectiveCeilingPerPax;
        const totalShortfall = shortfallPerPax * totalPax;
        out.push({
          id: 'actual-fee-over-ceiling',
          severity: 'blocker',
          message:
            `Your actual fee of ${fmtRM(actualPerPax)}/pax exceeds the ACM ceiling of ` +
            `${fmtRM(effectiveCeilingPerPax)}/pax. You'll self-fund ` +
            `${fmtRM(shortfallPerPax)} × ${totalPax} pax = ${fmtRM(totalShortfall)}. ` +
            `Reduce actual fee to ${fmtRM(effectiveCeilingPerPax)}/pax to fully claim.`,
          applyPatch: { actualCourseFee: String(Math.round(effectiveCeilingPerPax)) },
        });
      }
    }
  }

  // B3: SLB with no participating employers
  if (inputs.scheme === 'slb' && (inputs.subsidiaries || []).length === 0) {
    out.push({
      id: 'slb-no-employer',
      severity: 'blocker',
      message:
        'SLB requires at least one other participating employer. ' +
        'Add a participating employer using the "+ Add Participating Employer" button below.',
    });
  }

  // O1: own premises but at least one branch ≥100 km away
  if (
    inputs.venue === 'employer_premises' &&
    (inputs.branches || []).some(b => b?.kmDistance === 'over_100')
  ) {
    out.push({
      id: 'venue-vs-distant-branch',
      severity: 'optimization',
      message:
        'Branch staff travel 100 km+ but the venue is your own premises — no accommodation is claimable. ' +
        'Switching to an external venue/hotel would unlock daily allowance up to RM 500/day/pax for those travelling.',
      applyPatch: { venue: 'external_hotel' },
    });
  }

  // O2: half-day → consider full-day (in-house, general, ≥5 pax)
  if (inputs.duration === 'half_day' && isInhouse && isGeneralCourse && totalPax >= 5) {
    out.push({
      id: 'halfday-to-fullday',
      severity: 'optimization',
      message:
        'Switching from half-day to full-day extends the session from 4 to 7 hours and raises the ' +
        'daily course-fee ceiling from RM 6,000 to RM 10,500 per group. Consider full-day if the content fits.',
      applyPatch: { duration: 'full_day' },
    });
  }

  // O3: over-headed trainers (technical only — cap 25/trainer)
  if (
    isInhouse &&
    inputs.courseCategory === 'general_technical' &&
    trainers > 1 &&
    totalPax > 0 &&
    totalPax < 25 * trainers
  ) {
    const needed = Math.max(1, Math.ceil(totalPax / 25));
    if (needed < trainers) {
      out.push({
        id: 'over-headed-trainers',
        severity: 'optimization',
        message:
          `You have ${trainers} trainers but only ${totalPax} trainees (25 allowed per trainer). ` +
          `Reducing to ${needed} trainer(s) keeps you within the cap with no impact on per-pax claim.`,
        applyPatch: { numberOfTrainers: needed },
      });
    }
  }

  return out;
}
