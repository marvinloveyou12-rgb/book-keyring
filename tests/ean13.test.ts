import { describe, expect, it } from 'vitest';
import { ean13Bits, ean13CheckDigit, normalizeIsbn13 } from '@/lib/ean13';

describe('ISBN', () => {
  it('computes the check digit', () => {
    expect(ean13CheckDigit('978030640615')).toBe(7);
  });

  it('accepts ISBN-13 and converts ISBN-10', () => {
    expect(normalizeIsbn13('978-0-306-40615-7')).toBe('9780306406157');
    expect(normalizeIsbn13('0306406152')).toBe('9780306406157');
    expect(normalizeIsbn13('080442957X')).toBe('9780804429573');
  });

  it('picks the 13-digit code from a combined Kakao-style field', () => {
    expect(normalizeIsbn13('0306406152 9780306406157')).toBe('9780306406157');
  });

  it('rejects bad codes', () => {
    expect(normalizeIsbn13('9780306406158')).toBeNull();
    expect(normalizeIsbn13('')).toBeNull();
    expect(normalizeIsbn13(undefined)).toBeNull();
  });
});

describe('EAN-13 bars', () => {
  it('encodes 95 modules with guard bars', () => {
    const bits = ean13Bits('9780306406157');
    expect(bits).toHaveLength(95);
    expect(bits.startsWith('101')).toBe(true);
    expect(bits.slice(45, 50)).toBe('01010');
    expect(bits.endsWith('101')).toBe(true);
  });

  it('encodes 4006381333931 per the standard tables', () => {
    // First digit 4 → parity LGLLGG for digits 0 0 6 3 8 1; right half 3 3 3 9 3 1 uses R codes.
    const expected = [
      '101',
      '0001101', // 0 L
      '0100111', // 0 G
      '0101111', // 6 L
      '0111101', // 3 L
      '0001001', // 8 G
      '0110011', // 1 G
      '01010',
      '1000010', // 3 R
      '1000010', // 3 R
      '1000010', // 3 R
      '1110100', // 9 R
      '1000010', // 3 R
      '1100110', // 1 R
      '101',
    ].join('');
    expect(expected).toHaveLength(95);
    expect(ean13Bits('4006381333931')).toBe(expected);
  });

  it('throws on an invalid code', () => {
    expect(() => ean13Bits('1234567890123')).toThrow();
  });
});
