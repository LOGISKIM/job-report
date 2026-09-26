import { notFound, redirect } from "next/navigation";
import { Check, Info } from "@/components/icons";
import { AppBar, CTA, LinkButton } from "@/components/ui";
import { CUSTOM, getTemplate, stageOf } from "@/lib/catalog";
import { addBusinessDays, formatKDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ResultActions } from "./result-actions";

const STAGES = [
  ["접수 완료", "사진과 요청 사항을 확인했어요"],
  ["제작 중", "AI 장면을 만들고 있어요"],
  ["검수 중", "얼굴과 자막을 한 번 더 확인해요"],
  ["완성", "영상을 받아 보세요"],
];

export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;
  const q = await props.searchParams;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  if (order.status === "pending_payment") redirect(`/order/${id}/pay`);

  const t = getTemplate(order.template_id) ?? CUSTOM;

  if (order.status === "canceled") {
    return (
      <div className="app">
        <AppBar backHref="/orders" />
        <main className="view">
          <h1 className="h2">취소된 주문이에요</h1>
          <p className="sub">결제하지 않은 주문은 하루 뒤 사진과 함께 자동으로 지워져요.</p>
        </main>
        <CTA><LinkButton href="/">새로 만들기</LinkButton></CTA>
      </div>
    );
  }

  if (order.status === "delivered" && order.result_path) {
    // 본인 주문임을 위에서 RLS로 확인했으므로 1시간짜리 재생 링크를 만든다.
    const admin = createAdminClient();
    const { data: signed } = await admin.storage.from("results").createSignedUrl(order.result_path, 60 * 60, {
      download: `${order.nickname}_첫돌영상.mp4`,
    });
    const { data: stream } = await admin.storage.from("results").createSignedUrl(order.result_path, 60 * 60);
    return (
      <div className="app">
        <AppBar backHref="/orders" />
        <main className="view">
          {stream && <video className="video" src={stream.signedUrl} controls playsInline preload="metadata" />}
          <h1 className="h2">{order.nickname}의 첫돌 영상이<br />완성됐어요</h1>
          <p className="sub">{t.name} · 영상은 {order.result_purge_after ? formatKDate(order.result_purge_after) : "30일 뒤"}까지 받을 수 있어요</p>
          <ResultActions
            orderId={order.id}
            downloadUrl={signed?.signedUrl ?? null}
            revisionLeft={order.photos_deleted_at ? 0 : order.revision_left}
            photoCount={order.photo_count}
            photosDeletedAt={order.photos_deleted_at}
            photosPurgeAfter={order.photos_purge_after}
          />
        </main>
        <CTA><LinkButton href="/" sub>홈으로</LinkButton></CTA>
      </div>
    );
  }

  if (order.status === "delivered") {
    return (
      <div className="app">
        <AppBar backHref="/orders" />
        <main className="view">
          <h1 className="h2">영상 보관 기간이 끝났어요</h1>
          <p className="sub">개인정보 보호를 위해 완성 후 30일이 지난 영상과 사진은 모두 지웠어요.</p>
        </main>
        <CTA><LinkButton href="/">새로 만들기</LinkButton></CTA>
      </div>
    );
  }

  const stage = stageOf(order.status);
  const eta = order.paid_at ? addBusinessDays(new Date(order.paid_at), 5) : null;
  return (
    <div className="app">
      <AppBar backHref="/orders" />
      <main className="view">
        {q.paid && <p className="feedback good"><Check /> 결제가 완료됐어요</p>}
        <h1 className="h2">{order.nickname}의 영상을<br />{order.revision_request && stage < 3 ? "다시 다듬고 있어요" : "만들고 있어요"}</h1>
        {eta && <span className="eta">{formatKDate(eta)}까지 완성돼요</span>}
        <ol className="timeline">
          {STAGES.map(([name, desc], i) => {
            const cls = i < stage ? "done" : i === stage ? "now" : "todo";
            return (
              <li key={name} className={cls}>
                <span className="m">{cls === "done" && <Check />}</span>
                <div><b>{name}</b><p>{desc}</p></div>
              </li>
            );
          })}
        </ol>
        <div className="notice" style={{ marginTop: 32 }}>
          <Info />
          <span>단계가 바뀌면 카카오 알림톡으로 알려 드려요.</span>
        </div>
      </main>
      <CTA><LinkButton href="/" sub>홈으로</LinkButton></CTA>
    </div>
  );
}
