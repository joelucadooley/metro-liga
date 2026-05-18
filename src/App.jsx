import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CITY CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const CITIES = {
  barcelona: {
    id:       "barcelona",
    name:     "Barcelona",
    code:     "BCN",
    color:    "#E3000B",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/status.json",
    lines: {
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
    },
  },
  madrid: {
    id:       "madrid",
    name:     "Madrid",
    code:     "MAD",
    color:    "#003087",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/madrid_status.json",
    lines: {
      L1:  { color: "#00AADF", text: "#fff" },
      L2:  { color: "#E84E0F", text: "#fff" },
      L3:  { color: "#F7C100", text: "#000" },
      L4:  { color: "#994B29", text: "#fff" },
      L5:  { color: "#00A650", text: "#fff" },
      L6:  { color: "#9B9B9B", text: "#fff" },
      L7:  { color: "#F69C00", text: "#000" },
      L8:  { color: "#E91E8C", text: "#fff" },
      L9:  { color: "#9B2743", text: "#fff" },
      L10: { color: "#115EA4", text: "#fff" },
      L11: { color: "#008B45", text: "#fff" },
      L12: { color: "#A8007E", text: "#fff" },
      R:   { color: "#00AADF", text: "#fff" },
    },
  },
};

const REFRESH_SEC = 300;

// ─────────────────────────────────────────────────────────────────────────────
// STANDINGS
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
.hdr-top { display: flex; align-items: stretch; min-height: 64px; }
.hdr-badge {
  padding: 0.8rem 1rem;
  display: flex; flex-direction: column; justify-content: center;
  flex-shrink: 0; min-width: 80px; transition: background 0.3s;
}
.hdr-badge-sup { font-family: 'JetBrains Mono', monospace; font-size: 0.45rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.55); line-height: 1; }
.hdr-badge-title { font-size: 1.3rem; font-weight: 700; text-transform: uppercase; color: #fff; line-height: 1; }
.hdr-mid { flex: 1; padding: 0.6rem 1rem; display: flex; flex-direction: column; justify-content: center; gap: 0.15rem; min-width: 0; }
.hdr-season { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; letter-spacing: 0.12em; text-transform: uppercase; color: #333; }
.hdr-info { font-size: 0.85rem; color: #666; font-weight: 300; line-height: 1.2; }
.hdr-right { padding: 0.6rem 1rem; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 0.35rem; flex-shrink: 0; }
.hdr-time { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: #282828; text-align: right; line-height: 1.4; }
.btn-refresh { background: #161620; border: 1px solid #242430; border-radius: 2px; padding: 0.3rem 0.7rem; color: #666; font-family: 'Oswald', sans-serif; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
.btn-refresh:hover { background: #1e1e2c; color: #bbb; }
.btn-refresh:disabled { opacity: 0.35; cursor: wait; }
.spin { animation: spin 0.9s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── City tabs ── */
.city-tabs { display: flex; border-bottom: 1px solid #181820; background: #0a0a0e; }
.city-tab {
  padding: 0.5rem 1.2rem;
  font-family: 'Oswald', sans-serif; font-size: 0.85rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: #333; cursor: pointer; border: none; background: none;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: all 0.15s;
}
.city-tab:hover { color: #666; }
.city-tab.active { color: #ccc; border-bottom-color: var(--city-color, #E3000B); }

/* ── Countdown ── */
.countdown-wrap { background: #0c0c10; border-top: 1px solid #111116; }
.countdown-inner { display: flex; align-items: center; gap: 0.8rem; padding: 0.28rem 1rem; }
.cd-label { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; letter-spacing: 0.12em; text-transform: uppercase; color: #1e1e1e; flex-shrink: 0; }
.cd-track { flex: 1; background: #111118; height: 2px; border-radius: 1px; overflow: hidden; }
.cd-fill { height: 2px; border-radius: 1px; transition: width 1s linear; opacity: 0.5; }
.cd-num { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; color: #1e1e1e; flex-shrink: 0; min-width: 28px; text-align: right; }

/* ── Ticker ── */
.ticker-wrap { background: #0a0a0d; border-bottom: 1px solid #181820; overflow: hidden; height: 26px; display: flex; align-items: center; }
.ticker-label { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; letter-spacing: 0.12em; text-transform: uppercase; color: #886020; padding: 0 0.8rem; flex-shrink: 0; border-right: 1px solid #1e1e10; height: 100%; display: flex; align-items: center; background: #0a0a0d; z-index: 1; }
.ticker-label.incident { color: #8a2020; border-right-color: #1e1010; }
.ticker-track { flex: 1; overflow: hidden; position: relative; }
.ticker-inner { display: flex; white-space: nowrap; animation: ticker-scroll 45s linear infinite; font-family: 'JetBrains Mono', monospace; font-size: 0.54rem; color: #555; }
.ticker-inner:hover { animation-play-state: paused; }
@keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.ticker-item { padding: 0 1.5rem; display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
.ticker-pip { font-size: 0.44rem; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ticker-sep { color: #2a2a2a; margin: 0 0.8rem; }

/* ── Error ── */
.err-box { padding: 0.5rem 1rem; background: #130808; border-bottom: 1px solid #2a0e0e; font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: #6a3030; }

/* ── Table ── */
.tbl-head { display: grid; grid-template-columns: 32px minmax(0,1fr) 52px 100px 80px 44px; padding: 0.4rem 1rem; border-bottom: 1px solid #111116; background: #0a0a0e; }
.th { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; letter-spacing: 0.16em; text-transform: uppercase; color: #222; }
.th.r { text-align: right; }
.th.c { text-align: center; }

.zone-sep { padding: 0.25rem 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; letter-spacing: 0.16em; text-transform: uppercase; background: #0a0a0e; border-bottom: 1px solid #0e0e14; border-left: 2px solid transparent; }
.zone-sep.top   { color: #2a5a2a; border-left-color: #2a5a2a; }
.zone-sep.mid   { color: #1c1c24; border-left-color: #1a1a22; }
.zone-sep.releg { color: #5a1a1a; border-left-color: #5a1a1a; }

.row { display: grid; grid-template-columns: 32px minmax(0,1fr) 52px 100px 80px 44px; padding: 0 1rem; border-bottom: 1px solid #0e0e14; align-items: center; border-left: 2px solid transparent; transition: background 0.12s; height: 50px; }
.row:hover { background: #0e0e14; }
.row.top   { border-left-color: #1e3a1e; }
.row.mid   { border-left-color: #141420; }
.row.releg { border-left-color: #3a1010; }

.col-pos { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #222; }
.col-club { display: flex; align-items: center; gap: 0.6rem; min-width: 0; overflow: hidden; }
.pip { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.58rem; font-weight: 700; flex-shrink: 0; letter-spacing: -0.02em; }

.col-pts-wrap { text-align: right; }
.col-pts { font-family: 'JetBrains Mono', monospace; font-size: 1.05rem; color: #bbb; line-height: 1; }
.col-record { font-family: 'JetBrains Mono', monospace; font-size: 0.44rem; color: #252525; letter-spacing: 0.04em; margin-top: 1px; }

.col-form { display: flex; align-items: center; justify-content: center; gap: 3px; }
.fd { width: 12px; height: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.36rem; font-weight: 500; }
.fd.W    { background: #2a7a2a; color: #5aaa5a; }
.fd.D    { background: #7a6010; color: #bba040; }
.fd.L    { background: #7a1a1a; color: #aa4040; }
.fd.none { background: #131318; }

.col-season { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.seg-bar { display: flex; width: 72px; height: 3px; border-radius: 2px; overflow: hidden; gap: 1px; background: #131318; }
.seg-w { background: #2a7a2a; opacity: 0.8; }
.seg-d { background: #7a6010; opacity: 0.8; }
.seg-l { background: #7a1a1a; opacity: 0.8; }
.season-label { font-family: 'JetBrains Mono', monospace; font-size: 0.44rem; color: #252525; }

.col-now { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 500; text-align: right; letter-spacing: 0.06em; }
.now-clear    { color: #2a6a2a; }
.now-minor    { color: #886020; }
.now-incident { color: #8a2020; }

.state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1.5rem; gap: 0.7rem; font-family: 'JetBrains Mono', monospace; text-align: center; }
.state-ico { font-size: 2rem; }
.state-msg { font-size: 0.65rem; color: #333; max-width: 320px; line-height: 1.9; }

.legend { display: flex; gap: 1rem; padding: 0.5rem 1rem; border-top: 1px solid #0e0e14; align-items: center; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 0.3rem; font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; color: #252525; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.footer { padding: 0.4rem 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.42rem; color: #161616; border-top: 1px solid #0e0e14; letter-spacing: 0.05em; }

@media (max-width: 480px) {
  .tbl-head, .row { grid-template-columns: 28px minmax(0,1fr) 44px 90px 0 36px; }
  .col-season, .th.season { display: none; }
  .hdr-time { display: none; }
  .pip { width: 30px; height: 30px; font-size: 0.52rem; }
  .city-tab { padding: 0.5rem 0.8rem; font-size: 0.75rem; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Ticker({ standings, city }) {
  const alerts = standings.filter(s => s.currentSeverity !== "clear" && s.currentDetail);
  if (!alerts.length) return null;
  const hasIncident = alerts.some(s => s.currentSeverity === "incident");
  const items = [...alerts, ...alerts];
  return (
    <div className="ticker-wrap">
      <div className={`ticker-label ${hasIncident ? "incident" : ""}`}>
        {hasIncident ? "⚠ Incident" : "~ Alterations"}
      </div>
      <div className="ticker-track">
        <div className="ticker-inner">
          {items.map((s, i) => {
            const meta = city.lines[s.name] || { color: "#555", text: "#fff" };
            return (
              <span key={i} className="ticker-item">
                <span className="ticker-pip" style={{ background: meta.color, color: meta.text }}>{s.name}</span>
                {s.currentDetail}
                {i < items.length - 1 && <span className="ticker-sep">◆</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

function Row({ s, pos, total, city }) {
  const meta  = city.lines[s.name] || { color: "#555", text: "#fff" };
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
      </div>
      <div className="col-pts-wrap">
        <div className="col-pts">{s.seasonPts}</div>
        <div className="col-record">{s.checks > 0 ? `${s.wins}W ${s.draws}D ${s.losses}L` : "—"}</div>
      </div>
      <div className="col-form">
        {form.map((r, i) => <div key={i} className={`fd ${r ?? "none"}`}>{r ?? ""}</div>)}
      </div>
      <div className="col-season">
        <SeasonBar wins={s.wins} draws={s.draws} losses={s.losses} />
        <div className="season-label">{maxPts > 0 ? `${Math.round((s.seasonPts / maxPts) * 100)}% max pts` : "—"}</div>
      </div>
      <div className={`col-now ${nowCls}`}>{s.checks > 0 ? nowLbl : "—"}</div>
    </div>
  );
}

function Table({ standings, city }) {
  const n = standings.length;
  const relegStart = Math.max(n - 3, 3);
  return (
    <div>
      <div className="tbl-head">
        <div className="th">#</div>
        <div className="th">Line</div>
        <div className="th r">Pts</div>
        <div className="th c">Form</div>
        <div className="th r season">Season</div>
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
            <Row s={s} pos={i} total={n} city={city} />
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
// CITY VIEW — one instance per city, manages its own data
// ─────────────────────────────────────────────────────────────────────────────

function CityView({ city }) {
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
      const res = await fetch(`${city.statusUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastFetch(new Date());
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      busy.current = false;
    }
  }, [city.statusUrl]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    setErr(null);
    fetchData();
    const tick = setInterval(() => {
      cdRef.current = Math.max(0, cdRef.current - 1);
      setCountdown(cdRef.current);
      if (cdRef.current <= 0) fetchData();
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchData]);

  const standings  = data?.lines ? buildStandings(data.lines) : null;
  const matchday   = data?.matchday ?? 0;
  const updated    = data?.updated ? new Date(data.updated) : null;
  const pct        = (countdown / REFRESH_SEC) * 100;
  const incCount   = standings?.filter(s => s.currentSeverity === "incident").length ?? 0;
  const altCount   = standings?.filter(s => s.currentSeverity === "minor").length ?? 0;
  const timeStr    = updated?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const dateStr    = updated?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) ?? "—";

  return (
    <>
      {/* Countdown */}
      <div className="countdown-wrap">
        <div className="countdown-inner">
          <div className="cd-label">Next reload</div>
          <div className="cd-track">
            <div className="cd-fill" style={{ width: `${pct}%`, background: city.color }} />
          </div>
          <div className="cd-num">{countdown}s</div>
        </div>
      </div>

      {standings && <Ticker standings={standings} city={city} />}
      {err && <div className="err-box">⚠ {err} — try refreshing</div>}

      {loading ? (
        <div className="state">
          <div className="state-ico">🚇</div>
          <div className="state-msg">Loading {city.name} metro liga data…</div>
        </div>
      ) : standings ? (
        <Table standings={standings} city={city} />
      ) : null}

      <div className="footer">
        {city.name} · Data scraped every 5 min · Hosted free on GitHub Pages · W=3pts D=1pt L=0pts
        {updated && ` · Last checked ${dateStr} ${timeStr}`}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [cityId, setCityId] = useState("barcelona");
  const city = CITIES[cityId];

  return (
    <div className="app" style={{ "--city-color": city.color }}>
      <style>{CSS}</style>

      <div className="hdr">
        <div className="hdr-top">
          <div className="hdr-badge" style={{ background: city.color }}>
            <div className="hdr-badge-sup">{city.code} Metro</div>
            <div className="hdr-badge-title">Liga</div>
          </div>
          <div className="hdr-mid">
            <div className="hdr-season">Season 2025/26 · W=3 D=1 L=0</div>
            <div className="hdr-info">{city.name} Metro Liga</div>
          </div>
          <div className="hdr-right">
            <div className="hdr-time">{city.name}<br />Metro Liga</div>
          </div>
        </div>

        {/* City selector tabs */}
        <div className="city-tabs">
          {Object.values(CITIES).map(c => (
            <button
              key={c.id}
              className={`city-tab ${cityId === c.id ? "active" : ""}`}
              style={cityId === c.id ? { "--city-color": c.color, borderBottomColor: c.color, color: "#ccc" } : {}}
              onClick={() => setCityId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <CityView key={cityId} city={city} />
    </div>
  );
}