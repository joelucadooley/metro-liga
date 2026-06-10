#!/usr/bin/env python3
"""
Scrapes Metrovalencia and updates data/valencia_status.json.
Points awarded once per day. Resets on 1st of each month.
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone, date as date_cls
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES     = ["L1","L2","L3","L4","L5","L6","L7"]
POINTS    = {"W":3,"D":1,"L":0}
DATA_FILE = Path("data/valencia_status.json")
STATUS_URL = "https://www.metrovalencia.es/en/service-updates/"

STATION_TO_LINE = {
    "empalme":"L1","bétera":"L1","seminari":"L1","llíria":"L2",
    "rafelbunyol":"L3","aeroport":"L3","dr. lluch":"L4","faitanar":"L4",
    "alameda":"L5","maritim":"L5","tossal":"L6","sagunt":"L6",
    "la granja":"L7","pont de fusta":"L7",
}
INCIDENT_KW = ["service suspended","service interrupted","no service","interrupció","suspensió"]
MINOR_KW    = ["escalator","lift","elevator","elevator failure","ascensor","failure","avaria",
               "accessibility","out of service","improvement work","maintenance"]


def blank_line():
    return {"severity":"clear","description":None,"seasonPts":0,
            "checks":0,"wins":0,"draws":0,"losses":0,"recentForm":[]}


def load_existing():
    if DATA_FILE.exists():
        try: return json.loads(DATA_FILE.read_text())
        except Exception: pass
    return {"matchday":0,"updated":None,"lastMatchDate":None,"lastResetMonth":None,
            "lines":{n:blank_line() for n in LINES}}


def find_line(snippet):
    low = snippet.lower()
    for line in LINES:
        if re.search(rf'\b{re.escape(line)}\b', snippet, re.IGNORECASE): return line
    for station, line in STATION_TO_LINE.items():
        if station in low: return line
    return None


def scrape_valencia():
    status = {n:{"severity":"clear","description":None} for n in LINES}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(locale="en-GB",extra_http_headers={"Accept-Language":"en-GB,en;q=0.9"})
        page = context.new_page()
        try:
            page.goto(STATUS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(8000)
            html = page.content()
            soup = BeautifulSoup(html,"html.parser")
            for tag in soup(["script","style","noscript"]): tag.decompose()
            text = soup.get_text(separator="\n",strip=True)
            print(f"  Valencia: {len(text)} chars")
            lines_text = text.split("\n")
            for i, chunk in enumerate(lines_text):
                chunk_low = chunk.strip().lower()
                if any(kw in chunk_low for kw in INCIDENT_KW+MINOR_KW):
                    window = "\n".join(lines_text[max(0,i-3):i+8])
                    sev    = "incident" if any(kw in chunk_low for kw in INCIDENT_KW) else "minor"
                    line   = find_line(window)
                    if line:
                        if sev=="incident" or status[line]["severity"]=="clear":
                            status[line]={"severity":sev,"description":re.sub(r'\s+',' ',window).strip()[:250]}
                            print(f"  {line}: {sev}")
        except Exception as e:
            print(f"  Valencia failed: {e}")
        finally:
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
    if today.day==1 and last_reset!=this_month:
        print(f"  Monthly reset: {this_month}")
        lines={n:blank_line() for n in LINES}; matchday=0; last_reset=this_month
    award = (today_str!=last_date)
    for name in LINES:
        s=new_status.get(name,{"severity":"clear","description":None}); sev=s["severity"]
        prev=lines.get(name,blank_line())
        if award:
            result="L" if sev=="incident" else "D" if sev=="minor" else "W"; pts=POINTS[result]
            lines[name]={"severity":sev,"description":s["description"],
                "seasonPts":prev.get("seasonPts",0)+pts,"checks":prev.get("checks",0)+1,
                "wins":prev.get("wins",0)+(1 if result=="W" else 0),
                "draws":prev.get("draws",0)+(1 if result=="D" else 0),
                "losses":prev.get("losses",0)+(1 if result=="L" else 0),
                "recentForm":(prev.get("recentForm",[])+[result])[-5:]}
        else:
            u=dict(prev); u["severity"]=sev; u["description"]=s["description"]; lines[name]=u
    if award: matchday+=1
    return {"matchday":matchday,"lastMatchDate":today_str,"lastResetMonth":last_reset,
            "updated":datetime.now(timezone.utc).isoformat(),"lines":lines}


def main():
    DATA_FILE.parent.mkdir(exist_ok=True)
    existing=load_existing()
    print("Scraping Metrovalencia...")
    try: result=update_scores(existing,scrape_valencia())
    except Exception as e:
        print(f"Failed: {e}"); result=existing; result["updated"]=datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result,indent=2,ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday','?')}")

if __name__=="__main__": main()
