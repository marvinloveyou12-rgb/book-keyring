import { describe, expect, it } from 'vitest';
import { cellRegions, cellSize, computeLayout, countCells, DEFAULT_SETTINGS, effectiveBleed, faceSize, sanitizeSettings, slotRect } from '@/lib/layout';
import type { PrintSettings } from '@/lib/types';
import { mmToPt } from '@/lib/units';

const s = (patch: Partial<PrintSettings> = {}): PrintSettings => ({ ...DEFAULT_SETTINGS, ...patch });

describe('units', () => {
  it('converts mm to points', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72);
    expect(mmToPt(1)).toBeCloseTo(2.8346, 4);
  });
});

describe('sizes', () => {
  it('subtracts slack from the inner size', () => {
    expect(faceSize(s())).toEqual({ w: 30.5, h: 44.5 });
    expect(faceSize(s({ slack: 0 }))).toEqual({ w: 31, h: 45 });
  });

  it('joins faces per mode', () => {
    expect(cellSize(s({ join: 'side' }))).toEqual({ w: 61, h: 44.5 });
    expect(cellSize(s({ join: 'stack' }))).toEqual({ w: 30.5, h: 89 });
    expect(cellSize(s({ join: 'separate' }))).toEqual({ w: 30.5, h: 44.5 });
  });

  it('caps bleed at half the gap so cells never overlap', () => {
    expect(effectiveBleed(s({ bleed: 1, gap: 2 }))).toBe(1);
    expect(effectiveBleed(s({ bleed: 1, gap: 0 }))).toBe(0);
    expect(effectiveBleed(s({ bleed: 2, gap: 1 }))).toBe(0.5);
  });
});

describe('computeLayout', () => {
  it('fits 15 joined sets on A4 by default (PRD 출력 사양)', () => {
    const l = computeLayout(s());
    expect([l.cols, l.rows, l.perPage]).toEqual([3, 5, 15]);
  });

  it('fits 18 sets with no gap, no bleed and no ruler (shared cut lines)', () => {
    const l = computeLayout(s({ gap: 0, bleed: 0, testRuler: false, slack: 0 }));
    expect([l.cols, l.rows]).toEqual([3, 6]);
  });

  it('keeps every cell, with bleed, inside the page margins', () => {
    for (const join of ['side', 'stack', 'separate'] as const) {
      const set = s({ join });
      const l = computeLayout(set);
      const last = slotRect(l, l.perPage - 1);
      expect(slotRect(l, 0).x - l.bleed).toBeGreaterThanOrEqual(set.margin - 1e-9);
      expect(slotRect(l, 0).y - l.bleed).toBeGreaterThanOrEqual(set.margin - 1e-9);
      expect(last.x + last.w + l.bleed).toBeLessThanOrEqual(l.paperW - set.margin + 1e-9);
      expect(last.y + last.h + l.bleed).toBeLessThanOrEqual(l.paperH - set.margin - 14 + 1e-9);
    }
  });

  it('centres the grid horizontally', () => {
    const l = computeLayout(s());
    const last = slotRect(l, l.cols - 1);
    expect(l.originX - 10).toBeCloseTo(l.paperW - 10 - (last.x + last.w));
  });

  it('re-flows when the size changes', () => {
    const l = computeLayout(s({ innerW: 45, innerH: 31 }));
    expect(l.cellW).toBe(89);
    expect(l.cols).toBe(2);
  });

  it('reports zero when nothing fits', () => {
    expect(computeLayout(s({ innerW: 150, innerH: 150, paper: '4x6' })).perPage).toBe(0);
  });

  it('counts pages, doubling cells in separate mode', () => {
    expect(countCells([10, 6], s())).toEqual({ sets: 16, cells: 16, pages: 2 });
    expect(countCells([10, 6], s({ join: 'separate' })).cells).toBe(32);
  });
});

describe('cellRegions', () => {
  it('puts back on the left and front on the right in side mode', () => {
    const { W, H, regions } = cellRegions(s());
    expect(W).toBe(63);
    expect(H).toBe(46.5);
    expect(regions.map((r) => [r.which, r.x])).toEqual([
      ['back', 1],
      ['front', 31.5],
    ]);
  });

  it('rotates the back face above the front in stack mode', () => {
    const { regions } = cellRegions(s({ join: 'stack' }));
    expect(regions[0]).toMatchObject({ which: 'back', rotated: true, y: 1 });
    expect(regions[1]).toMatchObject({ which: 'front', rotated: false, y: 45.5 });
  });
});

describe('sanitizeSettings', () => {
  it('clamps and fills bad input', () => {
    const r = sanitizeSettings({ innerW: 1000, innerH: -3, paper: 'B9' as never, dpi: Number.NaN, join: 'x' as never });
    expect(r.innerW).toBe(150);
    expect(r.innerH).toBe(10);
    expect(r.paper).toBe('A4');
    expect(r.dpi).toBe(300);
    expect(r.join).toBe('side');
  });

  it('snaps size to 0.5mm', () => {
    expect(sanitizeSettings({ innerW: 31.26 }).innerW).toBe(31.5);
  });
});
