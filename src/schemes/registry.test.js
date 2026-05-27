import { getScheme, PURCHASE_SCHEME_IDS } from './registry';

test('registry lists the registered schemes', () => {
  expect(PURCHASE_SCHEME_IDS).toEqual(['alat', 'it']);
});

test('getScheme returns descriptor by id', () => {
  expect(getScheme('alat').label).toMatch(/ALAT/);
  expect(getScheme('it').code).toBe('IT');
});

test('getScheme returns undefined for unknown / removed id', () => {
  expect(getScheme('cbt')).toBeUndefined();
  expect(getScheme('nope')).toBeUndefined();
});
