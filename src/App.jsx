import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const LINE_META = {
  L1:   { color: "#E3000B", text: "#fff" },
  L2:   { color: "#9B2D82", text: "#fff" },
  L3:   { color: "#3FAA4B", text: "#fff" },
  L4:   { color: "#F5C300", text: "#000" },
  L5:   { color: "#0069B4", text: "#fff" },
  L9N:  { color: "#F37021", text: "#fff" },
  L9S:  { color: "#F37021", text: "#fff" },
  L10N: { color: "#009999", text: "#fff" },
  L10S: { color: "#007DB8", text: "#fff" },
  L11:  { color: "#8DC63F", text: "#000" },
};

// Raw GitHub URL — always serves the latest committed status.json
const STATUS_URL =
  "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/status.json";

const REFRESH_SEC = 300; // 5 minutes — matches the scraper interval

// ─────────────────────────────────────────────────────────────────────────────
// STANDINGS — built from the JSON file, no local computation needed
// ─────────────────────────────────────────────────────────────────────────────

function buildStandings(lines) {
  const rows = Object.entries(lines).map(([name, d]) => ({
    name,
    seasonPts:       d.seasonPts   ?? 0,
    checks:          d.checks      ?? 0,
    wins:            d.wins        ?? 0,
    draws:           d.draws       ?? 0,
    losses:          d.losses      ?? 0,
    recentForm:      d.recentForm  ?? [],
    currentSeverity: d.severity    ?? "clear",
    currentDetail:   d.description ?? null,
  }));

  rows.sort((a, b) => b.seasonPts - a.seasonPts || b.wins - a.wins);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.app { min-height: 100vh; background: #08080b; color: #ccc; font-family: 'Oswald', sans-serif; }

/* ── Header ── */
.hdr { background: #0c0c10; border-bottom: 1px solid #181820; }
.hdr-top { display: flex; align-items: stretch; }
.hdr-badge { background: #E3000B; padding: 1rem 1.3rem; display: flex; flex-direction: column; justify-content: center; flex-shrink: 0; min-width: 90px; }
.hdr-badge-sup { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.55); line-height: 1; }
.hdr-badge-title { font-size: 1.5rem; font-weight: 700; text-transform: uppercase; color: #fff; line-height: 1; }
.hdr-mid { flex: 1; padding: 0.7rem 1.3rem; display: flex; flex-direction: column; justify-content: center; gap: 0.2rem; }
.hdr-season { font-family: 'JetBrains Mono', monospace; font-size: 0.54rem; letter-spacing: 0.15em; text-transform: uppercase; color: #333; }
.hdr-info { font-size: 0.9rem; color: #666; font-weight: 300; }
.hdr-right { padding: 0.7rem 1.3rem; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 0.45rem; flex-shrink: 0; }
.hdr-time { font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: #282828; text-align: right; line-height: 1.5; }
.btn-refresh { background: #161620; border: 1px solid #242430; border-radius: 2px; padding: 0.35rem 0.85rem; color: #666; font-family: 'Oswald', sans-serif; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
.btn-refresh:hover { background: #1e1e2c; color: #bbb; }
.btn-refresh:disabled { opacity: 0.35; cursor: wait; }
.spin { animation: spin 0.9s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Countdown ── */
.countdown-wrap { background: #0c0c10; border-top: 1px solid #111116; padding-left: 90px; }
.countdown-inner { display: flex; align-items: center; gap: 0.8rem; padding: 0.3rem 1.3rem; }
.cd-label { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; letter-spacing: 0.14em; text-transform: uppercase; color: #1e1e1e; flex-shrink: 0; }
.cd-track { flex: 1; background: #111118; height: 2px; border-radius: 1px; overflow: hidden; }
.cd-fill { height: 2px; background: #E3000B; border-radius: 1px; transition: width 1s linear; opacity: 0.4; }
.cd-num { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: #1e1e1e; flex-shrink: 0; min-width: 28px; text-align: right; }

/* ── Error ── */
.err-box { padding: 0.6rem 1.3rem; background: #130808; border-bottom: 1px solid #2a0e0e; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: #6a3030; }

/* ── Table ── */
.tbl-head { display: grid; grid-template-columns: 38px minmax(0,1fr) 64px 120px 90px 52px; padding: 0.45rem 1.3rem; border-bottom: 1px solid #111116; background: #0a0a0e; }
.th { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; letter-spacing: 0.18em; text-transform: uppercase; color: #222; }
.th.r { text-align: right; }
.th.c { text-align: center; }

.zone-sep { padding: 0.28rem 1.3rem; font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; letter-spacing: 0.18em; text-transform: uppercase; background: #0a0a0e; border-bottom: 1px solid #0e0e14; border-left: 2px solid transparent; }
.zone-sep.top   { color: #2a5a2a; border-left-color: #2a5a2a; }
.zone-sep.mid   { color: #1c1c24; border-left-color: #1a1a22; }
.zone-sep.releg { color: #5a1a1a; border-left-color: #5a1a1a; }

.row { display: grid; grid-template-columns: 38px minmax(0,1fr) 64px 120px 90px 52px; padding: 0 1.3rem; border-bottom: 1px solid #0e0e14; align-items: center; border-left: 2px solid transparent; transition: background 0.12s; min-height: 54px; }
.row:hover { background: #0e0e14; }
.row.top   { border-left-color: #1e3a1e; }
.row.mid   { border-left-color: #141420; }
.row.releg { border-left-color: #3a1010; }

.col-pos { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #222; }
.col-club { display: flex; align-items: center; gap: 0.65rem; min-width: 0; padding: 0.4rem 0; }
.pip { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.56rem; font-weight: 700; flex-shrink: 0; }
.club-info { min-width: 0; }
.club-name { font-size: 0.95rem; font-weight: 600; color: #aaa; line-height: 1.1; }
.status-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.49rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.status-tag.incident { color: #8a2020; }
.status-tag.minor    { color: #886020; }
.no-data-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.49rem; color: #252525; }

.col-pts-wrap { text-align: right; }
.col-pts { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; color: #bbb; line-height: 1; }
.col-record { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: #252525; letter-spacing: 0.04em; margin-top: 1px; }

.col-form { display: flex; align-items: center; justify-content: center; gap: 4px; }
.fd { width: 11px; height: 11px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.38rem; font-weight: 500; }
.fd.W    { background: #2a7a2a; color: #5aaa5a; }
.fd.D    { background: #7a6010; color: #bba040; }
.fd.L    { background: #7a1a1a; color: #aa4040; }
.fd.none { background: #131318; }

.col-season { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.seg-bar { display: flex; width: 80px; height: 4px; border-radius: 2px; overflow: hidden; gap: 1px; background: #131318; }
.seg-w { background: #2a7a2a; opacity: 0.8; }
.seg-d { background: #7a6010; opacity: 0.8; }
.seg-l { background: #7a1a1a; opacity: 0.8; }
.season-label { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: #252525; }

.col-now { font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; font-weight: 500; text-align: right; letter-spacing: 0.06em; }
.now-clear    { color: #2a6a2a; }
.now-minor    { color: #886020; }
.now-incident { color: #8a2020; }

.state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 0.7rem; font-family: 'JetBrains Mono', monospace; text-align: center; }
.state-ico { font-size: 2rem; }
.state-msg { font-size: 0.7rem; color: #333; max-width: 380px; line-height: 1.9; }

.legend { display: flex; gap: 1.4rem; padding: 0.5rem 1.3rem; border-top: 1px solid #0e0e14; align-items: center; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 0.35rem; font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: #252525; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.footer { padding: 0.4rem 1.3rem; font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; color: #161616; border-top: 1px solid #0e0e14; letter-spacing: 0.06em; }

@media (max-width: 600px) {
  .tbl-head, .row { grid-template-columns: 32px minmax(0,1fr) 54px 0 75px 38px; }
  .col-form { display: none; }
  .countdown-wrap { padding-left: 0; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SeasonBar({ wins, draws, losses }) {
  const total = wins + draws + losses;
  if (!total) return <div className="seg-bar" />;
  const w = (wins / total) * 100, d = (draws / total) * 100, l = (losses / total) * 100;
  return (
    <div className="seg-bar">
      {wins   > 0 && <div className="seg-w" style={{ width: `${w}%` }} />}
      {draws  > 0 && <div className="seg-d" style={{ width: `${d}%` }} />}
      {losses > 0 && <div className="seg-l" style={{ width: `${l}%` }} />}
    </div>
  );
}

function Row({ s, pos, total }) {
  const meta  = LINE_META[s.name] || { color: "#555", text: "#fff" };
  const isTop = pos < 3, isRel = pos >= total - 3;
  const zone  = isTop ? "top" : isRel ? "releg" : "mid";
  const form  = [...Array(5)].map((_, i) => {
    const off = 5 - s.recentForm.length;
    return i >= off ? s.recentForm[i - off] : null;
  });
  const sev    = s.currentSeverity;
  const nowCls = sev === "incident" ? "now-incident" : sev === "minor" ? "now-minor" : "now-clear";
  const nowLbl = sev === "incident" ? "INC" : sev === "minor" ? "ALT" : "OK";
  const maxPts = s.checks * 3;

  return (
    <div className={`row ${zone}`}>
      <div className="col-pos">{pos + 1}</div>

      <div className="col-club">
        <div className="pip" style={{ background: meta.color, color: meta.text }}>{s.name}</div>
        <div className="club-info">
          <div className="club-name">{s.name}</div>
          {sev === "incident" && <div className="status-tag incident">⚠ {s.currentDetail}</div>}
          {sev === "minor"    && <div className="status-tag minor">~ {s.currentDetail}</div>}
          {sev === "clear" && s.checks === 0 && <div className="no-data-tag">awaiting first check</div>}
        </div>
      </div>

      <div className="col-pts-wrap">
        <div className="col-pts">{s.seasonPts}</div>
        <div className="col-record">
          {s.checks > 0 ? `${s.wins}W ${s.draws}D ${s.losses}L` : "—"}
        </div>
      </div>

      <div className="col-form">
        {form.map((r, i) => <div key={i} className={`fd ${r ?? "none"}`}>{r ?? ""}</div>)}
      </div>

      <div className="col-season">
        <SeasonBar wins={s.wins} draws={s.draws} losses={s.losses} />
        <div className="season-label">
          {maxPts > 0 ? `${Math.round((s.seasonPts / maxPts) * 100)}% max pts` : "no data yet"}
        </div>
      </div>

      <div className={`col-now ${nowCls}`}>{s.checks > 0 ? nowLbl : "—"}</div>
    </div>
  );
}

function Table({ standings }) {
  const n = standings.length;
  const relegStart = Math.max(n - 3, 3);
  return (
    <div>
      <div className="tbl-head">
        <div className="th">#</div>
        <div className="th">Line</div>
        <div className="th r">Pts</div>
        <div className="th c">Form</div>
        <div className="th r">Season</div>
        <div className="th r">Now</div>
      </div>
      {standings.map((s, i) => {
        const label =
          i === 0          ? { txt: "Champions Metro Zone", cls: "top"   } :
          i === 3          ? { txt: "Mid-table",            cls: "mid"   } :
          i === relegStart ? { txt: "Relegation Zone",      cls: "releg" } : null;
        return (
          <div key={s.name}>
            {label && <div className={`zone-sep ${label.cls}`}>{label.txt}</div>}
            <Row s={s} pos={i} total={n} />
          </div>
        );
      })}
      <div className="legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: "#2a7a2a" }} />W = clean run (3 pts)</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: "#7a6010" }} />D = station alterations (1 pt)</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: "#7a1a1a" }} />L = service incident (0 pts)</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err,        setErr]        = useState(null);
  const [lastFetch,  setLastFetch]  = useState(null);
  const [countdown,  setCountdown]  = useState(REFRESH_SEC);
  const cdRef = useRef(REFRESH_SEC);
  const busy  = useRef(false);

  const fetchData = useCallback(async (manual = false) => {
    if (busy.current) return;
    busy.current = true;
    if (manual) setRefreshing(true);
    cdRef.current = REFRESH_SEC;
    setCountdown(REFRESH_SEC);

    try {
      // cache-bust so browsers don't serve stale data
      const res = await fetch(`${STATUS_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
    const tick = setInterval(() => {
      cdRef.current = Math.max(0, cdRef.current - 1);
      setCountdown(cdRef.current);
      if (cdRef.current <= 0) fetchData();
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchData]);

  const standings = data?.lines ? buildStandings(data.lines) : null;
  const matchday  = data?.matchday ?? 0;
  const updated   = data?.updated ? new Date(data.updated) : null;
  const pct       = (countdown / REFRESH_SEC) * 100;

  const incCount = standings?.filter(s => s.currentSeverity === "incident").length ?? 0;
  const altCount = standings?.filter(s => s.currentSeverity === "minor").length ?? 0;

  const updatedStr = updated
    ? updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const updatedDateStr = updated
    ? updated.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "—";

  return (
    <div className="app">
      <style>{CSS}</style>

      <div className="hdr">
        <div className="hdr-top">
          <div className="hdr-badge">
            <div className="hdr-badge-sup">BCN Metro</div>
            <div className="hdr-badge-title">League</div>
          </div>
          <div className="hdr-mid">
            <div className="hdr-season">
              Season 2025/26 · Matchday {matchday} · W=3 D=1 L=0
            </div>
            <div className="hdr-info">
              {loading
                ? "Loading…"
                : err
                  ? "Could not load data"
                  : incCount > 0
                    ? `${incCount} incident${incCount > 1 ? "s" : ""}, ${altCount} alteration${altCount !== 1 ? "s" : ""}`
                    : altCount > 0
                      ? `All lines running · ${altCount} with station alterations`
                      : matchday === 0
                        ? "Waiting for first scraper run…"
                        : "All lines clear"}
            </div>
          </div>
          <div className="hdr-right">
            <div className="hdr-time">
              TMB checked<br />{updatedDateStr} {updatedStr}
            </div>
            <button
              className="btn-refresh"
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
            >
              <span className={refreshing ? "spin" : ""}>⟳</span>
              {refreshing ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="countdown-wrap">
          <div className="countdown-inner">
            <div className="cd-label">Next reload</div>
            <div className="cd-track">
              <div className="cd-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="cd-num">{countdown}s</div>
          </div>
        </div>
      </div>

      {err && (
        <div className="err-box">⚠ {err} — check your connection or try refreshing</div>
      )}

      {loading ? (
        <div className="state">
          <div className="state-ico">🚇</div>
          <div className="state-msg">Loading metro league data…</div>
        </div>
      ) : standings ? (
        <Table standings={standings} />
      ) : null}

      <div className="footer">
        Data scraped every 5 min from tmb.cat by GitHub Actions · Hosted free on GitHub Pages · W=3pts D=1pt L=0pts
      </div>
    </div>
  );
}