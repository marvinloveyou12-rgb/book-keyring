import type { Book, ProviderId, SearchResult } from '../types';

export const PAGE_SIZE = 20;

export interface BookProvider {
  id: ProviderId;
  /** True when the credentials it needs are present. */
  configured(): boolean;
  search(query: string, page: number): Promise<SearchResult>;
  lookup(isbn: string): Promise<Book | null>;
}

export class ProviderError extends Error {
  constructor(public provider: ProviderId, message: string) {
    super(`[${provider}] ${message}`);
  }
}

export async function fetchJson<T>(provider: ProviderId, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  } catch (e) {
    throw new ProviderError(provider, `요청 실패: ${(e as Error).message}`);
  }
  if (!res.ok) throw new ProviderError(provider, `HTTP ${res.status}`);
  return (await res.json()) as T;
}
