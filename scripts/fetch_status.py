#!/usr/bin/env python3
"""
Scrapes TMB Barcelona metro status pages and updates data/status.json.
Runs via GitHub Actions every 5 minutes. No API costs.

Classification logic:
- Traffic: "Normal service" + Stations: no Disruption = W (3pts)
- Traffic: "Normal service" + Stations: Disruption    = D (1pt)
- Traffic: anything other than "Normal service"       = L (0pts)
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


def extract_line_sections(text):
    """
    Split the full page text into per-line sections.
    Each section starts when we see a line identifier like 'L1', 'L9N' etc.
    Returns dict: { "L1": "...text for L1 section...", ... }
    """
    pattern = r'(?<!\w)(' + '|'.join(re.escape(l) for l in LINES) + r')(?!\w)'
    sections = {}
    matches = list(re.finditer(pattern, text))

    for i, m in enumerate(matches):
        line = m.group(1)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        section = text[start:end]

        # Only keep the first occurrence of each line
        # (later occurrences are cross-references in other lines' text)
        if line not in sections:
            sections[line] = section

    return sections


def classify_section(section):
    """
    Given a line's text section, return (severity, description).
    """
    has_normal_service = "Normal service" in section
    has_disruption = "Disruption" in section

    if has_normal_service and has_disruption:
        severity = "minor"
    elif has_normal_service:
        severity = "clear"
    else:
        severity = "incident"

    # Extract description: grab text after "Disruption" heading
    desc = None
    if has_disruption:
        after = section[section.index("Disruption"):]
        raw = after[len("Disruption"):].strip()
        # Remove UI noise
        raw = re.sub(r'Add to favourites[^\n]*', '', raw)
        raw = re.sub(r'\s+', ' ', raw).strip()
        desc = raw[:300] or None

    return severity, desc


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
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)

            sections = extract_line_sections(text)
            print(f"  Found sections for: {list(sections.keys())}")

            for line, section in sections.items():
                severity, desc = classify_section(section)
                status[line] = {"severity": severity, "description": desc}
                print(f"  {line}: {severity} — {(desc or '')[:80]}")

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
    print(f"Saved — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()