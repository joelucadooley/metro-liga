#!/usr/bin/env python3
"""
Scrapes TMB Barcelona metro status pages and updates data/status.json.
Runs via GitHub Actions every 5 minutes. No API costs.
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES = ["L1", "L2", "L3", "L4", "L5", "L9N", "L9S", "L10N", "L10S", "L11"]
POINTS = {"W": 3, "D": 1, "L": 0}
DATA_FILE = Path("data/status.json")

INCIDENT_KEYWORDS = [
    "incident", "interrupció", "interrupcio", "suspension", "suspended",
    "delayed", "avaria", "avería", "service disruption", "no service",
]
MINOR_KEYWORDS = [
    "escalator", "lift", "elevator", "ascensor", "passage", "pas tancat",
    "works", "obres", "closed", "tancat", "alteration", "alteració",
    "access", "accés", "stairs", "notice", "avís",
]

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
            n: {
                "severity": "clear", "description": None,
                "seasonPts": 0, "checks": 0,
                "wins": 0, "draws": 0, "losses": 0,
                "recentForm": [],
            }
            for n in LINES
        },
    }

def classify(snippet):
    s = snippet.lower()
    if any(k in s for k in INCIDENT_KEYWORDS):
        return "incident"
    if any(k in s for k in MINOR_KEYWORDS):
        return "minor"
    return "clear"

def scrape_pages():
    status = {n: {"severity": "clear", "description": None} for n in LINES}

    urls = [
        "https://www.tmb.cat/en/barcelona-transport/status-metro-network",
        "https://www.tmb.cat/en/barcelona-transport/service-notices",
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for url in urls:
            try:
                page = browser.new_page()
                # Wait for network to settle so Angular has time to render
                page.goto(url, wait_until="networkidle", timeout=30000)
                html = page.content()
                page.close()

                soup = BeautifulSoup(html, "html.parser")
                text = soup.get_text(separator=" ", strip=True)

                for line in LINES:
                    pattern = rf"\b{re.escape(line)}\b"
                    for m in re.finditer(pattern, text, re.IGNORECASE):
                        pos = m.start()
                        # Read 300 chars around each line mention
                        snippet = text[max(0, pos - 60): pos + 300]
                        sev = classify(snippet)

                        # Only upgrade severity, never downgrade
                        current = status[line]["severity"]
                        if sev == "incident" and current != "incident":
                            status[line] = {
                                "severity": "incident",
                                "description": snippet.strip()[:140],
                            }
                        elif sev == "minor" and current == "clear":
                            status[line] = {
                                "severity": "minor",
                                "description": snippet.strip()[:140],
                            }

            except Exception as e:
                print(f"  Warning: could not scrape {url}: {e}")

        browser.close()

    return status

def update_scores(existing, new_status):
    lines = existing.get("lines", {})
    matchday = existing.get("matchday", 0) + 1

    for name in LINES:
        s = new_status.get(name, {"severity": "clear", "description": None})
        sev = s["severity"]
        result = "L" if sev == "incident" else "D" if sev == "minor" else "W"
        pts = POINTS[result]
        prev = lines.get(name, {
            "seasonPts": 0, "checks": 0,
            "wins": 0, "draws": 0, "losses": 0, "recentForm": [],
        })
        lines[name] = {
            "severity": sev,
            "description": s["description"],
            "seasonPts": prev.get("seasonPts", 0) + pts,
            "checks":    prev.get("checks",    0) + 1,
            "wins":      prev.get("wins",      0) + (1 if result == "W" else 0),
            "draws":     prev.get("draws",     0) + (1 if result == "D" else 0),
            "losses":    prev.get("losses",    0) + (1 if result == "L" else 0),
            "recentForm": (prev.get("recentForm", []) + [result])[-5:],
        }

    return {
        "matchday": matchday,
        "updated": datetime.now(timezone.utc).isoformat(),
        "lines": lines,
    }

def main():
    DATA_FILE.parent.mkdir(exist_ok=True)
    print("Loading existing data...")
    existing = load_existing()

    print("Scraping TMB pages...")
    try:
        new_status = scrape_pages()
        print(f"  Scraped: {new_status}")
        result = update_scores(existing, new_status)
    except Exception as e:
        print(f"Scraping failed: {e}")
        result = existing
        result["updated"] = datetime.now(timezone.utc).isoformat()

    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved {DATA_FILE} — matchday {result.get('matchday', '?')}")

if __name__ == "__main__":
    main()