import { calculateFwt, groupsFor } from './calculateFwt';

const feeOf = (r, re) => (r.items.find(i => re.test(i.label)) || {}).amount;

test('groupsFor: ceil(trainees / per-group max)', () => {
  expect(groupsFor(40, 'soft_skills')).toBe(1);   // 40 / 50
  expect(groupsFor(40, 'technical')).toBe(2);      // 40 / 25
  expect(groupsFor(50, 'technical')).toBe(2);      // 50 / 25
  expect(groupsFor(0, 'soft_skills')).toBe(0);
});

test('in-house INTERNAL, daily allowance: trainer allowance uses auto groups', () => {
  const r = calculateFwt({
    subType: 'inhouse', courseCategory: 'soft_skills', trainerType: 'internal',
    numberOfTrainees: 10, trainingDays: 3, dailyDuration: 'full_day',
    distance: 'under_100', allowanceType: 'daily', durationType: 'less_than_month',
  });
  // groups 1; trainer 1400*3*1 = 4200; daily 250*10*3 = 7500; trainer meal 100*3*1 = 300 => 12,000
  expect(r.totalClaimable).toBe(12000);
  expect(r.items.some(i => /^Meal Allowance/i.test(i.label))).toBe(false); // trainee meal (trainer meal is separate)
});

test('short programme: meal allowance chosen instead of daily', () => {
  const r = calculateFwt({
    subType: 'inhouse', trainerType: 'internal', numberOfTrainees: 10,
    trainingDays: 3, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month',
  });
  // trainer 4200; meal 100*10*3 = 3000; trainer meal 100*3 = 300 => 7,500
  expect(r.totalClaimable).toBe(7500);
});

test('in-house EXTERNAL, 40 soft skills, 15 days full = RM157,500 course fee (1 group)', () => {
  const r = calculateFwt({
    subType: 'inhouse', courseCategory: 'soft_skills', trainerType: 'external',
    numberOfTrainees: 40, trainingDays: 15, dailyDuration: 'full_day',
    allowanceType: 'meal', durationType: 'less_than_month',
  });
  expect(feeOf(r, /Course Fee/i)).toBe(157500); // 10,500 * 15 * 1
});

test('in-house EXTERNAL, 40 technical, 15 days full = RM315,000 course fee (2 groups)', () => {
  const r = calculateFwt({
    subType: 'inhouse', courseCategory: 'technical', trainerType: 'external',
    numberOfTrainees: 40, trainingDays: 15, dailyDuration: 'full_day',
    allowanceType: 'meal', durationType: 'less_than_month',
  });
  expect(feeOf(r, /Course Fee/i)).toBe(315000); // (10,500 + 10,500) * 15
});

test('in-house EXTERNAL proration: trailing group under 5 pax', () => {
  const r = calculateFwt({
    subType: 'inhouse', courseCategory: 'technical', trainerType: 'external',
    numberOfTrainees: 3, trainingDays: 1, dailyDuration: 'full_day',
    allowanceType: 'meal', durationType: 'less_than_month',
  });
  // 0 full groups; remainder 3 < 5 => 2,100 * 3 = 6,300 per day * 1 day
  expect(feeOf(r, /Course Fee/i)).toBe(6300);
});

test('in-house INTERNAL allowance scales with auto groups (50 technical = 2 groups)', () => {
  const r = calculateFwt({
    subType: 'inhouse', courseCategory: 'technical', trainerType: 'internal',
    numberOfTrainees: 50, trainingDays: 1, dailyDuration: 'full_day',
    allowanceType: 'meal', durationType: 'less_than_month',
  });
  expect(feeOf(r, /Internal Trainer Allowance/i)).toBe(2800); // 1,400 * 1 * 2 groups
});

test('public certification: course fee is per pax × trainees + daily allowance', () => {
  const r = calculateFwt({
    subType: 'public_cert', numberOfTrainees: 2, trainingDays: 2,
    distance: 'under_100', allowanceType: 'daily', courseFee: 3000, durationType: 'less_than_month',
  });
  // fee 3000/pax * 2 = 6000; daily 250*2*2 = 1000 => 7,000
  expect(r.totalClaimable).toBe(7000);
});

test('in-house, more than 1 month: trainer + monthly + trainer meal + consumables', () => {
  const r = calculateFwt({
    subType: 'inhouse', courseCategory: 'soft_skills', trainerType: 'internal',
    numberOfTrainees: 5, trainingDays: 20, dailyDuration: 'full_day',
    durationType: 'more_than_month', months: 2, monthlyAllowancePerTrainee: 1200, consumableCost: 500,
  });
  // groups 1; trainer 1400*20 = 28000; monthly 1200*2*5 = 12000; trainer meal 100*20 = 2000; consumables 500 => 42,500
  expect(r.totalClaimable).toBe(42500);
});

test('general public: ACM RM1,750/pax/day course fee + daily allowance', () => {
  const r = calculateFwt({
    subType: 'general_public', numberOfTrainees: 5, trainingDays: 3,
    dailyDuration: 'full_day', distance: 'under_100', allowanceType: 'daily', durationType: 'less_than_month',
  });
  // fee 1750*3*5 = 26,250; daily 250*5*3 = 3,750 => 30,000
  expect(feeOf(r, /Course Fee/i)).toBe(26250);
  expect(r.totalClaimable).toBe(30000);
});

test('general public half-day uses RM1,000/pax', () => {
  const r = calculateFwt({
    subType: 'general_public', numberOfTrainees: 4, trainingDays: 2,
    dailyDuration: 'half_day', allowanceType: 'meal', durationType: 'less_than_month',
  });
  // fee 1000*2*4 = 8,000
  expect(feeOf(r, /Course Fee/i)).toBe(8000);
});

test('general public over 9 trainees triggers a warning', () => {
  const r = calculateFwt({ subType: 'general_public', numberOfTrainees: 12, trainingDays: 1, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month' });
  expect(r.warnings.some(w => /maximum of 9 trainees/i.test(w))).toBe(true);
});

test('in-house under 2 trainees triggers a minimum warning', () => {
  const r = calculateFwt({ subType: 'inhouse', trainerType: 'internal', numberOfTrainees: 1, trainingDays: 1, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month' });
  expect(r.warnings.some(w => /minimum of 2 trainees/i.test(w))).toBe(true);
});

test('less than 1 month with >30 training days triggers a warning', () => {
  const r = calculateFwt({ subType: 'inhouse', trainerType: 'internal', numberOfTrainees: 5, trainingDays: 45, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month' });
  expect(r.warnings.some(w => /cannot exceed 30/i.test(w))).toBe(true);
});

test('empty input -> zero with guidance warning + supporting docs', () => {
  const r = calculateFwt({});
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /enter the training details/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
  expect(r.supportingDocs.claimSubmission.length).toBeGreaterThan(0);
});

// ── ACM Jan 2026 Guide, FWT section ─────────────────────────────────────────
describe('FWT half day (Table Additional Note 2: half day amount for all fees and allowances)', () => {
  test('meal allowance RM50 per trainee per half day', () => {
    const r = calculateFwt({ subType: 'inhouse', trainerType: 'external', numberOfTrainees: 10, trainingDays: 2, dailyDuration: 'half_day', allowanceType: 'meal', durationType: 'less_than_month' });
    expect(feeOf(r, /^Meal Allowance/)).toBe(50 * 10 * 2);
  });
  test('daily allowance halved (RM125 / RM250)', () => {
    const r = calculateFwt({ subType: 'inhouse', trainerType: 'external', numberOfTrainees: 10, trainingDays: 2, dailyDuration: 'half_day', distance: 'over_100', allowanceType: 'daily', durationType: 'less_than_month' });
    expect(feeOf(r, /Trainee Daily Allowance/)).toBe(250 * 10 * 2);
  });
});

describe('FWT under 1 month: trainer meal + consumables', () => {
  test('internal trainer meal RM100/day per trainer (group)', () => {
    const r = calculateFwt({ subType: 'inhouse', courseCategory: 'technical', trainerType: 'internal', numberOfTrainees: 30, trainingDays: 2, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month' });
    expect(feeOf(r, /Internal Trainer Meal Allowance/)).toBe(100 * 2 * 2);
  });
  test('consumable training materials (in-house)', () => {
    const r = calculateFwt({ subType: 'inhouse', trainerType: 'external', numberOfTrainees: 10, trainingDays: 2, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month', consumableCost: 300 });
    expect(feeOf(r, /Consumable/)).toBe(300);
  });
});

describe('FWT general public: max 9 trainees, course fee as charged', () => {
  test('amounts are capped at 9 trainees', () => {
    const r = calculateFwt({ subType: 'general_public', numberOfTrainees: 12, trainingDays: 1, dailyDuration: 'full_day', distance: 'under_100', allowanceType: 'daily', durationType: 'less_than_month' });
    expect(feeOf(r, /Course Fee/)).toBe(1750 * 9);
    expect(feeOf(r, /Trainee Daily Allowance/)).toBe(250 * 9);
  });
  test('courseFeeActual (per pax, whole course) is used when provided', () => {
    const r = calculateFwt({ subType: 'general_public', numberOfTrainees: 3, trainingDays: 2, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month', courseFeeActual: 2500 });
    expect(feeOf(r, /Course Fee/)).toBe(2500 * 3);
  });
  test('without courseFeeActual the ACM rate is used', () => {
    const r = calculateFwt({ subType: 'general_public', numberOfTrainees: 3, trainingDays: 2, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month', courseFeeActual: '' });
    expect(feeOf(r, /Course Fee/)).toBe(1750 * 2 * 3);
  });
});
