"""가계부 대시보드 HTML 생성. server.py의 GET /dashboard 가 사용한다."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta

import db

MAX_MERCHANTS = 7  # 이 수를 넘는 가맹점은 '기타'로 접는다


def month_bounds(ym: str) -> tuple[datetime, datetime]:
    start = datetime.strptime(ym, "%Y-%m")
    end = (start + timedelta(days=32)).replace(day=1)
    return start, end


def build_data(ym: str) -> dict:
    start, end = month_bounds(ym)
    conn = db.connect()
    try:
        rows = db.fetch_between(conn, start, end)
    finally:
        conn.close()

    active = [r for r in rows if not r["canceled"]]
    total = sum(r["amount"] for r in active)
    today = datetime.now().strftime("%Y-%m-%d")
    today_total = sum(r["amount"] for r in active if r["ts"][:10] == today)

    days_in_month = ((end - timedelta(days=1)).day)
    by_day = defaultdict(lambda: {"amt": 0, "cnt": 0})
    for r in active:
        d = int(r["ts"][8:10])
        by_day[d]["amt"] += r["amount"]
        by_day[d]["cnt"] += 1
    days = [{"d": d, "amt": by_day[d]["amt"], "cnt": by_day[d]["cnt"]}
            for d in range(1, days_in_month + 1)]

    # 지출이 발생한 마지막 날까지의 일평균 (이번 달이면 오늘까지)
    now = datetime.now()
    elapsed = now.day if start <= now < end else days_in_month
    daily_avg = total // elapsed if elapsed else 0

    by_merchant = defaultdict(int)
    for r in active:
        by_merchant[r["merchant"]] += r["amount"]
    ranked = sorted(by_merchant.items(), key=lambda kv: kv[1], reverse=True)
    merchants = [{"name": n, "amt": a} for n, a in ranked[:MAX_MERCHANTS]]
    rest = sum(a for _, a in ranked[MAX_MERCHANTS:])
    if rest:
        merchants.append({"name": "기타", "amt": rest})

    recent = [{
        "ts": r["ts"][5:16].replace("T", " "),
        "merchant": r["merchant"],
        "amount": r["amount"],
        "installment": r["installment"],
        "canceled": bool(r["canceled"]),
        "source": r["source"],
    } for r in sorted(rows, key=lambda r: r["ts"], reverse=True)[:20]]

    prev_ym = (start - timedelta(days=1)).strftime("%Y-%m")
    next_ym = end.strftime("%Y-%m") if end <= datetime.now() else None

    return {
        "ym": ym, "title": f"{start:%Y년 %m월}",
        "prev": prev_ym, "next": next_ym,
        "total": total, "today": today_total,
        "count": len(active), "dailyAvg": daily_avg,
        "days": days, "merchants": merchants, "recent": recent,
    }


def render(ym: str) -> str:
    data = build_data(ym)
    return TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False))


TEMPLATE = r"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>가계부 대시보드</title>
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb;
  --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --baseline: #c3c2b7; --border: rgba(11,11,11,.10);
  --series: #2a78d6; --series-soft: #9ec5f4;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19;
    --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --baseline: #383835; --border: rgba(255,255,255,.10);
    --series: #3987e5; --series-soft: #1c5cab;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--page); color: var(--ink);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  padding: 20px; max-width: 960px; margin-inline: auto;
}
header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
header h1 { font-size: 20px; margin: 0; font-weight: 700; }
header nav a { color: var(--ink-2); text-decoration: none; padding: 2px 8px; border: 1px solid var(--border); border-radius: 6px; }
header nav a:hover { color: var(--ink); }
header .spacer { flex: 1; }
header .stamp { color: var(--muted); font-size: 12px; }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
.tile .label { color: var(--ink-2); font-size: 12px; margin-bottom: 4px; }
.tile .value { font-size: 26px; font-weight: 700; letter-spacing: -.01em; }
.tile .value small { font-size: 14px; font-weight: 500; color: var(--ink-2); margin-left: 2px; }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.card h2 { font-size: 14px; margin: 0 0 12px; font-weight: 600; color: var(--ink-2); }
svg text { font: 11px system-ui, -apple-system, "Segoe UI", sans-serif; fill: var(--muted); font-variant-numeric: tabular-nums; }
.bar { fill: var(--series); }
.bar:hover { opacity: .82; }
.hbar-label { fill: var(--ink); font-size: 12px; }
.hbar-value { fill: var(--ink-2); font-size: 12px; font-variant-numeric: tabular-nums; }

#tooltip {
  position: fixed; pointer-events: none; z-index: 10; display: none;
  background: var(--surface); color: var(--ink); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 10px; font-size: 12px;
  box-shadow: 0 4px 14px rgba(0,0,0,.18); white-space: nowrap;
}
#tooltip b { font-variant-numeric: tabular-nums; }

table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--grid); }
td { padding: 7px 8px; border-bottom: 1px solid var(--grid); }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr.canceled td { color: var(--muted); }
tr.canceled td.merchant { text-decoration: line-through; }
.badge { font-size: 11px; color: var(--ink-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; }
.empty { color: var(--muted); text-align: center; padding: 28px 0; }
</style>
</head>
<body>
<header>
  <h1>💳 가계부</h1>
  <nav>
    <a id="prev" href="#">‹ 이전 달</a>
    <span id="month-title" style="font-weight:600"></span>
    <a id="next" href="#">다음 달 ›</a>
  </nav>
  <span class="spacer"></span>
  <span class="stamp" id="stamp"></span>
</header>

<div class="kpis">
  <div class="tile"><div class="label">이번 달 지출</div><div class="value" id="k-total"></div></div>
  <div class="tile"><div class="label">오늘 지출</div><div class="value" id="k-today"></div></div>
  <div class="tile"><div class="label">결제 건수</div><div class="value" id="k-count"></div></div>
  <div class="tile"><div class="label">하루 평균</div><div class="value" id="k-avg"></div></div>
</div>

<div class="card"><h2>일별 지출</h2><div id="daily"></div></div>
<div class="card"><h2>가맹점별 지출</h2><div id="merchants"></div></div>
<div class="card"><h2>최근 내역</h2><div id="recent"></div></div>

<div id="tooltip"></div>

<script>
const DATA = __DATA__;
const fmt = n => n.toLocaleString("ko-KR");
const won = n => fmt(n) + "원";

document.getElementById("month-title").textContent = DATA.title;
document.getElementById("stamp").textContent = "갱신 " + new Date().toLocaleString("ko-KR");
document.getElementById("k-total").innerHTML = fmt(DATA.total) + "<small>원</small>";
document.getElementById("k-today").innerHTML = fmt(DATA.today) + "<small>원</small>";
document.getElementById("k-count").innerHTML = fmt(DATA.count) + "<small>건</small>";
document.getElementById("k-avg").innerHTML = fmt(DATA.dailyAvg) + "<small>원</small>";

const keepToken = new URLSearchParams(location.search).get("token");
function monthLink(ym) {
  const p = new URLSearchParams(); p.set("month", ym);
  if (keepToken) p.set("token", keepToken);
  return "/dashboard?" + p.toString();
}
document.getElementById("prev").href = monthLink(DATA.prev);
const nextEl = document.getElementById("next");
if (DATA.next) nextEl.href = monthLink(DATA.next); else nextEl.style.visibility = "hidden";

const tip = document.getElementById("tooltip");
function showTip(evt, html) {
  tip.innerHTML = html; tip.style.display = "block";
  const pad = 12, w = tip.offsetWidth;
  let x = evt.clientX + pad;
  if (x + w > innerWidth - 8) x = evt.clientX - w - pad;
  tip.style.left = x + "px"; tip.style.top = (evt.clientY + pad) + "px";
}
function hideTip() { tip.style.display = "none"; }

// ---- 일별 지출 (세로 막대) ----
(function () {
  const el = document.getElementById("daily");
  const days = DATA.days;
  if (!days.some(d => d.amt)) { el.innerHTML = '<div class="empty">이 달에는 기록이 없어요</div>'; return; }
  const W = 900, H = 220, m = {t: 12, r: 8, b: 22, l: 56};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...days.map(d => d.amt));
  const step = iw / days.length, bw = Math.max(2, step - 2); // 막대 사이 2px 간격
  const y = v => m.t + ih - (v / max) * ih;

  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  for (let i = 1; i <= 3; i++) {
    const gv = max * i / 3, gy = y(gv);
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${gy}" y2="${gy}" stroke="var(--grid)" stroke-width="1"/>`;
    s += `<text x="${m.l - 6}" y="${gy + 4}" text-anchor="end">${fmt(Math.round(gv))}</text>`;
  }
  s += `<line x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}" stroke="var(--baseline)" stroke-width="1"/>`;
  days.forEach((d, i) => {
    const x = m.l + i * step + (step - bw) / 2;
    if (d.amt > 0) {
      const by = y(d.amt), h = m.t + ih - by, r = Math.min(4, h, bw / 2);
      s += `<path class="bar" data-i="${i}" d="M${x},${by + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-bw} Z"/>`;
    }
    if (d.d === 1 || d.d % 5 === 0)
      s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${d.d}</text>`;
  });
  s += "</svg>";
  el.innerHTML = s;
  el.querySelectorAll(".bar").forEach(b => {
    const d = days[+b.dataset.i];
    const html = `${DATA.ym}-${String(d.d).padStart(2, "0")} · ${d.cnt}건<br><b>${won(d.amt)}</b>`;
    b.addEventListener("mousemove", e => showTip(e, html));
    b.addEventListener("mouseleave", hideTip);
  });
})();

// ---- 가맹점별 지출 (가로 막대, 직접 라벨) ----
(function () {
  const el = document.getElementById("merchants");
  const ms = DATA.merchants;
  if (!ms.length) { el.innerHTML = '<div class="empty">이 달에는 기록이 없어요</div>'; return; }
  const W = 900, rowH = 30, labelW = 150, valueW = 90;
  const H = ms.length * rowH;
  const iw = W - labelW - valueW;
  const max = Math.max(...ms.map(x => x.amt));
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  ms.forEach((x, i) => {
    const yy = i * rowH, bh = 18, by = yy + (rowH - bh) / 2;
    const bwv = Math.max(3, (x.amt / max) * iw), r = Math.min(4, bh / 2, bwv);
    s += `<text class="hbar-label" x="${labelW - 10}" y="${yy + rowH / 2 + 4}" text-anchor="end">${x.name.length > 10 ? x.name.slice(0, 10) + "…" : x.name}</text>`;
    s += `<path class="bar" data-i="${i}" d="M${labelW},${by} h${bwv - r} a${r},${r} 0 0 1 ${r},${r} v${bh - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(bwv - r)} Z"/>`;
    s += `<text class="hbar-value" x="${labelW + bwv + 8}" y="${yy + rowH / 2 + 4}">${won(x.amt)}</text>`;
  });
  s += "</svg>";
  el.innerHTML = s;
  el.querySelectorAll(".bar").forEach(b => {
    const x = ms[+b.dataset.i];
    const share = DATA.total ? Math.round(x.amt / DATA.total * 100) : 0;
    const html = `${x.name}<br><b>${won(x.amt)}</b> · 전체의 ${share}%`;
    b.addEventListener("mousemove", e => showTip(e, html));
    b.addEventListener("mouseleave", hideTip);
  });
})();

// ---- 최근 내역 테이블 ----
(function () {
  const el = document.getElementById("recent");
  if (!DATA.recent.length) { el.innerHTML = '<div class="empty">기록이 없어요</div>'; return; }
  let rows = DATA.recent.map(r => `
    <tr class="${r.canceled ? "canceled" : ""}">
      <td>${r.ts}</td>
      <td class="merchant">${r.merchant}</td>
      <td class="num">${won(r.amount)}</td>
      <td>${r.installment}${r.canceled ? ' <span class="badge">취소</span>' : ""}</td>
      <td><span class="badge">${r.source}</span></td>
    </tr>`).join("");
  el.innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>일시</th><th>가맹점</th><th class="num">금액</th><th>구분</th><th>수집</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
})();
</script>
</body>
</html>
"""
