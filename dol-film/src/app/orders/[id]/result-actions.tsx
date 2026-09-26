"use client";

import { useState, useTransition } from "react";
import { Edit, Save, Share } from "@/components/icons";
import { createShareLink, deletePhotosNow, requestRevision, revokeShareLinks } from "@/lib/actions/order";
import { formatKDate } from "@/lib/dates";

type Sheet = null | "share" | "revise" | "delete";

export function ResultActions({
  orderId,
  downloadUrl,
  revisionLeft,
  photoCount,
  photosDeletedAt,
  photosPurgeAfter,
}: {
  orderId: string;
  downloadUrl: string | null;
  revisionLeft: number;
  photoCount: number;
  photosDeletedAt: string | null;
  photosPurgeAfter: string | null;
}) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [share, setShare] = useState<{ url: string; expiresAt: string } | null>(null);
  const [revision, setRevision] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };
  const close = () => {
    setSheet(null);
    setError(null);
  };

  const openShare = () =>
    start(async () => {
      const res = await createShareLink(orderId);
      if (!res.ok) return flash(res.error);
      setShare({ url: `${window.location.origin}/s/${res.token}`, expiresAt: res.expiresAt });
      setSheet("share");
    });

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      flash("링크를 복사했어요");
    } catch {
      flash("링크를 길게 눌러 복사해 주세요");
    }
  };

  const revoke = () =>
    start(async () => {
      await revokeShareLinks(orderId);
      setShare(null);
      close();
      flash("지금까지 만든 공유 링크를 모두 껐어요");
    });

  const sendRevision = () =>
    start(async () => {
      const res = await requestRevision(orderId, revision);
      if (!res.ok) return setError(res.error);
      close();
    });

  const removePhotos = () =>
    start(async () => {
      const res = await deletePhotosNow(orderId);
      if (!res.ok) return setError(res.error);
      close();
      flash("원본 사진을 지웠어요");
    });

  return (
    <>
      <div className="actions">
        {downloadUrl ? (
          <a className="act" href={downloadUrl}><Save />저장하기</a>
        ) : (
          <button className="act" disabled><Save />저장하기</button>
        )}
        <button className="act" onClick={openShare} disabled={pending}><Share />가족 공유</button>
        <button className="act" onClick={() => setSheet("revise")} disabled={revisionLeft < 1}>
          <Edit />수정 요청<small>{revisionLeft}번 남음</small>
        </button>
      </div>

      <h2 className="sec-title">내 데이터</h2>
      {photosDeletedAt ? (
        <div className="datacard gone"><div><b>원본 사진을 지웠어요</b><span>{formatKDate(photosDeletedAt)} 삭제</span></div></div>
      ) : (
        <div className="datacard">
          <div>
            <b>원본 사진 {photoCount}장</b>
            <span>{photosPurgeAfter ? `${formatKDate(photosPurgeAfter)} 자동 삭제 예정` : "완성 후 7일 뒤 자동 삭제"}</span>
          </div>
          <button className="del" onClick={() => setSheet("delete")}>지금 삭제</button>
        </div>
      )}

      {sheet && <div className="dim" onClick={close} />}
      {sheet === "share" && share && (
        <div className="sheet" role="dialog" aria-modal="true">
          <span className="grab" />
          <h3>가족에게 공유하기</h3>
          <p>링크를 받은 사람은 로그인 없이 볼 수 있어요. 링크는 {formatKDate(share.expiresAt)}에 만료돼요.</p>
          <div className="linkbox"><code>{share.url}</code><button onClick={copy}>복사</button></div>
          <div className="btnrow">
            <button className="btn sub" onClick={revoke} disabled={pending}>모든 링크 끄기</button>
            <button className="btn" onClick={close}>닫기</button>
          </div>
        </div>
      )}
      {sheet === "revise" && (
        <div className="sheet" role="dialog" aria-modal="true">
          <span className="grab" />
          <h3>어떤 부분을 고칠까요?</h3>
          <p>수정은 1번 무료예요. 장면 이름과 고칠 점을 적어 주세요.</p>
          <textarea className="textarea" style={{ minHeight: 96 }} maxLength={500} value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="예) 생일 파티 장면에서 표정이 더 밝았으면 좋겠어요" />
          {error && <p className="error">{error}</p>}
          <button className="btn" onClick={sendRevision} disabled={pending}>수정 요청 보내기</button>
        </div>
      )}
      {sheet === "delete" && (
        <div className="sheet" role="dialog" aria-modal="true">
          <span className="grab" />
          <h3>원본 사진을 지금 지울까요?</h3>
          <p>지운 사진은 되돌릴 수 없고, 이후에는 수정 요청을 할 수 없어요. 완성 영상은 계속 받을 수 있어요.</p>
          {error && <p className="error">{error}</p>}
          <div className="btnrow">
            <button className="btn sub" onClick={close}>취소</button>
            <button className="btn danger" onClick={removePhotos} disabled={pending}>지우기</button>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
