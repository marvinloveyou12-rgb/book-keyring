import { normalizeIsbn13 } from '../ean13';
import type { Book } from '../types';
import { fetchJson, PAGE_SIZE, type BookProvider } from './types';

/** Google Books. Works without a key (low quota); env GOOGLE_BOOKS_API_KEY raises it. Covers are small. */
const BASE = 'https://www.googleapis.com/books/v1/volumes';

export interface GoogleVolume {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: { type?: string; identifier?: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

interface GoogleResponse {
  totalItems?: number;
  items?: GoogleVolume[];
}

export function mapGoogleVolume(v: GoogleVolume): Book | null {
  const info = v.volumeInfo;
  if (!info?.title) return null;
  const ids = info.industryIdentifiers ?? [];
  const isbn =
    normalizeIsbn13(ids.find((i) => i.type === 'ISBN_13')?.identifier) ??
    normalizeIsbn13(ids.find((i) => i.type === 'ISBN_10')?.identifier) ??
    '';
  const thumb = (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? '')
    .replace(/^http:/, 'https:')
    .replace('&edge=curl', '');
  return {
    id: `google:${isbn || v.id}`,
    isbn,
    title: info.subtitle ? `${info.title} - ${info.subtitle}` : info.title,
    author: (info.authors ?? []).join(', '),
    publisher: info.publisher ?? '',
    pubDate: info.publishedDate,
    description: info.description,
    coverUrl: thumb,
    thumbUrl: thumb,
    source: 'google',
  };
}

async function query(q: string, start: number, max: number) {
  const u = new URL(BASE);
  const p = new URLSearchParams({ q, startIndex: String(start), maxResults: String(max) });
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (key) p.set('key', key);
  u.search = p.toString();
  return fetchJson<GoogleResponse>('google', u.toString());
}

export const google: BookProvider = {
  id: 'google',
  configured: () => process.env.GOOGLE_BOOKS_DISABLED !== '1',
  async search(q, page) {
    const data = await query(q, (page - 1) * PAGE_SIZE, PAGE_SIZE);
    const items = (data.items ?? []).map(mapGoogleVolume).filter((b): b is Book => b !== null);
    const total = data.totalItems ?? items.length;
    return { provider: 'google', items, page, total, hasMore: page * PAGE_SIZE < total };
  },
  async lookup(isbn) {
    const data = await query(`isbn:${isbn}`, 0, 1);
    const first = data.items?.[0];
    return first ? mapGoogleVolume(first) : null;
  },
};
