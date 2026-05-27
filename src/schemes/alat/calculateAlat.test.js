import { calculateAlat } from './calculateAlat';

const base = {
  equipment: [{ item: 'LCD / Data Projector', cost: 4000 }],
  renovation: [{ type: 'Wall painting', cost: 2000 }],
};

test('no levy entered: claimable equals total requested', () => {
  const r = calculateAlat(base);
  expect(r.totalRequested).toBe(6000);
  expect(r.totalClaimable).toBe(6000);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(6000);
});

test('levy entered, total within 50%: claimable equals total', () => {
  const r = calculateAlat({ ...base, levyBalance: 100000 }); // cap = 50,000
  expect(r.totalClaimable).toBe(6000);
  expect(r.warnings.some(w => /within your estimated ALAT allowance/i.test(w))).toBe(true);
});

test('levy entered, total exceeds 50%: caps to what they can apply for', () => {
  const r = calculateAlat({ ...base, levyBalance: 8000 }); // cap = 4,000, total = 6,000
  expect(r.totalClaimable).toBe(4000);
  const adj = r.items.find(i => /50% of levy/i.test(i.label));
  expect(adj.amount).toBe(-2000);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(4000);
  expect(r.warnings.some(w => /apply for up to RM 4,000/i.test(w))).toBe(true);
});

test('empty lists produce zero claimable and a guidance warning', () => {
  const r = calculateAlat({ equipment: [], renovation: [] });
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /add at least one/i.test(w))).toBe(true);
});

test('always includes the 50%-of-levy note + 6-month warning + docs', () => {
  const r = calculateAlat(base);
  expect(r.warnings.some(w => /50%/.test(w) && /levy/i.test(w))).toBe(true);
  expect(r.warnings.some(w => /6 months/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
});
