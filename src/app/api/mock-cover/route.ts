import { type NextRequest } from 'next/server';
import { MOCK_BOOKS } from '@/lib/providers/mock';

export const runtime = 'nodejs';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Generated cover art for the mock catalogue (600×870, roughly a book's ratio). */
export function GET(req: NextRequest) {
  const i = Number(req.nextUrl.searchParams.get('i'));
  const back = req.nextUrl.searchParams.get('side') === 'back';
  const m = MOCK_BOOKS[i];
  if (!Number.isInteger(i) || !m) return new Response('not found', { status: 404 });
  const font = `'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif`;
  const svg = back
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="870" viewBox="0 0 600 870">
  <rect width="600" height="870" fill="${m.color}"/>
  <rect x="40" y="40" width="520" height="790" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
  <text x="300" y="300" text-anchor="middle" font-family="${font}" font-size="34" fill="#fff">${esc(m.desc.slice(0, 18))}</text>
  <text x="300" y="350" text-anchor="middle" font-family="${font}" font-size="34" fill="#fff">${esc(m.desc.slice(18))}</text>
  <text x="300" y="760" text-anchor="middle" font-family="${font}" font-size="28" fill="#fff" fill-opacity=".8">BACK · ${esc(m.publisher)}</text>
</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="870" viewBox="0 0 600 870">
  <rect width="600" height="870" fill="${m.color}"/>
  <circle cx="300" cy="420" r="170" fill="#fff" fill-opacity=".18"/>
  <circle cx="300" cy="420" r="95" fill="#fff" fill-opacity=".25"/>
  <text x="300" y="170" text-anchor="middle" font-family="${font}" font-size="64" font-weight="700" fill="#fff">${esc(m.title)}</text>
  <text x="300" y="700" text-anchor="middle" font-family="${font}" font-size="36" fill="#fff">${esc(m.author)}</text>
  <text x="300" y="810" text-anchor="middle" font-family="${font}" font-size="26" fill="#fff" fill-opacity=".8">${esc(m.publisher)}</text>
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } });
}
