import { SCHEMES, getScheme, PURCHASE_SCHEME_IDS } from './registry';

test('registry lists the three new purchase schemes', () => {
  expect(PURCHASE_SCHEME_IDS).toEqual(['alat', 'it', 'cbt']);
});

test('getScheme returns descriptor by id', () => {
  expect(getScheme('alat').label).toMatch(/ALAT/);
  expect(getScheme('it').code).toBe('IT');
  expect(getScheme('cbt').group).toBe('Facilities & Equipment Schemes');
});

test('getScheme returns undefined for unknown id', () => {
  expect(getScheme('nope')).toBeUndefined();
});
