// 로그인 후 돌아갈 주소. 외부 사이트로 보내는 공격(open redirect)을 막기 위해 우리 사이트 안의 경로만 허용한다.
// 브라우저는 주소 속 탭·줄바꿈을 지워 버리므로("/\t/evil.com" → "//evil.com") 문자열 검사만으로는 부족하다.
// 실제 URL로 해석해 본 뒤 같은 사이트인지 확인한다.
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(next)) return fallback;
  try {
    const base = "https://same.origin";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
