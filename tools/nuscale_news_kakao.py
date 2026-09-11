# -*- coding: utf-8 -*-
"""뉴스케일파워(NuScale Power) 관련 최신 뉴스를 카카오톡 '나에게 보내기'로 보낸다.

기본은 최근 2시간 안에 나온 기사만 고른다. 부동산 자동화(sudo-zip)의
notify_kakao.py 와 같은 토큰 파일(info.json)을 그대로 쓰므로, 그 코드가
돌아가는 PC에서 실행하면 된다.

    python tools\\nuscale_news_kakao.py            # 최근 2시간, 카카오 전송
    python tools\\nuscale_news_kakao.py --dry      # 보내지 않고 화면에만
    python tools\\nuscale_news_kakao.py --hours 6  # 최근 6시간
    python tools\\nuscale_news_kakao.py --all      # 이미 보낸 기사도 다시

뉴스는 구글 뉴스 RSS(한국어·영어)에서 받는다. API 키가 필요 없다.
한 번 보낸 기사는 data/nuscale_sent.json 에 적어 두고 다시 보내지 않으므로
작업 스케줄러에 걸어 두고 반복 실행해도 된다.
"""
from __future__ import annotations

import email.utils
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE_PATH = HERE.parent / "data" / "nuscale_sent.json"
KST = timezone(timedelta(hours=9))

# 검색어 → (언어, 국가, ceid). 한국어 기사와 영어 기사를 둘 다 본다.
QUERIES = [
    ("뉴스케일파워 OR 뉴스케일 OR NuScale", "ko", "KR", "KR:ko"),
    ("NuScale", "en-US", "US", "US:en"),
]
# 제목에 이 말이 하나도 없으면 뉴스케일과 무관한 검색 잡음으로 보고 버린다.
MUST_HAVE = re.compile(r"nuscale|뉴스케일|\bSMR\b", re.I)

# 부동산 자동화 저장소 위치. notify_kakao.py 를 여기서 가져온다.
KAKAO_DIRS = [
    os.environ.get("NOTIFY_KAKAO_DIR", ""),
    str(HERE.parent.parent / "sudo-zip"),
    r"C:\Users\tnals\OneDrive\바탕 화면\sudo-zip",
    r"C:\Users\tnals\sudo-zip",
]


# ── 뉴스 수집 ──────────────────────────────────────────────────────────
def _rss(query: str, hl: str, gl: str, ceid: str) -> list[dict]:
    url = ("https://news.google.com/rss/search?q="
           + urllib.parse.quote(query + " when:1d")
           + f"&hl={hl}&gl={gl}&ceid={urllib.parse.quote(ceid)}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        root = ET.fromstring(res.read())
    out = []
    for it in root.findall(".//item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        pub = it.findtext("pubDate") or ""
        src = it.findtext("source") or ""
        try:
            when = email.utils.parsedate_to_datetime(pub)
        except Exception:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        # 구글 RSS 제목은 "제목 - 매체" 꼴이라 매체를 떼어 둔다
        if not src and " - " in title:
            title, src = title.rsplit(" - ", 1)
        out.append({"title": title, "source": src, "link": link, "when": when})
    return out


def fetch_recent(hours: float) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    seen: set[str] = set()
    items: list[dict] = []
    for q, hl, gl, ceid in QUERIES:
        try:
            rows = _rss(q, hl, gl, ceid)
        except Exception as exc:
            print(f"  [rss] {hl} 수집 실패: {exc}")
            continue
        for r in rows:
            if r["when"] < cutoff or not MUST_HAVE.search(r["title"]):
                continue
            key = re.sub(r"\W+", "", r["title"].lower())[:60]
            if key in seen:
                continue
            seen.add(key)
            items.append(r)
    items.sort(key=lambda r: r["when"], reverse=True)
    return items


# ── 보낸 기록 ──────────────────────────────────────────────────────────
def _load_sent() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_sent(sent: dict) -> None:
    # 3일 지난 기록은 버린다 — 파일이 끝없이 불어나지 않게
    limit = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    sent = {k: v for k, v in sent.items() if v >= limit}
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(sent, indent=1, ensure_ascii=False),
                          encoding="utf-8")


# ── 카카오 ─────────────────────────────────────────────────────────────
def _kakao():
    """sudo-zip/notify_kakao.py 를 찾아 가져온다."""
    for d in KAKAO_DIRS:
        if d and (Path(d) / "notify_kakao.py").exists():
            sys.path.insert(0, d)
            import notify_kakao  # noqa: E402
            return notify_kakao
    raise SystemExit(
        "notify_kakao.py 를 찾지 못했습니다. sudo-zip 폴더 위치를 "
        "환경변수 NOTIFY_KAKAO_DIR 로 알려주세요.")


def _fmt(r: dict) -> str:
    t = r["when"].astimezone(KST).strftime("%H:%M")
    src = f" ({r['source']})" if r["source"] else ""
    return f"▪ {t} {r['title']}{src}\n{r['link']}"


def _chunks(items: list[dict], hours: float) -> list[tuple[str, str, str]]:
    """카카오 text 템플릿은 1000자 제한이라 여러 통으로 나눈다."""
    head = f"뉴스케일파워 뉴스 · 최근 {hours:g}시간 {len(items)}건"
    out, buf, first = [], [], ""
    for r in items:
        line = _fmt(r)
        if buf and len("\n\n".join(buf + [line])) > 900:
            out.append((head, "\n\n".join(buf), first))
            buf, first = [], ""
        if not first:
            first = r["link"]
        buf.append(line)
    if buf:
        out.append((head, "\n\n".join(buf), first))
    if len(out) > 1:
        out = [(f"{h} ({i + 1}/{len(out)})", b, l)
               for i, (h, b, l) in enumerate(out)]
    return out


def main(argv: list[str]) -> int:
    dry = "--dry" in argv
    resend = "--all" in argv
    hours = 2.0
    if "--hours" in argv:
        hours = float(argv[argv.index("--hours") + 1])

    items = fetch_recent(hours)
    sent = _load_sent()
    fresh = [r for r in items if resend or r["link"] not in sent]
    print(f"최근 {hours:g}시간 기사 {len(items)}건, 새로 보낼 것 {len(fresh)}건")
    for r in fresh:
        print("  " + _fmt(r).replace("\n", "\n    "))
    if not fresh:
        return 0
    if dry:
        return 0

    kakao = _kakao()
    ok = 0
    for title, body, link in _chunks(fresh, hours):
        if kakao.send_text(title, body, link):
            ok += 1
            print(f"  [카카오] 전송 완료: {title}")
    if ok:
        now = datetime.now(timezone.utc).isoformat()
        for r in fresh:
            sent[r["link"]] = now
        _save_sent(sent)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
