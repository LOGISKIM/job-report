"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Down, Info, Lock, Plus, Shield } from "@/components/icons";
import { AppBar, CTA } from "@/components/ui";
import { createOrder, finalizeUploads, prepareUploads } from "@/lib/actions/order";
import { CUSTOM, MOODS, MUSIC, PHOTO_MAX, PHOTO_MIN, getTemplate } from "@/lib/catalog";
import { CONSENTS } from "@/lib/consents";
import { sanitizePhoto } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

type Step = "mood" | "scene" | "photos" | "caption" | "consent";
type Photo = { blob: Blob; url: string };

const EXAMPLES = [
  "아빠랑 바닷가를 걸으며 모래성을 쌓는 장면",
  "할머니 댁 마당에서 강아지와 노는 장면",
  "놀이공원 회전목마를 타는 장면",
];

export function Wizard({ templateId }: { templateId: string }) {
  const router = useRouter();
  const t = getTemplate(templateId)!;
  const isCustom = t.id === CUSTOM.id;
  const steps: Step[] = isCustom ? ["mood", "scene", "photos", "caption", "consent"] : ["photos", "caption", "consent"];

  const [idx, setIdx] = useState(0);
  const [moods, setMoods] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [nickname, setNickname] = useState("");
  const [caption, setCaption] = useState("첫 번째 생일 축하해");
  const [phone, setPhone] = useState("");
  const [music, setMusic] = useState(0);
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);

  const step = steps[idx];
  useEffect(() => window.scrollTo(0, 0), [idx]);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const phoneOk = /^01[0-9]{8,9}$/.test(phone.replace(/\D/g, ""));
  const requiredAgreed = CONSENTS.filter((c) => c.required).every((c) => agree[c.id]);
  const canNext: Record<Step, boolean> = {
    mood: moods.length > 0,
    scene: customText.trim().length >= 10,
    photos: photos.length >= PHOTO_MIN,
    caption: nickname.trim().length > 0 && caption.trim().length > 0 && phoneOk,
    consent: requiredAgreed,
  };

  const back = () => (idx === 0 ? router.back() : setIdx(idx - 1));

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    setBusy("사진을 준비하고 있어요");
    const room = PHOTO_MAX - photos.length;
    const added: Photo[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const blob = await sanitizePhoto(file);
        added.push({ blob, url: URL.createObjectURL(blob) });
      } catch (e) {
        setError(e instanceof Error ? e.message : "사진을 올리지 못했어요");
      }
    }
    setPhotos((p) => [...p, ...added]);
    setBusy(null);
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photos[i].url);
    setPhotos((p) => p.filter((_, j) => j !== i));
  };

  const submit = async () => {
    setError(null);
    try {
      if (!orderIdRef.current) {
        setBusy("주문을 만들고 있어요");
        const res = await createOrder({
          templateId: t.id,
          moods,
          customRequest: customText,
          nickname,
          caption,
          music,
          phone,
          consents: agree,
        });
        if (!res.ok) throw new Error(res.error);
        orderIdRef.current = res.orderId;
      }
      const orderId = orderIdRef.current;

      setBusy("사진을 안전하게 올리고 있어요");
      const prep = await prepareUploads(orderId, photos.length);
      if (!prep.ok) throw new Error(prep.error);
      const supabase = createClient();
      let done = 0;
      await Promise.all(
        prep.uploads.map(async (u, i) => {
          const { error } = await supabase.storage
            .from("photos")
            .uploadToSignedUrl(u.path, u.token, photos[i].blob, { contentType: "image/jpeg" });
          if (error) throw new Error("사진을 올리지 못했어요. 다시 시도해 주세요");
          done++;
          setBusy(`사진을 안전하게 올리고 있어요 (${done}/${photos.length})`);
        }),
      );
      const fin = await finalizeUploads(orderId);
      if (!fin.ok) throw new Error(fin.error);
      router.push(`/order/${orderId}/pay`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제가 생겼어요. 다시 시도해 주세요");
      setBusy(null);
    }
  };

  const next = () => (step === "consent" ? submit() : setIdx(idx + 1));
  const allAgreed = CONSENTS.every((c) => agree[c.id]);

  return (
    <div className="app">
      <AppBar title={isCustom ? "나만의 스타일" : t.name} onBack={back} progress={(idx + 1) / steps.length} />
      <main className="view">
        {step === "mood" && (
          <>
            <h1 className="h2">어떤 분위기를<br />원하세요?</h1>
            <p className="sub">여러 개 골라도 돼요</p>
            <div className="chips">
              {MOODS.map((m) => {
                const on = moods.includes(m);
                return (
                  <button
                    key={m}
                    className={`chipbtn ${on ? "on" : ""}`}
                    aria-pressed={on}
                    onClick={() => setMoods(on ? moods.filter((x) => x !== m) : [...moods, m])}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "scene" && (
          <>
            <h1 className="h2">원하는 장면을<br />적어 주세요</h1>
            <p className="sub">장면 3~4개 정도면 충분해요</p>
            <div className="field">
              <label htmlFor="customText">장면 설명</label>
              <textarea
                id="customText"
                className="textarea"
                maxLength={300}
                value={customText}
                placeholder="예) 아빠랑 바닷가를 걸으며 모래성을 쌓는 장면"
                onChange={(e) => setCustomText(e.target.value)}
              />
              <span className="counter">{customText.length}/300</span>
            </div>
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => setCustomText((v) => (v.trim() ? v.trim() + "\n" : "") + ex)}>
                  + {ex}
                </button>
              ))}
            </div>
            <div className="notice">
              <Info />
              <span>적어 주신 내용은 담당자가 확인한 뒤 제작해요. 유명 캐릭터나 연예인처럼 저작권이 있는 요청은 만들 수 없어요.</span>
            </div>
          </>
        )}

        {step === "photos" && (
          <>
            <h1 className="h2">아이 사진을<br />올려 주세요</h1>
            <p className="sub">{PHOTO_MIN}~{PHOTO_MAX}장이면 충분해요. 얼굴이 잘 보일수록 닮게 나와요.</p>
            <div className="guide-ex">
              <div className="ex"><div className="pic"><div className="face"><i /></div></div><span className="ok">좋아요</span><span>정면, 밝은 곳</span></div>
              <div className="ex"><div className="pic dark"><div className="face"><i /></div></div><span className="no">아쉬워요</span><span>어두운 사진</span></div>
              <div className="ex"><div className="pic cover"><div className="face"><i /></div><div className="hand" /></div><span className="no">아쉬워요</span><span>얼굴이 가려짐</span></div>
            </div>
            <div className="uploader">
              {photos.map((p, i) => (
                <div className="slot" key={p.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`올린 사진 ${i + 1}`} />
                  <button className="x" aria-label={`사진 ${i + 1} 빼기`} onClick={() => removePhoto(i)}>×</button>
                </div>
              ))}
              {photos.length < PHOTO_MAX && (
                <label className="addslot">
                  <Plus />
                  <span>{photos.length}/{PHOTO_MAX}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={!!busy}
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {photos.length >= PHOTO_MIN ? (
              <div className="feedback good"><Check /> 좋아요! 이제 다음으로 넘어가도 돼요</div>
            ) : (
              <div className="feedback wait">{PHOTO_MIN - photos.length}장 더 올려 주세요</div>
            )}
            <div className="notice">
              <Lock />
              <span>사진 속 촬영 위치 정보는 올리기 전에 지워져요. 사진은 암호화해서 보관하고, 영상이 완성되고 7일 뒤 자동으로 지워요.</span>
            </div>
          </>
        )}

        {step === "caption" && (
          <>
            <h1 className="h2">영상에 들어갈<br />문구를 정해 주세요</h1>
            <div className="field">
              <label htmlFor="nickname">아이 애칭</label>
              <input id="nickname" className="input" maxLength={10} placeholder="서아" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              <span className="hint">실명 대신 애칭도 괜찮아요</span>
            </div>
            <div className="field">
              <label htmlFor="caption">엔딩 자막</label>
              <input id="caption" className="input" maxLength={24} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <div className={`subprev ${t.cls}`}>
              <div className="bg" />
              <span className="pl">엔딩 미리보기</span>
              <div className="cap">
                <b>{caption}</b>
                <span>{nickname.trim() || "서아"}의 첫 번째 생일</span>
              </div>
            </div>
            <div className="field">
              <span className="label" id="music-label">배경음악</span>
              <div className="radios" role="radiogroup" aria-labelledby="music-label">
                {MUSIC.map((m, i) => (
                  <button key={m.name} className={`radio ${music === i ? "on" : ""}`} role="radio" aria-checked={music === i} onClick={() => setMusic(i)}>
                    <span className="rc" />
                    <div><b>{m.name}</b><small>3:00 · {m.desc}</small></div>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="phone">완성 알림 받을 휴대폰 번호</label>
              <input id="phone" className="input" inputMode="numeric" autoComplete="tel" placeholder="01012345678" maxLength={13} value={phone} onChange={(e) => setPhone(e.target.value)} />
              <span className="hint">카카오 알림톡으로 진행 상황을 알려 드려요. 영상 보관이 끝나면 함께 지워요.</span>
            </div>
          </>
        )}

        {step === "consent" && (
          <>
            <h1 className="h2">마지막으로<br />동의가 필요해요</h1>
            <div className="promise">
              <Shield />
              <div>
                <b>사진은 7일 뒤 자동으로 지워져요</b>
                <p>영상 제작에만 쓰고, 담당자 1명만 볼 수 있어요. 완성 후엔 언제든 바로 지울 수도 있어요.</p>
              </div>
            </div>
            <button
              className={`allagree ${allAgreed ? "on" : ""}`}
              onClick={() => setAgree(Object.fromEntries(CONSENTS.map((c) => [c.id, !allAgreed])))}
            >
              <span className={`ck ${allAgreed ? "on" : ""}`}><Check /></span>전체 동의하기
            </button>
            <ul className="terms">
              {CONSENTS.map((c) => (
                <li key={c.id} className={`term ${open[c.id] ? "open" : ""}`}>
                  <div className="head">
                    <button className="lbl" role="checkbox" aria-checked={!!agree[c.id]} onClick={() => setAgree({ ...agree, [c.id]: !agree[c.id] })}>
                      <span className={`ck sm ${agree[c.id] ? "on" : ""}`}><Check /></span>
                      <span><span className={c.required ? "req" : "opt"}>[{c.required ? "필수" : "선택"}]</span> {c.label}</span>
                    </button>
                    <button className="more" aria-label="자세히 보기" aria-expanded={!!open[c.id]} onClick={() => setOpen({ ...open, [c.id]: !open[c.id] })}>
                      <Down />
                    </button>
                  </div>
                  <div className="body">
                    <table><tbody>{c.rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && <p className="error" role="alert">{error}</p>}
      </main>
      <CTA>
        <button className="btn" disabled={!canNext[step] || !!busy} onClick={next}>
          {busy ?? (step === "consent" ? "동의하고 결제로 이동" : "다음")}
        </button>
      </CTA>
    </div>
  );
}
