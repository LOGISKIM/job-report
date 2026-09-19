# -*- coding: utf-8 -*-
"""릴스 B v3 — 썸네일은 사이트를 흐릿하게 깔고 까만 글씨만, 본문은 실제 사이트를 스크롤하며 설명.

    썸네일   사이트 화면 blur + 가운데 까만 자막 + 아래 수도.zip 워터마크 (그것만)
    본문     긴 화면을 통째로 찍어 ffmpeg 가 아래로 훑는다(진짜 스크롤처럼 보인다)
    자막     투명 PNG 로 따로 구워 얹는다 — 화면을 가리지 않게 아래쪽, 흰 알약에 까만 글씨
    끝       입장코드 CTA 카드

수치는 사이트가 그 자리에서 계산한 값을 그대로 찍은 것이다(2026-09-19 기준).
"""
import os, re, struct, subprocess, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out2"); os.makedirs(OUT, exist_ok=True)
MIRROR = os.path.join(os.path.dirname(HERE), "site_mirror")
CH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FF = "/root/.local/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
FONT = "file:///home/user/sudo-zip/assets/Pretendard-Regular.woff2"
PORT = "8765"
W, H = 1080, 1920

FONT_CSS = f'@font-face{{font-family:P;src:url("{FONT}") format("woff2");}}' \
           f'@font-face{{font-family:"Pretendard Variable";src:url("{FONT}") format("woff2");}}' \
           f'@font-face{{font-family:Pretendard;src:url("{FONT}") format("woff2");}}'

# ───────── 1. 사이트 화면 찍기 (긴 화면 통째로) ─────────
# won: 예산(억), grp: '' 전체 / '서울', tall: 찍을 세로 길이(CSS px)
SHOTS = [
    ("all5",    5, "",    1500),
    ("seoul5",  5, "서울", 1250),
    ("seoul7",  7, "서울", 1500),
]

def make_variant(name, won, grp):
    src = open(os.path.join(MIRROR, "budget.html"), encoding="utf-8").read()
    inject = (f'document.getElementById("won").value="{won}";'
              + (f'document.getElementById("f-grp").value="{grp}";' if grp else ""))
    # 내용이 실제로 어디서 끝나는지 제목에 적어 둔다 — 빈 여백까지 훑지 않으려고
    inject += ('setTimeout(function(){document.title="CONTENT_H="+'
               'document.querySelector(".wrap").getBoundingClientRect().height;},700);')
    src = src.replace('<head>', f'<head><style>{FONT_CSS}</style>', 1)
    src = src.replace('APT.setLines(d.lines);\n  draw();',
                      f'APT.setLines(d.lines);\n  {inject}\n  draw();', 1)
    p = os.path.join(MIRROR, f"_b2_{name}.html")
    open(p, "w", encoding="utf-8").write(src)
    return f"http://127.0.0.1:{PORT}/_b2_{name}.html?code=sudo119"

def shoot_site(name, won, grp, tall):
    """(png, 내용이 끝나는 CSS px) — 뒤쪽은 텅 빈 흰 자리라 훑을 값이 없다."""
    url = make_variant(name, won, grp)
    png = os.path.join(OUT, f"site_{name}.png")
    common = [CH, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
              "--allow-file-access-from-files", f"--window-size=390,{tall}",
              "--virtual-time-budget=9000"]
    subprocess.run(common + ["--force-device-scale-factor=3", f"--screenshot={png}", url],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
    dom = subprocess.run(common + ["--dump-dom", url], capture_output=True, text=True,
                         timeout=180).stdout
    m = re.search(r"CONTENT_H=([\d.]+)", dom)
    # .wrap 은 머리글 아래부터라 머리글 높이(대략 54)와 여유를 더한다
    content = (float(m.group(1)) + 70) if m else tall
    return png, min(content, tall)

# ───────── 2. 카드·자막 굽기 ─────────
def shoot_html(html, name, transparent=False):
    p = os.path.join(OUT, name + ".html"); open(p, "w", encoding="utf-8").write(html)
    png = os.path.join(OUT, name + ".png")
    cmd = [CH, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
           "--allow-file-access-from-files", f"--window-size={W},{H}",
           "--force-device-scale-factor=1.3333333"]
    if transparent:
        cmd.append("--default-background-color=00000000")
    cmd += [f"--screenshot={png}", "file://" + p]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    return png

MARK = ('.mark{position:absolute;left:0;right:0;bottom:250px;text-align:center;'
        'font-size:40px;font-weight:900;color:#3a4250;letter-spacing:-.02em}'
        '.mark i{color:#3182f6;font-style:normal}')

def cover(shot, text):
    """사이트를 흐릿하게 깔고 가운데 까만 글씨, 아래 수도.zip 워터마크. 그것만."""
    return f'''<!doctype html><meta charset="utf-8"><style>{FONT_CSS}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{W}px;height:{H}px;overflow:hidden;font-family:P,sans-serif}}
#c{{position:relative;width:{W}px;height:{H}px;overflow:hidden;background:#fff}}
.bg{{position:absolute;inset:-60px;background:url("file://{shot}") center top/cover no-repeat;
  filter:blur(26px) saturate(.85);transform:scale(1.06)}}
.veil{{position:absolute;inset:0;background:rgba(255,255,255,.58)}}
.t{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  padding:0 78px;text-align:center;font-size:104px;font-weight:900;line-height:1.24;
  letter-spacing:-.045em;color:#0d1116;word-break:keep-all}}
{MARK}</style>
<div id="c"><div class="bg"></div><div class="veil"></div>
<div class="t">{text}</div><div class="mark">수도<i>.</i>zip</div></div>'''

def sub(text, small=""):
    """본문 자막 — 투명 배경, 아래쪽 흰 알약에 까만 글씨. 화면을 안 가린다."""
    extra = f'<div class="srow"><div class="s">{small}</div></div>' if small else ""
    return f'''<!doctype html><meta charset="utf-8"><style>{FONT_CSS}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{W}px;height:{H}px;overflow:hidden;background:transparent;font-family:P,sans-serif}}
#c{{position:relative;width:{W}px;height:{H}px}}
.box{{position:absolute;left:54px;right:54px;bottom:540px;text-align:center}}
.b{{display:inline-block;background:#fff;border-radius:28px;padding:26px 38px;
  box-shadow:0 14px 40px rgba(13,17,22,.28);font-size:56px;font-weight:900;color:#0d1116;
  line-height:1.3;letter-spacing:-.03em;word-break:keep-all}}
.b em{{font-style:normal;color:#1b64da}}
.srow{{display:block;margin-top:16px}}
.s{{font-size:30px;font-weight:700;color:#0d1116;
  background:rgba(255,255,255,.92);border-radius:18px;padding:12px 22px;display:inline-block}}
.wm{{position:absolute;right:44px;top:56px;font-size:34px;font-weight:900;color:#0d1116;
  background:rgba(255,255,255,.86);border-radius:14px;padding:8px 18px;letter-spacing:-.02em}}
.wm i{{color:#3182f6;font-style:normal}}</style>
<div id="c"><div class="wm">수도<i>.</i>zip</div>
<div class="box"><div class="b">{text}</div>{extra}</div></div>'''

def cta():
    steps = [('1', '이 릴스에 댓글 <span class="kw">코드</span> 남기기'),
             ('2', '<b>@sudo__zip</b> 팔로우'),
             ('3', 'DM으로 받은 <b>입장코드</b>로 프로필 링크 입장')]
    st = "".join(f'<div class="step"><div class="n">{n}</div><div class="t">{t}</div></div>' for n, t in steps)
    return f'''<!doctype html><meta charset="utf-8"><style>{FONT_CSS}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{W}px;height:{H}px;overflow:hidden;font-family:P,sans-serif;background:#eef4fd}}
#c{{position:relative;width:{W}px;height:{H}px;display:flex;align-items:center;justify-content:center;
  padding:0 64px 300px}}
.card{{width:100%;background:#fff;border-radius:44px;padding:60px 48px;text-align:center;
  box-shadow:0 30px 80px rgba(49,90,160,.18)}}
h1{{font-size:70px;font-weight:900;letter-spacing:-.04em;line-height:1.2;color:#0d1116;word-break:keep-all}}
h1 b{{color:#1b64da}}
.step{{display:flex;align-items:center;gap:22px;background:#eef4fd;border-radius:26px;
  padding:26px 30px;margin-top:20px;text-align:left}}
.step .n{{width:58px;height:58px;border-radius:50%;background:#3182f6;color:#fff;font-weight:900;
  font-size:32px;display:flex;align-items:center;justify-content:center;flex:none}}
.step .t{{font-size:38px;font-weight:800;line-height:1.3;color:#0d1116;word-break:keep-all}}
.step .t b{{color:#1b64da}}
.kw{{display:inline-block;background:#0d1116;color:#fff;border-radius:14px;padding:4px 18px;font-weight:900}}
.note{{margin-top:32px;font-size:28px;color:#5a6472;line-height:1.5}}
{MARK}</style>
<div id="c"><div class="card"><h1>내 예산으로<br><b>직접</b> 찾아보세요</h1>{st}
<div class="note">예산으로 찾기 · 구별 순위 · 역세권 도보 · 전세 갭 — 전부 무료</div></div>
<div class="mark">수도<i>.</i>zip</div></div>'''

# ───────── 3. 스크롤 구간 만들기 ─────────
def png_size(path):
    with open(path, "rb") as f:
        return struct.unpack(">II", f.read(33)[16:24])

def scroll_clip(site_png, subs, dur, hold=1.0, out_name="seg", content_css=None):
    """site_png 를 위에서 아래로 훑으며 subs[(png, t0, t1)] 자막을 얹는다.

    자막 PNG 는 크게 구워 두고 여기서 화면 크기로 줄인다 — 크기가 어긋나면
    오른쪽이 잘린다(1차 시도에서 그랬다).
    """
    mp4 = os.path.join(OUT, out_name + ".mp4")
    ins = ["-loop", "1", "-t", f"{dur}", "-i", site_png]
    for p, _, _ in subs:
        ins += ["-loop", "1", "-t", f"{dur}", "-i", p]

    iw, ih = png_size(site_png)
    scaled_h = round(ih * W / iw)
    if content_css:                     # 내용이 끝나는 곳까지만 훑는다
        scaled_h = min(scaled_h, round(content_css * 3 * W / iw))
    span = max(0, scaled_h - H)
    move = max(0.1, dur - hold * 2)

    y = f"max(0\\,min({span}\\,(t-{hold})*{span / move:.2f}))"
    chain = [f"[0:v]scale={W}:-1,crop={W}:{H}:0:'{y}',format=yuv420p[bg]"]
    last = "bg"
    for i, (p, t0, t1) in enumerate(subs, start=1):
        chain.append(f"[{i}:v]scale={W}:{H}[s{i}]")
        tag = f"v{i}"
        chain.append(f"[{last}][s{i}]overlay=0:0:enable='between(t,{t0},{t1})'[{tag}]")
        last = tag
    graph = ";".join(chain)
    subprocess.run([FF, "-y", "-loglevel", "error", *ins,
                    "-filter_complex", graph, "-map", f"[{last}]",
                    "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-pix_fmt", "yuv420p", mp4], check=True, timeout=600)
    return mp4

def still_clip(png, dur, out_name):
    mp4 = os.path.join(OUT, out_name + ".mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-t", f"{dur}", "-i", png,
                    "-vf", f"scale={W}:{H},format=yuv420p", "-r", "30",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", mp4], check=True, timeout=300)
    return mp4

def concat(parts, name):
    lst = os.path.join(OUT, name + ".txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    mp4 = os.path.join(OUT, name + ".mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", "-movflags", "+faststart", mp4], check=True, timeout=300)
    return mp4

HOOK = "아직도 5억으로<br>서울에 84㎡를<br>살 수 있다고?"

def main():
    shots, heights = {}, {}
    for n, w, g, t in SHOTS:
        shots[n], heights[n] = shoot_site(n, w, g, t)
        print(f"  {n}: 내용 끝 {heights[n]:.0f}px")

    cov = shoot_html(cover(shots["seoul5"], HOOK), "cover")
    cta_png = shoot_html(cta(), "cta")

    s1a = shoot_html(sub('예산에 <em>5억</em>만 넣으면'), "s1a", transparent=True)
    s1b = shoot_html(sub('수도권 <em>186곳</em>이 바로 나와요',
                         '300세대 이상 · 전용 84㎡ · 최근 3개월 평균'), "s1b", transparent=True)
    s2a = shoot_html(sub('그런데 <em>서울</em>만 보면'), "s2a", transparent=True)
    s2b = shoot_html(sub('딱 <em>5곳</em>이에요', '도봉 3 · 양천 1 · 노원 1'), "s2b", transparent=True)
    s3a = shoot_html(sub('<em>7억</em>으로 올리면'), "s3a", transparent=True)
    s3b = shoot_html(sub('<em>81곳</em>으로 늘어요', '도봉 25 · 노원 15 · 은평 6 · 관악 6'), "s3b", transparent=True)

    parts = [
        still_clip(cov, 2.4, "seg0_cover"),
        scroll_clip(shots["all5"], [(s1a, 0, 2.4), (s1b, 2.4, 6.0)], 6.0, 1.0,
                    "seg1_all5", heights["all5"]),
        scroll_clip(shots["seoul5"], [(s2a, 0, 1.9), (s2b, 1.9, 5.0)], 5.0, 0.9,
                    "seg2_seoul5", heights["seoul5"]),
        scroll_clip(shots["seoul7"], [(s3a, 0, 1.7), (s3b, 1.7, 4.6)], 4.6, 0.9,
                    "seg3_seoul7", heights["seoul7"]),
        still_clip(cta_png, 2.8, "seg4_cta"),
    ]
    out = concat(parts, "reel_B2_budget_scroll")
    shutil.copy(cov, os.path.join(OUT, "reel_B2_cover.png"))
    print("완성 →", out)

if __name__ == "__main__":
    main()
