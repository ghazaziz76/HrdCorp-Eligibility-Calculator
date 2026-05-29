import { comparePlans } from './comparePlans';

const planA = {
  id: 'a', name: 'Q1 HCC', schemeId: 'hcc', schemeLabel: 'HCC — Training Course',
  inputs: { scheme: 'hcc', trainingType: 'inhouse', trainerType: 'external', numberOfTrainers: '1',
            venue: 'external_hotel', courseCategory: 'general_non_technical', duration: 'full_day',
            days: '3', actualCourseFee: '', hasLTM: false, ltmActualCost: '',
            host: { pax: '10' }, branches: [], subsidiaries: [] },
  resultSnapshot: {
    items: [
      { label: 'Course Fee', amount: 21000 },
      { label: 'Trainer Allowance', amount: 4200 },
    ],
    totalClaimable: 25200, warnings: [], supportingDocs: { grantSubmission: [], claimSubmission: [] },
  },
};

const planB = {
  id: 'b', name: 'Same prog as SBL', schemeId: 'sbl', schemeLabel: 'SBL — Training Course',
  inputs: { scheme: 'sbl', trainingType: 'inhouse', trainerType: 'internal', numberOfTrainers: '1',
            venue: 'external_hotel', courseCategory: 'general_non_technical', duration: 'full_day',
            days: '3', actualCourseFee: '8000', hasLTM: true, ltmActualCost: '5000',
            host: { pax: '10' }, branches: [], subsidiaries: [] },
  resultSnapshot: {
    items: [
      { label: 'Course Fee', amount: 21000 },
      { label: 'Trainer Allowance', amount: 2800 },
      { label: 'LTM (Licensed Training Materials)', amount: 5000 },
    ],
    totalClaimable: 28800, warnings: [], supportingDocs: { grantSubmission: [], claimSubmission: [] },
  },
};

const planC = {
  id: 'c', name: 'Public version', schemeId: 'hcc', schemeLabel: 'HCC — Training Course',
  inputs: { scheme: 'hcc', trainingType: 'public', trainerType: 'external', numberOfTrainers: '1',
            venue: 'external_hotel', courseCategory: 'focus_area', duration: 'full_day',
            days: '5', actualCourseFee: '12500', hasLTM: false, ltmActualCost: '',
            host: { pax: '8' }, branches: [], subsidiaries: [] },
  resultSnapshot: {
    items: [
      { label: 'Course Fee', amount: 50000 },
      { label: 'Trainee Daily Allowance', amount: 10000 },
      { label: 'Air Ticket', entitledCount: 2 },
    ],
    totalClaimable: 60000, warnings: [], supportingDocs: { grantSubmission: [], claimSubmission: [] },
  },
};

test('planHeaders include id, name, scheme, and a subtitle', () => {
  const r = comparePlans([planA, planB]);
  expect(r.planHeaders).toHaveLength(2);
  expect(r.planHeaders[0]).toMatchObject({ id: 'a', name: 'Q1 HCC', schemeId: 'hcc' });
  expect(r.planHeaders[0].subtitle).toBe('10 pax · 3d');
});

test('inputRows mark rows that differ', () => {
  const r = comparePlans([planA, planB]);
  const find = (lbl) => r.inputRows.find(row => row.label === lbl);
  expect(find('Trainer Type').values).toEqual(['External', 'Internal']);
  expect(find('Trainer Type').differ).toBe(true);
  expect(find('Days').differ).toBe(false);
  expect(find('Days').values).toEqual(['3', '3']);
});

test('inputRows hide entirely-empty fields', () => {
  const both = { ...planA, inputs: { ...planA.inputs, actualCourseFee: '' } };
  const r = comparePlans([both, both]);
  expect(r.inputRows.find(row => row.label === 'Actual Course Fee')).toBeUndefined();
});

test('LTM formats as "No", "Yes", or "Yes (RM N,NNN)"', () => {
  const r = comparePlans([planA, planB]);
  const ltm = r.inputRows.find(row => row.label === 'LTM');
  expect(ltm.values).toEqual(['No', 'Yes (RM 5,000)']);
});

test('itemRows are aligned by label; missing plans get null', () => {
  const r = comparePlans([planA, planB, planC]);
  const find = (lbl) => r.itemRows.find(row => row.label === lbl);
  expect(find('Course Fee').amounts).toEqual([21000, 21000, 50000]);
  expect(find('Trainer Allowance').amounts).toEqual([4200, 2800, null]);
  expect(find('LTM (Licensed Training Materials)').amounts).toEqual([null, 5000, null]);
  expect(find('Trainee Daily Allowance').amounts).toEqual([null, null, 10000]);
});

test('entitledCount items are preserved as a string', () => {
  const r = comparePlans([planA, planC]);
  const air = r.itemRows.find(row => row.label === 'Air Ticket');
  expect(air.amounts).toEqual([null, '2 person(s)']);
});

test('totals + highestIndex', () => {
  const r = comparePlans([planA, planB, planC]);
  expect(r.totals).toEqual([25200, 28800, 60000]);
  expect(r.highestIndex).toBe(2);
});

test('highestIndex is null when all totals are zero', () => {
  const zeroA = { ...planA, resultSnapshot: { ...planA.resultSnapshot, totalClaimable: 0 } };
  const zeroB = { ...planB, resultSnapshot: { ...planB.resultSnapshot, totalClaimable: 0 } };
  const r = comparePlans([zeroA, zeroB]);
  expect(r.highestIndex).toBeNull();
});

test('comparePlans([]) and comparePlans([single]) do not throw', () => {
  expect(comparePlans([]).planHeaders).toEqual([]);
  expect(comparePlans([planA]).planHeaders).toHaveLength(1);
  expect(comparePlans([planA]).inputRows.length).toBeGreaterThan(0);
});

test('total pax includes branches and subsidiaries', () => {
  const planWithGroups = {
    ...planA,
    inputs: {
      ...planA.inputs,
      host: { pax: '5' },
      branches: [{ pax: '3' }, { pax: '2' }],
      subsidiaries: [{ pax: '4' }],
    },
  };
  const r = comparePlans([planWithGroups]);
  const pax = r.inputRows.find(row => row.label === 'Total Pax');
  expect(pax.values).toEqual(['14']);
  expect(r.inputRows.find(row => row.label === '# Branches').values).toEqual(['2']);
});
