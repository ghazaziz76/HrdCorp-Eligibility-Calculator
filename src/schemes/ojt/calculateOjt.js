// OJT — On-the-Job Training.
// Source: ACM Guide Jan 2026, section J.
const num = (v) => parseFloat(v) || 0;
const doc = (text) => ({ text });

const RATE_PER_TRAINEE_HOUR = 50;
const MAX_HOURS = 300;
const MIN_SESSION_HOURS = 4;
const MAX_RATIO = 4;        // max 1 trainer : 4 trainees per session
const APPLY_WINDOW_MONTHS = 6; // application must be submitted within 6 months AFTER training ends

const fmtDate = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

export function calculateOjt({
  numberOfTrainees = '',
  trainingHours = '',
  examinationFee = '',
  learningMaterials = '',
  trainingStartDate = '',
  trainingEndDate = '',
} = {}) {
  const trainees = Math.max(0, parseInt(numberOfTrainees, 10) || 0);
  const hours = Math.max(0, num(trainingHours));
  const examFee = num(examinationFee);
  const matCost = num(learningMaterials);

  const trainerAllowance = RATE_PER_TRAINEE_HOUR * hours * trainees;

  const items = [];
  if (trainerAllowance > 0) {
    items.push({
      label: 'OJT Trainer Allowance',
      note: `RM ${RATE_PER_TRAINEE_HOUR}/trainee/hour × ${trainees} trainee(s) × ${hours} hour(s)`,
      amount: trainerAllowance,
    });
  }
  if (examFee > 0) items.push({ label: 'Examination Fee', note: 'As per receipt', amount: examFee });
  if (matCost > 0) items.push({ label: 'Learning Materials (self-learning)', note: 'As per receipts (journals / books / online subscriptions)', amount: matCost });

  const totalClaimable = items.reduce((s, i) => s + i.amount, 0);

  // ── Training duration + 6-month application-window check ──────────────────
  const start = trainingStartDate ? new Date(trainingStartDate) : null;
  const end = trainingEndDate ? new Date(trainingEndDate) : null;
  const validStart = start && !isNaN(start);
  const validEnd = end && !isNaN(end);
  const durationDays = (validStart && validEnd && end >= start) ? daysBetween(start, end) + 1 : null;
  let applyDeadline = null;
  let pastDeadline = false;
  if (validEnd) {
    applyDeadline = addMonths(end, APPLY_WINDOW_MONTHS);
    pastDeadline = new Date() > applyDeadline;
  }

  const warnings = [];
  if (totalClaimable === 0) warnings.push('Enter the OJT details (trainees + hours, or examination/learning materials) to calculate.');
  if (trainees > MAX_RATIO) warnings.push(`OJT allows a maximum trainer-to-trainee ratio of 1:${MAX_RATIO} per session. With ${trainees} trainees, apply under the SBL scheme instead for the internal trainer allowance.`);
  if (hours > MAX_HOURS) warnings.push(`OJT total training hours cannot exceed ${MAX_HOURS}. You entered ${hours}.`);
  if (hours > 0 && hours < MIN_SESSION_HOURS) warnings.push(`Each OJT training session must be at least ${MIN_SESSION_HOURS} hours (sub-sessions may be split, minimum 1 continuous hour each).`);

  if (validStart && validEnd && end < start) {
    warnings.push('Training end date is before the start date — please correct the dates.');
  }
  if (durationDays !== null) {
    warnings.push(`Training duration: ${durationDays} day(s) (${fmtDate(start)} → ${fmtDate(end)}).`);
  }
  if (validEnd) {
    if (pastDeadline) {
      warnings.push(`⚠ APPLICATION DEADLINE HAS PASSED. Training ended on ${fmtDate(end)}; OJT applications must be submitted within ${APPLY_WINDOW_MONTHS} months after training ends (deadline was ${fmtDate(applyDeadline)}).`);
    } else {
      warnings.push(`Application deadline: ${fmtDate(applyDeadline)} (${APPLY_WINDOW_MONTHS} months after training ended on ${fmtDate(end)}).`);
    }
  }

  warnings.push(`Internal trainer allowance: RM${RATE_PER_TRAINEE_HOUR}/trainee/hour. Maximum ${MAX_HOURS} training hours in total (max 7 hours per day).`);
  warnings.push('Trainer-to-trainee ratio per session: minimum 1:1, maximum 1:4. For 5 or more trainees, apply under the SBL scheme.');
  warnings.push('Each training session must be at least 4 hours; sub-sessions may be split with a minimum of 1 continuous hour each.');
  warnings.push(`Application must be submitted within ${APPLY_WINDOW_MONTHS} months AFTER the training ended. Examination fee is claimable as per receipt.`);
  warnings.push('Trainer and trainee details with handwritten signatures are required. No claim submission is required under OJT.');

  const grantSubmission = [
    doc('OJT Attendance and Evaluation Log — trainees must achieve satisfactory levels of skills competency.'),
    doc('Trainer’s Claim Form (OJT Trainer’s Allowance Claim Form).'),
  ];
  if (examFee > 0 || matCost > 0) {
    grantSubmission.push(
      doc('Examination schedule.'),
      doc('Receipt of learning materials (journals, books, online subscriptions, etc.).'),
      doc('Receipt of examination fee payment.'),
    );
  }

  return {
    items,
    totalClaimable,
    durationDays,
    applyDeadline: applyDeadline ? fmtDate(applyDeadline) : null,
    pastDeadline,
    warnings,
    supportingDocs: {
      grantSubmission,
      claimSubmission: [doc('No claim submission is required under the OJT scheme.')],
    },
  };
}
