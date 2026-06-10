#!/usr/bin/env python3
"""
Scrapes TMB Barcelona metro status and updates data/status.json.
Points awarded once per day. Resets on 1st of each month.
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone, date as date_cls
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES = ["L1", "L2", "L3", "L4", "L5", "L9N", "L9S", "L10N", "L10S", "L11"]
POINTS = {"W": 3, "D": 1, "L": 0}
DATA_FILE = Path("data/status.json")
DATE_LINE = re.compile(r'^\d{2}\.\d{2}\.\d{4}$')
SKIP_LINES = {"From", ", until", "until", "Add to favourites", "See information on this line"}


def load_existing():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text())
        except Exception:
            pass
    return {"matchday": 0, "updated": None, "lastMatchDate": None, "lastResetMonth": None,
            "lines": {n: {"severity": "clear", "description": None, "seasonPts": 0,
                          "checks": 0, "wins": 0, "draws": 0, "losses": 0, "recentForm": []} for n in LINES}}


def blank_line():
    return {"severity": "clear", "description": None, "seasonPts": 0,
            "checks": 0, "wins": 0, "draws": 0, "losses": 0, "recentForm": []}


def dismiss_cookies(page):
    try:
        for selector in ["button[id*='accept']", "button[class*='accept']",
                         "button:has-text('Accept')", "button:has-text('Acceptar')"]:
            btn = page.query_selector(selector)
            if btn and btn.is_visible():
                btn.click()
                page.wait_for_timeout(1000)
                return True
    except Exception:
        pass
    return False


def find_real_sections(text):
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


def extract_clean_description(section):
    if "Disruption" not in section or "Stations" not in section:
        return None
    after = section[section.index("Disruption") + len("Disruption"):].strip()
    raw_lines = [l.strip() for l in after.split("\n") if l.strip()]
    parts = []
    current_station = None
    got_description = False
    station_count = 0
    for line in raw_lines:
        if line in LINES: break
        if station_count >= 2: break
        if line in SKIP_LINES or DATE_LINE.match(line) or line.startswith("More info"): continue
        if line.startswith("Until") or line.startswith("From "):
            if current_station and not got_description:
                sentence = line.split(".")[0] + "."
                parts.append(f"{current_station}: {sentence.strip()}")
                got_description = True
                station_count += 1
            continue
        if "/" not in line and len(line) < 50:
            current_station = line
            got_description = False
    return " · ".join(parts) if parts else None


def classify_section(section):
    has_normal = "Normal service" in section
    has_disrupt = "Disruption" in section
    if has_normal and has_disrupt:
        severity = "minor"
    elif has_normal:
        severity = "clear"
    else:
        severity = "incident"
    desc = extract_clean_description(section) if has_disrupt else None
    return severity, desc


def scrape_pages():
    status = {n: {"severity": "clear", "description": None} for n in LINES}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(locale="en-GB",
                                       extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"})
        context.add_cookies([{"name": "CookieConsent", "value": "true", "domain": ".tmb.cat", "path": "/"}])
        page = context.new_page()
        try:
            page.goto("https://www.tmb.cat/en/barcelona-transport/status-metro-network",
                      wait_until="domcontentloaded", timeout=30000)
            dismiss_cookies(page)
            page.wait_for_timeout(2000)
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "noscript"]): tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            print(f"  Page: {len(text)} chars")
            sections = find_real_sections(text)
            print(f"  Sections: {list(sections.keys())}")
            for line, section in sections.items():
                severity, desc = classify_section(section)
                status[line] = {"severity": severity, "description": desc}
                print(f"  {line}: {severity}")
            print(f"  Clean: {[l for l in LINES if l not in sections]}")
        except Exception as e:
            print(f"  Scrape failed: {e}")
        finally:
            browser.close()
    return status


def update_scores(existing, new_status):
    today      = date_cls.today()
    today_str  = today.isoformat()
    this_month = today.strftime("%Y-%m")
    last_date  = existing.get("lastMatchDate", "")
    last_reset = existing.get("lastResetMonth", "")

    lines    = existing.get("lines", {})
    matchday = existing.get("matchday", 0)

    # Monthly reset on the 1st
    if today.day == 1 and last_reset != this_month:
        print(f"  Monthly reset — new season: {this_month}")
        lines    = {n: blank_line() for n in LINES}
        matchday = 0
        last_reset = this_month

    award_points = (today_str != last_date)

    for name in LINES:
        s   = new_status.get(name, {"severity": "clear", "description": None})
        sev = s["severity"]
        prev = lines.get(name, blank_line())
        if award_points:
            result = "L" if sev == "incident" else "D" if sev == "minor" else "W"
            pts = POINTS[result]
            lines[name] = {
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
            updated["severity"]    = sev
            updated["description"] = s["description"]
            lines[name] = updated

    if award_points:
        matchday += 1

    return {
        "matchday":      matchday,
        "lastMatchDate": today_str,
        "lastResetMonth": last_reset,
        "updated":       datetime.now(timezone.utc).isoformat(),
        "lines":         lines,
    }


def main():
    DATA_FILE.parent.mkdir(exist_ok=True)
    print("Loading existing Barcelona data...")
    existing = load_existing()
    print("Scraping TMB Barcelona...")
    try:
        new_status = scrape_pages()
        result     = update_scores(existing, new_status)
    except Exception as e:
        print(f"Scraping failed: {e}")
        result = existing
        result["updated"] = datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday', '?')}")


if __name__ == "__main__":
    main()
