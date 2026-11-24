import type { JoinMode, PaperId, PrintSettings } from './types';

export const PAPERS: Record<PaperId, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: 'A4 (210×297mm)' },
  A5: { w: 148, h: 210, label: 'A5 (148×210mm)' },
  Letter: { w: 215.9, h: 279.4, label: 'Letter (216×279mm)' },
  '4x6': { w: 101.6, h: 152.4, label: '4×6인치 사진용지 (102×152mm)' },
};

export const JOIN_LABELS: Record<JoinMode, string> = {
  side: '좌우 펼침 (옆면에서 접기)',
  stack: '상하 펼침 (위에서 접기)',
  separate: '따로 자르기 (접지 않음)',
};

/** Space reserved at the bottom of every page when the test ruler is on. */
export const RULER_SPACE = 14;
export const SIZE_MIN = 10;
export const SIZE_MAX = 150;

export const DEFAULT_SETTINGS: PrintSettings = {
  innerW: 31,
  innerH: 45,
  slack: 0.5,
  bleed: 1,
  gap: 2,
  margin: 10,
  paper: 'A4',
  join: 'side',
  cropMarks: true,
  trimOutline: true,
  testRuler: true,
  dpi: 300,
};

export const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '기본 열쇠고리 3.1×4.5cm', w: 31, h: 45 },
  { label: '증명사진 3×4cm', w: 30, h: 40 },
  { label: '반명함 3.5×4.5cm', w: 35, h: 45 },
  { label: '명함 5×9cm', w: 50, h: 90 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Coerce untrusted (e.g. localStorage) settings into a valid range. */
export function sanitizeSettings(raw: Partial<PrintSettings> | null | undefined): PrintSettings {
  const d = DEFAULT_SETTINGS;
  const s = { ...d, ...(raw ?? {}) };
  const half = (v: number) => Math.round(v * 2) / 2;
  return {
    innerW: half(clamp(finite(s.innerW, d.innerW), SIZE_MIN, SIZE_MAX)),
    innerH: half(clamp(finite(s.innerH, d.innerH), SIZE_MIN, SIZE_MAX)),
    slack: clamp(finite(s.slack, d.slack), 0, 3),
    bleed: clamp(finite(s.bleed, d.bleed), 0, 3),
    gap: clamp(finite(s.gap, d.gap), 0, 20),
    margin: clamp(finite(s.margin, d.margin), 0, 30),
    paper: s.paper in PAPERS ? s.paper : d.paper,
    join: s.join in JOIN_LABELS ? s.join : d.join,
    cropMarks: Boolean(s.cropMarks),
    trimOutline: Boolean(s.trimOutline),
    testRuler: Boolean(s.testRuler),
    dpi: clamp(Math.round(finite(s.dpi, d.dpi)), 150, 600),
  };
}

/** One face of the insert, after subtracting the slack. */
export function faceSize(s: PrintSettings) {
  return { w: Math.max(5, s.innerW - s.slack), h: Math.max(5, s.innerH - s.slack) };
}

/** Bleed is capped at half the gap so neighbouring cells never overlap. */
export function effectiveBleed(s: PrintSettings) {
  return Math.max(0, Math.min(s.bleed, s.gap / 2));
}

/** Trim size of one printed cell (a joined set, or a single face in separate mode). */
export function cellSize(s: PrintSettings) {
  const f = faceSize(s);
  if (s.join === 'side') return { w: f.w * 2, h: f.h };
  if (s.join === 'stack') return { w: f.w, h: f.h * 2 };
  return f;
}

export interface Layout {
  paperW: number;
  paperH: number;
  cols: number;
  rows: number;
  perPage: number;
  cellW: number;
  cellH: number;
  gap: number;
  bleed: number;
  /** Top-left of the first cell's trim box, mm from the page's top-left. */
  originX: number;
  originY: number;
  /** Baseline of the test ruler, mm from the top; null when off. */
  rulerY: number | null;
}

/**
 * Cells per row: n·w + (n−1)·g + 2b ≤ usable width
 *   ⇒ n = ⌊(W − 2b + g) / (w + g)⌋   (same for rows)
 */
export function computeLayout(s: PrintSettings): Layout {
  const paper = PAPERS[s.paper];
  const b = effectiveBleed(s);
  const g = s.gap;
  const { w, h } = cellSize(s);
  const usableW = paper.w - 2 * s.margin;
  const usableH = paper.h - 2 * s.margin - (s.testRuler ? RULER_SPACE : 0);
  const fit = (avail: number, size: number) =>
    avail <= 0 ? 0 : Math.max(0, Math.floor((avail - 2 * b + g + 1e-9) / (size + g)));
  const cols = fit(usableW, w);
  const rows = fit(usableH, h);
  const gridW = cols * w + Math.max(0, cols - 1) * g;
  return {
    paperW: paper.w,
    paperH: paper.h,
    cols,
    rows,
    perPage: cols * rows,
    cellW: w,
    cellH: h,
    gap: g,
    bleed: b,
    originX: s.margin + (usableW - gridW) / 2,
    originY: s.margin + b,
    rulerY: s.testRuler ? paper.h - s.margin - 5 : null,
  };
}

/** Trim rectangle of the i-th cell on a page, mm from the page's top-left. */
export function slotRect(l: Layout, i: number) {
  const c = i % l.cols;
  const r = Math.floor(i / l.cols) % l.rows;
  return { x: l.originX + c * (l.cellW + l.gap), y: l.originY + r * (l.cellH + l.gap), w: l.cellW, h: l.cellH };
}

/** Fold line inside a cell, relative to its trim box, or null in separate mode. */
export function foldLine(s: PrintSettings) {
  const f = faceSize(s);
  if (s.join === 'side') return { x1: f.w, y1: 0, x2: f.w, y2: f.h };
  if (s.join === 'stack') return { x1: 0, y1: f.h, x2: f.w, y2: f.h };
  return null;
}

export interface FaceRegion {
  which: 'front' | 'back';
  /** Trim box of the face inside the cell image, mm (the image includes bleed). */
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

/** Where each face sits inside a joined cell image (which is trim + bleed on every side). */
export function cellRegions(s: PrintSettings): { W: number; H: number; regions: FaceRegion[] } {
  const f = faceSize(s);
  const b = effectiveBleed(s);
  if (s.join === 'side') {
    return {
      W: 2 * f.w + 2 * b,
      H: f.h + 2 * b,
      regions: [
        { which: 'back', x: b, y: b, w: f.w, h: f.h, rotated: false },
        { which: 'front', x: b + f.w, y: b, w: f.w, h: f.h, rotated: false },
      ],
    };
  }
  if (s.join === 'stack') {
    return {
      W: f.w + 2 * b,
      H: 2 * f.h + 2 * b,
      regions: [
        { which: 'back', x: b, y: b, w: f.w, h: f.h, rotated: true },
        { which: 'front', x: b, y: b + f.h, w: f.w, h: f.h, rotated: false },
      ],
    };
  }
  return { W: f.w + 2 * b, H: f.h + 2 * b, regions: [{ which: 'front', x: b, y: b, w: f.w, h: f.h, rotated: false }] };
}

/** Total printed cells and pages for a list of items. */
export function countCells(copies: number[], s: PrintSettings) {
  const sets = copies.reduce((a, c) => a + Math.max(0, c), 0);
  const cells = s.join === 'separate' ? sets * 2 : sets;
  const l = computeLayout(s);
  return { sets, cells, pages: l.perPage ? Math.ceil(cells / l.perPage) : 0 };
}
