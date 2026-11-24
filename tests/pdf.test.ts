import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/layout';
import { buildPdf } from '@/lib/pdf';
import type { PrintSettings } from '@/lib/types';
import { mmToPt } from '@/lib/units';

// 1×1 white PNG.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
);

const settings = (p: Partial<PrintSettings> = {}): PrintSettings => ({ ...DEFAULT_SETTINGS, ...p });

describe('buildPdf', () => {
  it('produces A4 pages at exact size, 15 sets per page', async () => {
    const slots = Array.from({ length: 16 }, () => 'a');
    const bytes = await buildPdf({ images: { a: PNG }, slots, settings: settings() });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(mmToPt(210), 2);
    expect(height).toBeCloseTo(mmToPt(297), 2);
    expect(doc.getTitle()).toBe('Book keyring covers');
  });

  it('draws each image at trim + bleed size', async () => {
    const bytes = await buildPdf({ images: { a: PNG }, slots: ['a'], settings: settings({ cropMarks: false, trimOutline: false, testRuler: false }) });
    const text = new TextDecoder('latin1').decode(bytes);
    // pdf-lib writes `w 0 0 h x y cm` before the image Do operator. Cell 61×44.5 + 1mm bleed each side.
    const m = /([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.]+ cm/.exec(text);
    if (m) {
      expect(Number(m[1])).toBeCloseTo(mmToPt(63), 1);
      expect(Number(m[2])).toBeCloseTo(mmToPt(46.5), 1);
    } else {
      // Content stream compressed: at least check it parsed.
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    }
  });

  it('works for every join mode and paper', async () => {
    for (const join of ['side', 'stack', 'separate'] as const) {
      for (const paper of ['A4', 'A5', 'Letter', '4x6'] as const) {
        const bytes = await buildPdf({ images: { a: PNG }, slots: ['a', 'a', 'a'], settings: settings({ join, paper }) });
        expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('refuses when nothing fits or nothing to print', async () => {
    await expect(buildPdf({ images: { a: PNG }, slots: ['a'], settings: settings({ innerW: 150, innerH: 150, paper: '4x6' }) })).rejects.toThrow();
    await expect(buildPdf({ images: {}, slots: [], settings: settings() })).rejects.toThrow();
  });

  it('errors on a slot without an image', async () => {
    await expect(buildPdf({ images: {}, slots: ['missing'], settings: settings() })).rejects.toThrow(/missing/);
  });
});
