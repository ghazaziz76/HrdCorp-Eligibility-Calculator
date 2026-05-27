import { getScheme, PURCHASE_SCHEME_IDS } from './registry';

test('registry lists the registered schemes', () => {
  expect(PURCHASE_SCHEME_IDS).toEqual(['alat', 'it', 'its', 'sgm', 'fwt']);
});

test('getScheme returns descriptor by id', () => {
  expect(getScheme('alat').label).toMatch(/ALAT/);
  expect(getScheme('it').code).toBe('IT');
  expect(getScheme('its').code).toBe('ITS');
  expect(getScheme('sgm').code).toBe('SGM');
  expect(getScheme('fwt').code).toBe('FWT');
});

test('getScheme returns undefined for unknown / removed id', () => {
  expect(getScheme('cbt')).toBeUndefined();
  expect(getScheme('nope')).toBeUndefined();
});
