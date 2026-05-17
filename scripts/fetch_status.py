name: Fetch TMB Status

on:
  schedule:
    - cron: '*/5 * * * *'   # every 5 minutes
  workflow_dispatch:          # also lets you trigger it manually from GitHub

jobs:
  fetch:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install playwright beautifulsoup4
          playwright install chromium --with-deps

      - name: Run scraper
        run: python scripts/fetch_status.py

      - name: Commit updated status.json
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/status.json
          git diff --staged --quiet || git commit -m "chore: update metro status [skip ci]"
          git push