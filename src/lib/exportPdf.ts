import { buildPdf } from './pdf';
import { canvasToJpeg, renderCell, renderFace } from './render';
import type { PrintItem, PrintSettings } from './types';

export async function exportPdf(items: PrintItem[], s: PrintSettings, onProgress?: (done: number, total: number) => void) {
  const images: Record<string, Uint8Array> = {};
  const slots: string[] = [];
  let done = 0;
  for (const item of items) {
    if (s.join === 'separate') {
      const [f, b] = await Promise.all([renderFace(item, 'front', s, s.dpi), renderFace(item, 'back', s, s.dpi)]);
      images[`${item.id}:f`] = await canvasToJpeg(f.canvas);
      images[`${item.id}:b`] = await canvasToJpeg(b.canvas);
      for (let c = 0; c < item.copies; c++) slots.push(`${item.id}:f`, `${item.id}:b`);
    } else {
      const cell = await renderCell(item, s, s.dpi);
      images[item.id] = await canvasToJpeg(cell.canvas);
      for (let c = 0; c < item.copies; c++) slots.push(item.id);
    }
    onProgress?.(++done, items.length);
  }
  const sets = items.reduce((a, it) => a + it.copies, 0);
  const bytes = await buildPdf({ images, slots, settings: s, title: `책표지 열쇠고리 ${sets}개` });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  // ASCII only: some browsers drop non-ASCII names in the download attribute.
  const name = `keyring-covers_${stamp}_${items.length}books_${sets}sets.pdf`;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { name, bytes: bytes.length };
}
