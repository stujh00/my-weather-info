import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '오늘의 진짜 정보판 — 서울 기온',
  description: '데이터가 안 올 때도 정직하게 설명하는 정보판'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
