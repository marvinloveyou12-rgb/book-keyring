import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '책표지 열쇠고리 메이커',
  description: '책을 검색해 열쇠고리 크기의 앞·뒤 표지를 만들고 인쇄용 PDF로 내려받습니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
