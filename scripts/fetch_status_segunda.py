#!/usr/bin/env python3
"""
Scrapes all small-city metro sites for the Segunda División combined league.
Cities: Sevilla, Bilbao, Málaga, Granada.
(Palma excluded — no reliable status page found.)
Updates data/segunda_status.json. Points awarded once per day only.
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone, date as date_cls
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

CITIES = [
    {"key_prefix": "SVQ", "city": "Sevilla",  "url": "https://www.metro-sevilla.es/en/",                                           "lines": ["L1"]},
    {"key_prefix": "BIL", "city": "Bilbao",   "url": "https://www.metrobilbao.eus/en/map-and-network-status",                      "lines": ["L1", "L2"]},
    {"key_prefix": "MAL", "city": "Málaga",   "url": "https://metromalaga.es/en/",                                                 "lines": ["L1", "L2"]},
    {"key_prefix": "GRN", "city": "Granada",  "url": "https://metropolitanogranada.es/en/",                                        "lines": ["L1"]},
    {"key_prefix": "PMI", "city": "Palma",    "url": "https://www.trensfm.com/index.php?register_vars%5Bidi%5D=3",                 "lines": ["M1"]},
]

ALL_KEYS = [f"{c['key_prefix']}_{l}" for c in CITIES for l in c["lines"]]
# SVQ_L1, BIL_L1, BIL_L2, MAL_L1, MAL_L2, GRN_L1, PMI_M1

POINTS = {"W": 3, "D": 1, "L": 0}
DATA_FILE = Path("data/segunda_status.json")

# Use specific multi-word phrases to avoid false positives from news/privacy text
INCIDENT_PHRASES = [
    r"service suspended", r"service interrupted", r"no service",
    r"line closed", r"service not available", r"trains not running",
    r"servicio interrumpido", r"sin servicio", r"interrupci[oó]n de servicio",
]

# More specific minor phrases — avoids matching "accessibility" policy text
# or "obras" in general news articles
MINOR_PHRASES = [
    r"escalator out of service", r"escalator.*?not.*?work",
    r"lift out of service", r"elevator out of service",
    r"elevator failure", r"escalator failure",
    r"we regret to inform",
    r"alterations in the operation",
    r"passageway.*?closed", r"access.*?closed",
    r"ascensor.*?fuera de servicio",
]


def matches_any(text, phrases):
    lower = text.lower()
    return any(re.search(phrase, lower) for phrase in phrases)


def first_match_snippet(text, phrases, context=150):
    lower = text.lower()
    for phrase in phrases:
        m = re.search(phrase, lower)
        if m:
            start = max(0, m.start() - 30)
            return re.sub(r'\s+', ' ', text[start: m.end() + context]).strip()
    return None


def classify_text_for_line(text, line_id):
    """Search for line mentions and classify severity from surrounding context."""
    pattern = rf"\b{re.escape(line_id)}\b"
    matches = list(re.finditer(pattern, text, re.IGNORECASE))
    if not matches:
        return "clear", None
    worst, best_desc = "clear", None
    for m in matches:
        snippet = text[max(0, m.start() - 60): m.start() + 350]
        if matches_any(snippet, INCIDENT_PHRASES):
            if worst != "incident":
                worst = "incident"
                best_desc = first_match_snippet(snippet, INCIDENT_PHRASES)
        elif matches_any(snippet, MINOR_PHRASES):
            if worst == "clear":
                worst = "minor"
                best_desc = first_match_snippet(snippet, MINOR_PHRASES)
    return worst, best_desc


def classify_page_generic(text):
    """For single-line cities — classify the whole page."""
    if matches_any(text, INCIDENT_PHRASES):
        return "incident", first_match_snippet(text, INCIDENT_PHRASES)
    if matches_any(text, MINOR_PHRASES):
        return "minor", first_match_snippet(text, MINOR_PHRASES)
    return "clear", None


def load_existing():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text())
        except Exception:
            pass
    return {"matchday": 0, "updated": None, "lastMatchDate": None,
            "lines": {k: {"severity": "clear", "description": None, "seasonPts": 0,
                          "checks": 0, "wins": 0, "draws": 0, "losses": 0, "recentForm": []} for k in ALL_KEYS}}


def scrape_all():
    status = {k: {"severity": "clear", "description": None} for k in ALL_KEYS}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(locale="en-GB",
                                       extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"})
        page = context.new_page()
        for city in CITIES:
            prefix = city["key_prefix"]
            lines  = city["lines"]
            try:
                page.goto(city["url"], wait_until="domcontentloaded", timeout=25000)
                page.wait_for_timeout(2000)
                html = page.content()
                soup = BeautifulSoup(html, "html.parser")
                for tag in soup(["script", "style", "noscript"]):
                    tag.decompose()
                text = soup.get_text(separator="\n", strip=True)
                print(f"  {city['city']}: {len(text)} chars")
                for line_id in lines:
                    key = f"{prefix}_{line_id}"
                    if len(lines) == 1:
                        sev, desc = classify_page_generic(text)
                    else:
                        sev, desc = classify_text_for_line(text, line_id)
                    status[key] = {"severity": sev, "description": desc}
                    print(f"    {key}: {sev} — {(desc or '')[:70]}")
            except Exception as e:
                print(f"  {city['city']}: failed ({e})")
        browser.close()
    return status


def update_scores(existing, new_status):
    today = date_cls.today().isoformat()
    last_date = existing.get("lastMatchDate", "")
    award_points = (today != last_date)
    lines = existing.get("lines", {})
    matchday = existing.get("matchday", 0)
    for k in ALL_KEYS:
        if k not in lines:
            lines[k] = {"seasonPts": 0, "checks": 0, "wins": 0,
                        "draws": 0, "losses": 0, "recentForm": []}
    for key in ALL_KEYS:
        s = new_status.get(key, {"severity": "clear", "description": None})
        sev = s["severity"]
        prev = lines[key]
        if award_points:
            result = "L" if sev == "incident" else "D" if sev == "minor" else "W"
            pts = POINTS[result]
            lines[key] = {
                "severity": sev, "description": s["description"],
                "seasonPts":  prev.get("seasonPts", 0) + pts,
                "checks":     prev.get("checks",    0) + 1,
                "wins":       prev.get("wins",       0) + (1 if result == "W" else 0),
                "draws":      prev.get("draws",      0) + (1 if result == "D" else 0),
                "losses":     prev.get("losses",     0) + (1 if result == "L" else 0),
                "recentForm": (prev.get("recentForm", []) + [result])[-5:],
            }
        else:
            updated = dict(prev)
            updated["severity"] = sev
            updated["description"] = s["description"]
            lines[key] = updated
    if award_points:
        matchday += 1
    return {"matchday": matchday, "lastMatchDate": today,
            "updated": datetime.now(timezone.utc).isoformat(), "lines": lines}


def main():
    DATA_FILE.parent.mkdir(exist_ok=True)
    print("Loading existing Segunda data...")
    existing = load_existing()
    print("Scraping Segunda División cities...")
    try:
        new_status = scrape_all()
        result = update_scores(existing, new_status)
    except Exception as e:
        print(f"Scraping failed: {e}")
        result = existing
        result["updated"] = datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()