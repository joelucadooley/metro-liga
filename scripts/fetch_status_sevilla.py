#!/usr/bin/env python3
import json, re
from pathlib import Path
from datetime import datetime, timezone, date as date_cls
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES=["L1"]; POINTS={"W":3,"D":1,"L":0}
DATA_FILE=Path("data/sevilla_status.json")
STATUS_URL="https://www.metro-sevilla.es/en/"
INCIDENT_KW=["service suspended","service interrupted","no service","suspended","interrupción"]
MINOR_KW=["escalator","lift","elevator","ascensor","works","maintenance","out of service"]

def blank_line():
    return {"severity":"clear","description":None,"seasonPts":0,"checks":0,"wins":0,"draws":0,"losses":0,"recentForm":[]}

def load_existing():
    if DATA_FILE.exists():
        try: return json.loads(DATA_FILE.read_text())
        except: pass
    return {"matchday":0,"updated":None,"lastMatchDate":None,"lastResetMonth":None,"lines":{"L1":blank_line()}}

def scrape():
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_context(locale="en-GB").new_page()
        try:
            page.goto(STATUS_URL,wait_until="domcontentloaded",timeout=25000)
            page.wait_for_timeout(2000)
            soup=BeautifulSoup(page.content(),"html.parser")
            for t in soup(["script","style","noscript"]): t.decompose()
            text=soup.get_text(separator="\n",strip=True); lower=text.lower()
            print(f"  Sevilla: {len(text)} chars")
            if any(kw in lower for kw in INCIDENT_KW): sev,desc="incident","Service disruption"
            elif any(kw in lower for kw in MINOR_KW):
                sev="minor"; desc=next((re.sub(r'\s+',' ',text[max(0,lower.find(kw)-30):lower.find(kw)+150]).strip() for kw in MINOR_KW if kw in lower),None)
            else: sev,desc="clear",None
            print(f"  L1: {sev}")
            return {"L1":{"severity":sev,"description":desc}}
        except Exception as e:
            print(f"  Failed: {e}"); return {"L1":{"severity":"clear","description":None}}
        finally: browser.close()

def update_scores(existing, new_status):
    today=date_cls.today(); today_str=today.isoformat(); this_month=today.strftime("%Y-%m")
    last_date=existing.get("lastMatchDate",""); last_reset=existing.get("lastResetMonth","")
    lines=existing.get("lines",{}); matchday=existing.get("matchday",0)
    if today.day==1 and last_reset!=this_month:
        print(f"  Monthly reset: {this_month}"); lines={"L1":blank_line()}; matchday=0; last_reset=this_month
    award=(today_str!=last_date)
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
    DATA_FILE.parent.mkdir(exist_ok=True); existing=load_existing()
    try: result=update_scores(existing,scrape())
    except Exception as e:
        print(f"Failed:{e}"); result=existing; result["updated"]=datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result,indent=2,ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday','?')}")

if __name__=="__main__": main()
