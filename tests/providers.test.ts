import { afterEach, describe, expect, it, vi } from 'vitest';
import { largeAladinCover, mapAladinItem } from '@/lib/providers/aladin';
import { mapGoogleVolume } from '@/lib/providers/google';
import { activeProviders, searchBooks } from '@/lib/providers';
import { kakaoOriginal, mapKakaoDoc } from '@/lib/providers/kakao';
import { mock, mockIsbn } from '@/lib/providers/mock';
import { isAllowedImageUrl } from '@/lib/imageProxy';
import { normalizeIsbn13 } from '@/lib/ean13';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('aladin', () => {
  it('upgrades cover size in the URL', () => {
    expect(largeAladinCover('https://image.aladin.co.kr/product/1/2/coversum/890.jpg')).toBe('https://image.aladin.co.kr/product/1/2/cover500/890.jpg');
    expect(largeAladinCover('https://image.aladin.co.kr/product/1/2/cover200/890.jpg')).toContain('/cover500/');
  });

  it('maps an item', () => {
    const b = mapAladinItem({ title: '책', author: '저자 (지은이)', publisher: '출판사', isbn13: '9780306406157', cover: 'http://image.aladin.co.kr/product/1/2/cover200/x.jpg' });
    expect(b).toMatchObject({ isbn: '9780306406157', title: '책', source: 'aladin', thumbUrl: 'https://image.aladin.co.kr/product/1/2/cover200/x.jpg' });
    expect(b?.coverUrl).toContain('/cover500/');
  });
});

describe('kakao', () => {
  const thumb = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F1467038%3Ftimestamp%3D20190131';
  it('extracts the original image from the thumbnail', () => {
    expect(kakaoOriginal(thumb)).toBe('https://t1.daumcdn.net/lbook/image/1467038?timestamp=20190131');
  });

  it('maps a document with combined isbn and translators', () => {
    const b = mapKakaoDoc({ title: 'T', isbn: '0306406152 9780306406157', authors: ['A'], translators: ['B'], publisher: 'P', thumbnail: thumb, datetime: '2014-11-17T00:00:00.000+09:00' });
    expect(b).toMatchObject({ isbn: '9780306406157', author: 'A, B (옮긴이)', pubDate: '2014-11-17' });
  });
});

describe('google', () => {
  it('maps a volume and cleans the thumbnail', () => {
    const b = mapGoogleVolume({
      id: 'x',
      volumeInfo: {
        title: 'Title',
        subtitle: 'Sub',
        authors: ['A', 'B'],
        industryIdentifiers: [{ type: 'ISBN_10', identifier: '0306406152' }],
        imageLinks: { thumbnail: 'http://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1&edge=curl' },
      },
    });
    expect(b).toMatchObject({ title: 'Title - Sub', author: 'A, B', isbn: '9780306406157' });
    expect(b?.coverUrl.startsWith('https://')).toBe(true);
    expect(b?.coverUrl).not.toContain('edge=curl');
  });
});

describe('mock', () => {
  it('has valid ISBNs and filters by query', async () => {
    expect(normalizeIsbn13(mockIsbn(0))).toBe(mockIsbn(0));
    const r = await mock.search('고양이', 1);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].title).toContain('고양이');
  });
});

describe('provider selection', () => {
  it('honours BOOK_PROVIDER', () => {
    vi.stubEnv('BOOK_PROVIDER', 'mock');
    expect(activeProviders().map((p) => p.id)).toEqual(['mock']);
  });

  it('orders configured providers YES24 → aladin → kakao → google', () => {
    vi.stubEnv('BOOK_PROVIDER', '');
    vi.stubEnv('YES24_API_URL', 'https://example.invalid');
    vi.stubEnv('YES24_API_KEY', 'k');
    vi.stubEnv('ALADIN_TTB_KEY', 'k');
    vi.stubEnv('KAKAO_REST_KEY', '');
    expect(activeProviders().map((p) => p.id)).toEqual(['yes24', 'aladin', 'google']);
  });

  it('falls through to the next provider when one fails', async () => {
    vi.stubEnv('BOOK_PROVIDER', '');
    vi.stubEnv('YES24_API_URL', 'https://example.invalid');
    vi.stubEnv('YES24_API_KEY', 'k');
    vi.stubEnv('ALADIN_TTB_KEY', 'k');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ totalResults: 1, item: [{ title: '책', isbn13: '9780306406157', cover: '' }] }), { status: 200 }),
    );
    const r = await searchBooks('책', 1);
    expect(r.provider).toBe('aladin');
    expect(r.items[0].title).toBe('책');
  });
});

describe('image proxy allowlist', () => {
  it('allows known cover hosts only', () => {
    expect(isAllowedImageUrl('https://image.aladin.co.kr/product/x.jpg')).not.toBeNull();
    expect(isAllowedImageUrl('https://evil.example.com/x.jpg')).toBeNull();
    expect(isAllowedImageUrl('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(isAllowedImageUrl('file:///etc/passwd')).toBeNull();
    expect(isAllowedImageUrl('https://image.aladin.co.kr:8443/x.jpg')).toBeNull();
    expect(isAllowedImageUrl('https://user:pw@image.aladin.co.kr/x.jpg')).toBeNull();
  });

  it('accepts extra hosts from env', () => {
    vi.stubEnv('IMAGE_PROXY_EXTRA_HOSTS', 'cdn.example.com');
    expect(isAllowedImageUrl('https://cdn.example.com/a.png')).not.toBeNull();
  });
});
