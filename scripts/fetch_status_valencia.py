#!/usr/bin/env python3
"""
Scrapes Metrovalencia service updates page and updates data/valencia_status.json.
Runs via GitHub Actions every 5 minutes. No API costs.

Single page: metrovalencia.es/en/service-updates/
Lists all current service alerts per line.
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"]

POINTS    = {"W": 3, "D": 1, "L": 0}
DATA_FILE = Path("data/valencia_status.json")
STATUS_URL = "https://www.metrovalencia.es/en/service-updates/"

INCIDENT_KEYWORDS = [
    "service suspended", "service interrupted", "no service",
    "suspended between", "line closed", "service not available",
    "trains not running", "interruption of service",
    "interrupció", "suspensió",
]

MINOR_KEYWORDS = [
    "escalator", "lift", "elevator", "ascensor",
    "passage", "access", "alteration", "works",
    "out of service", "closed temporarily", "improvement work",
    "maintenance", "reduced service",
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
            n: {
                "severity": "clear", "description": None,
                "seasonPts": 0, "checks": 0,
                "wins": 0, "draws": 0, "losses": 0, "recentForm": [],
            }
            for n in LINES
        },
    }


def scrape_valencia():
    status = {n: {"severity": "clear", "description": None} for n in LINES}

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
            print(f"  Sample: {repr(text[500:1000])}")

            # Check each line
            for line in LINES:
                pattern = rf"\b{re.escape(line)}\b"
                matches = list(re.finditer(pattern, text, re.IGNORECASE))

                if not matches:
                    # Line not mentioned = no issues
                    status[line] = {"severity": "clear", "description": None}
                    continue

                # Look at text around each mention
                worst = "clear"
                best_desc = None

                for m in matches:
                    pos = m.start()
                    snippet = text[max(0, pos - 50): pos + 400].lower()
                    orig_snippet = text[max(0, pos - 50): pos + 400]

                    if any(kw in snippet for kw in INCIDENT_KEYWORDS):
                        if worst != "incident":
                            worst = "incident"
                            best_desc = re.sub(r'\s+', ' ', orig_snippet).strip()[:250]
                    elif any(kw in snippet for kw in MINOR_KEYWORDS):
                        if worst == "clear":
                            worst = "minor"
                            best_desc = re.sub(r'\s+', ' ', orig_snippet).strip()[:250]

                status[line] = {"severity": worst, "description": best_desc}
                print(f"  {line}: {worst} — {(best_desc or '')[:70]}")

        except Exception as e:
            print(f"  Scrape failed: {e}")
        finally:
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
    print("Loading existing Valencia data...")
    existing = load_existing()
    print("Scraping Metrovalencia service updates...")
    try:
        new_status = scrape_valencia()
        result = update_scores(existing, new_status)
    except Exception as e:
        print(f"Scraping failed: {e}")
        result = existing
        result["updated"] = datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()