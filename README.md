# Metro Liga 🚇

A football-style league table ranking Spanish metro lines by reliability. Updated automatically every 5 minutes from official metro websites. Points are awarded once per day.

**Live site:** [joelucadooley.github.io/metro-liga](https://joelucadooley.github.io/metro-liga)

[![GitHub Sponsors](https://img.shields.io/github/sponsors/joelucadooley?style=social)](https://github.com/joelucadooley) [![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?logo=ko-fi&logoColor=white)](https://ko-fi.com/joelucadooley)

---

## How it works

Each metro line is treated like a football team. Once per day, the current service status is checked and points are awarded:

| Result | Condition | Points |
|--------|-----------|--------|
| **W** — Win | Clean run, no disruptions | 3 |
| **D** — Draw | Station alterations (escalators, lifts, access) | 1 |
| **L** — Loss | Service incident or suspension | 0 |

Lines are ranked by points, with wins as tiebreaker. The table is divided into Champions Metro Zone, Mid-table, and Relegation Zone — just like a real football league.

---

## Cities

| Liga | City | Lines | Source |
|------|------|-------|--------|
| Barcelona | BCN Metro Liga | L1–L5, L9N, L9S, L10N, L10S, L11 | tmb.cat |
| Madrid | MAD Metro Liga | L1–L12, R | metromadrid.es |
| Valencia | VLC Metro Liga | L1–L7 | metrovalencia.es |
| Segunda División | Sevilla, Bilbao, Málaga, Granada, Palma | SVQ L1, BIL L1/L2, MAL L1/L2, GRN L1, PMI M1 | Various |

---

## Tech stack

- **Frontend:** React + Vite, hosted on GitHub Pages (free)
- **Scrapers:** Python + Playwright + BeautifulSoup
- **Automation:** GitHub Actions — runs every 5 minutes via cron-job.org webhook
- **Data:** JSON files committed to the repo, fetched directly by the frontend
- **Cost:** £0

---

## Architecture

```
cron-job.org (every 5 min)
    → GitHub Actions webhook (repository_dispatch)
        → Python scrapers visit official metro websites
        → Classify each line as clear / minor / incident
        → Award daily points (once per UTC day)
        → Commit updated JSON to main branch
            → React app fetches JSON from raw.githubusercontent.com
                → Displays league table
```

---

## Running locally

```bash
# Frontend
npm install
npm run dev

# Scrapers (requires Python 3.11+)
pip install playwright beautifulsoup4
playwright install chromium

python scripts/fetch_status.py          # Barcelona
python scripts/fetch_status_madrid.py   # Madrid
python scripts/fetch_status_valencia.py # Valencia
python scripts/fetch_status_segunda.py  # Segunda División
```

---

## Project structure

```
├── src/
│   └── App.jsx              # React app (single file)
├── scripts/
│   ├── fetch_status.py          # Barcelona scraper
│   ├── fetch_status_madrid.py   # Madrid scraper
│   ├── fetch_status_valencia.py # Valencia scraper
│   ├── fetch_status_sevilla.py  # Sevilla scraper
│   ├── fetch_status_bilbao.py   # Bilbao scraper
│   └── fetch_status_segunda.py  # Segunda División (combined)
├── data/
│   ├── status.json              # Barcelona data
│   ├── madrid_status.json       # Madrid data
│   ├── valencia_status.json     # Valencia data
│   └── segunda_status.json      # Segunda División data
└── .github/workflows/
    ├── fetch-status.yml         # Scraper automation
    └── deploy.yml               # GitHub Pages deployment
```

Created by [Joe Luca Dooley](https://github.com/joelucadooley)
