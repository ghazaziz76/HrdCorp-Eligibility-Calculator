import { calculateOjt } from './calculateOjt';

test('trainer allowance = RM50 × hours × trainees', () => {
  const r = calculateOjt({ numberOfTrainees: 2, trainingHours: 10 });
  // 50 * 10 * 2 = 1,000
  expect(r.totalClaimable).toBe(1000);
});

test('totals trainer allowance + exam fee + learning materials', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 5, examinationFee: 300, learningMaterials: 200 });
  // 50*5*1 = 250; + 300 + 200 = 750
  expect(r.totalClaimable).toBe(750);
  expect(r.items.length).toBe(3);
});

test('over 4 trainees → SBL-instead warning', () => {
  const r = calculateOjt({ numberOfTrainees: 5, trainingHours: 10 });
  expect(r.warnings.some(w => /SBL scheme/i.test(w) && /1:4/.test(w))).toBe(true);
});

test('over 300 hours triggers a warning', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 350 });
  expect(r.warnings.some(w => /cannot exceed 300/i.test(w))).toBe(true);
});

test('under 4-hour session triggers a warning', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 2 });
  expect(r.warnings.some(w => /at least 4 hours/i.test(w))).toBe(true);
});

test('exam-fee / learning-materials docs only appear when those costs are claimed', () => {
  const without = calculateOjt({ numberOfTrainees: 1, trainingHours: 10 });
  const withExam = calculateOjt({ numberOfTrainees: 1, trainingHours: 10, examinationFee: 100 });
  expect(without.supportingDocs.grantSubmission.some(d => /Examination schedule/i.test(d.text))).toBe(false);
  expect(withExam.supportingDocs.grantSubmission.some(d => /Examination schedule/i.test(d.text))).toBe(true);
});

test('claim submission is "not required" under OJT', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 10 });
  expect(r.supportingDocs.claimSubmission.some(d => /no claim submission/i.test(d.text))).toBe(true);
});

test('empty input -> zero with guidance warning', () => {
  const r = calculateOjt({});
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /enter the OJT details/i.test(w))).toBe(true);
});
