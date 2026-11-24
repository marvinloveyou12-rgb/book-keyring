/** Hosts the image proxy may fetch from. Keeps /api/image from being an open proxy (SSRF). */
const DEFAULT_HOSTS = [
  'image.aladin.co.kr',
  'search1.kakaocdn.net',
  't1.daumcdn.net',
  'books.google.com',
  'books.googleusercontent.com',
  'image.yes24.com',
];

export function allowedHosts(): string[] {
  const extra = (process.env.IMAGE_PROXY_EXTRA_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_HOSTS, ...extra];
}

export function isAllowedImageUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  return allowedHosts().includes(u.hostname.toLowerCase()) ? u : null;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
