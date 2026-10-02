"""Line charts as standalone SVG in the carousel's card style."""
import math
from collections import OrderedDict
from xml.sax.saxutils import escape

INK, MUTE, LINE, RISE, TEAL = "#14213D", "#5D6679", "#D4D8DE", "#D9442B", "#2E7A77"
PALETTE = [INK, TEAL, RISE, "#8A6D1F"]
MONO = "IBM Plex Mono, ui-monospace, Menlo, monospace"
SANS = "IBM Plex Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"


def monthly(rows, keep_last_daily=True):
    """Average daily rows by month; optionally replace the last month with the latest value."""
    buckets = OrderedDict()
    for r in rows:
        buckets.setdefault(r["date"][:7], []).append(r["value"])
    out = [{"date": k, "value": sum(v) / len(v)} for k, v in buckets.items()]
    if keep_last_daily and rows and out:
        out[-1]["value"] = rows[-1]["value"]
    return out


def _nice_step(span, target=6):
    raw = span / target
    mag = 10 ** math.floor(math.log10(raw))
    return next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)


def line_chart(series, *, width=1000, height=620, unit="%", ref=None, start_year_ticks=5):
    """series: [{"name": str, "rows": [{"date","value"}], "color"?: str}]. Dates may differ; gaps break the line."""
    m = {"l": 74, "r": 160, "t": 24, "b": 58}
    values = [r["value"] for s in series for r in s["rows"]]
    step = _nice_step(max(values) - min(values))
    lo, hi = math.floor(min(values) / step) * step, math.ceil(max(values) / step) * step
    dates = [{"date": d} for d in sorted({r["date"] for s in series for r in s["rows"]})]
    pos = {r["date"]: i for i, r in enumerate(dates)}
    n = len(dates)
    x = lambda i: m["l"] + (width - m["l"] - m["r"]) * i / max(n - 1, 1)
    y = lambda v: m["t"] + (height - m["t"] - m["b"]) * (hi - v) / (hi - lo)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
           f'<rect width="{width}" height="{height}" fill="#F3F4F0"/>']

    v = lo
    while v <= hi + 1e-9:
        label = f"{v:g}{unit}"
        stroke, sw = (MUTE, 2) if abs(v) < 1e-9 and lo < 0 else (LINE, 1.5)
        out.append(f'<line x1="{m["l"]}" x2="{width - m["r"]}" y1="{y(v):.1f}" y2="{y(v):.1f}" stroke="{stroke}" stroke-width="{sw}"/>')
        out.append(f'<text x="{m["l"] - 12}" y="{y(v) + 8:.1f}" text-anchor="end" font-size="22" fill="{MUTE}" font-family="{MONO}">{label}</text>')
        v += step

    years = sorted({int(r["date"][:4]) for r in dates})
    tick_years = [yr for yr in years if yr % start_year_ticks == 0] or years[:: max(len(years) // 5, 1)]
    for yr in tick_years:
        i = next(k for k, r in enumerate(dates) if r["date"].startswith(str(yr)))
        out.append(f'<text x="{x(i):.1f}" y="{height - 18}" text-anchor="middle" font-size="22" fill="{MUTE}" font-family="{MONO}">{yr}</text>')

    if ref:  # {"date": "2002-05", "value": 5.29, "label": "..."}
        i = next((k for k, r in enumerate(dates) if r["date"].startswith(ref["date"])), 0)
        out.append(f'<line x1="{x(i):.1f}" x2="{x(n - 1):.1f}" y1="{y(ref["value"]):.1f}" y2="{y(ref["value"]):.1f}" stroke="{RISE}" stroke-width="2" stroke-dasharray="6 7"/>')
        out.append(f'<circle cx="{x(i):.1f}" cy="{y(ref["value"]):.1f}" r="6" fill="{RISE}"/>')
        out.append(f'<text x="{x(i) + 12:.1f}" y="{y(ref["value"]) - 14:.1f}" font-size="22" font-weight="700" fill="{RISE}" font-family="{SANS}">{escape(ref["label"])}</text>')

    ends = []
    for k, s in enumerate(series):
        color = s.get("color", PALETTE[k % len(PALETTE)])
        d, prev = "", None
        for r in s["rows"]:
            i = pos[r["date"]]
            d += ("L" if prev is not None and i == prev + 1 else "M") + f"{x(i):.1f},{y(r['value']):.1f}"
            prev = i
        out.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{4 if k == 0 else 3}" stroke-linejoin="round"/>')
        last = s["rows"][-1]["value"]
        out.append(f'<circle cx="{x(pos[s["rows"][-1]["date"]]):.1f}" cy="{y(last):.1f}" r="8" fill="{color}"/>')
        ends.append([y(last), last, s["name"], color])

    ends.sort()  # keep end labels from overlapping
    for k in range(1, len(ends)):
        ends[k][0] = max(ends[k][0], ends[k - 1][0] + 58)
    for ly, last, name, color in ends:
        out.append(f'<text x="{x(n - 1) + 16:.1f}" y="{ly + 8:.1f}" font-size="28" font-weight="600" fill="{color}" font-family="{MONO}">{last:.2f}{unit}</text>')
        out.append(f'<text x="{x(n - 1) + 16:.1f}" y="{ly + 36:.1f}" font-size="20" fill="{MUTE}" font-family="{SANS}">{escape(name)}</text>')
    out.append("</svg>")
    return "\n".join(out)
