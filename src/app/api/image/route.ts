import { NextResponse, type NextRequest } from 'next/server';
import { isAllowedImageUrl, MAX_IMAGE_BYTES } from '@/lib/imageProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Relays a cover image from an allow-listed host so the browser canvas can read it (CORS). */
export async function GET(req: NextRequest) {
  let target = isAllowedImageUrl(req.nextUrl.searchParams.get('url') ?? '');
  if (!target) return NextResponse.json({ error: '허용되지 않은 이미지 주소입니다.' }, { status: 400 });

  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    try {
      res = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { Accept: 'image/*' } });
    } catch {
      return NextResponse.json({ error: '이미지를 가져오지 못했습니다.' }, { status: 502 });
    }
    if (res.status >= 300 && res.status < 400) {
      const next = isAllowedImageUrl(new URL(res.headers.get('location') ?? '', target).toString());
      if (!next) return NextResponse.json({ error: '허용되지 않은 리디렉션입니다.' }, { status: 502 });
      target = next;
      continue;
    }
    break;
  }
  if (!res || !res.ok) return NextResponse.json({ error: `이미지 응답 오류 (${res?.status ?? '-'})` }, { status: 502 });

  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return NextResponse.json({ error: '이미지가 아닙니다.' }, { status: 502 });
  if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: '이미지가 너무 큽니다.' }, { status: 413 });
  }
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: '이미지가 너무 큽니다.' }, { status: 413 });

  return new NextResponse(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
