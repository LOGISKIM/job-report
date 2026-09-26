import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { CUSTOM, STATUS_LABEL, getTemplate, won } from "@/lib/catalog";
import { formatKDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "관리자 · 첫돌필름", robots: { index: false, follow: false } };

const FILTERS = [
  ["todo", "할 일"],
  ["delivered", "완성"],
  ["pending_payment", "결제 대기"],
  ["canceled", "취소"],
  ["all", "전체"],
] as const;

export default async function AdminPage(props: PageProps<"/admin">) {
  const { admin } = await requireAdmin();
  const q = await props.searchParams;
  const filter = FILTERS.some(([k]) => k === q.status) ? (q.status as string) : "todo";

  let query = admin
    .from("orders")
    .select("id, nickname, template_id, status, amount, photo_count, revision_request, paid_at, created_at")
    .order("created_at", { ascending: filter !== "todo" ? false : true })
    .limit(100);
  if (filter === "todo") query = query.in("status", ["paid", "in_production", "review"]);
  else if (filter !== "all") query = query.eq("status", filter);
  const { data: orders } = await query;

  return (
    <div className="admin-wrap">
      <h1>주문 관리</h1>
      <nav className="admin-tabs">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/admin?status=${k}`} className={k === filter ? "on" : ""}>{label}</Link>
        ))}
      </nav>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr><th>결제 시각</th><th>애칭</th><th>스타일</th><th>상태</th><th>사진</th><th>금액</th><th>메모</th></tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <td className="num">{o.paid_at ? formatKDateTime(o.paid_at) : "–"}</td>
                <td><Link href={`/admin/orders/${o.id}`} style={{ color: "var(--blue)", fontWeight: 700 }}>{o.nickname}</Link></td>
                <td>{(getTemplate(o.template_id) ?? CUSTOM).name}</td>
                <td>{STATUS_LABEL[o.status]}</td>
                <td className="num">{o.photo_count}장</td>
                <td className="num">{won(o.amount)}</td>
                <td>{o.revision_request ? "수정 요청" : ""}</td>
              </tr>
            ))}
            {!orders?.length && <tr><td colSpan={7} style={{ color: "var(--g600)" }}>주문이 없어요</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
