import { NextResponse, type NextRequest } from 'next/server';
import { TtlCache } from '@/lib/cache';
import { searchBooks } from '@/lib/providers';
import type { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cache = new TtlCache<SearchResult>(24 * 60 * 60 * 1000);

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const page = Math.min(50, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1));
  if (!q) return NextResponse.json({ error: '검색어를 입력하세요.' }, { status: 400 });
  if (q.length > 100) return NextResponse.json({ error: '검색어는 100자 이하로 입력하세요.' }, { status: 400 });

  const key = `${q.toLowerCase()}|${page}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit, { headers: { 'X-Cache': 'HIT' } });

  try {
    const result = await searchBooks(q, page);
    cache.set(key, result);
    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });
  } catch (e) {
    return NextResponse.json({ error: `도서 검색에 실패했습니다: ${(e as Error).message}` }, { status: 502 });
  }
}
