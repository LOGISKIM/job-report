"""Free data APIs for redrawing charts. Every fetcher returns a list of dict rows."""
import csv
import io
import os
from pathlib import Path

from . import net

ROOT = Path(__file__).resolve().parent.parent


def _get(url, **kwargs):
    return net.get(url, browser=False, **kwargs)

# The weekly "pack": series most carousels need, all from FRED (no key required).
FRED_PACK = {
    "DGS2": "미국 2년물 금리",
    "DGS10": "미국 10년물 금리",
    "DGS30": "미국 30년물 금리",
    "T10Y2Y": "10년-2년 금리차",
    "THREEFYTP10": "10년물 기간 프리미엄 (Kim-Wright)",
    "DFEDTARU": "연방기금금리 상단",
    "PCEPILFE": "근원 PCE 물가지수",
    "CPIAUCSL": "CPI",
    "UNRATE": "실업률",
    "PAYEMS": "비농업 고용자 수",
    "DTWEXBGS": "달러 인덱스 (광의)",
    "DEXKOUS": "원/달러 환율",
    "DCOILBRENTEU": "브렌트유",
    "BAMLH0A0HYM2": "미국 하이일드 스프레드",
    "SP500": "S&P 500 지수 (최근 10년)",
}


def _csv_rows(text):
    return list(csv.DictReader(io.StringIO(text.lstrip("﻿"))))


def fred(series_id, start="2000-01-01"):
    """FRED series via the public CSV endpoint. Missing values are dropped."""
    text = _get("https://fred.stlouisfed.org/graph/fredgraph.csv",
                   params={"id": series_id, "cosd": start}).text
    rows = []
    for r in _csv_rows(text):
        v = r.get(series_id, "")
        if v not in ("", "."):
            rows.append({"date": r["observation_date"], "value": float(v)})
    return rows


def treasury_yield_curve(year):
    """Daily par yield curve (1M..30Y) from the U.S. Treasury."""
    url = f"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{year}/all"
    params = {"type": "daily_treasury_yield_curve", "field_tdr_date_value": year, "page": "", "_format": "csv"}
    return _csv_rows(_get(url, params=params).text)


def fiscal_data(endpoint, **params):
    """Treasury Fiscal Data API, e.g. endpoint='v2/accounting/od/avg_interest_rates'."""
    params.setdefault("page[size]", 1000)
    params.setdefault("sort", "-record_date")
    url = f"https://api.fiscaldata.treasury.gov/services/api/fiscal_service/{endpoint}"
    return _get(url, params=params).json()["data"]


def bls(series_ids, start_year, end_year):
    """BLS API v2. Set BLS_API_KEY for higher limits (works without it)."""
    payload = {"seriesid": list(series_ids), "startyear": str(start_year), "endyear": str(end_year)}
    if os.environ.get("BLS_API_KEY"):
        payload["registrationkey"] = os.environ["BLS_API_KEY"]
    res = net.post_json("https://api.bls.gov/publicAPI/v2/timeseries/data/", payload)
    if res.get("status") != "REQUEST_SUCCEEDED":
        raise net.FetchError(f"BLS: {res.get('message')}")
    rows = []
    for s in res["Results"]["series"]:
        for d in s["data"]:
            if d["period"].startswith("M") and d["period"] != "M13":
                rows.append({"series": s["seriesID"], "date": f"{d['year']}-{d['period'][1:]}-01",
                             "value": float(d["value"])})
    return sorted(rows, key=lambda r: (r["series"], r["date"]))


def ecos(stat_code, cycle, start, end, item_code="", rows=1000):
    """Bank of Korea ECOS. Needs ECOS_API_KEY (free); the 'sample' key returns 10 rows at most."""
    key = os.environ.get("ECOS_API_KEY", "sample")
    if key == "sample":
        rows = min(rows, 10)
    url = f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/{rows}/{stat_code}/{cycle}/{start}/{end}/{item_code}"
    res = _get(url).json()
    if "StatisticSearch" not in res:
        raise net.FetchError(f"ECOS: {res.get('RESULT', res)}")
    return [{"date": r["TIME"], "item": r.get("ITEM_NAME1", ""), "value": float(r["DATA_VALUE"]), "unit": r.get("UNIT_NAME", "")}
            for r in res["StatisticSearch"]["row"]]


def worldbank(country, indicator, per_page=100):
    """World Bank indicator, e.g. worldbank('KR', 'NY.GDP.MKTP.KD.ZG')."""
    res = _get(f"https://api.worldbank.org/v2/country/{country}/indicator/{indicator}",
                  params={"format": "json", "per_page": per_page}).json()
    if len(res) < 2 or res[1] is None:
        return []
    return [{"date": r["date"], "country": r["country"]["value"], "value": r["value"]}
            for r in res[1] if r["value"] is not None][::-1]


def oecd(dataflow, key="all", start=None):
    """OECD SDMX REST, e.g. oecd('OECD.SDD.STES,DSD_STES@DF_CLI,4.1', 'USA+KOR.M.LI...AA...H')."""
    params = {"format": "csvfilewithlabels"}
    if start:
        params["startPeriod"] = start
    return _csv_rows(_get(f"https://sdmx.oecd.org/public/rest/data/{dataflow}/{key}", params=params, timeout=60).text)


def sec_company_facts(cik):
    """SEC XBRL company facts (all reported financial values) for a CIK."""
    headers = {"User-Agent": os.environ.get("SEC_USER_AGENT", "macro-brief research contact@example.com")}
    return _get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(cik):010d}.json", headers=headers).json()


def save_csv(rows, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return path
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return path


def fetch_pack(out_dir, start="2000-01-01"):
    """Download FRED_PACK into out_dir/data/*.csv. Returns {series: (ok, info)}."""
    result = {}
    for sid in FRED_PACK:
        try:
            rows = fred(sid, start)
            save_csv(rows, Path(out_dir) / "data" / f"{sid}.csv")
            result[sid] = (True, f"{rows[-1]['date']} = {rows[-1]['value']}" if rows else "empty")
        except Exception as e:
            result[sid] = (False, str(e)[:120])
    return result
