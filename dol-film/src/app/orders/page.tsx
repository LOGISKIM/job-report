import Link from "next/link";
import { AppBar, CTA, LinkButton, Poster } from "@/components/ui";
import { CUSTOM, STATUS_LABEL, getTemplate } from "@/lib/catalog";
import { formatKDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, nickname, template_id, status, created_at")
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="app">
      <AppBar backHref="/" title="내 주문" />
      <main className="view">
        {!orders?.length ? (
          <>
            <h1 className="h2">아직 주문이 없어요</h1>
            <p className="sub">마음에 드는 스타일을 골라 첫 영상을 만들어 보세요.</p>
          </>
        ) : (
          <ul className="orderlist">
            {orders.map((o) => {
              const t = getTemplate(o.template_id) ?? CUSTOM;
              return (
                <li key={o.id}>
                  <Link className="orderitem" href={o.status === "pending_payment" ? `/order/${o.id}/pay` : `/orders/${o.id}`}>
                    <Poster t={t} size="mini" />
                    <div>
                      <b>{o.nickname} · {t.name}</b>
                      <span>{formatKDate(o.created_at)} 주문 · {STATUS_LABEL[o.status]}</span>
                    </div>
                    <span className="chev">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <CTA>
        <LinkButton href="/" sub>새 영상 만들기</LinkButton>
      </CTA>
    </div>
  );
}
