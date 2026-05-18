#!/usr/bin/env python3
"""
Scrapes Metro de Sevilla status and updates data/sevilla_status.json.
Runs via GitHub Actions every 5 minutes. No API costs.

Seville has only one operational line: L1.
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES     = ["L1"]
POINTS    = {"W": 3, "D": 1, "L": 0}
DATA_FILE = Path("data/sevilla_status.json")
STATUS_URL = "https://www.metro-sevilla.es/en/"

INCIDENT_KEYWORDS = [
    "service suspended", "service interrupted", "no service",
    "line closed", "not available", "incidencia", "interrupción",
    "suspended", "out of operation",
]
MINOR_KEYWORDS = [
    "escalator", "lift", "elevator", "ascensor",
    "works", "maintenance", "alteration", "out of service",
    "access", "improvement", "reduced",
]


def load_existing():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text())
        except Exception:
            pass
    return {
        "matchday": 0, "updated": None,
        "lines": {
            "L1": {
                "severity": "clear", "description": None,
                "seasonPts": 0, "checks": 0,
                "wins": 0, "draws": 0, "losses": 0, "recentForm": [],
            }
        },
    }


def scrape_sevilla():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            locale="en-GB",
            extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"},
        )
        page = context.new_page()

        try:
            page.goto(STATUS_URL, wait_until="domcontentloaded", timeout=25000)
            page.wait_for_timeout(2000)

            html = page.content()
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)

            print(f"  Page length: {len(text)} chars")
            print(f"  Sample: {repr(text[200:600])}")

            lower = text.lower()

            if any(kw in lower for kw in INCIDENT_KEYWORDS):
                severity = "incident"
                for kw in INCIDENT_KEYWORDS:
                    idx = lower.find(kw)
                    if idx != -1:
                        desc = re.sub(r'\s+', ' ', text[idx:idx+200]).strip()
                        break
                else:
                    desc = "Service disruption reported"
            elif any(kw in lower for kw in MINOR_KEYWORDS):
                severity = "minor"
                for kw in MINOR_KEYWORDS:
                    idx = lower.find(kw)
                    if idx != -1:
                        desc = re.sub(r'\s+', ' ', text[max(0, idx-30):idx+150]).strip()
                        break
                else:
                    desc = "Station alteration reported"
            else:
                severity = "clear"
                desc = None

            print(f"  L1: {severity} — {(desc or '')[:70]}")
            return {"L1": {"severity": severity, "description": desc}}

        except Exception as e:
            print(f"  Scrape failed: {e}")
            return {"L1": {"severity": "clear", "description": None}}
        finally:
            browser.close()


def update_scores(existing, new_status):
    lines    = existing.get("lines", {})
    matchday = existing.get("matchday", 0) + 1
    for name in LINES:
        s      = new_status.get(name, {"severity": "clear", "description": None})
        sev    = s["severity"]
        result = "L" if sev == "incident" else "D" if sev == "minor" else "W"
        pts    = POINTS[result]
        prev   = lines.get(name, {"seasonPts": 0, "checks": 0, "wins": 0, "draws": 0, "losses": 0, "recentForm": []})
        lines[name] = {
            "severity": sev, "description": s["description"],
            "seasonPts":  prev.get("seasonPts", 0) + pts,
            "checks":     prev.get("checks",    0) + 1,
            "wins":       prev.get("wins",       0) + (1 if result == "W" else 0),
            "draws":      prev.get("draws",      0) + (1 if result == "D" else 0),
            "losses":     prev.get("losses",     0) + (1 if result == "L" else 0),
            "recentForm": (prev.get("recentForm", []) + [result])[-5:],
        }
    return {"matchday": matchday, "updated": datetime.now(timezone.utc).isoformat(), "lines": lines}


def main():
    DATA_FILE.parent.mkdir(exist_ok=True)
    print("Loading existing Sevilla data...")
    existing = load_existing()
    print("Scraping Metro de Sevilla...")
    try:
        new_status = scrape_sevilla()
        result = update_scores(existing, new_status)
    except Exception as e:
        print(f"Scraping failed: {e}")
        result = existing
        result["updated"] = datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()