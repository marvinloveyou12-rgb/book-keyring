import { NextResponse, type NextRequest } from 'next/server';
import { normalizeIsbn13 } from '@/lib/ean13';
import { lookupBook } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ isbn: string }> }) {
  const isbn = normalizeIsbn13((await params).isbn);
  if (!isbn) return NextResponse.json({ error: '올바른 ISBN이 아닙니다.' }, { status: 400 });
  try {
    const book = await lookupBook(isbn);
    if (!book) return NextResponse.json({ error: '도서를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json(book);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
