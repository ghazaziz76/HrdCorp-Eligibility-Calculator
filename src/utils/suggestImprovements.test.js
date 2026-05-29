import { suggestImprovements } from './suggestImprovements';

const baseInputs = {
  scheme: 'hcc',
  trainingType: 'inhouse',
  trainerType: 'external',
  numberOfTrainers: '1',
  venue: 'external_hotel',
  courseCategory: 'general_non_technical',
  duration: 'full_day',
  days: '3',
  actualCourseFee: '',
  host: { pax: '10', kmDistance: 'under_100' },
  branches: [],
  subsidiaries: [],
};

const baseResult = {
  items: [{ label: 'Course Fee', amount: 20000 }],
  totalClaimable: 25200, warnings: [], supportingDocs: { grantSubmission: [], claimSubmission: [] },
};

test('clean inputs produce no suggestions', () => {
  expect(suggestImprovements(baseInputs, baseResult)).toEqual([]);
});

test('B1: 60 pax non-tech with 1 trainer suggests adding 1 trainer', () => {
  const inputs = { ...baseInputs, host: { pax: '60', kmDistance: 'under_100' } };
  const r = suggestImprovements(inputs, baseResult);
  const b1 = r.find(s => s.id === 'pax-cap-exceeded');
  expect(b1).toBeTruthy();
  expect(b1.severity).toBe('blocker');
  expect(b1.message).toMatch(/60 trainees/);
  expect(b1.message).toMatch(/1 trainer/);
  expect(b1.message).toMatch(/Add 1 more trainer/);
  expect(b1.message).toMatch(/100 pax/);
  expect(b1.applyPatch).toEqual({ numberOfTrainers: 2 });
});

test('B1: 30 pax tech with 1 trainer suggests adding 1 (cap 25, newMax 50)', () => {
  const inputs = { ...baseInputs, courseCategory: 'general_technical', host: { pax: '30', kmDistance: 'under_100' } };
  const r = suggestImprovements(inputs, baseResult);
  const b1 = r.find(s => s.id === 'pax-cap-exceeded');
  expect(b1).toBeTruthy();
  expect(b1.message).toMatch(/25\/trainer/);
  expect(b1.message).toMatch(/technical/);
  expect(b1.applyPatch).toEqual({ numberOfTrainers: 2 });
});

test('B1: exactly 50 pax non-tech with 1 trainer does NOT fire', () => {
  const inputs = { ...baseInputs, host: { pax: '50', kmDistance: 'under_100' } };
  const r = suggestImprovements(inputs, baseResult);
  expect(r.find(s => s.id === 'pax-cap-exceeded')).toBeUndefined();
});

test('B2: actual fee per pax exceeds the ACM ceiling', () => {
  // 10 pax, courseFee item = 20,000 → ceiling 2,000/pax; actual 3,000/pax → shortfall 1,000/pax × 10 = 10,000
  const inputs = { ...baseInputs, actualCourseFee: '3000', host: { pax: '10', kmDistance: 'under_100' } };
  const r = suggestImprovements(inputs, baseResult);
  const b2 = r.find(s => s.id === 'actual-fee-over-ceiling');
  expect(b2).toBeTruthy();
  expect(b2.severity).toBe('blocker');
  expect(b2.message).toMatch(/RM 3,000\/pax/);
  expect(b2.message).toMatch(/RM 2,000\/pax/);
  expect(b2.message).toMatch(/RM 10,000/);
  expect(b2.applyPatch).toEqual({ actualCourseFee: '2000' });
});

test('B2: actual fee BELOW ceiling does NOT fire', () => {
  const inputs = { ...baseInputs, actualCourseFee: '1500', host: { pax: '10', kmDistance: 'under_100' } };
  const r = suggestImprovements(inputs, baseResult);
  expect(r.find(s => s.id === 'actual-fee-over-ceiling')).toBeUndefined();
});

test('B3: SLB with no participating employers (informational, no applyPatch)', () => {
  const inputs = { ...baseInputs, scheme: 'slb', subsidiaries: [] };
  const r = suggestImprovements(inputs, baseResult);
  const b3 = r.find(s => s.id === 'slb-no-employer');
  expect(b3).toBeTruthy();
  expect(b3.severity).toBe('blocker');
  expect(b3.message).toMatch(/SLB/);
  expect(b3.applyPatch).toBeFalsy();
});

test('O1: venue=own premises + a 100km+ branch suggests switching venue', () => {
  const inputs = { ...baseInputs, venue: 'employer_premises', branches: [{ label: 'B1', pax: '4', kmDistance: 'over_100' }] };
  const r = suggestImprovements(inputs, baseResult);
  const o1 = r.find(s => s.id === 'venue-vs-distant-branch');
  expect(o1).toBeTruthy();
  expect(o1.severity).toBe('optimization');
  expect(o1.applyPatch).toEqual({ venue: 'external_hotel' });
});

test('O2: half-day, in-house, general non-tech, 8 pax → suggest full-day', () => {
  const inputs = { ...baseInputs, duration: 'half_day', host: { pax: '8', kmDistance: 'under_100' } };
  const r = suggestImprovements(inputs, baseResult);
  const o2 = r.find(s => s.id === 'halfday-to-fullday');
  expect(o2).toBeTruthy();
  expect(o2.applyPatch).toEqual({ duration: 'full_day' });
});

test('O3: technical, 2 trainers, 10 pax → suggest reducing to 1 trainer', () => {
  const inputs = { ...baseInputs, courseCategory: 'general_technical', numberOfTrainers: '2', host: { pax: '10', kmDistance: 'under_100' } };
  const r = suggestImprovements(inputs, baseResult);
  const o3 = r.find(s => s.id === 'over-headed-trainers');
  expect(o3).toBeTruthy();
  expect(o3.message).toMatch(/2 trainers/);
  expect(o3.message).toMatch(/10 trainees/);
  expect(o3.applyPatch).toEqual({ numberOfTrainers: 1 });
});

test('total pax sums host + branches + subsidiaries', () => {
  // 5 + 3 + 2 + 4 = 14; with 1 trainer non-tech → no B1 (≤ 50)
  const inputs = {
    ...baseInputs,
    host: { pax: '5', kmDistance: 'under_100' },
    branches: [{ pax: '3' }, { pax: '2' }],
    subsidiaries: [{ pax: '4' }],
  };
  expect(suggestImprovements(inputs, baseResult)).toEqual([]);
});

test('defensive: undefined inputs returns []', () => {
  expect(suggestImprovements(undefined, undefined)).toEqual([]);
});
