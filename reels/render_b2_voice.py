# -*- coding: utf-8 -*-
"""릴스 B(예산으로 찾기)를 내레이션과 함께 굽는다 — 그림은 다 구워 뒀고 소리만 새로 받는다.

왜 이렇게 나눠 뒀나. 화면(사이트 캡처·자막·카드)은 크롬으로 찍어 `assets_b2/` 에
넣어 두었다. 그래서 이 스크립트는 **ffmpeg 하나만** 있으면 돌고, 목소리를 바꾸면
그 길이에 맞춰 화면 길이가 다시 계산된다 — 말이 길어지면 그만큼 천천히 훑는다.

소리는 프로젝트의 `tts.py` 를 그대로 쓴다. 환경변수 TYPECAST_API_KEY /
TYPECAST_VOICE_ID 가 있으면 타입캐스트(ssfm-v30 · toneup 0.7 · 템포 1.1 ·
피치 +1 · -14 LUFS), 없으면 edge-tts 로 내려온다. 즉 PC 에서 그냥 돌리면
쓰던 목소리로 다시 구워진다.

실행:
    set PYTHONIOENCODING=utf-8
    python render_b2_voice.py                  → out/reel_B2_voice.mp4
    python render_b2_voice.py --edge           → 키가 있어도 edge 로(미리듣기, 크레딧 안 씀)
    python render_b2_voice.py --say            → 읽을 말만 보여 주고 끝낸다

올릴 때는 내레이션이 있으므로 볼륨을 뒤집는다:
    python -c "import io,publish_story as ps; ps.publish_reel(r'out/reel_B2_voice.mp4',
        io.open('reel_B_budget5eok_caption.txt',encoding='utf-8').read(),
        audio_id='1574238607820475', audio_volume=10, video_volume=100)"
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets_b2")
OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
VOICE = os.path.join(OUT, "voice"); os.makedirs(VOICE, exist_ok=True)
W, H = 1080, 1920
PAD = 0.25          # 문장 사이 쉬는 틈
COVER_LEAD = 0.3    # 썸네일에서 말이 시작되기 전 여유
CTA_TAIL = 0.6      # 마지막 카드가 말 끝나고 남는 시간
HOLD = 0.8          # 스크롤 장의 위아래 멈춤


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:                                   # 없으면 파이썬 패키지에 들어 있는 것
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        raise SystemExit("ffmpeg 을 찾지 못했습니다 — PATH 에 넣거나 pip install imageio-ffmpeg")


FF = ffmpeg()


def load_tts():
    """프로젝트의 tts.py 를 찾아 불러온다 — 목소리 설정이 거기 한 곳에 있다."""
    here = [os.environ.get("SUDO_ZIP_DIR"), HERE, os.path.dirname(HERE),
            os.path.join(os.path.dirname(HERE), "sudo-zip"),
            r"C:\Users\tnals\OneDrive\바탕 화면\클로드", "/home/user/sudo-zip"]
    for d in filter(None, here):
        if os.path.exists(os.path.join(d, "tts.py")):
            sys.path.insert(0, d)
            import tts
            return tts
    raise SystemExit("tts.py 를 못 찾았습니다 — SUDO_ZIP_DIR 에 프로젝트 폴더를 알려주세요")


def dur_of(path: str) -> float:
    out = subprocess.run([FF, "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    if not m:
        raise RuntimeError(f"길이를 못 읽었습니다: {path}")
    h, mm, s = m.groups()
    return int(h) * 3600 + int(mm) * 60 + float(s)


def png_size(path: str) -> tuple[int, int]:
    with open(path, "rb") as f:
        return struct.unpack(">II", f.read(33)[16:24])


def trim(src: str, dst: str) -> str:
    """앞뒤 무음을 잘라 낸다 — 합성기가 문장 끝에 0.5~1초를 붙여 보내 온다.

    그대로 두면 릴스가 6초쯤 늘어지고, 늘어짐은 완주율을 깎는다.
    쉬는 틈은 PAD 로 우리가 정한다.
    """
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-af",
                    "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB"
                    ":stop_periods=-1:stop_duration=0.15:stop_threshold=-45dB", dst],
                   check=True, timeout=180)
    return dst


def synth(lines: list[str], edge_only: bool) -> list[tuple[str, float]]:
    tts = load_tts()
    if edge_only:
        tts.typecast_save = lambda *a, **k: False
    got: list[tuple[str, float]] = []

    async def run():
        ways = set()
        for i, say in enumerate(lines):
            raw = os.path.join(VOICE, f"b2_{i:02d}.mp3")
            ways.add(await tts.save(say, raw,
                                    lines[i - 1] if i else "",
                                    lines[i + 1] if i + 1 < len(lines) else ""))
            cut = trim(raw, os.path.join(VOICE, f"b2_{i:02d}_cut.mp3"))
            got.append((cut, dur_of(cut)))
            print(f"  {i + 1:2d}. {got[-1][1]:5.2f}초  {say}")
        print("  소리:", " · ".join(sorted(ways)))
    asyncio.run(run())
    return got


def still(png: str, dur: float, name: str) -> str:
    mp4 = os.path.join(OUT, name + ".mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-t", f"{dur:.3f}",
                    "-i", png, "-vf", f"scale={W}:{H},format=yuv420p", "-r", "30",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", mp4],
                   check=True, timeout=600)
    return mp4


def scroll(site_png: str, subs: list[tuple[str, float, float]], dur: float,
           content_css: float, name: str) -> str:
    """긴 사이트 화면을 위에서 아래로 훑으며 자막을 얹는다.

    자막 PNG 는 크게 구워 두고 여기서 화면 크기로 줄인다 — 크기가 어긋나면
    오른쪽이 잘린다.
    """
    mp4 = os.path.join(OUT, name + ".mp4")
    ins = ["-loop", "1", "-t", f"{dur:.3f}", "-i", site_png]
    for p, _, _ in subs:
        ins += ["-loop", "1", "-t", f"{dur:.3f}", "-i", p]

    iw, ih = png_size(site_png)
    scaled_h = round(ih * W / iw)
    if content_css:                      # 내용이 끝나는 곳까지만 — 빈 흰 자리는 훑지 않는다
        scaled_h = min(scaled_h, round(content_css * 3 * W / iw))
    span = max(0, scaled_h - H)
    move = max(0.1, dur - HOLD * 2)

    y = f"max(0\\,min({span}\\,(t-{HOLD})*{span / move:.2f}))"
    chain = [f"[0:v]scale={W}:-1,crop={W}:{H}:0:'{y}',format=yuv420p[bg]"]
    last = "bg"
    for i, (_, t0, t1) in enumerate(subs, start=1):
        chain.append(f"[{i}:v]scale={W}:{H}[s{i}]")
        chain.append(f"[{last}][s{i}]overlay=0:0:enable='between(t,{t0:.2f},{t1:.2f})'[v{i}]")
        last = f"v{i}"
    subprocess.run([FF, "-y", "-loglevel", "error", *ins,
                    "-filter_complex", ";".join(chain), "-map", f"[{last}]",
                    "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-pix_fmt", "yuv420p", mp4], check=True, timeout=900)
    return mp4


def concat(parts: list[str], name: str, copy: bool = True) -> str:
    lst = os.path.join(OUT, name + ".txt")
    with open(lst, "w", encoding="utf-8") as f:
        f.write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(OUT, name + os.path.splitext(parts[0])[1])
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", lst, "-c", "copy", out], check=True, timeout=600)
    return out


def audio_track(items: list[tuple[str, float]]) -> str:
    """문장마다 제 창 길이에 맞춰 뒤를 조용히 채우고 이어 붙인다."""
    parts = []
    for i, (mp3, win) in enumerate(items):
        wav = os.path.join(VOICE, f"pad_{i:02d}.wav")
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp3, "-af", "apad",
                        "-t", f"{win:.3f}", "-ar", "44100", "-ac", "2", wav],
                       check=True, timeout=180)
        parts.append(wav)
    return concat(parts, "b2_track")


def main() -> None:
    edge_only = "--edge" in sys.argv
    man = json.load(open(os.path.join(ASSETS, "manifest.json"), encoding="utf-8"))
    says = [man["cover"]["say"]] + [l["say"] for sc in man["scenes"] for l in sc["lines"]] \
        + [man["cta"]["say"]]
    if "--say" in sys.argv:
        for s in says:
            print(s)
        return

    print("소리 받는 중…")
    voices = synth(says, edge_only)
    asset = lambda n: os.path.join(ASSETS, n)

    windows, parts, k = [], [], 0

    d = COVER_LEAD + voices[k][1] + PAD
    parts.append(still(asset(man["cover"]["png"]), d, "seg0_cover"))
    windows.append((voices[k][0], d)); k += 1

    for si, sc in enumerate(man["scenes"], start=1):
        subs, t = [], 0.0
        for j, line in enumerate(sc["lines"]):
            win = voices[k + j][1] + PAD
            subs.append((asset(line["png"]), t, t + win))
            windows.append((voices[k + j][0], win))
            t += win
        k += len(sc["lines"])
        parts.append(scroll(asset(sc["png"]), subs, t, sc["content_css"],
                            f"seg{si}_{sc['name']}"))

    d = voices[k][1] + PAD + CTA_TAIL
    parts.append(still(asset(man["cta"]["png"]), d, "seg9_cta"))
    windows.append((voices[k][0], d))

    silent = concat(parts, "b2_silent")
    wav = audio_track(windows)
    out = os.path.join(OUT, "reel_B2_voice.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", silent, "-i", wav,
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
                    "-shortest", "-movflags", "+faststart", out], check=True, timeout=600)
    print(f"완성 → {out}  ({sum(w for _, w in windows):.1f}초)")


if __name__ == "__main__":
    main()
