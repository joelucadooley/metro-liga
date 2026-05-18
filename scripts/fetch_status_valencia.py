#!/usr/bin/env python3
"""
Scrapes Metrovalencia service updates page and updates data/valencia_status.json.
Runs via GitHub Actions every 5 minutes. No API costs.

Single page: metrovalencia.es/en/service-updates/
Content is JS-rendered so needs networkidle + extra wait.
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

# Station → line mapping for Valencia
# Used to assign an alteration to the right line when the line isn't mentioned
STATION_TO_LINE = {
    "empalme": "L1", "bétera": "L1", "seminari": "L1",
    "llíria": "L2",
    "rafelbunyol": "L3", "aeroport": "L3", "aiport": "L3",
    "dr. lluch": "L4", "faitanar": "L4",
    "alameda": "L5", "maritim": "L5", "aeroport t1": "L5",
    "tossal": "L6", "sagunt": "L6",
    "la granja": "L7", "pont de fusta": "L7",
}

INCIDENT_KEYWORDS = [
    "service suspended", "service interrupted", "no service",
    "suspended between", "line closed", "service not available",
    "trains not running", "interruption of service",
    "interrupció", "suspensió",
]

MINOR_KEYWORDS = [
    "escalator", "lift", "elevator", "elevator failure", "ascensor",
    "passage", "access", "alteration", "works", "accessibility",
    "out of service", "closed temporarily", "improvement work",
    "maintenance", "reduced service", "failure", "avaria",
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


def find_line_for_snippet(snippet):
    """Try to find which line a snippet refers to by line mention or station name."""
    low = snippet.lower()

    # Direct line mention
    for line in LINES:
        if re.search(rf'\b{re.escape(line)}\b', snippet, re.IGNORECASE):
            return line

    # Station name lookup
    for station, line in STATION_TO_LINE.items():
        if station in low:
            return line

    return None


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
            # networkidle + long wait to let JS render the notices
            page.goto(STATUS_URL, wait_until="networkidle", timeout=35000)
            page.wait_for_timeout(5000)

            html = page.content()
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)

            print(f"  Page length: {len(text)} chars")

            lines_text = text.split("\n")

            # Scan each chunk of text for incident/minor keywords
            # and try to assign to a line
            i = 0
            while i < len(lines_text):
                chunk = lines_text[i].strip()
                chunk_low = chunk.lower()

                if any(kw in chunk_low for kw in INCIDENT_KEYWORDS + MINOR_KEYWORDS):
                    # Get context window
                    window = "\n".join(lines_text[max(0, i-3): i+8])
                    sev = "incident" if any(kw in chunk_low for kw in INCIDENT_KEYWORDS) else "minor"
                    line = find_line_for_snippet(window)

                    if line:
                        current = status[line]["severity"]
                        if sev == "incident" or current == "clear":
                            desc = re.sub(r'\s+', ' ', window).strip()[:250]
                            status[line] = {"severity": sev, "description": desc}
                            print(f"  {line}: {sev} — {desc[:80]}")
                    else:
                        # Couldn't identify line — log it
                        print(f"  Unknown line: {sev} — {chunk[:80]}")

                i += 1

            # Report clean lines
            for line in LINES:
                if status[line]["severity"] == "clear":
                    print(f"  {line}: clear")

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