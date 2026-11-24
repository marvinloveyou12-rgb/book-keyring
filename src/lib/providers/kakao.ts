import { normalizeIsbn13 } from '../ean13';
import type { Book } from '../types';
import { fetchJson, PAGE_SIZE, type BookProvider } from './types';

/** Kakao book search (Daum). Env: KAKAO_REST_KEY. https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide#search-book */
const BASE = 'https://dapi.kakao.com/v3/search/book';

export interface KakaoDoc {
  title?: string;
  contents?: string;
  isbn?: string;
  datetime?: string;
  authors?: string[];
  translators?: string[];
  publisher?: string;
  thumbnail?: string;
}

interface KakaoResponse {
  meta?: { total_count?: number; is_end?: boolean };
  documents?: KakaoDoc[];
}

/** Kakao thumbnails are 120×174 resizes; the original image is in the `fname` query parameter. */
export function kakaoOriginal(thumb: string): string {
  try {
    const fname = new URL(thumb).searchParams.get('fname');
    if (fname && /^https?:\/\//.test(fname)) return fname.replace(/^http:/, 'https:');
  } catch {
    /* not a URL */
  }
  return thumb;
}

export function mapKakaoDoc(d: KakaoDoc): Book | null {
  if (!d.title) return null;
  const isbn = normalizeIsbn13(d.isbn) ?? '';
  const thumb = d.thumbnail ?? '';
  const authors = [...(d.authors ?? []), ...(d.translators ?? []).map((t) => `${t} (옮긴이)`)];
  return {
    id: `kakao:${isbn || d.title}`,
    isbn,
    title: d.title,
    author: authors.join(', '),
    publisher: d.publisher ?? '',
    pubDate: d.datetime?.slice(0, 10),
    description: d.contents,
    coverUrl: thumb ? kakaoOriginal(thumb) : '',
    thumbUrl: thumb,
    source: 'kakao',
  };
}

const key = () => (process.env.KAKAO_REST_KEY ?? '').trim().replace(/^KakaoAK\s+/i, '');

async function query(params: Record<string, string>) {
  const u = new URL(BASE);
  u.search = new URLSearchParams(params).toString();
  return fetchJson<KakaoResponse>('kakao', u.toString(), { headers: { Authorization: `KakaoAK ${key()}` } });
}

export const kakao: BookProvider = {
  id: 'kakao',
  configured: () => Boolean(key()),
  async search(q, page) {
    const data = await query({ query: q, page: String(page), size: String(PAGE_SIZE) });
    const items = (data.documents ?? []).map(mapKakaoDoc).filter((b): b is Book => b !== null);
    return { provider: 'kakao', items, page, total: data.meta?.total_count, hasMore: data.meta?.is_end === false };
  },
  async lookup(isbn) {
    const data = await query({ query: isbn, target: 'isbn', size: '1' });
    const first = data.documents?.[0];
    return first ? mapKakaoDoc(first) : null;
  },
};
