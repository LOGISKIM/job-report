"""HTTP helpers shared by every collector."""
import time

import requests

# Several publishers (Goldman Sachs, Schwab) reject non-browser user agents.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
}

_browser = requests.Session()
_browser.headers.update(HEADERS)
# Data APIs (FRED in particular) stall on browser-like headers, so they get plain defaults.
_plain = requests.Session()


class FetchError(Exception):
    pass


def get(url, *, params=None, timeout=30, retries=2, browser=True, **kwargs):
    """GET with a small retry on network errors, 5xx, 404 and 429 responses."""
    session = _browser if browser else _plain
    last = None
    for attempt in range(retries + 1):
        try:
            r = session.get(url, params=params, timeout=timeout, **kwargs)
        except requests.RequestException as e:
            last = FetchError(f"{url}: {e}")
        else:
            # CDNs occasionally return a transient 404/429, so those are retried too.
            if r.status_code < 400:
                return r
            last = FetchError(f"{url}: HTTP {r.status_code}")
            if r.status_code < 500 and r.status_code not in (404, 429):
                raise last
        if attempt < retries:
            time.sleep(2 ** attempt)
    raise last


def post_json(url, payload, timeout=30):
    r = _plain.post(url, json=payload, timeout=timeout)
    if r.status_code >= 400:
        raise FetchError(f"{url}: HTTP {r.status_code}")
    return r.json()
