// 로그인 후 돌아갈 주소. 외부 사이트로 보내는 공격(open redirect)을 막기 위해 우리 사이트 안의 경로만 허용한다.
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
