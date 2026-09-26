import { notFound } from "next/navigation";
import { AppBar, CTA, LinkButton, Poster } from "@/components/ui";
import { TEMPLATES, getTemplate, mmss, won } from "@/lib/catalog";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

export default async function TemplatePage(props: PageProps<"/templates/[id]">) {
  const { id } = await props.params;
  const t = getTemplate(id);
  if (!t || t.id === "custom") notFound();

  const scenes = t.scenes.map((s, i) => {
    const start = t.scenes.slice(0, i).reduce((sum, x) => sum + x.seconds, 0);
    return { ...s, start, end: start + s.seconds };
  });

  return (
    <div className="app">
      <AppBar backHref="/" />
      <main className="view">
        {/* TODO: 실제 샘플 영상이 생기면 <video className="video">로 바꾼다 */}
        <Poster t={t} size="big" />
        <h1 className="h2">{t.name}</h1>
        <p className="sub">{t.desc}</p>
        <dl className="rows">
          <div className="row"><dt>영상 길이</dt><dd>3분</dd></div>
          <div className="row"><dt>제작 기간</dt><dd>결제 후 영업일 5일</dd></div>
          <div className="row"><dt>수정</dt><dd>1번 무료</dd></div>
          <div className="row"><dt>가격</dt><dd>{won(t.price)}</dd></div>
        </dl>
        <div className="divider" />
        <h2 className="sec-title" style={{ marginTop: 0 }}>장면 구성</h2>
        <ol className="scenes">
          {scenes.map((s) => (
            <li key={s.name}>
              <span className="tc">{mmss(s.start)}–{mmss(s.end)}</span>
              <div>
                <b>
                  {s.name} <span className={`tag ${s.kind === "photo" ? "grey" : ""}`}>{s.kind === "photo" ? "사진" : "AI 영상"}</span>
                </b>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="fine">샘플 영상은 동의를 받은 가족의 사진으로 만들었어요.</p>
      </main>
      <CTA>
        <LinkButton href={`/order/new?template=${t.id}`}>이 스타일로 만들기</LinkButton>
      </CTA>
    </div>
  );
}
