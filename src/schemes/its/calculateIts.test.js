import { calculateIts } from './calculateIts';

const base = {
  numberOfInterns: 2,
  monthlyAllowance: 1000,
  months: 6,
  ppePerIntern: 200,
  insuranceTotal: 500,
};

test('totals allowance + PPE + insurance (no levy entered)', () => {
  const r = calculateIts(base);
  // allowance 1000*6*2 = 12000, ppe 200*2 = 400, insurance 500 => 12900
  expect(r.totalRequested).toBe(12900);
  expect(r.totalClaimable).toBe(12900);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(12900);
});

test('caps at 50% of ball-park levy and tells how much can be applied for', () => {
  const r = calculateIts({ ...base, levyBalance: 20000 }); // cap = 10,000
  expect(r.totalClaimable).toBe(10000);
  expect(r.warnings.some(w => /apply for up to RM 10,000/i.test(w))).toBe(true);
});

test('warns when months outside 2-12 range', () => {
  const r = calculateIts({ ...base, months: 18 });
  expect(r.warnings.some(w => /between 2 and 12 months/i.test(w))).toBe(true);
});

test('empty input -> zero with guidance warning', () => {
  const r = calculateIts({});
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /enter the intern details/i.test(w))).toBe(true);
});

test('always includes 50%-levy note + supporting docs (grant + claim)', () => {
  const r = calculateIts(base);
  expect(r.warnings.some(w => /50%/.test(w) && /levy/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
  expect(r.supportingDocs.claimSubmission.length).toBeGreaterThan(0);
});
