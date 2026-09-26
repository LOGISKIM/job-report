import { notFound, redirect } from "next/navigation";
import { AppBar, Poster } from "@/components/ui";
import { MUSIC, PHOTO_MIN, getTemplate, won } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { TossPay } from "./toss-pay";

export default async function PayPage(props: PageProps<"/order/[id]/pay">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/order/${id}/pay`);

  // RLS 덕분에 본인 주문만 조회된다.
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  if (order.status !== "pending_payment") redirect(`/orders/${id}`);
  if (order.photo_count < PHOTO_MIN) redirect(`/order/new?template=${order.template_id}`);

  const t = getTemplate(order.template_id)!;
  return (
    <div className="app">
      <AppBar backHref="/" title="결제" />
      <main className="view">
        <h1 className="h2">주문 내용을<br />확인해 주세요</h1>
        <div className="summary">
          <Poster t={t} size="mini" />
          <div>
            <b>{t.name}</b>
            <span>3분 영상 · 영업일 5일 · 수정 1번</span>
          </div>
        </div>
        <dl className="rows">
          <div className="row"><dt>애칭</dt><dd>{order.nickname}</dd></div>
          <div className="row"><dt>사진</dt><dd>{order.photo_count}장</dd></div>
          {order.moods?.length > 0 && <div className="row"><dt>분위기</dt><dd>{order.moods.join(", ")}</dd></div>}
          <div className="row"><dt>배경음악</dt><dd>{MUSIC[order.music]?.name}</dd></div>
        </dl>
        <dl className="total"><dt>결제 금액</dt><dd>{won(order.amount)}</dd></dl>
        <TossPay orderId={order.id} amount={order.amount} orderName={`첫돌필름 ${t.name}`} customerKey={user.id} />
        <p className="fine">카드 정보는 결제대행사(토스페이먼츠)가 처리하고 첫돌필름에는 저장되지 않아요. 결제하지 않은 주문은 하루 뒤 사진과 함께 자동으로 지워져요.</p>
      </main>
    </div>
  );
}
