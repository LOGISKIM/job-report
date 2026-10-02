"""Parsing helpers: RSS/Atom/RDF feeds, HTML metadata, dates, PDF text."""
import html
import io
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


def _local(tag):
    return tag.rsplit("}", 1)[-1]


def _child_text(el, *names):
    for child in el:
        if _local(child.tag) in names:
            text = (child.text or "").strip()
            if text:
                return text
            href = child.get("href")
            if href:
                return href
    return ""


def _atom_link(el):
    for child in el:
        if _local(child.tag) == "link" and child.get("href"):
            if child.get("rel", "alternate") == "alternate":
                return child.get("href")
    return ""


def parse_date(value):
    """Return an ISO date string (UTC) or "" for RFC 822 / ISO 8601 input."""
    if not value:
        return ""
    value = value.strip()
    try:
        dt = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        dt = None
    if dt is None:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            m = re.match(r"\d{4}-\d{2}-\d{2}", value)
            return m.group(0) if m else ""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    return dt.date().isoformat()


def strip_html(text):
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", text or "")
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def parse_feed(xml_bytes):
    """Parse RSS 2.0, RSS 1.0 (RDF) or Atom into a list of item dicts."""
    root = ET.fromstring(xml_bytes)
    items = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        link = _child_text(el, "link") if _local(el.tag) == "item" else _atom_link(el)
        if not link:
            link = el.get("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about", "")
        if not link:  # podcast feeds: fall back to the audio file or a URL guid
            enclosure = next((c for c in el if _local(c.tag) == "enclosure"), None)
            guid = _child_text(el, "guid")
            link = enclosure.get("url", "") if enclosure is not None else (guid if guid.startswith("http") else "")
        body = strip_html(_child_text(el, "encoded", "content", "description", "summary"))
        items.append({
            "title": strip_html(_child_text(el, "title")),
            "url": link.strip(),
            "date": parse_date(_child_text(el, "pubDate", "date", "published", "updated")),
            "summary": strip_html(_child_text(el, "description", "summary", "encoded", "content"))[:1200],
            "text": body,
        })
    return items


_META_PATTERNS = {
    "title": [r'property="og:title"\s+content="([^"]*)"', r'content="([^"]*)"\s+property="og:title"', r"<title[^>]*>(.*?)</title>"],
    "summary": [r'property="og:description"\s+content="([^"]*)"', r'content="([^"]*)"\s+property="og:description"',
                r'name="description"\s+content="([^"]*)"'],
    "date": [r'property="article:published_time"\s+content="([^"]*)"', r'"datePublished"\s*:\s*"([^"]+)"',
             r'name="(?:date|publish-date|publication_date)"\s+content="([^"]*)"'],
}


def page_meta(page_html):
    """Pull title, description and publish date out of an article page."""
    out = {}
    for key, patterns in _META_PATTERNS.items():
        value = ""
        for pat in patterns:
            m = re.search(pat, page_html, re.I | re.S)
            if m and m.group(1).strip():
                value = m.group(1)
                break
        out[key] = strip_html(value)
    out["date"] = parse_date(out["date"])
    return out


def pdf_text(data, max_pages=12):
    """Extract text from a PDF; returns "" if pypdf is not installed."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""
    reader = PdfReader(io.BytesIO(data))
    pages = reader.pages[:max_pages]
    return "\n\n".join((p.extract_text() or "").strip() for p in pages).strip()
