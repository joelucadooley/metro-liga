import { useState, useEffect, useCallback, useRef } from "react";

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
    id: "valencia", name: "Valencia", code: "VLC", color: "#c9a800",
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
    id: "segunda", name: "Segunda", code: "2ª", color: "#666",
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
// STYLES — light theme
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
html, body, #root { margin: 0; padding: 0; background: #f4f4f6; width: 100%; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.app { min-height: 100vh; background: #f4f4f6; color: #111; font-family: 'Oswald', sans-serif; }

/* ── Header ── */
.hdr { background: #fff; border-bottom: 1px solid #e0e0e6; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.hdr-top { display: flex; align-items: stretch; min-height: 72px; }
.hdr-badge {
  padding: 0.9rem 1.3rem;
  display: flex; flex-direction: column; justify-content: center;
  flex-shrink: 0; min-width: 120px; transition: background 0.3s;
}
.hdr-badge-sup { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.7); line-height: 1; margin-bottom: 0.2rem; }
.hdr-badge-title { font-size: 1.7rem; font-weight: 700; text-transform: uppercase; color: #fff; line-height: 0.95; }
.hdr-mid { flex: 1; padding: 0.7rem 1.3rem; display: flex; flex-direction: column; justify-content: center; gap: 0.2rem; min-width: 0; }
.hdr-matchday { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; letter-spacing: 0.14em; text-transform: uppercase; color: #aaa; }
.hdr-info { font-size: 0.9rem; color: #888; font-weight: 300; line-height: 1.2; }
.hdr-right { padding: 0.7rem 1.3rem; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 0.4rem; flex-shrink: 0; }
.hdr-time { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; color: #ccc; text-align: right; line-height: 1.4; }

/* ── City tabs ── */
.city-tabs { display: flex; border-bottom: 1px solid #e0e0e6; background: #fff; overflow-x: auto; padding: 0 1.3rem; }
.city-tab {
  padding: 0.5rem 1rem; font-family: 'Oswald', sans-serif; font-size: 0.85rem;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;
  color: #bbb; cursor: pointer; border: none; background: none;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
}
.city-tab:hover { color: #888; }
.city-tab.active { color: #111; }

/* ── Ticker ── */
.ticker-wrap {
  background: #fafafa; border-bottom: 1px solid #e0e0e6;
  overflow: hidden; height: 28px; display: flex; align-items: center;
}
.ticker-label {
  font-family: 'JetBrains Mono', monospace; font-size: 0.48rem;
  letter-spacing: 0.12em; text-transform: uppercase;
  padding: 0 1rem; flex-shrink: 0; border-right: 1px solid #e0e0e6;
  height: 100%; display: flex; align-items: center; background: #fafafa; z-index: 1;
  color: #e67e22;
}
.ticker-label.incident { color: #c0392b; }
.ticker-track { flex: 1; overflow: hidden; }
.ticker-inner {
  display: flex; white-space: nowrap;
  animation: ticker-scroll 45s linear infinite;
  font-family: 'JetBrains Mono', monospace; font-size: 0.54rem; color: #999;
}
.ticker-inner:hover { animation-play-state: paused; }
@keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.ticker-item { padding: 0 1.5rem; display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
.ticker-pip { font-size: 0.44rem; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ticker-sep { color: #ddd; margin: 0 0.8rem; }

/* ── Error ── */
.err-box { padding: 0.5rem 1.3rem; background: #fff0f0; border-bottom: 1px solid #ffc0c0; font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: #c00; }

/* ── Content wrapper ── */
.content-wrap { max-width: 860px; margin: 0 auto; }

/* ── Table ── */
.tbl-head {
  display: grid;
  grid-template-columns: 40px minmax(0,1fr) 64px 120px 44px;
  padding: 0.45rem 1.3rem; border-bottom: 2px solid #e0e0e6; background: #fff;
}
.th { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; letter-spacing: 0.18em; text-transform: uppercase; color: #bbb; }
.th.r { text-align: right; }
.th.c { text-align: center; }

.zone-sep {
  padding: 0.28rem 1.3rem;
  font-family: 'JetBrains Mono', monospace; font-size: 0.48rem;
  letter-spacing: 0.18em; text-transform: uppercase;
  background: #f0f0f4; border-bottom: 1px solid #e0e0e6;
  border-left: 3px solid transparent; color: #aaa;
}
.zone-sep.top   { color: #2a7a2a; border-left-color: #2a7a2a; background: #f0faf0; }
.zone-sep.mid   { color: #bbb;    border-left-color: #ddd; }
.zone-sep.releg { color: #c0392b; border-left-color: #c0392b; background: #fff5f5; }

.row {
  display: grid;
  grid-template-columns: 40px minmax(0,1fr) 64px 120px 44px;
  padding: 0 1.3rem; border-bottom: 1px solid #ebebef;
  align-items: center; border-left: 3px solid transparent;
  transition: background 0.1s; height: 52px;
  background: #fff;
}
.row:hover { background: #f8f8fb; }
.row.top   { border-left-color: #2a7a2a; }
.row.mid   { border-left-color: #ddd; }
.row.releg { border-left-color: #c0392b; }

.col-pos { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #ccc; }

.col-club { display: flex; align-items: center; gap: 0.6rem; min-width: 0; overflow: hidden; }
.pip { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.58rem; font-weight: 700; flex-shrink: 0; letter-spacing: -0.02em; }
.club-text { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
.club-label { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: #999; white-space: nowrap; }

/* Scrolling description — scrolls inside the column, no extra height */
.club-desc-wrap { overflow: hidden; position: relative; }
.club-desc {
  font-family: 'JetBrains Mono', monospace; font-size: 0.44rem;
  white-space: nowrap; display: inline-block;
  animation: scroll-desc 18s linear infinite;
  font-style: italic;
}
.club-desc:hover { animation-play-state: paused; }
.club-desc.minor    { color: #b07800; }
.club-desc.incident { color: #c0392b; }
@keyframes scroll-desc {
  0%   { transform: translateX(0); }
  20%  { transform: translateX(0); }
  80%  { transform: translateX(-100%); }
  100% { transform: translateX(-100%); }
}

.col-pts-wrap { text-align: right; }
.col-pts { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; color: #222; line-height: 1; font-weight: 500; }
.col-record { font-family: 'JetBrains Mono', monospace; font-size: 0.44rem; color: #ccc; margin-top: 1px; }

.col-form { display: flex; align-items: center; justify-content: center; gap: 4px; justify-self: center; width: 100%; }
.fd { width: 13px; height: 13px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.38rem; font-weight: 500; }
.fd.W    { background: #d4edda; color: #1a7a2a; }
.fd.D    { background: #fff3cd; color: #856404; }
.fd.L    { background: #f8d7da; color: #c0392b; }
.fd.none { background: #eee; }

/* Status symbol in NOW column */
.col-now { font-size: 1rem; text-align: right; line-height: 1; }
.now-clear    { color: #27ae60; }
.now-minor    { color: #e67e22; }
.now-incident { color: #c0392b; }
.now-pending  { color: #ddd; font-size: 0.7rem; }

.state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 0.8rem; font-family: 'JetBrains Mono', monospace; text-align: center; }
.state-ico { font-size: 2.5rem; }
.state-msg { font-size: 0.66rem; color: #aaa; max-width: 340px; line-height: 1.9; }

.legend { display: flex; gap: 1.2rem; padding: 0.7rem 1.3rem; border-top: 1px solid #ebebef; align-items: center; flex-wrap: wrap; background: #fff; }
.legend-item { display: flex; align-items: center; gap: 0.4rem; font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: #aaa; }

.solo-champ { text-align: center; padding: 1.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: #2a7a2a; letter-spacing: 0.1em; background: #fff; }

.footer {
  padding: 0.6rem 1.3rem; font-family: 'JetBrains Mono', monospace;
  font-size: 0.44rem; color: #ccc; border-top: 1px solid #ebebef;
  letter-spacing: 0.05em; display: flex; gap: 1.2rem; flex-wrap: wrap; align-items: center;
  background: #fff;
}
.footer a { color: #aaa; text-decoration: none; }
.footer a:hover { color: #555; }

@media (max-width: 600px) {
  .tbl-head, .row { grid-template-columns: 32px minmax(0,1fr) 50px 100px 36px; }
  .pip { width: 30px; height: 30px; font-size: 0.52rem; }
  .city-tab { padding: 0.5rem 0.7rem; font-size: 0.78rem; }
  .hdr-badge { min-width: 90px; }
  .hdr-badge-title { font-size: 1.4rem; }
  .hdr-time { display: none; }
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
      <div className={`ticker-label${hasIncident ? " incident" : ""}`}>
        {hasIncident ? "⚠ Incident" : "~ Issues"}
      </div>
      <div className="ticker-track">
        <div className="ticker-inner">
          {items.map((s, i) => {
            const meta = city.lines[s.name] || { color: "#999", text: "#fff" };
            const pipText = meta.pip || s.name;
            return (
              <span key={i} className="ticker-item">
                <span className="ticker-pip" style={{ background: meta.color, color: meta.text }}>{pipText}</span>
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

function Row({ s, pos, total, city }) {
  const meta    = city.lines[s.name] || { color: "#999", text: "#fff" };
  const isTop   = pos < 3, isRel = pos >= total - 3;
  const zone    = isTop ? "top" : isRel ? "releg" : "mid";
  const form    = [...Array(5)].map((_, i) => {
    const off = 5 - s.recentForm.length;
    return i >= off ? s.recentForm[i - off] : null;
  });
  const sev     = s.currentSeverity;
  const pipText = meta.pip   || s.name;
  const label   = meta.label || null;
  const desc    = sev !== "clear" ? s.currentDetail : null;
  // Speed: ~60px per second regardless of text length
  const scrollDuration = desc ? Math.max(6, desc.length * 0.1) + 's' : '0s';

  const nowSymbol = s.checks === 0 ? <span className="now-pending">—</span>
    : sev === "incident" ? <span className="now-incident" title="Service incident">✗</span>
    : sev === "minor"    ? <span className="now-minor"    title="Station issues">!</span>
    :                      <span className="now-clear"    title="All clear">✓</span>;

  return (
    <div className={`row ${zone}`}>
      <div className="col-pos">{pos + 1}</div>
      <div className="col-club">
        <div className="pip" style={{ background: meta.color, color: meta.text }}>{pipText}</div>
        <div className="club-text">
          {label && <div className="club-label">{label}</div>}
          {desc && (
            <div className="club-desc-wrap">
              <span className={`club-desc ${sev}`} style={{ animationDuration: scrollDuration }}>{desc}</span>
            </div>
          )}
        </div>
      </div>
      <div className="col-pts-wrap">
        <div className="col-pts">{s.seasonPts}</div>
        <div className="col-record">{s.checks > 0 ? `${s.wins}W ${s.draws}D ${s.losses}L` : "—"}</div>
      </div>
      <div className="col-form">
        {form.map((r, i) => <div key={i} className={`fd ${r ?? "none"}`}>{r ?? ""}</div>)}
      </div>
      <div className="col-now">{nowSymbol}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <div className="legend-item"><span style={{ color: "#27ae60", fontSize: "1rem" }}>✓</span> Clean run (3 pts)</div>
      <div className="legend-item"><span style={{ color: "#e67e22", fontSize: "1rem" }}>!</span> Station issues (1 pt)</div>
      <div className="legend-item"><span style={{ color: "#c0392b", fontSize: "1rem" }}>✗</span> Service incident (0 pts)</div>
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

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [cityId,    setCityId]    = useState("barcelona");
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState(null);
  const cdRef = useRef(REFRESH_SEC);
  const busy  = useRef(false);
  const city  = CITIES[cityId];

  const fetchData = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch(`${city.statusUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, [city.statusUrl]);

  useEffect(() => {
    setData(null); setLoading(true); setErr(null);
    cdRef.current = REFRESH_SEC;
    fetchData();
    const tick = setInterval(() => {
      cdRef.current = Math.max(0, cdRef.current - 1);
      if (cdRef.current <= 0) {
        cdRef.current = REFRESH_SEC;
        fetchData();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchData]);

  const standings = data?.lines ? buildStandings(data.lines) : null;
  const matchday  = data?.matchday ?? 0;
  const updated   = data?.updated ? new Date(data.updated) : null;
  const incCount  = standings?.filter(s => s.currentSeverity === "incident").length ?? 0;
  const altCount  = standings?.filter(s => s.currentSeverity === "minor").length ?? 0;
  const timeStr   = updated?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const dateStr   = updated?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) ?? "—";

  const statusText = loading    ? "Loading…"
    : err           ? "Could not load data"
    : incCount > 0  ? `${incCount} service incident${incCount > 1 ? "s" : ""}`
    : altCount > 0  ? `All running · ${altCount} with station issues`
    : matchday === 0 ? "Waiting for first data…"
    : "All lines clear";

  const badgeBg = city.id === "segunda"
    ? "linear-gradient(135deg,#EE1C25,#003082)"
    : city.color;

  const monthStr = updated
    ? updated.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="app">
      <style>{CSS}</style>

      <div className="hdr">
        <div className="hdr-top">
          <div className="hdr-badge" style={{ background: badgeBg }}>
            <div className="hdr-badge-sup">{city.code} Metro</div>
            <div className="hdr-badge-title">Liga</div>
          </div>
          <div className="hdr-mid">
            <div className="hdr-matchday">{city.name} · {monthStr}</div>
            <div className="hdr-info">{statusText}</div>
          </div>
          <div className="hdr-right">
            {updated && (
              <div className="hdr-time">Updated<br />{dateStr} {timeStr}</div>
            )}
          </div>
        </div>

        <div className="city-tabs">
          {Object.values(CITIES).map(c => (
            <button
              key={c.id}
              className={`city-tab ${cityId === c.id ? "active" : ""}`}
              style={cityId === c.id ? { borderBottomColor: c.color, color: "#111" } : {}}
              onClick={() => setCityId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="err-box">⚠ {err}</div>}

      <div className="content-wrap">
        {loading ? (
          <div className="state">
            <div className="state-ico">🚇</div>
            <div className="state-msg">Loading {city.name} metro liga…</div>
          </div>
        ) : standings ? (
          <Table standings={standings} city={city} />
        ) : null}

        <div className="footer">
          <span>Metro Liga · Spanish metro reliability league</span>
          <span>Created by <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Joe Luca Dooley</a></span>
        </div>
      </div>
    </div>
  );
}