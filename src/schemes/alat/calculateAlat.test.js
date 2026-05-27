import { calculateAlat } from './calculateAlat';

const base = {
  levyBalance: 100000,
  equipment: [{ description: 'LCD Projector', cost: 4000 }],
  renovation: [{ type: 'Wall painting', cost: 2000 }],
};

test('under cap: claimable equals total requested', () => {
  const r = calculateAlat(base);
  expect(r.totalRequested).toBe(6000);
  expect(r.totalClaimable).toBe(6000);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(6000);
});

test('over cap: claimable capped at 50% of levy, adjustment line added', () => {
  const r = calculateAlat({ ...base, levyBalance: 8000 });
  expect(r.totalClaimable).toBe(4000);
  const adj = r.items.find(i => /cap/i.test(i.label));
  expect(adj.amount).toBe(-2000);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(4000);
  expect(r.warnings.some(w => /50%/.test(w))).toBe(true);
});

test('empty lists produce zero claimable and a guidance warning', () => {
  const r = calculateAlat({ levyBalance: 100000, equipment: [], renovation: [] });
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /add at least one/i.test(w))).toBe(true);
});

test('always includes 6-month and post-approval warnings + supporting docs', () => {
  const r = calculateAlat(base);
  expect(r.warnings.some(w => /6 months/i.test(w))).toBe(true);
  expect(r.supportingDocs.grantSubmission.length).toBeGreaterThan(0);
});
