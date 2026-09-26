import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { audit, requireAdmin } from "@/lib/admin-auth";
import { CUSTOM, MUSIC, STATUS_LABEL, getTemplate, won } from "@/lib/catalog";
import { formatKDateTime } from "@/lib/dates";
import { buildPrompts } from "@/lib/prompts";
import { listOrderPhotos } from "@/lib/storage";
import { AdminControls } from "./controls";

export const metadata: Metadata = { title: "주문 상세 · 관리자", robots: { index: false, follow: false } };

export default async function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  const { user, admin } = await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: o } = await admin.from("orders").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();

  const t = getTemplate(o.template_id) ?? CUSTOM;

  // 사진은 10분짜리 링크로만 보여 주고, 열람 기록을 남긴다.
  let photos: string[] = [];
  if (!o.photos_deleted_at) {
    const paths = await listOrderPhotos(admin, o.user_id, o.id);
    if (paths.length) {
      const { data } = await admin.storage.from("photos").createSignedUrls(paths, 600);
      photos = (data ?? []).flatMap((d) => (d.signedUrl ? [d.signedUrl] : []));
      await audit(user.id, o.id, "view_photos");
    }
  }

  const prompts = buildPrompts(o);

  return (
    <div className="admin-wrap">
      <Link href="/admin" className="textlink" style={{ padding: 0 }}>← 주문 목록</Link>
      <h1 style={{ marginTop: 12 }}>{o.nickname} · {t.name}</h1>

      <section className="panel">
        <h2>주문 정보</h2>
        <dl className="rows" style={{ marginTop: 0 }}>
          <div className="row"><dt>상태</dt><dd>{STATUS_LABEL[o.status]}</dd></div>
          <div className="row"><dt>결제</dt><dd>{won(o.amount)} · {o.paid_at ? formatKDateTime(o.paid_at) : "미결제"}</dd></div>
          <div className="row"><dt>엔딩 자막</dt><dd>{o.caption}</dd></div>
          <div className="row"><dt>배경음악</dt><dd>{MUSIC[o.music]?.name}</dd></div>
          {o.moods?.length > 0 && <div className="row"><dt>분위기</dt><dd>{o.moods.join(", ")}</dd></div>}
          {o.custom_request && <div className="row"><dt>요청 장면</dt><dd style={{ whiteSpace: "pre-wrap" }}>{o.custom_request}</dd></div>}
          {o.revision_request && <div className="row"><dt>수정 요청</dt><dd style={{ color: "var(--red)" }}>{o.revision_request}</dd></div>}
          <div className="row"><dt>샘플 활용</dt><dd>{o.sample_consent ? "동의" : "동의 안 함"}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <h2>사진 {o.photos_deleted_at ? "(삭제됨)" : `${photos.length}장`}</h2>
        {photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`사진 ${i + 1}`} />
              </a>
            ))}
          </div>
        )}
        <p className="fine">링크는 10분 뒤 만료돼요. 작업용 PC에 받은 사진은 납품 후 꼭 지워 주세요.</p>
      </section>

      <section className="panel">
        <h2>Flow 장면 프롬프트</h2>
        <pre className="prompt-box">{prompts.join("\n\n")}</pre>
      </section>

      <AdminControls orderId={o.id} status={o.status} hasResult={!!o.result_path} />
    </div>
  );
}
