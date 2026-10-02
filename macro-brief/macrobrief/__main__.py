"""Command line: python -m macrobrief <command> ..."""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

from . import charts, collect, data, digest

ROOT = collect.ROOT


def cmd_collect(a):
    out_dir, status, items = collect.collect(days=a.days, only=set(a.only.split(",")) if a.only else None)
    for s in status:
        print(f"  {'OK ' if s['ok'] else 'ERR'} {s['id']:<22} {s['count'] if s['ok'] else s['error']}")
    print(f"{len(items)}건 저장: {out_dir / 'items.json'}")
    return out_dir


def cmd_digest(a):
    out_dir = ROOT / "out" / (a.date or date.today().isoformat())
    print(f"후보 정리: {digest.write_digest(out_dir)}")


def cmd_weekly(a):
    out_dir = cmd_collect(a)
    print(f"후보 정리: {digest.write_digest(out_dir)}")
    print("FRED 데이터 팩:")
    for sid, (ok, info) in data.fetch_pack(out_dir).items():
        print(f"  {'OK ' if ok else 'ERR'} {sid:<14} {data.FRED_PACK[sid]:<24} {info}")


def cmd_data(a):
    src, args = a.source, a.args
    if src == "fred":
        rows = {sid: data.fred(sid, a.start) for sid in args}
        for sid, r in rows.items():
            print(f"saved {data.save_csv(r, a.out_dir / f'{sid}.csv')} ({len(r)} rows)")
        return
    if src == "treasury":
        rows, name = data.treasury_yield_curve(args[0]), f"treasury_curve_{args[0]}"
    elif src == "fiscal":
        rows, name = data.fiscal_data(args[0]), args[0].replace("/", "_")
    elif src == "bls":
        y = date.today().year
        rows, name = data.bls(args, int(a.start[:4]) if a.start else y - 9, y), "bls_" + "_".join(args)
    elif src == "ecos":  # stat_code cycle start end [item_code]
        rows, name = data.ecos(*args), "ecos_" + args[0]
    elif src == "worldbank":
        rows, name = data.worldbank(args[0], args[1]), f"wb_{args[0]}_{args[1]}"
    elif src == "oecd":
        rows, name = data.oecd(args[0], args[1] if len(args) > 1 else "all", a.start), "oecd_" + args[0].split(",")[1]
    elif src == "sec":
        facts = data.sec_company_facts(args[0])
        path = a.out_dir / f"sec_{args[0]}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(facts), encoding="utf-8")
        print(f"saved {path}")
        return
    else:
        sys.exit(f"unknown data source: {src}")
    print(f"saved {data.save_csv(rows, a.out_dir / f'{name}.csv')} ({len(rows)} rows)")


def cmd_chart(a):
    ids = a.series.split(",")
    names = a.names.split(",") if a.names else [data.FRED_PACK.get(i, i) for i in ids]
    series = []
    for sid, name in zip(ids, names):
        rows = data.fred(sid, a.start)
        series.append({"name": name, "rows": charts.monthly(rows) if a.monthly else rows})
    ref = {"date": a.ref_date, "value": a.ref_value, "label": a.ref_label} if a.ref_date else None
    svg = charts.line_chart(series, unit=a.unit, ref=ref)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg, encoding="utf-8")
    print(f"saved {out}")


def main(argv=None):
    p = argparse.ArgumentParser(prog="macrobrief", description="글로벌 매크로 리포트 수집·데이터·차트 도구")
    sub = p.add_subparsers(dest="cmd", required=True)

    for name, fn, help_ in [("collect", cmd_collect, "모든 출처에서 최근 글 수집"),
                            ("weekly", cmd_weekly, "수집 + 후보 정리 + FRED 데이터 팩 (주 1회)")]:
        s = sub.add_parser(name, help=help_)
        s.add_argument("--days", type=int, default=10, help="최근 며칠 치 (기본 10)")
        s.add_argument("--only", help="쉼표로 구분한 출처 id만 수집")
        s.set_defaults(fn=fn)

    s = sub.add_parser("digest", help="수집 결과를 주제별 후보(digest.md)로 정리")
    s.add_argument("--date", help="out/<날짜> 폴더 (기본 오늘)")
    s.set_defaults(fn=cmd_digest)

    s = sub.add_parser("data", help="공공 데이터 내려받기 (CSV)")
    s.add_argument("source", choices=["fred", "treasury", "fiscal", "bls", "ecos", "worldbank", "oecd", "sec"])
    s.add_argument("args", nargs="+")
    s.add_argument("--start", default="2000-01-01")
    s.add_argument("--out-dir", type=Path, default=ROOT / "out" / "data")
    s.set_defaults(fn=cmd_data)

    s = sub.add_parser("chart", help="FRED 시계열로 카드 스타일 SVG 차트 만들기")
    s.add_argument("--series", required=True, help="예: DGS10,DGS30")
    s.add_argument("--names", help="범례 이름, 쉼표 구분")
    s.add_argument("--start", default="2000-01-01")
    s.add_argument("--monthly", action="store_true", help="월평균 (마지막 점은 최신 값)")
    s.add_argument("--unit", default="%")
    s.add_argument("--ref-date"), s.add_argument("--ref-value", type=float), s.add_argument("--ref-label", default="")
    s.add_argument("--out", default=str(ROOT / "out" / "chart.svg"))
    s.set_defaults(fn=cmd_chart)

    a = p.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
