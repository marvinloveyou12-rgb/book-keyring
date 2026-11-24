// EAN-13 (ISBN-13) barcode encoding.

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => c.replace(/./g, (b) => (b === '0' ? '1' : '0')));
const G = R.map((c) => c.split('').reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

function validIsbn10(d: string) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = d[i];
    const v = c === 'X' || c === 'x' ? 10 : Number(c);
    if (Number.isNaN(v) || (v === 10 && i !== 9)) return false;
    sum += (10 - i) * v;
  }
  return sum % 11 === 0;
}

/** Returns a valid ISBN-13/EAN-13 string, converting ISBN-10, or null. */
export function normalizeIsbn13(raw: string | undefined | null): string | null {
  if (!raw) return null;
  // Providers sometimes return "ISBN10 ISBN13" in one field.
  const candidates = raw.split(/[\s,]+/).map((p) => p.replace(/[^0-9Xx]/g, ''));
  for (const d of candidates) {
    if (/^\d{13}$/.test(d) && ean13CheckDigit(d) === Number(d[12])) return d;
  }
  for (const d of candidates) {
    if (/^\d{9}[\dXx]$/.test(d) && validIsbn10(d)) {
      const base = '978' + d.slice(0, 9);
      return base + ean13CheckDigit(base);
    }
  }
  return null;
}

/** 95 module bits ("1" = bar) for a valid 13-digit code. */
export function ean13Bits(code: string): string {
  if (!/^\d{13}$/.test(code) || ean13CheckDigit(code) !== Number(code[12])) {
    throw new Error(`Invalid EAN-13: ${code}`);
  }
  const parity = PARITY[Number(code[0])];
  let bits = '101';
  for (let i = 0; i < 6; i++) {
    const d = Number(code[i + 1]);
    bits += parity[i] === 'L' ? L[d] : G[d];
  }
  bits += '01010';
  for (let i = 7; i < 13; i++) bits += R[Number(code[i])];
  return bits + '101';
}
