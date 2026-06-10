#!/usr/bin/env python3
import json, re
from pathlib import Path
from datetime import datetime, timezone, date as date_cls
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

LINES=["L1","L2"]; POINTS={"W":3,"D":1,"L":0}
DATA_FILE=Path("data/bilbao_status.json")
STATUS_URL="https://www.metrobilbao.eus/en/map-and-network-status"
INCIDENT_KW=["service suspended","service interrupted","no service","suspended","interruption"]
MINOR_KW=["escalator","lift","elevator","ascensor","works","maintenance","out of service","access"]

def blank_line():
    return {"severity":"clear","description":None,"seasonPts":0,"checks":0,"wins":0,"draws":0,"losses":0,"recentForm":[]}

def load_existing():
    if DATA_FILE.exists():
        try: return json.loads(DATA_FILE.read_text())
        except: pass
    return {"matchday":0,"updated":None,"lastMatchDate":None,"lastResetMonth":None,
            "lines":{n:blank_line() for n in LINES}}

def scrape():
    status={n:{"severity":"clear","description":None} for n in LINES}
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_context(locale="en-GB").new_page()
        try:
            page.goto(STATUS_URL,wait_until="domcontentloaded",timeout=25000)
            page.wait_for_timeout(2000)
            soup=BeautifulSoup(page.content(),"html.parser")
            for t in soup(["script","style","noscript"]): t.decompose()
            text=soup.get_text(separator="\n",strip=True)
            print(f"  Bilbao: {len(text)} chars")
            for line in LINES:
                matches=list(re.finditer(rf'\b{re.escape(line)}\b',text,re.IGNORECASE))
                worst,best_desc="clear",None
                for m in matches:
                    snippet=text[max(0,m.start()-50):m.start()+400]; sl=snippet.lower()
                    if any(kw in sl for kw in INCIDENT_KW):
                        if worst!="incident": worst="incident"; best_desc=re.sub(r'\s+',' ',snippet).strip()[:250]
                    elif any(kw in sl for kw in MINOR_KW):
                        if worst=="clear": worst="minor"; best_desc=re.sub(r'\s+',' ',snippet).strip()[:250]
                status[line]={"severity":worst,"description":best_desc}
                print(f"  {line}: {worst}")
        except Exception as e:
            print(f"  Failed: {e}")
        finally: browser.close()
    return status

def update_scores(existing, new_status):
    today=date_cls.today(); today_str=today.isoformat(); this_month=today.strftime("%Y-%m")
    last_date=existing.get("lastMatchDate",""); last_reset=existing.get("lastResetMonth","")
    lines=existing.get("lines",{}); matchday=existing.get("matchday",0)
    if today.day==1 and last_reset!=this_month:
        print(f"  Monthly reset: {this_month}"); lines={n:blank_line() for n in LINES}; matchday=0; last_reset=this_month
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
