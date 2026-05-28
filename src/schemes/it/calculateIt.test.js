import { calculateIt } from './calculateIt';

const base = {
  computers: [{ description: 'Desktop PC', qty: 5, unitCost: 3000 }],
  webcam: 500,
  internetSubscription: 1200,
  lastApplicationDate: '',
};

test('under cap: claimable equals total requested', () => {
  const r = calculateIt(base);
  expect(r.totalRequested).toBe(16700);
  expect(r.totalClaimable).toBe(16700);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(16700);
});

test('over RM25,000 cap: capped with adjustment line', () => {
  const r = calculateIt({ ...base, computers: [{ description: 'PC', qty: 10, unitCost: 3000 }] });
  expect(r.totalClaimable).toBe(25000);
  const adj = r.items.find(i => /25,000/.test(i.label));
  expect(adj.amount).toBe(25000 - 31700);
  expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(25000);
});

test('flags 3-year rule when last application within 3 years', () => {
  const recent = new Date(); recent.setFullYear(recent.getFullYear() - 1);
  const r = calculateIt({ ...base, lastApplicationDate: recent.toISOString().slice(0, 10) });
  expect(r.warnings.some(w => /3 years/i.test(w) && /not.*eligible|too soon|within/i.test(w))).toBe(true);
});

test('empty computers list -> zero with guidance warning', () => {
  const r = calculateIt({ computers: [], webcam: 0, internetSubscription: 0, lastApplicationDate: '' });
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /add at least one/i.test(w))).toBe(true);
});
