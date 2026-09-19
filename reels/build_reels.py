# -*- coding: utf-8 -*-
"""샘플 릴스 3편 + 엔딩 CTA 카드 + 훅 썸네일을 HTML → PNG → MP4 로 굽는다.
수도.zip 파이프라인과 같은 방식(헤드리스 크롬 캡처)이라 그대로 옮겨 쓸 수 있다.
수치는 전부 실제 자료(사이트 budget.json 2026-09-19, data/rent_11350.json)에서 뽑았다."""
import os, subprocess, json, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
CH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FF = "/root/.local/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
FONT = "file:///home/user/sudo-zip/assets/Pretendard-Regular.woff2"
SHOT = {k: f"file://{HERE}/shot_{k}.png" for k in ("gate", "budget", "rank")}

BASE = """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
@font-face{font-family:P;src:url("__FONT__") format("woff2");}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#0b0f16;color:#fff;
 font-family:P,"Pretendard",-apple-system,"Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased}
#c{position:relative;width:1080px;height:1920px;overflow:hidden;
 background:radial-gradient(120% 70% at 50% 0%,#1a2436 0%,#0b0f16 60%)}
.glow{position:absolute;width:900px;height:900px;border-radius:50%;filter:blur(120px);opacity:.35;
 background:#ff8a5c;left:50%;top:-520px;transform:translateX(-50%)}
.glow.b{background:#3182f6;top:auto;bottom:-620px;opacity:.22}
.wrap{position:absolute;left:0;right:0;top:0;bottom:0;padding:210px 64px 460px;display:flex;flex-direction:column;
 align-items:center;justify-content:center;text-align:center}
.wrap.top{justify-content:flex-start}
.eye{font-size:40px;font-weight:800;color:#ffd8c9;letter-spacing:.04em}
.q{margin-top:26px;font-size:92px;font-weight:900;line-height:1.18;letter-spacing:-.035em;word-break:keep-all}
.q b,.hl{color:#ff8a5c}
.q .bl{color:#7fb3ff}
.pill{margin-top:34px;display:inline-block;background:rgba(255,138,92,.16);border:2px solid rgba(255,138,92,.55);
 border-radius:999px;padding:14px 32px;font-size:32px;font-weight:800;color:#ffd8c9}
.pill.bl{background:rgba(49,130,246,.16);border-color:rgba(49,130,246,.6);color:#cfe1ff}
.big{font-size:300px;font-weight:900;line-height:1;letter-spacing:-.06em;color:#ff8a5c;
 text-shadow:0 20px 60px rgba(255,138,92,.35)}
.sub{margin-top:18px;font-size:44px;font-weight:700;color:#dfe6f0;line-height:1.4;word-break:keep-all}
.sub small{display:block;font-size:30px;color:#8b95a1;margin-top:10px;font-weight:600}
.cta{position:absolute;left:52px;right:52px;bottom:520px;text-align:center;font-size:40px;font-weight:800;
 color:#fff;line-height:1.35;word-break:keep-all;text-shadow:0 4px 16px rgba(0,0,0,.8)}
.cta b{color:#ff8a5c}
.tag{position:absolute;left:0;right:0;bottom:470px;text-align:center;font-size:30px;font-weight:800;color:rgba(255,255,255,.75)}
.foot{position:absolute;left:60px;right:60px;bottom:400px;text-align:center;font-size:22px;color:#6b7684;line-height:1.5}
/* 폰 프레임 */
.phone{position:relative;width:640px;height:1385px;border-radius:70px;background:#000;padding:16px;
 box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 3px #2b3440}
.phone .scr{width:100%;height:100%;border-radius:56px;overflow:hidden;background:#fff;position:relative}
.phone img{width:100%;display:block}
.phone .notch{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:200px;height:34px;border-radius:20px;background:#000}
.cap{margin-top:40px;font-size:50px;font-weight:900;line-height:1.25;letter-spacing:-.02em;word-break:keep-all}
.cap b{color:#ff8a5c}
.cap .bl{color:#7fb3ff}
/* 표 */
.tbl{width:952px;margin-top:40px;border-radius:28px;overflow:hidden;background:rgba(255,255,255,.06);
 border:1.5px solid rgba(255,255,255,.12)}
.row{display:flex;align-items:center;gap:22px;padding:24px 30px;border-top:1px solid rgba(255,255,255,.08);text-align:left}
.row:first-child{border-top:none}
.row.dim{opacity:.16}
.row .no{width:58px;height:58px;border-radius:50%;background:#2b3440;color:#fff;font-weight:900;font-size:30px;
 display:flex;align-items:center;justify-content:center;flex:none}
.row.hot .no{background:#ff8a5c;color:#0b0f16}
.row .nm{flex:1;min-width:0}
.row .nm b{display:block;font-size:38px;font-weight:900;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .nm .s{display:block;font-size:26px;color:#8b95a1;margin-top:4px;font-weight:600}
.row .amt{font-size:42px;font-weight:900;color:#ffd8c9;white-space:nowrap;text-align:right}
.row .amt small{display:block;font-size:22px;color:#8b95a1;font-weight:600}
.gu{display:inline-block;background:rgba(127,179,255,.18);color:#cfe1ff;border-radius:10px;padding:2px 12px;font-size:26px;font-weight:800;margin-right:8px;vertical-align:4px}
/* 막대 */
.bars{width:952px;margin-top:50px}
.bar{display:flex;align-items:center;gap:24px;margin-top:26px}
.bar .lb{width:150px;text-align:right;font-size:44px;font-weight:900;color:#fff}
.bar .tr{flex:1;height:64px;border-radius:32px;background:rgba(255,255,255,.08);overflow:hidden}
.bar .fl{height:100%;border-radius:32px;background:linear-gradient(90deg,#ff8a5c,#ffb37a)}
.bar .v{width:170px;text-align:left;font-size:44px;font-weight:900;color:#ffd8c9}
/* CTA 카드 */
.ctacard{width:952px;background:#fff;color:#191f28;border-radius:40px;padding:56px 48px;text-align:center;
 box-shadow:0 30px 80px rgba(0,0,0,.5)}
.ctacard h1{font-size:64px;font-weight:900;letter-spacing:-.03em;line-height:1.2;word-break:keep-all}
.ctacard h1 b{color:#3182f6}
.steps{margin-top:40px;display:flex;flex-direction:column;gap:18px;text-align:left}
.step{display:flex;align-items:center;gap:22px;background:#eef4fd;border-radius:24px;padding:24px 28px}
.step .n{width:56px;height:56px;border-radius:50%;background:#3182f6;color:#fff;font-weight:900;font-size:30px;
 display:flex;align-items:center;justify-content:center;flex:none}
.step .t{font-size:36px;font-weight:800;line-height:1.3;word-break:keep-all}
.step .t b{color:#3182f6}
.kw{display:inline-block;background:#191f28;color:#fff;border-radius:14px;padding:4px 18px;font-weight:900}
.ctacard .note{margin-top:30px;font-size:26px;color:#5a6472;line-height:1.5}
</style></head><body><div id="c"><div class="glow"></div><div class="glow b"></div>__BODY__</div></body></html>"""

def page(body): return BASE.replace("__FONT__", FONT).replace("__BODY__", body)

TAG = '<div class="tag">@sudo__zip</div>'
CTA_LINE = '<div class="cta">댓글에 <b>코드</b> 남기고 팔로우하면<br>DM으로 <b>입장코드</b>를 보내드려요</div>'

def phone(shot, cap, top=True):
    return f'''<div class="wrap top" style="padding-top:150px">
      <div class="phone"><div class="scr"><img src="{shot}"></div><div class="notch"></div></div>
      <div class="cap">{cap}</div></div>{TAG}'''

def cta_card(title, steps, note):
    st = "".join(f'<div class="step"><div class="n">{i+1}</div><div class="t">{s}</div></div>' for i, s in enumerate(steps))
    return f'''<div class="wrap"><div class="ctacard"><h1>{title}</h1><div class="steps">{st}</div>
      <div class="note">{note}</div></div></div>{TAG}'''

CTA_STEPS = ['이 릴스에 댓글 <span class="kw">코드</span> 남기기',
             '<b>@sudo__zip</b> 팔로우',
             'DM으로 받은 <b>입장코드</b>로 프로필 링크 입장']
CTA_NOTE = "예산으로 찾기 · 구별 순위 · 역세권 도보 · 전세 갭 — 전부 무료예요"

# ───────────── 릴스 A: 입장코드 받는 법 ─────────────
A = [
 (2.2, f'''<div class="wrap"><div class="eye">수도.zip</div>
   <div class="q">부동산 사이트인데<br><b>입장코드</b>가 있다?</div>
   <div class="pill">무료 · 팔로워에게만 열려요</div></div>{CTA_LINE}{TAG}'''),
 (3.0, phone(SHOT["gate"], '이 문은 <b>코드</b>가 있어야 열려요')),
 (3.5, phone(SHOT["budget"], '<span class="bl">5억</span> 넣으면 살 수 있는<br>아파트 <b>186곳</b>이 바로 나와요')),
 (3.0, phone(SHOT["rank"], '구마다 제일 비싼 단지 ·<br>역세권 도보 · 전세 갭까지')),
 (3.3, cta_card('입장코드 받는 법은<br><b>3초</b>면 끝나요', CTA_STEPS, CTA_NOTE)),
]

# ───────────── 릴스 B: 5억으로 서울 84㎡? (budget.json 2026-09-19) ─────────────
B_LIST = [("도봉구","동익미라벨","쌍문동 · 4호선 쌍문 · 495세대","4억9,500","3개월 1건"),
          ("도봉구","신동아4","방학동 · 1호선 방학 · 361세대","4억9,000","3개월 1건"),
          ("양천구","신안약수","신월동 · 2호선 신정네거리 · 440세대","4억9,000","최근거래 6/5"),
          ("도봉구","우성1","방학동 · 4호선 쌍문 · 658세대","4억8,700","3개월 1건"),
          ("노원구","수락파크","상계동 · 7호선 수락산 · 468세대","3억5,000","최근거래 3/9")]
def rows_html(items, upto=None, hot=1):
    h = []
    for i, (gu, apt, sub, amt, basis) in enumerate(items):
        dim = "" if upto is None or i < upto else " dim"
        h.append(f'<div class="row{" hot" if i < hot else ""}{dim}"><div class="no">{i+1}</div>'
                 f'<div class="nm"><b><span class="gu">{gu}</span>{apt}</b><span class="s">{sub}</span></div>'
                 f'<div class="amt">{amt}<small>{basis}</small></div></div>')
    return '<div class="tbl">' + "".join(h) + '</div>'

B = [
 (2.4, f'''<div class="wrap"><div class="eye">예산으로 찾기</div>
   <div class="q">아직도 <b>5억</b>으로<br>서울에 <span class="bl">84㎡</span>를<br>살 수 있다고?</div>
   <div class="pill">300세대 이상 · 최근 3개월 평균</div>
   <div class="sub" style="margin-top:44px">몇 곳일까요? 댓글로 먼저 맞혀보세요 👇</div></div>{TAG}'''),
 (2.6, f'''<div class="wrap"><div class="eye">서울 25개 구 전체에서</div>
   <div class="big">5곳</div>
   <div class="sub">도봉 3 · 노원 1 · 양천 1<small>서울·경기 전체로 넓히면 186곳</small></div></div>{TAG}'''),
 (3.8, f'''<div class="wrap top" style="padding-top:170px"><div class="eye">5억 이하 84㎡ · 서울</div>
   <div class="cap" style="margin-top:18px">이 <b>5곳</b>이에요</div>{rows_html(B_LIST)}
   <div class="foot" style="position:static;margin-top:26px">최근 3개월 매매 평균 기준 · 석 달 안에 거래가 없으면 가장 최근 거래 하나 · 자료 국토교통부 실거래가</div></div>{TAG}'''),
 (3.0, f'''<div class="wrap"><div class="eye">예산을 조금만 올리면</div>
   <div class="q">살 수 있는 곳이<br><b>16배</b> 늘어요</div>
   <div class="bars">
    <div class="bar"><div class="lb">5억</div><div class="tr"><div class="fl" style="width:6%"></div></div><div class="v">5곳</div></div>
    <div class="bar"><div class="lb">6억</div><div class="tr"><div class="fl" style="width:46%"></div></div><div class="v">37곳</div></div>
    <div class="bar"><div class="lb">7억</div><div class="tr"><div class="fl" style="width:100%"></div></div><div class="v">81곳</div></div>
   </div><div class="sub" style="margin-top:40px"><small>7억이면 도봉 25 · 노원 15 · 은평 6 · 관악 6</small></div></div>{TAG}'''),
 (3.2, cta_card('내 예산으로<br><b>직접</b> 찾아보세요', ['댓글 <span class="kw">코드</span> + 팔로우 → DM으로 입장코드',
        '프로필 링크 → <b>예산으로 찾기</b>', '가진 돈 넣기 → 서울·경기 8,547단지에서 골라줘요'],
        '입장코드는 팔로워에게만 드려요 · 무료')),
]

# ───────────── 릴스 C: 노원구 84㎡ 전세 TOP5 (rent_11350.json, 신규 계약 8.20~9.11) ─────────────
C_LIST = [("중계동","주공5","15층 · 1992년","7억5,000","8/20"),
          ("공릉동","태릉해링턴플레이스","18층 · 2022년","7억5,000","9/2"),
          ("하계동","우성","8층 · 1988년","7억3,000","8/22"),
          ("중계동","중앙하이츠아쿠아","5층 · 2008년","7억3,000","9/9"),
          ("하계동","학여울청구","15층 · 1999년","7억1,000","9/4")]
C = [(2.2, f'''<div class="wrap"><div class="eye">노원구 · 전용 84㎡</div>
   <div class="q">노원구 전세,<br>지금 <b>얼마</b>일까?</div>
   <div class="pill bl">신규 계약 · 8.20 ~ 9.11</div>
   <div class="sub" style="margin-top:44px">1위 보증금, 댓글로 맞혀보세요 👇</div></div>{TAG}''')]
for k in range(1, 6):
    C.append((0.85 if k < 5 else 2.0, f'''<div class="wrap top" style="padding-top:170px"><div class="eye">노원구 84㎡ 전세 보증금 TOP 5</div>
   <div class="cap" style="margin-top:18px">신규 계약 <b>26건</b> 중 비싼 순</div>{rows_html(C_LIST, upto=k, hot=1)}
   <div class="foot" style="position:static;margin-top:26px">계약일 기준 · 신고 기한이 30일이라 아직 신고되지 않은 계약은 다음 회차에 잡혀요 · 자료 국토교통부 실거래가</div></div>{TAG}'''))
C += [
 (2.6, f'''<div class="wrap"><div class="eye">같은 기간 노원구 84㎡ 신규 전세 26건</div>
   <div class="q">절반은<br><b>5억 4,500</b> 아래</div>
   <div class="sub">가장 싼 신규 전세는 하계동 벽산 <span class="hl">2억 6,000</span><small>6층 · 1988년 · 8/21 계약</small></div></div>{TAG}'''),
 (3.0, cta_card('우리 동네 전세는?<br><b>지도</b>에서 바로 확인', ['댓글 <span class="kw">코드</span> + 팔로우 → DM으로 입장코드',
        '프로필 링크 → <b>지도</b> → 단지 누르기', '최근 거래 · 최고가 · 전세 · 가까운 역이 한 장에'], '수도권 8,600단지 · 무료')),
]

# ───────────── 단독 카드: 엔딩 CTA · 훅 썸네일 ─────────────
END_CARD = cta_card('더 보고 싶다면<br><b>입장코드</b>를 받으세요', CTA_STEPS, CTA_NOTE)
HOOK_THUMB = f'''<div class="wrap"><div class="eye">오늘 신고가 · 9월 19일</div>
   <div class="q">노원구에서 오늘<br><b>가장 비싸게</b> 팔린<br>단지는?</div>
   <div class="pill">신고가 4건 · 정답은 3초 뒤</div>
   <div class="sub" style="margin-top:44px">단지 이름, 댓글로 먼저 맞혀보세요 👇</div></div>{CTA_LINE}{TAG}'''

def shoot(html, name):
    p = os.path.join(OUT, name + ".html"); open(p, "w", encoding="utf-8").write(html)
    png = os.path.join(OUT, name + ".png")
    subprocess.run([CH, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    "--allow-file-access-from-files", "--window-size=1080,1920",
                    "--force-device-scale-factor=1.3333333", f"--screenshot={png}", "file://" + p],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    return png

def reel(scenes, name):
    lst = os.path.join(OUT, name + ".txt")
    with open(lst, "w", encoding="utf-8") as f:
        pngs = []
        for i, (sec, body) in enumerate(scenes):
            png = shoot(page(body), f"{name}_{i+1:02d}"); pngs.append(png)
            f.write(f"file '{png}'\nduration {sec}\n")
        f.write(f"file '{pngs[-1]}'\nduration 0.034\n")   # concat demuxer 는 마지막 장을 한 프레임 더 적어야 길이가 맞는다
    total = sum(s for s, _ in scenes)
    mp4 = os.path.join(OUT, name + ".mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-t", f"{total:.2f}",
                    "-vf", "scale=1080:1920:flags=lanczos,format=yuv420p", "-r", "30",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", mp4],
                   check=True, timeout=600)
    print(name, "→", mp4, f"{sum(s for s, _ in scenes):.1f}s")

if __name__ == "__main__":
    which = sys.argv[1:] or ["A", "B", "C", "cards"]
    if "A" in which: reel(A, "reel_A_entrycode")
    if "B" in which: reel(B, "reel_B_budget5eok")
    if "C" in which: reel(C, "reel_C_nowon_jeonse")
    if "cards" in which:
        shoot(page(END_CARD), "card_ending_cta"); shoot(page(HOOK_THUMB), "card_hook_thumb"); print("cards done")
