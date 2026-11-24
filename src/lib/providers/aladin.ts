import { normalizeIsbn13 } from '../ean13';
import type { Book } from '../types';
import { fetchJson, PAGE_SIZE, type BookProvider } from './types';

/** Aladin Open API (TTB). Env: ALADIN_TTB_KEY. https://blog.aladin.co.kr/openapi */
const BASE = 'https://www.aladin.co.kr/ttb/api';

export interface AladinItem {
  itemId?: number;
  title?: string;
  author?: string;
  publisher?: string;
  pubDate?: string;
  description?: string;
  isbn?: string;
  isbn13?: string;
  cover?: string;
}

interface AladinResponse {
  totalResults?: number;
  item?: AladinItem[];
  errorCode?: number;
  errorMessage?: string;
}

/** Aladin cover URLs carry the size in the path (coversum, cover200, ...); cover500 is the largest. */
export const largeAladinCover = (url: string) => url.replace(/\/(coversum|cover\d+)\//, '/cover500/');

export function mapAladinItem(it: AladinItem): Book | null {
  const isbn = normalizeIsbn13(it.isbn13) ?? normalizeIsbn13(it.isbn) ?? '';
  if (!it.title) return null;
  const thumb = (it.cover ?? '').replace(/^http:/, 'https:');
  return {
    id: `aladin:${isbn || it.itemId}`,
    isbn,
    title: it.title,
    author: it.author ?? '',
    publisher: it.publisher ?? '',
    pubDate: it.pubDate,
    description: it.description,
    coverUrl: thumb ? largeAladinCover(thumb) : '',
    thumbUrl: thumb,
    source: 'aladin',
  };
}

const key = () => (process.env.ALADIN_TTB_KEY ?? '').trim();

export const aladin: BookProvider = {
  id: 'aladin',
  configured: () => Boolean(key()),
  async search(query, page) {
    const u = new URL(`${BASE}/ItemSearch.aspx`);
    u.search = new URLSearchParams({
      ttbkey: key(),
      Query: query,
      QueryType: 'Keyword',
      SearchTarget: 'Book',
      MaxResults: String(PAGE_SIZE),
      start: String(page),
      Cover: 'Big',
      output: 'js',
      Version: '20131101',
    }).toString();
    const data = await fetchJson<AladinResponse>('aladin', u.toString());
    if (data.errorCode) throw new Error(`[aladin] ${data.errorMessage ?? data.errorCode}`);
    const items = (data.item ?? []).map(mapAladinItem).filter((b): b is Book => b !== null);
    const total = data.totalResults ?? items.length;
    return { provider: 'aladin', items, page, total, hasMore: page * PAGE_SIZE < total };
  },
  async lookup(isbn) {
    const u = new URL(`${BASE}/ItemLookUp.aspx`);
    u.search = new URLSearchParams({
      ttbkey: key(),
      itemIdType: 'ISBN13',
      ItemId: isbn,
      Cover: 'Big',
      output: 'js',
      Version: '20131101',
    }).toString();
    const data = await fetchJson<AladinResponse>('aladin', u.toString());
    const first = data.item?.[0];
    return first ? mapAladinItem(first) : null;
  },
};
