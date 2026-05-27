import { calculateAlat } from './calculateAlat';

const base = {
  equipment: [{ item: 'LCD / Data Projector', cost: 4000 }],
  renovation: [{ type: 'Wall painting', cost: 2000 }],
};

test('claimable equals total requested (tool applies no levy cap)', () => {
  const r = calculateAlat(base);
  expect(r.totalRequested).toBe(6000);
  expect(r.totalClaimable).toBe(6000);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(6000);
});

test('includes the 50%-of-levy eligibility note after calculating', () => {
  const r = calculateAlat(base);
  expect(r.warnings.some(w => /50%/.test(w) && /levy/i.test(w))).toBe(true);
});

test('empty lists produce zero claimable and a guidance warning', () => {
  const r = calculateAlat({ equipment: [], renovation: [] });
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /add at least one/i.test(w))).toBe(true);
});

test('always includes 6-month/post-approval warning + supporting docs', () => {
  const r = calculateAlat(base);
  expect(r.warnings.some(w => /6 months/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
});
