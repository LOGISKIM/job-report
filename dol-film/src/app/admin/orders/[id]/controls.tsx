"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createResultUpload, markDelivered, setStatus } from "@/lib/actions/admin";
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
      {msg && <p className="fine">{msg}</p>}
    </section>
  );
}
