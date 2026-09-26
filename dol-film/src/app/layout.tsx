import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_KR({
  variable: "--font-noto",
  weight: ["400", "500", "700", "800"],
  preload: false,
  display: "swap",
});

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
    <html lang="ko" className={noto.variable}>
      <body>{children}</body>
    </html>
  );
}
