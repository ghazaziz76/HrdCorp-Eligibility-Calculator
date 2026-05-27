import { calculateFwt } from './calculateFwt';

test('in-house INTERNAL trainer, less than 1 month: trainer + daily + meal allowances', () => {
  const r = calculateFwt({
    subType: 'inhouse', courseCategory: 'soft_skills', trainerType: 'internal',
    numberOfTrainees: 10, numberOfTrainers: 1, trainingDays: 3,
    dailyDuration: 'full_day', distance: 'under_100', durationType: 'less_than_month',
  });
  // trainer 1400*3 = 4200; daily 250*10*3 = 7500; meal 100*10*3 = 3000 => 14,700
  expect(r.totalClaimable).toBe(14700);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(14700);
});

test('in-house EXTERNAL trainer: course fee instead of trainer allowance', () => {
  const r = calculateFwt({
    subType: 'inhouse', trainerType: 'external',
    numberOfTrainees: 10, trainingDays: 3, distance: 'under_100',
    courseFee: 9000, durationType: 'less_than_month',
  });
  // no trainer allowance; fee 9000; daily 250*10*3 = 7500; meal 100*10*3 = 3000 => 19,500
  expect(r.totalClaimable).toBe(19500);
  expect(r.items.some(i => /Internal Trainer Allowance/i.test(i.label))).toBe(false);
  expect(r.items.some(i => /Course Fee/i.test(i.label))).toBe(true);
});

test('in-house, more than 1 month: trainer + monthly + trainer meal + consumables', () => {
  const r = calculateFwt({
    subType: 'inhouse', numberOfTrainees: 5, numberOfTrainers: 1, trainingDays: 20,
    dailyDuration: 'full_day', durationType: 'more_than_month',
    months: 2, monthlyAllowancePerTrainee: 1200, consumableCost: 500,
  });
  // trainer 1400*20 = 28000; monthly 1200*2*5 = 12000; trainer meal 100*20 = 2000; consumables 500 => 42,500
  expect(r.totalClaimable).toBe(42500);
});

test('public certification: course fee + daily + meal (no trainer allowance)', () => {
  const r = calculateFwt({
    subType: 'public_cert', numberOfTrainees: 2, trainingDays: 2,
    distance: 'under_100', courseFee: 3000, durationType: 'less_than_month',
  });
  // fee 3000; daily 250*2*2 = 1000; meal 100*2*2 = 400 => 4,400; no trainer line
  expect(r.totalClaimable).toBe(4400);
  expect(r.items.some(i => /Trainer Allowance/i.test(i.label))).toBe(false);
});

test('general public over 9 trainees triggers a warning', () => {
  const r = calculateFwt({ subType: 'general_public', numberOfTrainees: 12, courseFee: 1000, durationType: 'less_than_month', trainingDays: 1 });
  expect(r.warnings.some(w => /maximum of 9 trainees/i.test(w))).toBe(true);
});

test('in-house technical over 25 trainees triggers a warning', () => {
  const r = calculateFwt({ subType: 'inhouse', courseCategory: 'technical', numberOfTrainees: 30, numberOfTrainers: 1, trainingDays: 1, dailyDuration: 'full_day', durationType: 'less_than_month' });
  expect(r.warnings.some(w => /maximum of 25 trainees/i.test(w))).toBe(true);
});

test('empty input -> zero with guidance warning + supporting docs', () => {
  const r = calculateFwt({});
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /enter the training details/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
  expect(r.supportingDocs.claimSubmission.length).toBeGreaterThan(0);
});
