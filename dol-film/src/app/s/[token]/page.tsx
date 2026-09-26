import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatKDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "첫돌 영상", robots: { index: false, follow: false } };

// 가족 공유 링크. 로그인 없이 볼 수 있지만 토큰이 길고 무작위라 추측할 수 없고, 기간이 지나면 열리지 않는다.
export default async function SharedVideoPage(props: PageProps<"/s/[token]">) {
  const { token } = await props.params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("share_links")
    .select("order_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return <Expired />;

  const { data: order } = await admin
    .from("orders")
    .select("nickname, status, result_path")
    .eq("id", link.order_id)
    .single();
  if (!order || order.status !== "delivered" || !order.result_path) return <Expired />;

  const { data: signed } = await admin.storage.from("results").createSignedUrl(order.result_path, 60 * 60);
  if (!signed) return <Expired />;

  return (
    <div className="app">
      <main className="view" style={{ paddingTop: 24 }}>
        <span className="brand">첫돌필름</span>
        <h1 className="h2">{order.nickname}의 첫 번째 생일</h1>
        <video className="video" src={signed.signedUrl} controls playsInline preload="metadata" style={{ marginTop: 16 }} />
        <p className="fine">이 링크는 {formatKDate(link.expires_at)}까지 열려요.</p>
      </main>
    </div>
  );
}

function Expired() {
  return (
    <div className="app">
      <main className="view" style={{ paddingTop: 24 }}>
        <span className="brand">첫돌필름</span>
        <h1 className="h2">링크가 만료됐어요</h1>
        <p className="sub">영상을 보내 준 가족에게 새 링크를 요청해 주세요.</p>
      </main>
    </div>
  );
}
