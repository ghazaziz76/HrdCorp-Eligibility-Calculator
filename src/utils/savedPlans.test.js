import {
  loadPlans, savePlan, updatePlan, renamePlan, duplicatePlan, deletePlan, storageUsageRatio,
  STORAGE_KEY,
} from './savedPlans';

beforeEach(() => { localStorage.clear(); });

const fixture = (overrides = {}) => ({
  name: 'Q1 Leadership',
  schemeId: 'fwt',
  schemeLabel: 'FWT — Future Workers Training',
  inputs: { subType: 'inhouse', numberOfTrainees: '10' },
  resultSnapshot: { items: [], totalClaimable: 14700, warnings: [], supportingDocs: { grantSubmission: [], claimSubmission: [] } },
  ...overrides,
});

test('loadPlans returns [] when storage is empty', () => {
  expect(loadPlans()).toEqual([]);
});

test('savePlan returns a plan with id + timestamps and persists it', () => {
  const p = savePlan(fixture());
  expect(p.id).toMatch(/^\d+$/);
  expect(p.savedAt).toBeTruthy();
  expect(p.updatedAt).toBe(p.savedAt);
  expect(loadPlans()).toEqual([p]);
});

test('savePlan prepends so newest is first', () => {
  const a = savePlan(fixture({ name: 'A' }));
  const b = savePlan(fixture({ name: 'B' }));
  expect(loadPlans().map(p => p.name)).toEqual(['B', 'A']);
  expect(a.id).not.toBe(b.id);
});

test('updatePlan merges fields and bumps updatedAt', async () => {
  const p = savePlan(fixture({ name: 'Old' }));
  await new Promise(r => setTimeout(r, 5));
  const updated = updatePlan(p.id, { resultSnapshot: { items: [], totalClaimable: 99, warnings: [], supportingDocs: { grantSubmission: [], claimSubmission: [] } } });
  expect(updated.resultSnapshot.totalClaimable).toBe(99);
  expect(updated.updatedAt).not.toBe(p.updatedAt);
  expect(loadPlans()[0].resultSnapshot.totalClaimable).toBe(99);
});

test('renamePlan changes name + updatedAt only', () => {
  const p = savePlan(fixture({ name: 'Old' }));
  const r = renamePlan(p.id, 'New');
  expect(r.name).toBe('New');
  expect(loadPlans()[0].name).toBe('New');
});

test('duplicatePlan creates a fresh id with "(copy)" appended', () => {
  const p = savePlan(fixture({ name: 'Source' }));
  const d = duplicatePlan(p.id);
  expect(d.id).not.toBe(p.id);
  expect(d.name).toBe('Source (copy)');
  expect(loadPlans().length).toBe(2);
});

test('deletePlan removes by id', () => {
  const p = savePlan(fixture());
  deletePlan(p.id);
  expect(loadPlans()).toEqual([]);
});

test('loadPlans recovers from corrupted JSON', () => {
  localStorage.setItem(STORAGE_KEY, '{not json');
  expect(loadPlans()).toEqual([]);
});

test('storageUsageRatio returns a 0..1 number', () => {
  savePlan(fixture());
  const r = storageUsageRatio();
  expect(typeof r).toBe('number');
  expect(r).toBeGreaterThanOrEqual(0);
  expect(r).toBeLessThanOrEqual(1);
});
