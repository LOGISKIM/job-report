import { AppBar } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";
import { KakaoLogin } from "./kakao-login";

export default async function LoginPage(props: PageProps<"/login">) {
  const q = await props.searchParams;
  const next = safeNext(typeof q.next === "string" ? q.next : null);
  return (
    <div className="app">
      <AppBar backHref="/" />
      <main className="view">
        <h1 className="h2">
          로그인하고
          <br />
          영상을 신청해 주세요
        </h1>
        <p className="sub">주문 진행 상황과 완성 영상을 확인할 때 필요해요. 비밀번호는 따로 만들지 않아요.</p>
        {q.error && <p className="error">로그인하지 못했어요. 다시 시도해 주세요.</p>}
      </main>
      <KakaoLogin next={next} />
    </div>
  );
}
