import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CITY CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const CITIES = {
  barcelona: {
    id: "barcelona", name: "Barcelona", code: "BCN", color: "#E3000B",
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
    id: "madrid", name: "Madrid", code: "MAD", color: "#003087",
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
  valencia: {
    id: "valencia", name: "Valencia", code: "VLC", color: "#F5C400",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/valencia_status.json",
    lines: {
      L1: { color: "#F5C400", text: "#000" },
      L2: { color: "#E5007D", text: "#fff" },
      L3: { color: "#EE1C25", text: "#fff" },
      L4: { color: "#004B9D", text: "#fff" },
      L5: { color: "#009A44", text: "#fff" },
      L6: { color: "#F47920", text: "#fff" },
      L7: { color: "#8DC63F", text: "#000" },
    },
  },
  segunda: {
    id: "segunda", name: "Segunda", code: "2ª", color: "#555",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/segunda_status.json",
    lines: {
      SVQ_L1: { color: "#01820B", text: "#fff", pip: "L1", label: "Sevilla" },
      BIL_L1: { color: "#EE1C25", text: "#fff", pip: "L1", label: "Bilbao" },
      BIL_L2: { color: "#003082", text: "#fff", pip: "L2", label: "Bilbao" },
      MAL_L1: { color: "#009E3A", text: "#fff", pip: "L1", label: "Málaga" },
      MAL_L2: { color: "#00AADF", text: "#fff", pip: "L2", label: "Málaga" },
      GRN_L1: { color: "#1FACA5", text: "#fff", pip: "L1", label: "Granada" },
      PMI_M1: { color: "#F5A623", text: "#fff", pip: "M1", label: "Palma" },
    },
  },
};

const REFRESH_SEC = 300;
const GITHUB_URL  = "https://github.com/joelucadooley/metro-liga";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildStandings(lines) {
  return Object.entries(lines)
    .map(([name, d]) => ({
      name,
      seasonPts:       d.seasonPts   ?? 0,
      checks:          d.checks      ?? 0,
      wins:            d.wins        ?? 0,
      draws:           d.draws       ?? 0,
      losses:          d.losses      ?? 0,
      recentForm:      d.recentForm  ?? [],
      currentSeverity: d.severity    ?? "clear",
      currentDetail:   d.description ?? null,
    }))
    .sort((a, b) => b.seasonPts - a.seasonPts || b.wins - a.wins);
}

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
html, body, #root { margin: 0; padding: 0; background: #08080b; width: 100%; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.app { min-height: 100vh; background: #08080b; color: #ccc; font-family: 'Oswald', sans-serif; }

/* ── Top progress bar (replaces countdown) ── */
.top-bar { height: 2px; background: #111; position: relative; overflow: hidden; }
.top-bar-fill { height: 100%; position: absolute; left: 0; top: 0; transition: width 1s linear; opacity: 0.6; }

/* ── Header ── */
.hdr { background: #0c0c10; border-bottom: 1px solid #181820; }
.hdr-top { display: flex; align-items: stretch; min-height: 72px; }
.hdr-badge {
  padding: 0.9rem 1.3rem;
  display: flex; flex-direction: column; justify-content: center;
  flex-shrink: 0; min-width: 120px; transition: background 0.3s;
}
.hdr-badge-sup { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.6); line-height: 1; margin-bottom: 0.2rem; }
.hdr-badge-title { font-size: 1.7rem; font-weight: 700; text-transform: uppercase; color: #fff; line-height: 0.95; }
.hdr-mid { flex: 1; padding: 0.7rem 1.3rem; display: flex; flex-direction: column; justify-content: center; gap: 0.2rem; min-width: 0; }
.hdr-matchday { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; letter-spacing: 0.14em; text-transform: uppercase; color: #333; }
.hdr-info { font-size: 0.9rem; color: #555; font-weight: 300; line-height: 1.2; }
.hdr-right { padding: 0.7rem 1.3rem; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 0.4rem; flex-shrink: 0; }
.hdr-actions { display: flex; gap: 0.5rem; }
.btn {
  background: #161620; border: 1px solid #242430; border-radius: 2px;
  padding: 0.35rem 0.8rem; color: #555;
  font-family: 'Oswald', sans-serif; font-size: 0.78rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
  cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 0.3rem; white-space: nowrap;
}
.btn:hover { background: #1e1e2c; color: #aaa; }
.btn:disabled { opacity: 0.35; cursor: wait; }
.btn-primary { border-color: #333; }
.spin { animation: spin 0.9s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── City tabs ── */
.city-tabs { display: flex; border-bottom: 1px solid #181820; background: #0a0a0e; overflow-x: auto; padding: 0 1.3rem; }
.city-tab {
  padding: 0.5rem 1rem; font-family: 'Oswald', sans-serif; font-size: 0.85rem;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;
  color: #2a2a2a; cursor: pointer; border: none; background: none;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
}
.city-tab:hover { color: #555; }
.city-tab.active { color: #ccc; }

/* ── Intro card ── */
.intro-wrap {
  background: #0c0c10; border-bottom: 1px solid #181820;
  padding: 0.8rem 1.3rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
}
.intro-text { font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: #444; line-height: 1.8; flex: 1; min-width: 200px; }
.intro-text strong { color: #666; }
.btn-dismiss { background: none; border: 1px solid #222; border-radius: 2px; padding: 0.25rem 0.6rem; color: #333; font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
.btn-dismiss:hover { color: #888; border-color: #444; }

/* ── Error ── */
.err-box { padding: 0.5rem 1.3rem; background: #130808; border-bottom: 1px solid #2a0e0e; font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: #6a3030; }

/* ── Content wrapper ── */
.content-wrap { max-width: 860px; margin: 0 auto; }

/* ── Table ── */
.tbl-head {
  display: grid;
  grid-template-columns: 40px minmax(0,1fr) 64px 120px 52px;
  padding: 0.45rem 1.3rem; border-bottom: 1px solid #111116; background: #0a0a0e;
}
.th { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; letter-spacing: 0.18em; text-transform: uppercase; color: #222; }
.th.r { text-align: right; }
.th.c { text-align: center; }

.zone-sep {
  padding: 0.28rem 1.3rem; font-family: 'JetBrains Mono', monospace;
  font-size: 0.48rem; letter-spacing: 0.18em; text-transform: uppercase;
  background: #0a0a0e; border-bottom: 1px solid #0e0e14; border-left: 2px solid transparent;
}
.zone-sep.top   { color: #2a5a2a; border-left-color: #2a5a2a; }
.zone-sep.mid   { color: #1c1c24; border-left-color: #1a1a22; }
.zone-sep.releg { color: #5a1a1a; border-left-color: #5a1a1a; }

.row {
  display: grid;
  grid-template-columns: 40px minmax(0,1fr) 64px 120px 52px;
  padding: 0 1.3rem; border-bottom: 1px solid #0e0e14;
  align-items: center; border-left: 2px solid transparent;
  transition: background 0.12s; min-height: 54px;
}
.row:hover { background: #0e0e14; }
.row.top   { border-left-color: #1e3a1e; }
.row.mid   { border-left-color: #141420; }
.row.releg { border-left-color: #3a1010; }

.col-pos { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #222; }

.col-club { display: flex; align-items: center; gap: 0.6rem; min-width: 0; overflow: hidden; padding: 0.4rem 0; }
.pip { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.58rem; font-weight: 700; flex-shrink: 0; letter-spacing: -0.02em; }
.club-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow: hidden; }
.club-label { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: #444; white-space: nowrap; }
.club-desc { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-style: italic; }
.club-desc.minor    { color: #886020; }
.club-desc.incident { color: #8a2020; }

.col-pts-wrap { text-align: right; }
.col-pts { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; color: #bbb; line-height: 1; }
.col-record { font-family: 'JetBrains Mono', monospace; font-size: 0.44rem; color: #252525; margin-top: 1px; }

.col-form { display: flex; align-items: center; justify-content: center; gap: 4px; }
.fd { width: 13px; height: 13px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.38rem; font-weight: 500; }
.fd.W    { background: #2a7a2a; color: #5aaa5a; }
.fd.D    { background: #7a6010; color: #bba040; }
.fd.L    { background: #7a1a1a; color: #aa4040; }
.fd.none { background: #131318; }

.col-now { font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; font-weight: 500; text-align: right; letter-spacing: 0.06em; }
.now-clear    { color: #2a6a2a; }
.now-minor    { color: #886020; }
.now-incident { color: #8a2020; }

.state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 0.8rem; font-family: 'JetBrains Mono', monospace; text-align: center; }
.state-ico { font-size: 2.5rem; }
.state-msg { font-size: 0.66rem; color: #333; max-width: 340px; line-height: 1.9; }

.legend { display: flex; gap: 1.2rem; padding: 0.6rem 1.3rem; border-top: 1px solid #0e0e14; align-items: center; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 0.35rem; font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: #252525; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.solo-champ { text-align: center; padding: 1.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: #2a5a2a; letter-spacing: 0.1em; }

.footer {
  padding: 0.5rem 1.3rem; font-family: 'JetBrains Mono', monospace;
  font-size: 0.44rem; color: #1e1e1e; border-top: 1px solid #0e0e14;
  letter-spacing: 0.05em; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;
}
.footer a { color: #333; text-decoration: none; }
.footer a:hover { color: #666; }

@media (max-width: 600px) {
  .tbl-head, .row { grid-template-columns: 32px minmax(0,1fr) 50px 100px 40px; }
  .pip { width: 30px; height: 30px; font-size: 0.52rem; }
  .city-tab { padding: 0.5rem 0.7rem; font-size: 0.78rem; }
  .hdr-badge { min-width: 90px; }
  .hdr-badge-title { font-size: 1.4rem; }
  .club-desc { display: none; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// INTRO CARD
// ─────────────────────────────────────────────────────────────────────────────

function IntroCard() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem("metro-liga-intro-dismissed"); }
    catch { return true; }
  });

  if (!visible) return null;

  return (
    <div className="intro-wrap">
      <div className="intro-text">
        <strong>Metro Liga</strong> ranks Spanish metro lines by reliability — like a football league table.{" "}
        <strong>W</strong> = clean run (3pts) · <strong>D</strong> = station issues (1pt) · <strong>L</strong> = service incident (0pts).
        Points are awarded once per day. Data scraped automatically from official metro websites.
      </div>
      <button className="btn-dismiss" onClick={() => {
        try { localStorage.setItem("metro-liga-intro-dismissed", "1"); } catch {}
        setVisible(false);
      }}>
        Got it ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SeasonBar({ wins, draws, losses }) {
  const total = wins + draws + losses;
  if (!total) return <div style={{ height: 3, background: "#131318", borderRadius: 2, width: 80 }} />;
  const w = (wins / total) * 100, d = (draws / total) * 100, l = (losses / total) * 100;
  return (
    <div style={{ display: "flex", width: 80, height: 3, borderRadius: 2, overflow: "hidden", gap: 1, background: "#131318" }}>
      {wins   > 0 && <div style={{ width: `${w}%`, background: "#2a7a2a", opacity: 0.8 }} />}
      {draws  > 0 && <div style={{ width: `${d}%`, background: "#7a6010", opacity: 0.8 }} />}
      {losses > 0 && <div style={{ width: `${l}%`, background: "#7a1a1a", opacity: 0.8 }} />}
    </div>
  );
}

function Row({ s, pos, total, city }) {
  const meta     = city.lines[s.name] || { color: "#555", text: "#fff" };
  const isTop    = pos < 3, isRel = pos >= total - 3;
  const zone     = isTop ? "top" : isRel ? "releg" : "mid";
  const form     = [...Array(5)].map((_, i) => {
    const off = 5 - s.recentForm.length;
    return i >= off ? s.recentForm[i - off] : null;
  });
  const sev      = s.currentSeverity;
  const nowCls   = sev === "incident" ? "now-incident" : sev === "minor" ? "now-minor" : "now-clear";
  const nowLbl   = sev === "incident" ? "INC" : sev === "minor" ? "ALT" : "OK";
  const pipText  = meta.pip   || s.name;
  const label    = meta.label || null;
  const maxPts   = s.checks * 3;
  const desc     = sev !== "clear" ? truncate(s.currentDetail, 55) : null;

  return (
    <div className={`row ${zone}`}>
      <div className="col-pos">{pos + 1}</div>

      <div className="col-club">
        <div className="pip" style={{ background: meta.color, color: meta.text }}>{pipText}</div>
        <div className="club-info">
          {label && <div className="club-label">{label}</div>}
          {desc  && <div className={`club-desc ${sev}`}>{desc}</div>}
        </div>
      </div>

      <div className="col-pts-wrap">
        <div className="col-pts">{s.seasonPts}</div>
        <div className="col-record">{s.checks > 0 ? `${s.wins}W ${s.draws}D ${s.losses}L` : "—"}</div>
      </div>

      <div className="col-form">
        {form.map((r, i) => <div key={i} className={`fd ${r ?? "none"}`}>{r ?? ""}</div>)}
      </div>

      <div className={`col-now ${nowCls}`}>{s.checks > 0 ? nowLbl : "—"}</div>
    </div>
  );
}

function Table({ standings, city }) {
  const n = standings.length;
  if (n === 1) {
    return (
      <div>
        <div className="tbl-head">
          <div className="th">#</div><div className="th">Line</div>
          <div className="th r">Pts</div><div className="th c">Form</div>
          <div className="th r">Now</div>
        </div>
        <div className="zone-sep top">Champions Metro Zone</div>
        <Row s={standings[0]} pos={0} total={1} city={city} />
        <div className="solo-champ">🏆 Undefeated champions — no competition found</div>
        <Legend />
      </div>
    );
  }
  const relegStart = Math.max(n - 3, 3);
  return (
    <div>
      <div className="tbl-head">
        <div className="th">#</div><div className="th">Line</div>
        <div className="th r">Pts</div><div className="th c">Form</div>
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
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <div className="legend-item"><div className="legend-dot" style={{ background: "#2a7a2a" }} />W = clean run (3 pts)</div>
      <div className="legend-item"><div className="legend-dot" style={{ background: "#7a6010" }} />D = station alterations (1 pt)</div>
      <div className="legend-item"><div className="legend-dot" style={{ background: "#7a1a1a" }} />L = service incident (0 pts)</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY VIEW
// ─────────────────────────────────────────────────────────────────────────────

function CityView({ city, refreshKey }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err,        setErr]        = useState(null);
  const [countdown,  setCountdown]  = useState(REFRESH_SEC);
  const cdRef = useRef(REFRESH_SEC);
  const busy  = useRef(false);

  const fetchData = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    cdRef.current = REFRESH_SEC;
    setCountdown(REFRESH_SEC);
    setRefreshing(true);
    try {
      const res = await fetch(`${city.statusUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      busy.current = false;
    }
  }, [city.statusUrl]);

  // Fetch on mount, city change, or manual refresh
  useEffect(() => {
    setData(null); setLoading(true); setErr(null);
    fetchData();
  }, [fetchData, refreshKey]);

  // Countdown timer
  useEffect(() => {
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
  const incCount  = standings?.filter(s => s.currentSeverity === "incident").length ?? 0;
  const altCount  = standings?.filter(s => s.currentSeverity === "minor").length ?? 0;
  const timeStr   = updated?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const dateStr   = updated?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) ?? "—";

  return { standings, matchday, updated, pct, incCount, altCount, timeStr, dateStr, loading, refreshing, err, city };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [cityId,     setCityId]     = useState("barcelona");
  const [refreshKey, setRefreshKey] = useState(0);
  const city = CITIES[cityId];

  // Share handler
  const handleShare = async () => {
    const text = `Metro Liga — ${city.name} metro reliability league table`;
    if (navigator.share) {
      try { await navigator.share({ title: "Metro Liga", text, url: window.location.href }); }
      catch {}
    } else {
      try { await navigator.clipboard.writeText(window.location.href); alert("Link copied!"); }
      catch {}
    }
  };

  return (
    <AppInner
      city={city}
      cityId={cityId}
      setCityId={setCityId}
      refreshKey={refreshKey}
      onRefresh={() => setRefreshKey(k => k + 1)}
      onShare={handleShare}
    />
  );
}

function AppInner({ city, cityId, setCityId, refreshKey, onRefresh, onShare }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err,        setErr]        = useState(null);
  const [countdown,  setCountdown]  = useState(REFRESH_SEC);
  const cdRef = useRef(REFRESH_SEC);
  const busy  = useRef(false);

  const fetchData = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    cdRef.current = REFRESH_SEC;
    setCountdown(REFRESH_SEC);
    setRefreshing(true);
    try {
      const res = await fetch(`${city.statusUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
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
    setData(null); setLoading(true); setErr(null);
    fetchData();
  }, [fetchData, refreshKey]);

  useEffect(() => {
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
  const incCount  = standings?.filter(s => s.currentSeverity === "incident").length ?? 0;
  const altCount  = standings?.filter(s => s.currentSeverity === "minor").length ?? 0;
  const timeStr   = updated?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const dateStr   = updated?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) ?? "—";

  const statusText = loading ? "Loading…"
    : err       ? "Could not load data"
    : incCount > 0 ? `${incCount} service incident${incCount > 1 ? "s" : ""}`
    : altCount > 0 ? `All running · ${altCount} with station alterations`
    : matchday === 0 ? "Waiting for first data…"
    : "All lines clear";

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* Hairline progress bar at very top */}
      <div className="top-bar">
        <div className="top-bar-fill" style={{ width: `${pct}%`, background: city.color }} />
      </div>

      <div className="hdr">
        <div className="hdr-top">
          <div className="hdr-badge" style={{ background: city.id === "segunda" ? "linear-gradient(135deg,#EE1C25,#003082)" : city.color }}>
            <div className="hdr-badge-sup">{city.code} Metro</div>
            <div className="hdr-badge-title">Liga</div>
          </div>
          <div className="hdr-mid">
            <div className="hdr-matchday">
              {city.name} · Matchday {matchday} · W=3 D=1 L=0
            </div>
            <div className="hdr-info">{statusText}</div>
          </div>
          <div className="hdr-right">
            <div className="hdr-actions">
              <button className="btn" onClick={onShare} title="Share">⬆ Share</button>
              <button className="btn btn-primary" onClick={onRefresh} disabled={refreshing || loading}>
                <span className={refreshing ? "spin" : ""}>⟳</span>
                {refreshing ? "…" : ""}
              </button>
            </div>
            {updated && (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", color: "#282828", textAlign: "right" }}>
                {dateStr} {timeStr}
              </div>
            )}
          </div>
        </div>

        <div className="city-tabs">
          {Object.values(CITIES).map(c => (
            <button
              key={c.id}
              className={`city-tab ${cityId === c.id ? "active" : ""}`}
              style={cityId === c.id ? { borderBottomColor: c.color, color: "#ddd" } : {}}
              onClick={() => setCityId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <IntroCard />

      {err && <div className="err-box">⚠ {err} — try refreshing</div>}

      <div className="content-wrap">
        {loading ? (
          <div className="state">
            <div className="state-ico">🚇</div>
            <div className="state-msg">Loading {city.name} metro liga data…</div>
          </div>
        ) : standings ? (
          <Table standings={standings} city={city} />
        ) : null}

        <div className="footer">
          <span>Metro Liga · Real-time Spanish metro reliability · W=3pts D=1pt L=0pts</span>
          <span>Created by <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Joe Luca Dooley</a></span>
          {updated && <span>Last updated {dateStr} {timeStr}</span>}
        </div>
      </div>
    </div>
  );
}