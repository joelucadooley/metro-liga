#!/usr/bin/env python3
"""
Scrapes TMB Barcelona metro status pages and updates data/status.json.
Runs via GitHub Actions every 5 minutes. No API costs.

Classification logic:
- Traffic: "Normal service" + Stations: no Disruption = W (3pts)
- Traffic: "Normal service" + Stations: Disruption    = D (1pt)
- Traffic: anything other than "Normal service"       = L (0pts)

The real line section always has the pattern:
  L1
  Hospital de Bellvitge / Fondo
  Traffic
  Normal service
  ...
  Stations
  Disruption (if any)
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


def find_real_sections(text):
    """
    Find each line's real status section by looking for the pattern:
      <LINE>\n<route>\nTraffic\n<status>
    Cross-references in other lines' disruption text won't have 'Traffic'
    following them within a few lines.
    """
    sections = {}
    lines_list = text.split("\n")

    for i, chunk in enumerate(lines_list):
        chunk = chunk.strip()
        for line in LINES:
            if chunk == line:
                lookahead = "\n".join(lines_list[i:i + 6])
                if "Traffic" in lookahead and line not in sections:
                    end = len(lines_list)
                    for j in range(i + 1, len(lines_list)):
                        next_chunk = lines_list[j].strip()
                        if next_chunk in LINES:
                            next_look = "\n".join(lines_list[j:j + 6])
                            if "Traffic" in next_look:
                                end = j
                                break
                    sections[line] = "\n".join(lines_list[i:end])
                break

    return sections


def classify_section(section):
    has_normal_service = "Normal service" in section
    has_disruption = "Disruption" in section

    if has_normal_service and has_disruption:
        severity = "minor"
    elif has_normal_service:
        severity = "clear"
    else:
        severity = "incident"

    desc = None
    if has_disruption and "Stations" in section:
        after = section[section.index("Disruption"):]
        raw = after[len("Disruption"):].strip()
        raw = re.sub(r'Add to favourites[^\n]*\n?', '', raw)
        raw = re.sub(r'See information on this line\n?', '', raw)
        raw = re.sub(r'\n+', ' · ', raw).strip()
        raw = re.sub(r'\s+', ' ', raw).strip()
        desc = raw[:300] or None

    return severity, desc


def scrape_pages():
    status = {n: {"severity": "clear", "description": None} for n in LINES}

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            locale="en-GB",
            extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"}
        )

        try:
            page.goto(
                "https://www.tmb.cat/en/barcelona-transport/status-metro-network",
                wait_until="networkidle",
                timeout=30000,
            )
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)

            # Debug: print a sample of the page text so we can see what GitHub gets
            print(f"  Page length: {len(text)} chars")
            print(f"  Contains 'Traffic': {'Traffic' in text}")
            print(f"  Contains 'Normal service': {'Normal service' in text}")
            print(f"  Contains 'Disruption': {'Disruption' in text}")
            print(f"  Sample (3000-3600): {repr(text[3000:3600])}")

            sections = find_real_sections(text)
            print(f"  Found real sections for: {list(sections.keys())}")

            for line, section in sections.items():
                severity, desc = classify_section(section)
                status[line] = {"severity": severity, "description": desc}
                print(f"  {line}: {severity} — {(desc or '')[:80]}")

            missing = [l for l in LINES if l not in sections]
            if missing:
                print(f"  Clean lines (not on page): {missing}")

        except Exception as e:
            print(f"  Warning: scrape failed: {e}")

        finally:
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
    print(f"Saved — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()