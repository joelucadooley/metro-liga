#!/usr/bin/env python3
import json, re
from pathlib import Path
from datetime import datetime, timezone, date as date_cls
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

CITIES = [
    {"key_prefix":"SVQ","city":"Sevilla", "url":"https://www.metro-sevilla.es/en/",                      "lines":["L1"]},
    {"key_prefix":"BIL","city":"Bilbao",  "url":"https://www.metrobilbao.eus/en/map-and-network-status", "lines":["L1","L2"]},
    {"key_prefix":"MAL","city":"Málaga",  "url":"https://metromalaga.es/en/",                            "lines":["L1","L2"]},
    {"key_prefix":"GRN","city":"Granada", "url":"https://metropolitanogranada.es/en/",                   "lines":["L1"]},
    {"key_prefix":"PMI","city":"Palma",   "url":"https://www.trensfm.com/index.php?register_vars%5Bidi%5D=3","lines":["M1"]},
]
ALL_KEYS=[f"{c['key_prefix']}_{l}" for c in CITIES for l in c["lines"]]
POINTS={"W":3,"D":1,"L":0}
DATA_FILE=Path("data/segunda_status.json")

INCIDENT_PHRASES=[r"service suspended",r"service interrupted",r"no service",r"line closed",
                  r"servicio interrumpido",r"sin servicio",r"interrupci[oó]n de servicio"]
MINOR_PHRASES=[r"escalator out of service",r"escalator.*?not.*?work",r"lift out of service",
               r"elevator out of service",r"elevator failure",r"escalator failure",
               r"we regret to inform",r"alterations in the operation",
               r"passageway.*?closed",r"access.*?closed",r"ascensor.*?fuera de servicio"]

def blank_line():
    return {"severity":"clear","description":None,"seasonPts":0,"checks":0,"wins":0,"draws":0,"losses":0,"recentForm":[]}

def load_existing():
    if DATA_FILE.exists():
        try: return json.loads(DATA_FILE.read_text())
        except: pass
    return {"matchday":0,"updated":None,"lastMatchDate":None,"lastResetMonth":None,
            "lines":{k:blank_line() for k in ALL_KEYS}}

def matches_any(text,phrases):
    lower=text.lower(); return any(re.search(p,lower) for p in phrases)

def first_snippet(text,phrases,ctx=150):
    lower=text.lower()
    for p in phrases:
        m=re.search(p,lower)
        if m: return re.sub(r'\s+',' ',text[max(0,m.start()-30):m.end()+ctx]).strip()
    return None

def classify_line(text,line_id):
    matches=list(re.finditer(rf'\b{re.escape(line_id)}\b',text,re.IGNORECASE))
    if not matches: return "clear",None
    worst,best_desc="clear",None
    for m in matches:
        snippet=text[max(0,m.start()-60):m.start()+350]
        if matches_any(snippet,INCIDENT_PHRASES):
            if worst!="incident": worst="incident"; best_desc=first_snippet(snippet,INCIDENT_PHRASES)
        elif matches_any(snippet,MINOR_PHRASES):
            if worst=="clear": worst="minor"; best_desc=first_snippet(snippet,MINOR_PHRASES)
    return worst,best_desc

def classify_page(text):
    if matches_any(text,INCIDENT_PHRASES): return "incident",first_snippet(text,INCIDENT_PHRASES)
    if matches_any(text,MINOR_PHRASES):    return "minor",first_snippet(text,MINOR_PHRASES)
    return "clear",None

def scrape_all():
    status={k:{"severity":"clear","description":None} for k in ALL_KEYS}
    with sync_playwright() as p:
        browser=p.chromium.launch()
        context=browser.new_context(locale="en-GB",extra_http_headers={"Accept-Language":"en-GB,en;q=0.9"})
        page=context.new_page()
        for city in CITIES:
            prefix=city["key_prefix"]; lines=city["lines"]
            try:
                page.goto(city["url"],wait_until="domcontentloaded",timeout=35000)
                page.wait_for_timeout(2000)
                soup=BeautifulSoup(page.content(),"html.parser")
                for t in soup(["script","style","noscript"]): t.decompose()
                text=soup.get_text(separator="\n",strip=True)
                print(f"  {city['city']}: {len(text)} chars")
                for line_id in lines:
                    key=f"{prefix}_{line_id}"
                    sev,desc=(classify_page(text) if len(lines)==1 else classify_line(text,line_id))
                    status[key]={"severity":sev,"description":desc}
                    print(f"    {key}: {sev}")
            except Exception as e:
                print(f"  {city['city']}: failed ({e})")
        browser.close()
    return status

def update_scores(existing, new_status):
    today=date_cls.today(); today_str=today.isoformat(); this_month=today.strftime("%Y-%m")
    last_date=existing.get("lastMatchDate",""); last_reset=existing.get("lastResetMonth","")
    lines=existing.get("lines",{}); matchday=existing.get("matchday",0)
    for k in ALL_KEYS:
        if k not in lines: lines[k]=blank_line()
    if today.day==1 and last_reset!=this_month:
        print(f"  Monthly reset: {this_month}"); lines={k:blank_line() for k in ALL_KEYS}; matchday=0; last_reset=this_month
    award=(today_str!=last_date)
    for key in ALL_KEYS:
        s=new_status.get(key,{"severity":"clear","description":None}); sev=s["severity"]
        prev=lines[key]
        if award:
            result="L" if sev=="incident" else "D" if sev=="minor" else "W"; pts=POINTS[result]
            lines[key]={"severity":sev,"description":s["description"],
                "seasonPts":prev.get("seasonPts",0)+pts,"checks":prev.get("checks",0)+1,
                "wins":prev.get("wins",0)+(1 if result=="W" else 0),
                "draws":prev.get("draws",0)+(1 if result=="D" else 0),
                "losses":prev.get("losses",0)+(1 if result=="L" else 0),
                "recentForm":(prev.get("recentForm",[])+[result])[-5:]}
        else:
            u=dict(prev); u["severity"]=sev; u["description"]=s["description"]; lines[key]=u
    if award: matchday+=1
    return {"matchday":matchday,"lastMatchDate":today_str,"lastResetMonth":last_reset,
            "updated":datetime.now(timezone.utc).isoformat(),"lines":lines}

def main():
    DATA_FILE.parent.mkdir(exist_ok=True); existing=load_existing()
    print("Scraping Segunda División...")
    try: result=update_scores(existing,scrape_all())
    except Exception as e:
        print(f"Failed:{e}"); result=existing; result["updated"]=datetime.now(timezone.utc).isoformat()
    DATA_FILE.write_text(json.dumps(result,indent=2,ensure_ascii=False))
    print(f"Saved — matchday {result.get('matchday','?')}")

if __name__=="__main__": main()
