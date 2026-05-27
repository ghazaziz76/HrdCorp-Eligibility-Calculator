import { calculateSgm } from './calculateSgm';

const base = { numberOfGraduates: 2, monthlySalary: 2500 };

test('allowance = salary × 12 × graduates (no levy entered)', () => {
  const r = calculateSgm(base); // 2500 * 12 * 2 = 60,000
  expect(r.totalRequested).toBe(60000);
  expect(r.totalClaimable).toBe(60000);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(60000);
});

test('caps at 50% of ball-park levy and tells how much can be applied for', () => {
  const r = calculateSgm({ ...base, levyBalance: 80000 }); // cap = 40,000
  expect(r.totalClaimable).toBe(40000);
  expect(r.warnings.some(w => /apply for up to RM 40,000/i.test(w))).toBe(true);
});

test('empty input -> zero with guidance warning', () => {
  const r = calculateSgm({});
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /enter the graduate/i.test(w))).toBe(true);
});

test('includes 12-month/eligibility notes + grant docs + no-claim note', () => {
  const r = calculateSgm(base);
  expect(r.warnings.some(w => /12 months/i.test(w))).toBe(true);
  expect(r.warnings.some(w => /SKM Level 4/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
  expect(r.supportingDocs.claimSubmission.some(d => /no claim submission/i.test(d.text))).toBe(true);
});
