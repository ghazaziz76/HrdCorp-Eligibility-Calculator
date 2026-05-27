import { calculateCbt } from './calculateCbt';

const base = {
  softwarePurchase:   [{ description: 'Interactive safety CBT', cost: 3000 }],
  softwareDevelopment:[{ description: 'Custom LMS build', cost: 20000 }],
  lmsSubscription:    [{ description: 'LMS annual', cost: 6000 }],
  elearningSubscription: [{ description: 'Content platform', cost: 4000 }],
};

test('no scheme cap: claimable equals total (as charged)', () => {
  const r = calculateCbt(base);
  expect(r.totalRequested).toBe(33000);
  expect(r.totalClaimable).toBe(33000);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(33000);
});

test('only includes categories with cost > 0', () => {
  const r = calculateCbt({ ...base, lmsSubscription: [], elearningSubscription: [] });
  expect(r.items.find(i => /LMS Subscription/.test(i.label))).toBeUndefined();
  expect(r.totalClaimable).toBe(23000);
});

test('always includes development-proposal and levy-availability warnings + docs', () => {
  const r = calculateCbt(base);
  expect(r.warnings.some(w => /1 month/i.test(w))).toBe(true);
  expect(r.warnings.some(w => /levy/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
});

test('empty -> zero with guidance warning', () => {
  const r = calculateCbt({ softwarePurchase: [], softwareDevelopment: [], lmsSubscription: [], elearningSubscription: [] });
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /add at least one/i.test(w))).toBe(true);
});
