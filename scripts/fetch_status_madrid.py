#!/usr/bin/env python3
"""
Scrapes Metro de Madrid line pages and updates data/madrid_status.json.
Runs via GitHub Actions every 5 minutes. No API costs.

Each line has its own page at metromadrid.es/en/linea/linea-X
Classification:
- "We regret to inform you of alterations" → D / minor (1pt)
- "service suspended" / "interrupted"      → L / incident (0pts)
- "All the mechanic escalators...working"  → W / clear (3pts)
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES = {
    "L1":  "linea-1",
    "L2":  "linea-2",
    "L3":  "linea-3",
    "L4":  "linea-4",
    "L5":  "linea-5",
    "L6":  "linea-6",
    "L7":  "linea-7",
    "L8":  "linea-8",
    "L9":  "linea-9",
    "L10": "linea-10",
    "L11": "linea-11",
    "L12": "linea-12",
    "R":   "ramal",
}

INCIDENT_KEYWORDS = [
    "service suspended",
    "service interrupted",
    "no service between",
    "trains are not running",
    "line is closed",
    "service is not available",
    "servicio interrumpido",
    "sin servicio",
]

MINOR_KEYWORD = "we regret to inform you of alterations"
CLEAR_KEYWORD = "all the mechanic escalators and/or lifts are working properly"

POINTS   = {"W": 3, "D": 1, "L": 0}
DATA_FILE = Path("data/madrid_status.json")
BASE_URL  = "https://www.metromadrid.es/en/linea/"


def load_existing():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text())
        except Exception:
            pass
    return {
        "matchday": 0,
        "updated": None,
        "lines": {
            name: {
                "severity": "clear", "description": None,
                "seasonPts": 0, "checks": 0,
                "wins": 0, "draws": 0, "losses": 0,
                "recentForm": [],
            }
            for name in LINES
        },
    }


def classify_page(text):
    lower = text.lower()

    # Check for full service incident first
    if any(kw in lower for kw in INCIDENT_KEYWORDS):
        severity = "incident"
        # Try to extract incident description
        for kw in INCIDENT_KEYWORDS:
            idx = lower.find(kw)
            if idx != -1:
                snippet = text[idx:idx + 200].strip()
                snippet = re.sub(r'\s+', ' ', snippet)
                return severity, snippet[:200]
        return severity, "Service disruption reported"

    # Check for escalator/lift alterations
    if MINOR_KEYWORD in lower:
        severity = "minor"
        idx = lower.find(MINOR_KEYWORD)
        raw = text[idx:idx + 300].strip()
        raw = re.sub(r'\s+', ' ', raw)
        return severity, raw[:250]

    return "clear", None


def scrape_all_lines():
    status = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            locale="en-GB",
            extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"},
        )
        page = context.new_page()

        for line_name, slug in LINES.items():
            url = BASE_URL + slug
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=25000)
                page.wait_for_timeout(1500)

                html = page.content()
                soup = BeautifulSoup(html, "html.parser")
                for tag in soup(["script", "style", "noscript"]):
                    tag.decompose()
                text = soup.get_text(separator="\n", strip=True)

                severity, desc = classify_page(text)
                status[line_name] = {"severity": severity, "description": desc}
                print(f"  {line_name}: {severity} — {(desc or '')[:70]}")

            except Exception as e:
                print(f"  {line_name}: failed ({e}) — defaulting to clear")
                status[line_name] = {"severity": "clear", "description": None}

        browser.close()

    return status


def update_scores(existing, new_status):
    lines    = existing.get("lines", {})
    matchday = existing.get("matchday", 0) + 1

    for name in LINES:
        s      = new_status.get(name, {"severity": "clear", "description": None})
        sev    = s["severity"]
        result = "L" if sev == "incident" else "D" if sev == "minor" else "W"
        pts    = POINTS[result]
        prev   = lines.get(name, {
            "seasonPts": 0, "checks": 0,
            "wins": 0, "draws": 0, "losses": 0, "recentForm": [],
        })
        lines[name] = {
            "severity":    sev,
            "description": s["description"],
            "seasonPts":   prev.get("seasonPts", 0) + pts,
            "checks":      prev.get("checks",    0) + 1,
            "wins":        prev.get("wins",       0) + (1 if result == "W" else 0),
            "draws":       prev.get("draws",      0) + (1 if result == "D" else 0),
            "losses":      prev.get("losses",     0) + (1 if result == "L" else 0),
            "recentForm":  (prev.get("recentForm", []) + [result])[-5:],
        }

    return {
        "matchday": matchday,
        "updated":  datetime.now(timezone.utc).isoformat(),
        "lines":    lines,
    }


def main():
    DATA_FILE.parent.mkdir(exist_ok=True)
    print("Loading existing Madrid data...")
    existing = load_existing()

    print("Scraping Metro de Madrid line pages...")
    try:
        new_status = scrape_all_lines()
        result     = update_scores(existing, new_status)
    except Exception as e:
        print(f"Scraping failed: {e}")
        result = existing
        result["updated"] = datetime.now(timezone.utc).isoformat()

    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()