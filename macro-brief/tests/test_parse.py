import re
import unittest
from pathlib import Path

from macrobrief import charts, digest, parse

FIX = Path(__file__).parent / "fixtures"


class FeedTests(unittest.TestCase):
    def test_rss(self):
        items = parse.parse_feed((FIX / "rss.xml").read_bytes())
        self.assertEqual(items[0]["title"], "Yields climb as Treasury selloff deepens")
        self.assertEqual(items[0]["url"], "https://ex.com/a")
        self.assertEqual(items[0]["date"], "2026-10-01")  # 21:00 -04:00 is the next day in UTC
        self.assertEqual(items[0]["summary"], "The 10-year yield rose.")
        self.assertEqual(items[1]["url"], "https://ex.com/ep.mp3")  # enclosure fallback

    def test_rdf(self):
        [item] = parse.parse_feed((FIX / "rdf.xml").read_bytes())
        self.assertEqual(item["url"], "https://bis.org/review/r1.htm")
        self.assertEqual(item["date"], "2026-09-29")

    def test_atom(self):
        [item] = parse.parse_feed((FIX / "atom.xml").read_bytes())
        self.assertEqual(item["url"], "https://ex.com/atom1")
        self.assertEqual(item["date"], "2026-09-28")


class MetaTests(unittest.TestCase):
    def test_page_meta(self):
        html = ('<html><head><title>Fallback</title><meta property="og:title" content="What&#39;s Pushing Yields">'
                '<meta name="description" content="Debt and AI issuance"></head>'
                '<script type="application/ld+json">{"datePublished": "2026-08-21"}</script></html>')
        meta = parse.page_meta(html)
        self.assertEqual(meta, {"title": "What's Pushing Yields", "summary": "Debt and AI issuance", "date": "2026-08-21"})


class DigestTests(unittest.TestCase):
    def test_word_boundaries(self):
        items = [{"title": "Said the chair", "summary": ""}, {"title": "AI chips and Treasury yields", "summary": ""}]
        digest.tag_items(items, {"ai_semis": ["ai", "chip"], "rates": ["treasury", "yield"]})
        self.assertEqual(items[0]["topics"], [])  # "ai" inside "Said" must not match
        self.assertEqual(set(items[1]["topics"]), {"ai_semis", "rates"})


class ChartTests(unittest.TestCase):
    def test_monthly_keeps_latest_value(self):
        rows = [{"date": "2026-08-01", "value": 4.0}, {"date": "2026-08-31", "value": 5.0},
                {"date": "2026-09-01", "value": 5.0}, {"date": "2026-09-30", "value": 6.0}]
        self.assertEqual([r["value"] for r in charts.monthly(rows)], [4.5, 6.0])

    def test_gap_breaks_line(self):
        a = [{"date": f"2026-0{m}", "value": m} for m in range(1, 6)]
        b = [r for r in a if r["date"] != "2026-03"]
        svg = charts.line_chart([{"name": "a", "rows": a}, {"name": "b", "rows": b}])
        d_b = re.findall(r'<path d="([^"]+)"', svg)[1]
        self.assertEqual(d_b.count("M"), 2)


if __name__ == "__main__":
    unittest.main()
