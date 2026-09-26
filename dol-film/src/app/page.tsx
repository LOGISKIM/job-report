import Link from "next/link";
import { Lock, Pen } from "@/components/icons";
import { Poster } from "@/components/ui";
import { CUSTOM, STATUS_LABEL, TEMPLATES, getTemplate, won } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let active: { id: string; nickname: string; template_id: string; status: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("orders")
      .select("id, nickname, template_id, status")
      .in("status", ["paid", "in_production", "review", "delivered"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    active = data;
  }

  return (
    <div className="app">
      <header className="appbar" style={{ padding: "0 20px" }}>
        <span className="brand">첫돌필름</span>
        <Link className="right" href={user ? "/orders" : "/login"}>
          {user ? "내 주문" : "로그인"}
        </Link>
      </header>
      <main className="view">
        <h1 className="h1">
          우리 아이 첫 생일,
          <br />
          영화처럼 남겨요
        </h1>
        <p className="sub">사진 몇 장이면 3분짜리 돌 영상이 완성돼요</p>

        {active && (
          <Link className="banner" href={`/orders/${active.id}`}>
            <span className="dot" />
            <div>
              <b>
                {active.nickname}의 영상을 {active.status === "delivered" ? "다 만들었어요" : "만들고 있어요"}
              </b>
              <span>
                {getTemplate(active.template_id)?.name} · {STATUS_LABEL[active.status]}
              </span>
            </div>
            <span className="chev">›</span>
          </Link>
        )}

        <h2 className="sec-title">스타일 고르기</h2>
        <div className="grid">
          {TEMPLATES.map((t) => (
            <Link key={t.id} className="tcard" href={`/templates/${t.id}`}>
              <Poster t={t} chip={t.badge} dur />
              <span className="tname">{t.name}</span>
              <span className="tprice">{won(t.price)}</span>
            </Link>
          ))}
        </div>

        <Link className="custom-card" href="/order/new?template=custom">
          <span className="ic">
            <Pen />
          </span>
          <div>
            <b>원하는 스타일이 없나요?</b>
            <span>적어 주시면 그대로 만들어 드려요 · {won(CUSTOM.price)}</span>
          </div>
          <span className="chev">›</span>
        </Link>

        <div className="trust">
          <Lock />
          <span>사진은 영상이 완성되고 7일 뒤 자동으로 지워져요</span>
        </div>

        <footer className="footer">
          <Link href="/privacy">개인정보처리방침</Link> · <Link href="/terms">이용약관</Link>
          <br />
          {/* TODO: 사업자 정보(상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 연락처)를 채워야 한다 */}
          상호 · 대표자 · 사업자등록번호 · 통신판매업 신고번호
        </footer>
      </main>
    </div>
  );
}
