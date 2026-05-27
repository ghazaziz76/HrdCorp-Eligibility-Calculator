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
  // groups 1; trainer 1400*3*1 = 4200; daily 250*10*3 = 7500 => 11,700
  expect(r.totalClaimable).toBe(11700);
  expect(r.items.some(i => /Meal Allowance/i.test(i.label))).toBe(false);
});

test('short programme: meal allowance chosen instead of daily', () => {
  const r = calculateFwt({
    subType: 'inhouse', trainerType: 'internal', numberOfTrainees: 10,
    trainingDays: 3, dailyDuration: 'full_day', allowanceType: 'meal', durationType: 'less_than_month',
  });
  // trainer 4200; meal 100*10*3 = 3000 => 7,200
  expect(r.totalClaimable).toBe(7200);
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

test('general public over 9 trainees triggers a warning', () => {
  const r = calculateFwt({ subType: 'general_public', numberOfTrainees: 12, courseFee: 1000, trainingDays: 1, allowanceType: 'meal', durationType: 'less_than_month' });
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
