import { ean13CheckDigit } from '../ean13';
import type { Book } from '../types';
import { PAGE_SIZE, type BookProvider } from './types';

/** Offline sample catalogue for development and tests (BOOK_PROVIDER=mock). Titles are made up. */
export const MOCK_BOOKS: { title: string; author: string; publisher: string; color: string; desc: string }[] = [
  { title: '봄날의 서재', author: '김하늘', publisher: '예시출판', color: '#c8553d', desc: '작은 동네 서점에서 벌어지는 사계절의 이야기.' },
  { title: '밤의 고양이 탐정', author: '이도윤', publisher: '샘플북스', color: '#2d3a4a', desc: '도시의 밤을 누비는 고양이 탐정의 첫 번째 사건.' },
  { title: '바다로 가는 기차', author: '박서연', publisher: '예시출판', color: '#3a7ca5', desc: '종착역이 바다인 기차에 오른 일곱 사람.' },
  { title: '초록 정원 일기', author: '최민준', publisher: '테스트하우스', color: '#5b8c5a', desc: '베란다 한 칸에서 시작한 정원 가꾸기 기록.' },
  { title: '별을 세는 방법', author: '정유나', publisher: '샘플북스', color: '#f2c14e', desc: '천문대 연구원이 들려주는 밤하늘 입문서.' },
  { title: '오래된 지도', author: '한지호', publisher: '테스트하우스', color: '#8c5e3c', desc: '할아버지의 다락방에서 발견한 지도 한 장.' },
  { title: 'The Quiet Library', author: 'A. Sample', publisher: 'Example Press', color: '#6d597a', desc: 'A short novel about a library that never closes.' },
  { title: '여름 레몬 레시피', author: '윤채원', publisher: '예시출판', color: '#e9d985', desc: '레몬 하나로 만드는 서른 가지 여름 요리.' },
];

export function mockIsbn(i: number) {
  const base = `979119000${String(100 + i).padStart(3, '0')}`;
  return base + ean13CheckDigit(base);
}

export function mockBook(i: number): Book {
  const m = MOCK_BOOKS[i];
  const isbn = mockIsbn(i);
  const cover = `/api/mock-cover?i=${i}`;
  return {
    id: `mock:${isbn}`,
    isbn,
    title: m.title,
    author: m.author,
    publisher: m.publisher,
    pubDate: '2026-01-15',
    description: m.desc,
    coverUrl: cover,
    thumbUrl: cover,
    // Every other book has a back cover image, to exercise both back-face modes.
    backCoverUrl: i % 2 === 0 ? `/api/mock-cover?i=${i}&side=back` : undefined,
    source: 'mock',
  };
}

export const mock: BookProvider = {
  id: 'mock',
  configured: () => true,
  async search(q, page) {
    const all = MOCK_BOOKS.map((_, i) => mockBook(i));
    const needle = q.toLowerCase();
    const hits = all.filter((b) => [b.title, b.author, b.publisher, b.isbn].some((f) => f.toLowerCase().includes(needle)));
    const list = hits.length ? hits : all;
    const items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { provider: 'mock', items, page, total: list.length, hasMore: page * PAGE_SIZE < list.length };
  },
  async lookup(isbn) {
    const i = MOCK_BOOKS.findIndex((_, j) => mockIsbn(j) === isbn);
    return i >= 0 ? mockBook(i) : null;
  },
};
