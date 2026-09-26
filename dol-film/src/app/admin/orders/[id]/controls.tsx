"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelOrder, createResultUpload, markDelivered, setStatus } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/client";

const STEPS = [
  ["paid", "접수 완료"],
  ["in_production", "제작 중"],
  ["review", "검수 중"],
] as const;

export function AdminControls({ orderId, status, hasResult }: { orderId: string; status: string; hasResult: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const canWork = ["paid", "in_production", "review"].includes(status);

  const move = (s: string) =>
    start(async () => {
      const res = await setStatus(orderId, s);
      setMsg(res.ok ? "상태를 바꿨어요" : res.error);
      router.refresh();
    });

  const deliver = () =>
    start(async () => {
      if (!file) return;
      setMsg("영상을 올리고 있어요…");
      const prep = await createResultUpload(orderId);
      if (!prep.ok) return setMsg(prep.error);
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("results")
        .uploadToSignedUrl(prep.path, prep.token, file, { contentType: "video/mp4" });
      if (error) return setMsg(`업로드 실패: ${error.message}`);
      const res = await markDelivered(orderId, prep.path);
      setMsg(res.ok ? "납품했어요. 고객에게 알림톡이 나가요" : res.error);
      router.refresh();
    });

  const cancel = () =>
    start(async () => {
      const res = await cancelOrder(orderId, reason);
      setMsg(res.ok ? "취소하고 환불했어요. 사진과 영상도 지웠어요" : res.error);
      setConfirmCancel(false);
      router.refresh();
    });

  if (!canWork) {
    return (
      <section className="panel">
        <h2>진행</h2>
        <p className="sub">{status === "delivered" ? `납품 완료${hasResult ? "" : " (영상 보관 기간 끝남)"}` : "지금은 작업할 수 없는 상태예요"}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>진행</h2>
      <div className="admin-row">
        {STEPS.map(([s, label]) => (
          <button key={s} className={`btn small ${s === status ? "" : "sub"}`} disabled={pending || s === status} onClick={() => move(s)}>
            {label}
          </button>
        ))}
      </div>
      <h2 style={{ marginTop: 24 }}>완성 영상 납품</h2>
      <div className="admin-row">
        <input type="file" accept="video/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn small" disabled={!file || pending} onClick={deliver}>업로드하고 납품하기</button>
      </div>
      <h2 style={{ marginTop: 24 }}>취소·환불</h2>
      <div className="admin-row">
        <input className="input" style={{ maxWidth: 320, fontSize: 14 }} placeholder="취소 사유 (고객에게 보이는 환불 사유)" value={reason} maxLength={100} onChange={(e) => setReason(e.target.value)} />
        {confirmCancel ? (
          <>
            <button className="btn small danger" disabled={pending} onClick={cancel}>정말 전액 환불하기</button>
            <button className="btn small sub" onClick={() => setConfirmCancel(false)}>그만두기</button>
          </>
        ) : (
          <button className="btn small sub" disabled={reason.trim().length < 2 || pending} onClick={() => setConfirmCancel(true)}>취소하고 환불</button>
        )}
      </div>
      {msg && <p className="fine">{msg}</p>}
    </section>
  );
}
