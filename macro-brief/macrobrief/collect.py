"""Collect recent research items from every source in sources.yaml."""
import json
import re
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urljoin

import yaml

from . import net, parse

ROOT = Path(__file__).resolve().parent.parent
MANUAL_DIR = ROOT / "inbox" / "manual"


def load_config(path=ROOT / "sources.yaml"):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _rss(src, text_dir, cutoff):
    items = parse.parse_feed(net.get(src["url"]).content)[: src.get("max_items", 30)]
    items = [i for i in items if not i["date"] or i["date"] >= cutoff]
    for i, item in enumerate(items):
        text = item.pop("text", "")
        if src.get("save_text") and len(text) > 1500:  # e.g. podcast transcripts
            path = text_dir / f"{src['id']}-{item['date'] or i}-{_slug(item['title'])}.txt"
            path.write_text(f"{item['title']}\n{item['url']}\n\n{text}", encoding="utf-8")
            item["text_file"] = str(path.relative_to(ROOT))
    return items


def _slug(title, n=50):
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:n]


def _wp_json(src):
    posts = net.get(src["url"]).json()
    return [{
        "title": parse.strip_html(p["title"]["rendered"]),
        "url": p["link"],
        "date": parse.parse_date(p["date"]),
        "summary": parse.strip_html(p.get("excerpt", {}).get("rendered", "")),
    } for p in posts]


def _listing(src):
    page = net.get(src["url"]).text
    links = list(dict.fromkeys(re.findall(r'href="(%s)"' % src["link_pattern"], page)))
    items = []
    for link in links[: src.get("max_items", 8)]:
        url = urljoin(src["base"], link)
        try:
            meta = parse.page_meta(net.get(url).text)
        except net.FetchError:
            continue
        items.append({"title": meta["title"], "url": url, "date": meta["date"], "summary": meta["summary"]})
    return items


def _page_pdf(src, text_dir):
    page = net.get(src["url"]).text.replace("&#34;", '"').replace("&quot;", '"')
    links = list(dict.fromkeys(re.findall(src["pdf_pattern"], page)))
    items = []
    for link in links[: src.get("max_items", 1)]:
        url = urljoin(src["url"], link)
        stamp = re.search(r"(20\d{2})(\d{2})(\d{2})", url)
        slug = re.sub(r"\.pdf$", "", url.rsplit("/", 1)[-1])
        slug = re.sub(r"^.*?-20\d{6}-", "", slug).replace("-", " ")
        item = {
            "title": slug.capitalize(),
            "url": url,
            "date": "-".join(stamp.groups()) if stamp else "",
            "summary": "",
            "page": src["url"],
        }
        if src.get("extract_text", True):
            text = parse.pdf_text(net.get(url, timeout=60).content)
            if text:
                path = text_dir / f"{src['id']}.txt"
                path.write_text(text, encoding="utf-8")
                item["text_file"] = str(path.relative_to(ROOT))
                item["summary"] = text[:600]
        items.append(item)
    return items


def _manual(src, text_dir):
    """Files the user dropped into inbox/manual/ (PDF or text)."""
    items = []
    for f in sorted(MANUAL_DIR.glob("*")):
        if f.name.startswith(".") or f.name == "README.md" or f.suffix.lower() not in (".pdf", ".txt", ".md"):
            continue
        data = f.read_bytes()
        text = parse.pdf_text(data) if f.suffix.lower() == ".pdf" else data.decode("utf-8", "ignore")
        out = text_dir / f"manual-{f.stem}.txt"
        out.write_text(text, encoding="utf-8")
        items.append({
            "title": f.stem.replace("-", " ").replace("_", " "),
            "url": src["url"],
            "date": date.fromtimestamp(f.stat().st_mtime).isoformat(),
            "summary": text[:600],
            "text_file": str(out.relative_to(ROOT)),
        })
    return items


def collect(days=10, only=None, out_root=ROOT / "out", today=None):
    """Fetch every source, keep items from the last `days` days, save items.json."""
    cfg = load_config()
    today = today or date.today()
    cutoff = (today - timedelta(days=days)).isoformat()
    out_dir = out_root / today.isoformat()
    text_dir = out_dir / "texts"
    text_dir.mkdir(parents=True, exist_ok=True)

    all_items, status = [], []
    for src in cfg["sources"]:
        if only and src["id"] not in only:
            continue
        kind = src["kind"]
        try:
            if kind == "rss":
                items = _rss(src, text_dir, cutoff)
            elif kind == "wp_json":
                items = _wp_json(src)
            elif kind == "listing":
                items = _listing(src)
            elif kind == "page_pdf":
                items = _page_pdf(src, text_dir)
            elif kind == "manual":
                items = _manual(src, text_dir)
            else:
                raise ValueError(f"unknown kind {kind}")
        except Exception as e:  # one broken source must not stop the run
            status.append({"id": src["id"], "ok": False, "count": 0, "error": str(e)[:200]})
            continue
        # Undated items (some listing pages) are kept; dated ones must be recent.
        items = [i for i in items if not i["date"] or i["date"] >= cutoff]
        for i in items:
            i.update(source=src["id"], source_name=src["name"], tier=src["tier"], tag=src["tag"])
        all_items.extend(items)
        status.append({"id": src["id"], "ok": True, "count": len(items)})

    all_items.sort(key=lambda i: i["date"] or "", reverse=True)
    (out_dir / "items.json").write_text(
        json.dumps({"collected": today.isoformat(), "days": days, "status": status, "items": all_items},
                   ensure_ascii=False, indent=1),
        encoding="utf-8")
    return out_dir, status, all_items
