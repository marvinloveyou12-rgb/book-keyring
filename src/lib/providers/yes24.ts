import { ProviderError, type BookProvider } from './types';

/**
 * YES24 adapter.
 *
 * YES24 has no public developer search API. This adapter is the slot for a
 * partner API: once YES24 grants access and shares its spec, implement
 * `search` and `lookup` here (map each item to `Book`, with `source: 'yes24'`).
 * Until then it reports itself as not ready, and the search route falls
 * through to the next configured provider (Aladin → Kakao → Google Books).
 *
 * Env: YES24_API_URL, YES24_API_KEY
 */
export const yes24: BookProvider = {
  id: 'yes24',
  configured: () => Boolean(process.env.YES24_API_URL && process.env.YES24_API_KEY),
  async search() {
    throw new ProviderError('yes24', '제휴 API 규격이 아직 구현되지 않았습니다 (src/lib/providers/yes24.ts).');
  },
  async lookup() {
    throw new ProviderError('yes24', '제휴 API 규격이 아직 구현되지 않았습니다 (src/lib/providers/yes24.ts).');
  },
};
