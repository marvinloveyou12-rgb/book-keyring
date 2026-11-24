import { PDFDocument, PDFImage, rgb, StandardFonts } from 'pdf-lib';
import { computeLayout, foldLine, slotRect } from './layout';
import type { PrintSettings } from './types';
import { mmToPt } from './units';

export interface PdfInput {
  /** Cell images keyed by id; each covers the cell's trim box plus bleed on every side. JPEG or PNG bytes. */
  images: Record<string, Uint8Array>;
  /** Image key per printed cell, in print order. */
  slots: string[];
  settings: PrintSettings;
  title?: string;
}

const MARK_LEN = 3; // mm
const MARK_GAP = 1; // mm between the bleed edge and a crop mark
const MARK_COLOR = rgb(0, 0, 0);
const GUIDE_COLOR = rgb(0.55, 0.55, 0.55);

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8;

export async function buildPdf({ images, slots, settings: s, title }: PdfInput): Promise<Uint8Array> {
  const l = computeLayout(s);
  if (l.perPage === 0) throw new Error('현재 사이즈·여백으로는 용지에 한 개도 들어가지 않습니다.');
  if (slots.length === 0) throw new Error('인쇄할 항목이 없습니다.');

  const doc = await PDFDocument.create();
  doc.setTitle(title ?? 'Book keyring covers');
  doc.setCreator('book-keyring');
  doc.setProducer('book-keyring (pdf-lib)');

  const embedded = new Map<string, PDFImage>();
  for (const [key, bytes] of Object.entries(images)) {
    embedded.set(key, isJpeg(bytes) ? await doc.embedJpg(bytes) : await doc.embedPng(bytes));
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const b = l.bleed;
  const fold = foldLine(s);
  const pageCount = Math.ceil(slots.length / l.perPage);

  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([mmToPt(l.paperW), mmToPt(l.paperH)]);
    // Page coordinates are mm from the top-left; PDF is points from the bottom-left.
    const X = (mm: number) => mmToPt(mm);
    const Y = (mm: number) => mmToPt(l.paperH - mm);
    const line = (x1: number, y1: number, x2: number, y2: number, opts: { dashed?: boolean; color?: typeof MARK_COLOR; width?: number } = {}) =>
      page.drawLine({
        start: { x: X(x1), y: Y(y1) },
        end: { x: X(x2), y: Y(y2) },
        thickness: opts.width ?? 0.25,
        color: opts.color ?? MARK_COLOR,
        dashArray: opts.dashed ? [2, 2] : undefined,
      });

    const pageSlots = slots.slice(p * l.perPage, (p + 1) * l.perPage);
    pageSlots.forEach((key, i) => {
      const img = embedded.get(key);
      if (!img) throw new Error(`Missing image for slot "${key}"`);
      const r = slotRect(l, i);
      page.drawImage(img, { x: X(r.x - b), y: Y(r.y + r.h + b), width: X(r.w + 2 * b), height: X(r.h + 2 * b) });
    });

    if (s.trimOutline) {
      pageSlots.forEach((_, i) => {
        const r = slotRect(l, i);
        page.drawRectangle({ x: X(r.x), y: Y(r.y + r.h), width: X(r.w), height: X(r.h), borderColor: GUIDE_COLOR, borderWidth: 0.2 });
        if (fold) line(r.x + fold.x1, r.y + fold.y1, r.x + fold.x2, r.y + fold.y2, { dashed: true, color: GUIDE_COLOR, width: 0.2 });
      });
    }

    if (s.cropMarks) {
      const used = pageSlots.length;
      const colsUsed = Math.min(l.cols, used);
      const rowsUsed = Math.ceil(used / l.cols);
      const left = l.originX;
      const right = l.originX + colsUsed * l.cellW + (colsUsed - 1) * l.gap;
      const top = l.originY;
      const bottom = l.originY + rowsUsed * l.cellH + (rowsUsed - 1) * l.gap;
      const off = b + MARK_GAP;
      const lenTop = Math.min(MARK_LEN, top - off);
      const lenLeft = Math.min(MARK_LEN, left - off);
      const lenRight = Math.min(MARK_LEN, l.paperW - right - off);
      const lenBottom = Math.min(MARK_LEN, (l.rulerY ?? l.paperH) - 2 - bottom - off);

      const xs = new Set<number>();
      const foldXs = new Set<number>();
      for (let c = 0; c < colsUsed; c++) {
        const x = l.originX + c * (l.cellW + l.gap);
        xs.add(x).add(x + l.cellW);
        if (fold && s.join === 'side') foldXs.add(x + fold.x1);
      }
      const ys = new Set<number>();
      const foldYs = new Set<number>();
      for (let r = 0; r < rowsUsed; r++) {
        const y = l.originY + r * (l.cellH + l.gap);
        ys.add(y).add(y + l.cellH);
        if (fold && s.join === 'stack') foldYs.add(y + fold.y1);
      }
      const vMarks = (set: Set<number>, dashed: boolean) => {
        for (const x of set) {
          if (lenTop > 0.5) line(x, top - off, x, top - off - lenTop, { dashed });
          if (lenBottom > 0.5) line(x, bottom + off, x, bottom + off + lenBottom, { dashed });
        }
      };
      const hMarks = (set: Set<number>, dashed: boolean) => {
        for (const y of set) {
          if (lenLeft > 0.5) line(left - off, y, left - off - lenLeft, y, { dashed });
          if (lenRight > 0.5) line(right + off, y, right + off + lenRight, y, { dashed });
        }
      };
      vMarks(xs, false);
      hMarks(ys, false);
      vMarks(foldXs, true);
      hMarks(foldYs, true);
    }

    if (p === 0 && l.rulerY !== null) {
      const x0 = s.margin;
      const y = l.rulerY;
      line(x0, y, x0 + 50, y, { width: 0.4 });
      for (let t = 0; t <= 50; t += 5) line(x0 + t, y, x0 + t, y - (t % 10 === 0 ? 2.5 : 1.5), { width: 0.3 });
      page.drawText('50 mm  -  print at "Actual size / 100%". If this line is not 50 mm, check printer scaling.', {
        x: X(x0 + 53),
        y: Y(y) ,
        size: 6,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  return doc.save();
}
