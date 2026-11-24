import type { Book, ProviderId, SearchResult } from '../types';
import { aladin } from './aladin';
import { google } from './google';
import { kakao } from './kakao';
import { mock } from './mock';
import type { BookProvider } from './types';
import { yes24 } from './yes24';

/** Priority order when BOOK_PROVIDER is not set. YES24 first, as the PRD asks. */
const ORDER: BookProvider[] = [yes24, aladin, kakao, google];
const BY_ID: Record<ProviderId, BookProvider> = { yes24, aladin, kakao, google, mock };

export function activeProviders(): BookProvider[] {
  const pref = process.env.BOOK_PROVIDER?.trim();
  if (pref) {
    const p = BY_ID[pref as ProviderId];
    if (!p) throw new Error(`Unknown BOOK_PROVIDER "${pref}". Use one of: ${Object.keys(BY_ID).join(', ')}`);
    return [p];
  }
  return ORDER.filter((p) => p.configured());
}

async function firstSuccess<T>(run: (p: BookProvider) => Promise<T>): Promise<T> {
  const providers = activeProviders();
  if (!providers.length) throw new Error('사용 가능한 도서 API가 없습니다. .env.local 에 API 키를 설정하세요.');
  const errors: string[] = [];
  for (const p of providers) {
    try {
      return await run(p);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  throw new Error(errors.join(' / '));
}

export const searchBooks = (q: string, page: number): Promise<SearchResult> => firstSuccess((p) => p.search(q, page));

export const lookupBook = (isbn: string): Promise<Book | null> => firstSuccess((p) => p.lookup(isbn));
