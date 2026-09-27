import type { MetadataRoute } from "next";

// 폰에서 "홈 화면에 추가"하면 주소창 없이 앱처럼 열린다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "첫돌필름",
    short_name: "첫돌필름",
    description: "사진 몇 장이면 3분짜리 돌 영상이 완성돼요.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
