import { useState, useEffect, useCallback, useRef } from "react";

// ── City config ──────────────────────────────────────────────────────────────

const CITIES = {
  barcelona: {
    id:"barcelona", name:"Barcelona", code:"BCN", color:"#E3000B",
    statusUrl:"https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/status.json",
    lines:{
      L1:{color:"#E3000B",text:"#fff"}, L2:{color:"#9B2D82",text:"#fff"},
      L3:{color:"#3FAA4B",text:"#fff"}, L4:{color:"#F5C300",text:"#000"},
      L5:{color:"#0069B4",text:"#fff"}, L9N:{color:"#F37021",text:"#fff"},
      L9S:{color:"#F37021",text:"#fff"}, L10N:{color:"#009999",text:"#fff"},
      L10S:{color:"#007DB8",text:"#fff"}, L11:{color:"#8DC63F",text:"#000"},
    },
  },
  madrid: {
    id:"madrid", name:"Madrid", code:"MAD", color:"#003087",
    statusUrl:"https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/madrid_status.json",
    lines:{
      L1:{color:"#00AADF",text:"#fff"}, L2:{color:"#E84E0F",text:"#fff"},
      L3:{color:"#F7C100",text:"#000"}, L4:{color:"#994B29",text:"#fff"},
      L5:{color:"#00A650",text:"#fff"}, L6:{color:"#9B9B9B",text:"#fff"},
      L7:{color:"#F69C00",text:"#000"}, L8:{color:"#E91E8C",text:"#fff"},
      L9:{color:"#9B2743",text:"#fff"}, L10:{color:"#115EA4",text:"#fff"},
      L11:{color:"#008B45",text:"#fff"}, L12:{color:"#A8007E",text:"#fff"},
      R:{color:"#00AADF",text:"#fff"},
    },
  },
  valencia: {
    id:"valencia", name:"Valencia", code:"VLC", color:"#c9a800",
    statusUrl:"https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/valencia_status.json",
    lines:{
      L1:{color:"#F5C400",text:"#000"}, L2:{color:"#E5007D",text:"#fff"},
      L3:{color:"#EE1C25",text:"#fff"}, L4:{color:"#004B9D",text:"#fff"},
      L5:{color:"#009A44",text:"#fff"}, L6:{color:"#F47920",text:"#fff"},
      L7:{color:"#8DC63F",text:"#000"},
    },
  },
  segunda: {
    id:"segunda", name:"Segunda", code:"2ª", color:"#555",
    statusUrl:"https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/segunda_status.json",
    lines:{
      SVQ_L1:{color:"#01820B",text:"#fff",pip:"L1",label:"Sevilla"},
      BIL_L1:{color:"#EE1C25",text:"#fff",pip:"L1",label:"Bilbao"},
      BIL_L2:{color:"#003082",text:"#fff",pip:"L2",label:"Bilbao"},
      MAL_L1:{color:"#009E3A",text:"#fff",pip:"L1",label:"Málaga"},
      MAL_L2:{color:"#00AADF",text:"#fff",pip:"L2",label:"Málaga"},
      GRN_L1:{color:"#1FACA5",text:"#fff",pip:"L1",label:"Granada"},
      PMI_M1:{color:"#F5A623",text:"#fff",pip:"M1",label:"Palma"},
    },
  },
};

const REFRESH_SEC = 300;
const GITHUB_URL  = "https://github.com/joelucadooley/metro-liga";

function buildStandings(lines) {
  return Object.entries(lines)
    .map(([name,d]) => ({
      name,
      seasonPts:d.seasonPts??0, checks:d.checks??0,
      wins:d.wins??0, draws:d.draws??0, losses:d.losses??0,
      recentForm:d.recentForm??[],
      currentSeverity:d.severity??"clear",
      currentDetail:d.description??null,
    }))
    .sort((a,b) => b.seasonPts-a.seasonPts || b.wins-a.wins);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

html, body, #root {
  margin: 0; padding: 0; width: 100%;
  background: #23232f;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.app {
  min-height: 100vh;
  background: #23232f;
  font-family: 'Oswald', sans-serif;
  color: #111;
}

/* ── Header (full width, white) ── */
.hdr {
  background: #fff;
  border-bottom: 1px solid #e8e8ee;
}
.hdr-top {
  display: flex;
  align-items: stretch;
  min-height: 60px;
  max-width: 900px;
  margin: 0 auto;
}
.hdr-badge {
  padding: .75rem 1.1rem;
  display: flex; flex-direction: column; justify-content: center;
  flex-shrink: 0; min-width: 105px;
  transition: background .3s;
}
.hdr-badge-sup {
  font-family: 'JetBrains Mono', monospace;
  font-size: .44rem; letter-spacing: .2em; text-transform: uppercase;
  color: rgba(255,255,255,.65); line-height: 1; margin-bottom: .15rem;
}
.hdr-badge-title {
  font-size: 1.5rem; font-weight: 700; text-transform: uppercase;
  color: #fff; line-height: .95;
}
.hdr-mid {
  flex: 1; padding: .6rem 1.1rem;
  display: flex; flex-direction: column; justify-content: center; gap: .1rem;
  min-width: 0;
}
.hdr-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: .46rem; letter-spacing: .12em; text-transform: uppercase; color: #bbb;
}
.hdr-status {
  font-size: .85rem; color: #777; font-weight: 300;
}
.hdr-time {
  padding: .6rem 1.1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: .44rem; color: #ccc; text-align: right;
  display: flex; align-items: center;
}

/* ── City tabs (full width, white) ── */
.city-tabs {
  display: flex; background: #fff;
  border-bottom: 1px solid #e8e8ee;
  overflow-x: auto;
  padding: 0 1.1rem;
  max-width: 900px;
  margin: 0 auto;
}
.city-tab {
  padding: .42rem .85rem;
  font-family: 'Oswald', sans-serif; font-size: .8rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .08em;
  color: #bbb; cursor: pointer; border: none; background: none;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: all .15s; white-space: nowrap; flex-shrink: 0;
}
.city-tab:hover { color: #888; }
.city-tab.active { color: #111; }

/* ── Card wrapper ── */
.card {
  max-width: 900px;
  margin: 1rem auto;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 20px rgba(0,0,0,.25);
}

/* ── HTML Table ── */
table {
  width: 100%;
  border-collapse: collapse;
}
thead th {
  font-family: 'JetBrains Mono', monospace;
  font-size: .44rem; letter-spacing: .16em; text-transform: uppercase;
  color: #bbb; font-weight: 400;
  padding: .38rem 0;
  border-bottom: 2px solid #eee;
}
th.col-num  { width: 36px; padding-left: 1.1rem; text-align: left; }
th.col-line { text-align: left; padding-left: .5rem; }
th.col-pts  { width: 58px; text-align: right; }
th.col-form { width: 90px; text-align: center; }
th.col-now  { width: 44px; text-align: right; padding-right: 1.1rem; }

tbody tr { height: 46px; border-bottom: 1px solid #f2f2f6; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover td { background: #fafafa; }

/* Left border by zone */
tbody tr.top  td:first-child { border-left: 3px solid #2a7a2a; }
tbody tr.mid  td:first-child { border-left: 3px solid #e0e0e8; }
tbody tr.releg td:first-child { border-left: 3px solid #c0392b; }

td { vertical-align: middle; padding: 0; }
td.col-num {
  width: 36px; padding-left: 1.1rem;
  font-family: 'JetBrains Mono', monospace; font-size: .75rem; color: #ccc;
}
td.col-line { padding-left: .5rem; }
td.col-pts  { width: 58px; text-align: right; }
td.col-form { width: 90px; text-align: center; }
td.col-now  { width: 44px; text-align: right; padding-right: 1.1rem; font-size: .95rem; }

/* Zone separator rows */
tr.zone-sep td {
  padding: .22rem 1.1rem;
  font-family: 'JetBrains Mono', monospace; font-size: .44rem;
  letter-spacing: .16em; text-transform: uppercase;
  color: #aaa; background: #f5f5f8;
  border-bottom: 1px solid #eee;
  border-left: 3px solid #ddd;
}
tr.zone-sep.top td  { color: #2a7a2a; border-left-color: #2a7a2a; background: #f2faf2; }
tr.zone-sep.releg td { color: #c0392b; border-left-color: #c0392b; background: #fef5f5; }

/* Line cell */
.line-cell {
  display: flex; align-items: center; gap: .5rem;
  overflow: hidden;
}
.pip {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: .5rem; font-weight: 700; flex-shrink: 0;
  letter-spacing: -.02em;
}
.line-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 1px;
}
.line-city {
  font-family: 'JetBrains Mono', monospace; font-size: .46rem; color: #999;
  white-space: nowrap;
}
.desc-wrap { overflow: hidden; }
.desc-text {
  font-family: 'JetBrains Mono', monospace; font-size: .42rem;
  white-space: nowrap; display: inline-block; font-style: italic;
  animation: marquee linear infinite;
}
.desc-text.minor    { color: #a06000; }
.desc-text.incident { color: #c0392b; }
@keyframes marquee {
  0%,15% { transform: translateX(0); }
  85%,100% { transform: translateX(-100%); }
}

/* Points cell */
.pts-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem; color: #222; font-weight: 500; line-height: 1;
}
.pts-rec {
  font-family: 'JetBrains Mono', monospace;
  font-size: .4rem; color: #ccc; margin-top: 1px;
}

/* Form dots — text-align:center on td guarantees centering */
.form-dots {
  display: inline-flex; gap: 3px; align-items: center;
}
.fd {
  width: 11px; height: 11px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: .3rem; font-weight: 500;
}
.fd.W { background: #d4edda; color: #1a7a2a; }
.fd.D { background: #fff3cd; color: #856404; }
.fd.L { background: #f8d7da; color: #c0392b; }
.fd.none { background: #eee; }

/* Now symbols */
.now-ok  { color: #27ae60; }
.now-alt { color: #e67e22; }
.now-inc { color: #c0392b; }
.now-na  { color: #ccc; font-size: .7rem; }

/* Legend */
.legend {
  display: flex; gap: .9rem; padding: .45rem 1.1rem;
  border-top: 1px solid #f0f0f4;
  align-items: center; flex-wrap: wrap;
}
.legend-item {
  display: flex; align-items: center; gap: .3rem;
  font-family: 'JetBrains Mono', monospace; font-size: .44rem; color: #aaa;
}

/* Footer */
.footer {
  padding: .4rem 1.1rem;
  font-family: 'JetBrains Mono', monospace; font-size: .4rem;
  color: #bbb; display: flex; gap: 1rem; flex-wrap: wrap;
  border-top: 1px solid #f0f0f4;
}
.footer a { color: #999; text-decoration: none; }
.footer a:hover { color: #555; }

/* Loading */
.loading {
  padding: 3rem 1rem; text-align: center;
  font-family: 'JetBrains Mono', monospace; font-size: .6rem; color: #aaa;
}

/* Mobile: hide form column */
@media (max-width: 600px) {
  th.col-form, td.col-form { display: none; }
  .hdr-time { display: none; }
  .city-tab { padding: .42rem .6rem; font-size: .72rem; }
  .hdr-badge { min-width: 90px; }
  .hdr-badge-title { font-size: 1.35rem; }
  .card { margin: 0; border-radius: 0; box-shadow: none; }
  th.col-num  { padding-left: .8rem; }
  td.col-num  { padding-left: .8rem; }
  th.col-now  { padding-right: .8rem; }
  td.col-now  { padding-right: .8rem; }
  .hdr-top    { max-width: 100%; }
  .city-tabs  { max-width: 100%; padding: 0 .6rem; }
}
`;

// ── Row ──────────────────────────────────────────────────────────────────────

function Row({ s, pos, total, city }) {
  const meta    = city.lines[s.name] || { color:"#999", text:"#fff" };
  const isTop   = pos < 3;
  const isReleg = pos >= total - 3;
  const cls     = isTop ? "top" : isReleg ? "releg" : "mid";

  const form = [...Array(5)].map((_,i) => {
    const off = 5 - s.recentForm.length;
    return i >= off ? s.recentForm[i - off] : null;
  });

  const sev     = s.currentSeverity;
  const pipText = meta.pip   || s.name;
  const label   = meta.label || null;
  const desc    = sev !== "clear" ? s.currentDetail : null;
  const dur     = desc ? `${Math.max(5, desc.length * 0.13)}s` : "0s";

  const nowEl = s.checks === 0
    ? <span className="now-na">—</span>
    : sev === "incident" ? <span className="now-inc">✗</span>
    : sev === "minor"    ? <span className="now-alt">!</span>
    :                      <span className="now-ok">✓</span>;

  return (
    <tr className={cls}>
      <td className="col-num">{pos + 1}</td>
      <td className="col-line">
        <div className="line-cell">
          <div className="pip" style={{ background: meta.color, color: meta.text }}>
            {pipText}
          </div>
          <div className="line-info">
            {label && <div className="line-city">{label}</div>}
            {desc  && (
              <div className="desc-wrap">
                <span className={`desc-text ${sev}`} style={{ animationDuration: dur }}>
                  {desc}
                </span>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="col-pts">
        <div className="pts-num">{s.seasonPts}</div>
        <div className="pts-rec">
          {s.checks > 0 ? `${s.wins}W ${s.draws}D ${s.losses}L` : "—"}
        </div>
      </td>
      <td className="col-form">
        <div className="form-dots">
          {form.map((r,i) => (
            <div key={i} className={`fd ${r ?? "none"}`}>{r ?? ""}</div>
          ))}
        </div>
      </td>
      <td className="col-now">{nowEl}</td>
    </tr>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

function Table({ standings, city }) {
  const n = standings.length;
  const relegStart = Math.max(n - 3, 3);

  const thead = (
    <thead>
      <tr>
        <th className="col-num">#</th>
        <th className="col-line">Line</th>
        <th className="col-pts">Pts</th>
        <th className="col-form">Form</th>
        <th className="col-now">Now</th>
      </tr>
    </thead>
  );

  const rows = [];
  standings.forEach((s, i) => {
    if (i === 0)          rows.push(<tr key="z0" className="zone-sep top"><td colSpan={5}>Champions Metro Zone</td></tr>);
    if (i === 3)          rows.push(<tr key="z1" className="zone-sep mid"><td colSpan={5}>Mid-table</td></tr>);
    if (i === relegStart) rows.push(<tr key="z2" className="zone-sep releg"><td colSpan={5}>Relegation Zone</td></tr>);
    rows.push(<Row key={s.name} s={s} pos={i} total={n} city={city} />);
  });

  return (
    <table>
      {thead}
      <tbody>{rows}</tbody>
    </table>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [cityId, setCityId] = useState("barcelona");
  const [data,   setData]   = useState(null);
  const [loading,setLoading]= useState(true);
  const [err,    setErr]    = useState(null);
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
    } catch(e) {
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
      if (cdRef.current <= 0) { cdRef.current = REFRESH_SEC; fetchData(); }
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchData]);

  const standings = data?.lines ? buildStandings(data.lines) : null;
  const updated   = data?.updated ? new Date(data.updated) : null;
  const incCount  = standings?.filter(s => s.currentSeverity === "incident").length ?? 0;
  const altCount  = standings?.filter(s => s.currentSeverity === "minor").length ?? 0;
  const monthStr  = (updated ?? new Date()).toLocaleDateString("en-GB", { month:"long", year:"numeric" });
  const timeStr   = updated?.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" }) ?? "";
  const dateStr   = updated?.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" }) ?? "";

  const statusText = loading    ? "Loading…"
    : err           ? "Could not load data"
    : incCount > 0  ? `${incCount} service incident${incCount > 1 ? "s" : ""}`
    : altCount > 0  ? `All running · ${altCount} with station issues`
    : "All lines clear";

  const badgeBg = city.id === "segunda"
    ? "linear-gradient(135deg,#EE1C25,#003082)"
    : city.color;

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* Header */}
      <div className="hdr">
        <div className="hdr-top">
          <div className="hdr-badge" style={{ background: badgeBg }}>
            <div className="hdr-badge-sup">{city.code} Metro</div>
            <div className="hdr-badge-title">Liga</div>
          </div>
          <div className="hdr-mid">
            <div className="hdr-sub">{city.name} · {monthStr}</div>
            <div className="hdr-status">{statusText}</div>
          </div>
          {updated && (
            <div className="hdr-time">
              Updated {dateStr} {timeStr}
            </div>
          )}
        </div>

        {/* Tabs */}
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

      {/* Content card */}
      <div className="card">
        {err && (
          <div style={{ padding:".5rem 1.1rem", background:"#fff0f0", fontSize:".52rem",
                        fontFamily:"'JetBrains Mono',monospace", color:"#c00" }}>
            ⚠ {err}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading {city.name} metro liga…</div>
        ) : standings ? (
          <Table standings={standings} city={city} />
        ) : null}

        {/* Legend */}
        {!loading && standings && (
          <div className="legend">
            <div className="legend-item">
              <span style={{ color:"#27ae60", fontSize:"1rem" }}>✓</span> Clean run (3 pts)
            </div>
            <div className="legend-item">
              <span style={{ color:"#e67e22", fontSize:"1rem" }}>!</span> Station issues (1 pt)
            </div>
            <div className="legend-item">
              <span style={{ color:"#c0392b", fontSize:"1rem" }}>✗</span> Service incident (0 pts)
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <span>Metro Liga · Spanish metro reliability</span>
          <span>
            Created by{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              Joe Luca Dooley
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}