import {
  isValidVinFormat,
  normalizeVin,
  validateVinCheckDigit,
} from './vin.util';

describe('vin.util', () => {
  it('normalizes VIN', () => {
    expect(normalizeVin(' 1hgcm82633a004352 ')).toBe('1HGCM82633A004352');
  });

  it('validates format', () => {
    expect(isValidVinFormat('1HGCM82633A004352')).toBe(true);
    expect(isValidVinFormat('1HGCM82633A00435')).toBe(false);
    expect(isValidVinFormat('1HGCM82633I004352')).toBe(false);
  });

  it('validates check digit for known VIN', () => {
    expect(validateVinCheckDigit('1HGCM82633A004352')).toBe(true);
  });
});
