import type { Book, FaceImage, PrintItem } from './types';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const defaultFace = (src: string): FaceImage => ({ src, fit: 'fill', zoom: 1, offX: 0, offY: 0, bg: '#ffffff' });

const shorten = (s: string | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n).trim()}…` : t;
};

export function newItem(book: Book, colors?: { bg: string; fg: string }): PrintItem {
  return {
    id: uid(),
    book,
    copies: 1,
    front: defaultFace(book.coverUrl),
    back: {
      mode: book.backCoverUrl ? 'image' : 'template',
      image: defaultFace(book.backCoverUrl ?? ''),
      template: {
        bg: colors?.bg ?? '#334155',
        fg: colors?.fg ?? '#ffffff',
        blurb: shorten(book.description, 120),
        barcode: true,
      },
    },
  };
}

/** A blank item for "직접 업로드" (no search). */
export function blankItem(): PrintItem {
  return newItem({
    id: `upload:${uid()}`,
    isbn: '',
    title: '제목 없음',
    author: '',
    publisher: '',
    coverUrl: '',
    thumbUrl: '',
    source: 'mock',
  });
}

/** Drops anything malformed that came back from localStorage. */
export function sanitizeItems(raw: unknown): PrintItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (it): it is PrintItem =>
      it && typeof it === 'object' && typeof it.id === 'string' && it.book && typeof it.book.title === 'string' && it.front && it.back,
  ).map((it) => ({ ...it, copies: Math.min(99, Math.max(1, Math.round(Number(it.copies) || 1))) }));
}
