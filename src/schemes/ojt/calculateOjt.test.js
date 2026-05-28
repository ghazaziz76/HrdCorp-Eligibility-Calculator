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

test('exam-fee / learning-materials docs group only appears when those costs are claimed', () => {
  const without = calculateOjt({ numberOfTrainees: 1, trainingHours: 10 });
  const withExam = calculateOjt({ numberOfTrainees: 1, trainingHours: 10, examinationFee: 100 });
  expect(without.supportingDocs.grantSubmission.some(d => /Examination Fees/i.test(d.text))).toBe(false);
  expect(withExam.supportingDocs.grantSubmission.some(d => /Examination Fees/i.test(d.text))).toBe(true);
  const examGroup = withExam.supportingDocs.grantSubmission.find(d => /Examination Fees/i.test(d.text));
  expect(examGroup.subItems.some(s => /Examination schedule/i.test(s))).toBe(true);
});

test('grant submission docs are grouped by heading with sub-items (matches ACM layout)', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 10 });
  const trainerGroup = r.supportingDocs.grantSubmission.find(d => /OJT Trainer Allowance/i.test(d.text));
  expect(trainerGroup).toBeTruthy();
  expect(trainerGroup.subItems.some(s => /Attendance and Evaluation Log/i.test(s))).toBe(true);
  expect(trainerGroup.subItems.some(s => /Trainer.s Claim Form/i.test(s))).toBe(true);
});

test('claim submission is "not required" under OJT', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 10 });
  expect(r.supportingDocs.claimSubmission.some(d => /no claim submission/i.test(d.text))).toBe(true);
});

test('training duration is computed from start and end dates (inclusive)', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 10, trainingStartDate: '2026-05-01', trainingEndDate: '2026-05-10' });
  expect(r.durationDays).toBe(10);
  expect(r.warnings.some(w => /Training duration: 10 day/i.test(w))).toBe(true);
});

test('end before start triggers a correction warning', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 10, trainingStartDate: '2026-05-10', trainingEndDate: '2026-05-01' });
  expect(r.warnings.some(w => /end date is before the start date/i.test(w))).toBe(true);
});

test('6-month application deadline computed from training end date', () => {
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 10, trainingEndDate: '2026-05-01' });
  expect(r.applyDeadline).toBe('2026-11-01');
  expect(r.warnings.some(w => /Application deadline: 2026-11-01/.test(w))).toBe(true);
});

test('past deadline (training ended >6 months ago) raises a clear warning', () => {
  const longAgo = new Date(); longAgo.setFullYear(longAgo.getFullYear() - 2);
  const r = calculateOjt({ numberOfTrainees: 1, trainingHours: 10, trainingEndDate: longAgo.toISOString().slice(0, 10) });
  expect(r.pastDeadline).toBe(true);
  expect(r.warnings.some(w => /APPLICATION DEADLINE HAS PASSED/i.test(w))).toBe(true);
});

test('empty input -> zero with guidance warning', () => {
  const r = calculateOjt({});
  expect(r.totalClaimable).toBe(0);
  expect(r.warnings.some(w => /enter the OJT details/i.test(w))).toBe(true);
});
