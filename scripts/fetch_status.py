#!/usr/bin/env python3
"""
Scrapes TMB Barcelona metro status pages and updates data/status.json.
Runs via GitHub Actions every 5 minutes. No API costs.

Classification logic:
- Traffic: "Normal service" + Stations: no Disruption = W (3pts)
- Traffic: "Normal service" + Stations: Disruption    = D (1pt)
- Traffic: anything else                              = L (0pts)
"""

import json
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES = ["L1", "L2", "L3", "L4", "L5", "L9N", "L9S", "L10N", "L10S", "L11"]
POINTS = {"W": 3, "D": 1, "L": 0}
DATA_FILE = Path("data/status.json")


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
                "severity": "clear",
                "description": None,
                "seasonPts": 0,
                "checks": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "recentForm": [],
            }
            for n in LINES
        },
    }


def scrape_pages():
    status = {n: {"severity": "clear", "description": None} for n in LINES}

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        try:
            page.goto(
                "https://www.tmb.cat/en/barcelona-transport/status-metro-network",
                wait_until="networkidle",
                timeout=30000,
            )
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")
            text = soup.get_text(separator="\n", strip=True)
            lines_text = text.split("\n")

            current_line = None

            for i, chunk in enumerate(lines_text):
                chunk = chunk.strip()

                # Detect which line we're looking at
                for line in LINES:
                    if chunk == line or chunk.startswith(line + " "):
                        current_line = line
                        break

                if current_line is None:
                    continue

                # Look at the next 30 lines for Traffic and Stations sections
                window = "\n".join(lines_text[i: i + 30])

                has_normal_service = "Normal service" in window
                has_disruption = "Disruption" in window

                if has_normal_service and has_disruption:
                    severity = "minor"
                elif has_normal_service:
                    severity = "clear"
                else:
                    severity = "incident"

                # Extract disruption description
                desc = None
                if has_disruption:
                    for j in range(i, min(i + 30, len(lines_text))):
                        if "Disruption" in lines_text[j]:
                            desc_lines = [
                                l.strip()
                                for l in lines_text[j + 1: j + 5]
                                if l.strip()
                            ]
                            desc = " ".join(desc_lines)[:200] or None
                            break

                # Only update if we haven't already set this line
                # (take the worst severity seen)
                current = status[current_line]["severity"]
                if severity == "incident" or current == "clear":
                    status[current_line] = {
                        "severity": severity,
                        "description": desc,
                    }

        except Exception as e:
            print(f"  Warning: scrape failed: {e}")

        finally:
            browser.close()

    print(f"  Scraped: {status}")
    return status


def update_scores(existing, new_status):
    lines = existing.get("lines", {})
    matchday = existing.get("matchday", 0) + 1

    for name in LINES:
        s = new_status.get(name, {"severity": "clear", "description": None})
        sev = s["severity"]
        result = "L" if sev == "incident" else "D" if sev == "minor" else "W"
        pts = POINTS[result]
        prev = lines.get(
            name,
            {
                "seasonPts": 0,
                "checks": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "recentForm": [],
            },
        )
        lines[name] = {
            "severity": sev,
            "description": s["description"],
            "seasonPts": prev.get("seasonPts", 0) + pts,
            "checks": prev.get("checks", 0) + 1,
            "wins": prev.get("wins", 0) + (1 if result == "W" else 0),
            "draws": prev.get("draws", 0) + (1 if result == "D" else 0),
            "losses": prev.get("losses", 0) + (1 if result == "L" else 0),
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
        result = update_scores(existing, new_status)
    except Exception as e:
        print(f"Scraping failed: {e}")
        result = existing
        result["updated"] = datetime.now(timezone.utc).isoformat()

    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved {DATA_FILE} — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()