import type { Metadata, Viewport } from "next";
// Pretendard (SIL OFL 1.1). 화면에 쓰인 글자가 속한 조각 파일만 내려받는 dynamic subset 방식이다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "첫돌필름 · 우리 아이 첫 생일 영상",
  description: "사진 몇 장이면 3분짜리 돌 영상이 완성돼요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
