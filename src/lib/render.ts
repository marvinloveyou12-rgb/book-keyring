// Browser-only canvas rendering of faces and joined cells.
import { ean13Bits, normalizeIsbn13 } from './ean13';
import { cellRegions, effectiveBleed, faceSize } from './layout';
import type { BackTemplate, Book, FaceImage, PrintItem, PrintSettings } from './types';
import { pxPerMm } from './units';

export const FONT_STACK = `"Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif`;

export function proxify(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const url = proxify(src);
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
      img.src = url;
    });
    p.catch(() => imageCache.delete(url));
    imageCache.set(url, p);
  }
  return p;
}

/** Tries each source in turn (e.g. large cover, then thumbnail). */
export async function loadFirst(srcs: (string | undefined)[]): Promise<HTMLImageElement> {
  let last: unknown = new Error('이미지가 없습니다.');
  for (const s of srcs) {
    if (!s) continue;
    try {
      return await loadImage(s);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

function newCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Average colour of an image, darkened slightly so light text stays readable. */
export function dominantColor(img: HTMLImageElement): string {
  const c = newCanvas(16, 16);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 16, 16);
  const d = ctx.getImageData(0, 0, 16, 16).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  const k = 0.85;
  const hex = (v: number) => Math.round((v / n) * k).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function textColorFor(bg: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(bg);
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}

/**
 * Canvas pixels per image pixel for a placement (also drives the effective-dpi warning).
 * fill: cover the whole bleed area so a slightly-off cut never shows white.
 * fit: fit inside the trim box.
 */
function placementScale(img: HTMLImageElement, face: FaceImage, trim: Rect, full: Rect) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = face.fit === 'fill' ? Math.max(full.w / iw, full.h / ih) : Math.min(trim.w / iw, trim.h / ih);
  return { s: base * face.zoom, iw, ih };
}

/**
 * In fill mode the offset is clamped so the image always covers the trim box
 * (no blank strip inside the cut line). Returns the scale and the offsets actually used.
 */
function drawPlaced(ctx: CanvasRenderingContext2D, img: HTMLImageElement, face: FaceImage, trim: Rect, full: Rect) {
  const { s, iw, ih } = placementScale(img, face, trim, full);
  const dw = iw * s;
  const dh = ih * s;
  let { offX, offY } = face;
  if (face.fit === 'fill') {
    // Bleed is symmetric, so trim and full share a centre: keep the image over the full area.
    const mx = Math.max(0, (dw - full.w) / 2 / trim.w);
    const my = Math.max(0, (dh - full.h) / 2 / trim.h);
    offX = Math.max(-mx, Math.min(mx, offX));
    offY = Math.max(-my, Math.min(my, offY));
  }
  const cx = trim.x + trim.w / 2 + offX * trim.w;
  const cy = trim.y + trim.h / 2 + offY * trim.h;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  return { s, offX, offY };
}

interface Rect { x: number; y: number; w: number; h: number }

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  let line = '';
  const push = (l: string) => lines.push(l);
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxW) {
      line = candidate;
      continue;
    }
    if (line) push(line);
    line = '';
    // A word wider than the line (common in Korean without spaces): break by character.
    let chunk = '';
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxW && chunk) {
        push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    line = chunk;
  }
  if (line) push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

function drawBarcode(ctx: CanvasRenderingContext2D, isbn: string, x: number, y: number, w: number, h: number, k: number) {
  const bits = ean13Bits(isbn);
  const quiet = 4; // modules of white on each side
  const module = w / (bits.length + quiet * 2);
  const digitsH = 1.6 * k;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#000000';
  const barTop = y + 0.6 * k;
  const barH = h - digitsH - 1.0 * k;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') ctx.fillRect(x + (quiet + i) * module, barTop, Math.ceil(module), barH);
  }
  ctx.font = `${1.5 * k}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(isbn, x + w / 2, y + h - 0.4 * k);
}

function drawBackTemplate(ctx: CanvasRenderingContext2D, book: Book, tpl: BackTemplate, full: Rect, trim: Rect, k: number) {
  ctx.fillStyle = tpl.bg;
  ctx.fillRect(full.x, full.y, full.w, full.h);
  const pad = 2.5 * k;
  const innerW = trim.w - pad * 2;
  let y = trim.y + pad;
  ctx.fillStyle = tpl.fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const titleSize = 2.8 * k;
  ctx.font = `700 ${titleSize}px ${FONT_STACK}`;
  for (const l of wrapLines(ctx, book.title, innerW, 3)) {
    ctx.fillText(l, trim.x + pad, y);
    y += titleSize * 1.25;
  }
  y += 0.8 * k;

  const metaSize = 1.8 * k;
  ctx.globalAlpha = 0.85;
  ctx.font = `${metaSize}px ${FONT_STACK}`;
  for (const l of [...wrapLines(ctx, book.author, innerW, 2), ...wrapLines(ctx, book.publisher, innerW, 1)]) {
    ctx.fillText(l, trim.x + pad, y);
    y += metaSize * 1.35;
  }
  ctx.globalAlpha = 1;

  y += 1.0 * k;
  ctx.fillRect(trim.x + pad, y, Math.min(innerW, 8 * k), Math.max(1, 0.25 * k));
  y += 1.5 * k;

  const isbn = tpl.barcode ? normalizeIsbn13(book.isbn) : null;
  const barH = 9 * k;
  const bottomLimit = trim.y + trim.h - pad - (isbn ? barH + 1 * k : 0);
  const blurbSize = 1.7 * k;
  const lh = blurbSize * 1.45;
  const maxLines = Math.floor((bottomLimit - y) / lh);
  if (tpl.blurb.trim() && maxLines > 0) {
    ctx.font = `${blurbSize}px ${FONT_STACK}`;
    for (const l of wrapLines(ctx, tpl.blurb, innerW, maxLines)) {
      ctx.fillText(l, trim.x + pad, y);
      y += lh;
    }
  }

  if (isbn) {
    const bw = Math.min(innerW, 20 * k);
    drawBarcode(ctx, isbn, trim.x + trim.w - pad - bw, trim.y + trim.h - pad - barH, bw, barH, k);
  }
}

export interface FaceRender {
  canvas: HTMLCanvasElement;
  /** Effective resolution of the placed image, or null for the generated template. */
  effDpi: number | null;
  /** Offsets actually drawn (after fill-mode clamping), or null when no image was placed. */
  applied: { offX: number; offY: number } | null;
}

/** One face, trim size plus bleed on every side, at `dpi`. */
export async function renderFace(item: PrintItem, which: 'front' | 'back', s: PrintSettings, dpi: number): Promise<FaceRender> {
  const f = faceSize(s);
  const b = effectiveBleed(s);
  const k = pxPerMm(dpi);
  const canvas = newCanvas((f.w + 2 * b) * k, (f.h + 2 * b) * k);
  const ctx = canvas.getContext('2d')!;
  const full = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const trim = { x: b * k, y: b * k, w: f.w * k, h: f.h * k };

  if (which === 'back' && item.back.mode === 'template') {
    drawBackTemplate(ctx, item.book, item.back.template, full, trim, k);
    return { canvas, effDpi: null, applied: null };
  }

  const face = which === 'front' ? item.front : item.back.image;
  ctx.fillStyle = face.bg;
  ctx.fillRect(0, 0, full.w, full.h);
  if (!face.src) return { canvas, effDpi: null, applied: null };
  const img = await loadFirst(which === 'front' ? [face.src, item.book.thumbUrl] : [face.src]);
  const { s: scale, offX, offY } = drawPlaced(ctx, img, face, trim, full);
  return { canvas, effDpi: dpi / scale, applied: { offX, offY } };
}

function rotate180(src: HTMLCanvasElement) {
  const c = newCanvas(src.width, src.height);
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, c.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(src, 0, 0);
  return c;
}

type PerFace<T> = { front: T; back: T };

export interface CellRender {
  canvas: HTMLCanvasElement;
  effDpi: PerFace<number | null>;
  applied: PerFace<FaceRender['applied']>;
}

/**
 * A joined front+back cell (side or stack mode): trim + bleed on the outer edges, no bleed at the fold.
 * side:  [ back | front ] — folding along the vertical centre keeps both upright.
 * stack: back is rotated 180° above front, so it reads upright once folded over the top edge.
 */
export async function renderCell(item: PrintItem, s: PrintSettings, dpi: number): Promise<CellRender> {
  if (s.join === 'separate') throw new Error('renderCell is for joined modes; use renderFace in separate mode.');
  const [front, back] = await Promise.all([renderFace(item, 'front', s, dpi), renderFace(item, 'back', s, dpi)]);
  const f = faceSize(s);
  const b = effectiveBleed(s);
  const k = pxPerMm(dpi);
  const { W, H } = cellRegions(s);
  const canvas = newCanvas(W * k, H * k);
  const ctx = canvas.getContext('2d')!;
  const px = (mm: number) => Math.round(mm * k);

  if (s.join === 'side') {
    const fw = front.canvas.width;
    const keepBack = px(b + f.w);
    ctx.drawImage(back.canvas, 0, 0, keepBack, back.canvas.height, 0, 0, keepBack, back.canvas.height);
    const cut = px(b);
    ctx.drawImage(front.canvas, cut, 0, fw - cut, front.canvas.height, keepBack, 0, fw - cut, front.canvas.height);
  } else {
    const r = rotate180(back.canvas);
    const keepBack = px(b + f.h);
    ctx.drawImage(r, 0, 0, r.width, keepBack, 0, 0, r.width, keepBack);
    const fh = front.canvas.height;
    const cut = px(b);
    ctx.drawImage(front.canvas, 0, cut, front.canvas.width, fh - cut, 0, keepBack, front.canvas.width, fh - cut);
  }
  return { canvas, effDpi: { front: front.effDpi, back: back.effDpi }, applied: { front: front.applied, back: back.applied } };
}

export function canvasToJpeg(c: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error('이미지 변환 실패'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** Downscales an uploaded file to at most `maxSide` px and returns a JPEG data URL (keeps localStorage small). */
export async function fileToDataUrl(file: File, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = newCanvas(img.naturalWidth * scale, img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}
