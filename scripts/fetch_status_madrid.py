#!/usr/bin/env python3
"""
Scrapes Metro de Madrid and updates data/madrid_status.json.
Points awarded once per day. Resets on 1st of each month.
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone, date as date_cls
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES = {
    "L1":"linea-1","L2":"linea-2","L3":"linea-3","L4":"linea-4",
    "L5":"linea-5","L6":"linea-6","L7":"linea-7","L8":"linea-8",
    "L9":"linea-9","L10":"linea-10","L11":"linea-11","L12":"linea-12","R":"ramal",
}
POINTS    = {"W":3,"D":1,"L":0}
DATA_FILE = Path("data/madrid_status.json")
BASE_URL  = "https://www.metromadrid.es/en/linea/"

INCIDENT_KW = ["service suspended","service interrupted","no service","suspended","interruption"]
MINOR_KW    = "we regret to inform you of alterations"


def blank_line():
    return {"severity":"clear","description":None,"seasonPts":0,
            "checks":0,"wins":0,"draws":0,"losses":0,"recentForm":[]}


def load_existing():
    if DATA_FILE.exists():
        try: return json.loads(DATA_FILE.read_text())
        except Exception: pass
    return {"matchday":0,"updated":None,"lastMatchDate":None,"lastResetMonth":None,
            "lines":{n:blank_line() for n in LINES}}


def scrape_all_lines():
    status = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(locale="en-GB",
                                       extra_http_headers={"Accept-Language":"en-GB,en;q=0.9"})
        page = context.new_page()
        for name, slug in LINES.items():
            try:
                page.goto(BASE_URL+slug, wait_until="domcontentloaded", timeout=25000)
                page.wait_for_timeout(1500)
                html = page.content()
                soup = BeautifulSoup(html,"html.parser")
                for tag in soup(["script","style","noscript"]): tag.decompose()
                text = soup.get_text(separator="\n",strip=True)
                lower = text.lower()
                if any(kw in lower for kw in INCIDENT_KW):
                    sev, desc = "incident", "Service disruption reported"
                elif MINOR_KW in lower:
                    idx = lower.find(MINOR_KW)
                    desc = re.sub(r'\s+',' ',text[idx:idx+200]).strip()
                    sev  = "minor"
                else:
                    sev, desc = "clear", None
                status[name] = {"severity":sev,"description":desc}
                print(f"  {name}: {sev}")
            except Exception as e:
                print(f"  {name}: failed ({e})")
                status[name] = {"severity":"clear","description":None}
        browser.close()
    return status


def update_scores(existing, new_status):
    today      = date_cls.today()
    today_str  = today.isoformat()
    this_month = today.strftime("%Y-%m")
    last_date  = existing.get("lastMatchDate","")
    last_reset = existing.get("lastResetMonth","")

    lines    = existing.get("lines",{})
    matchday = existing.get("matchday",0)

    if today.day == 1 and last_reset != this_month:
        print(f"  Monthly reset: {this_month}")
        lines    = {n:blank_line() for n in LINES}
        matchday = 0
        last_reset = this_month

    award = (today_str != last_date)
    for name in LINES:
        s    = new_status.get(name,{"severity":"clear","description":None})
        sev  = s["severity"]
        prev = lines.get(name, blank_line())
        if award:
            result = "L" if sev=="incident" else "D" if sev=="minor" else "W"
            pts    = POINTS[result]
            lines[name] = {
                "severity":sev,"description":s["description"],
                "seasonPts":  prev.get("seasonPts",0)+pts,
                "checks":     prev.get("checks",0)+1,
                "wins":       prev.get("wins",0)+(1 if result=="W" else 0),
                "draws":      prev.get("draws",0)+(1 if result=="D" else 0),
                "losses":     prev.get("losses",0)+(1 if result=="L" else 0),
                "recentForm": (prev.get("recentForm",[])+[result])[-5:],
            }
        else:
            u=dict(prev); u["severity"]=sev; u["description"]=s["description"]; lines[name]=u

    if award: matchday+=1
    return {"matchday":matchday,"lastMatchDate":today_str,"lastResetMonth":last_reset,
            "updated":datetime.now(timezone.utc).isoformat(),"lines":lines}


def main():
    DATA_FILE.parent.mkdir(exist_ok=True)
    existing = load_existing()
    print("Scraping Metro de Madrid...")
    try:
        result = update_scores(existing, scrape_all_lines())
    except Exception as e:
        print(f"Failed: {e}"); result=existing; result["updated"]=datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result,indent=2,ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday','?')}")

if __name__=="__main__": main()
