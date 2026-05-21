import { useState, useEffect, useCallback, useRef } from "react";

const CITIES = {
  barcelona: {
    id: "barcelona", name: "Barcelona", code: "BCN", color: "#E3000B",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/status.json",
    lines: {
      L1:{color:"#E3000B",text:"#fff"},L2:{color:"#9B2D82",text:"#fff"},
      L3:{color:"#3FAA4B",text:"#fff"},L4:{color:"#F5C300",text:"#000"},
      L5:{color:"#0069B4",text:"#fff"},L9N:{color:"#F37021",text:"#fff"},
      L9S:{color:"#F37021",text:"#fff"},L10N:{color:"#009999",text:"#fff"},
      L10S:{color:"#007DB8",text:"#fff"},L11:{color:"#8DC63F",text:"#000"},
    },
  },
  madrid: {
    id: "madrid", name: "Madrid", code: "MAD", color: "#003087",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/madrid_status.json",
    lines: {
      L1:{color:"#00AADF",text:"#fff"},L2:{color:"#E84E0F",text:"#fff"},
      L3:{color:"#F7C100",text:"#000"},L4:{color:"#994B29",text:"#fff"},
      L5:{color:"#00A650",text:"#fff"},L6:{color:"#9B9B9B",text:"#fff"},
      L7:{color:"#F69C00",text:"#000"},L8:{color:"#E91E8C",text:"#fff"},
      L9:{color:"#9B2743",text:"#fff"},L10:{color:"#115EA4",text:"#fff"},
      L11:{color:"#008B45",text:"#fff"},L12:{color:"#A8007E",text:"#fff"},
      R:{color:"#00AADF",text:"#fff"},
    },
  },
  valencia: {
    id: "valencia", name: "Valencia", code: "VLC", color: "#c9a800",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/valencia_status.json",
    lines: {
      L1:{color:"#F5C400",text:"#000"},L2:{color:"#E5007D",text:"#fff"},
      L3:{color:"#EE1C25",text:"#fff"},L4:{color:"#004B9D",text:"#fff"},
      L5:{color:"#009A44",text:"#fff"},L6:{color:"#F47920",text:"#fff"},
      L7:{color:"#8DC63F",text:"#000"},
    },
  },
  segunda: {
    id: "segunda", name: "Segunda", code: "2ª", color: "#555",
    statusUrl: "https://raw.githubusercontent.com/joelucadooley/metro-liga/main/data/segunda_status.json",
    lines: {
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
    .map(([name, d]) => ({
      name,
      seasonPts: d.seasonPts??0, checks: d.checks??0,
      wins: d.wins??0, draws: d.draws??0, losses: d.losses??0,
      recentForm: d.recentForm??[],
      currentSeverity: d.severity??"clear",
      currentDetail: d.description??null,
    }))
    .sort((a,b) => b.seasonPts-a.seasonPts || b.wins-a.wins);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
html,body,#root{margin:0;padding:0;background:#1e1e2a;width:100%;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
.app{min-height:100vh;background:#1e1e2a;color:#111;font-family:'Oswald',sans-serif;}

/* Header */
.hdr{background:#fff;border-bottom:1px solid #e0e0e6;box-shadow:0 1px 4px rgba(0,0,0,0.08);}
.hdr-top{display:flex;align-items:stretch;min-height:64px;}
.hdr-badge{padding:.8rem 1.2rem;display:flex;flex-direction:column;justify-content:center;flex-shrink:0;min-width:110px;transition:background .3s;}
.hdr-badge-sup{font-family:'JetBrains Mono',monospace;font-size:.45rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.65);line-height:1;margin-bottom:.15rem;}
.hdr-badge-title{font-size:1.6rem;font-weight:700;text-transform:uppercase;color:#fff;line-height:.95;}
.hdr-mid{flex:1;padding:.6rem 1.2rem;display:flex;flex-direction:column;justify-content:center;gap:.15rem;min-width:0;}
.hdr-matchday{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.14em;text-transform:uppercase;color:#aaa;}
.hdr-info{font-size:.88rem;color:#777;font-weight:300;}
.hdr-right{padding:.6rem 1.2rem;display:flex;align-items:center;flex-shrink:0;}
.hdr-time{font-family:'JetBrains Mono',monospace;font-size:.44rem;color:#ccc;text-align:right;line-height:1.5;}

/* City tabs */
.city-tabs{display:flex;border-bottom:1px solid #e0e0e6;background:#fff;overflow-x:auto;padding:0 1.2rem;}
.city-tab{padding:.45rem .9rem;font-family:'Oswald',sans-serif;font-size:.82rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#bbb;cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap;flex-shrink:0;}
.city-tab:hover{color:#888;}
.city-tab.active{color:#111;}

/* Error */
.err-box{padding:.4rem 1.2rem;background:#fff0f0;border-bottom:1px solid #ffc0c0;font-family:'JetBrains Mono',monospace;font-size:.52rem;color:#c00;}

/* Content container */
.content-wrap{max-width:900px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,0.3);}

/* Table — using real HTML table for guaranteed alignment */
.liga-table{width:100%;border-collapse:collapse;background:#fff;}
.liga-table th{font-family:'JetBrains Mono',monospace;font-size:.46rem;letter-spacing:.16em;text-transform:uppercase;color:#bbb;padding:.4rem 0;border-bottom:2px solid #e8e8ee;font-weight:400;}
.liga-table th:first-child{padding-left:1.2rem;text-align:left;width:36px;}
.liga-table th.th-line{text-align:left;padding-left:.5rem;}
.liga-table th.th-pts{text-align:right;width:60px;}
.liga-table th.th-form{text-align:center;width:90px;}
.liga-table th.th-now{text-align:right;width:44px;padding-right:1.2rem;}

.liga-table td{padding:0;border-bottom:1px solid #f0f0f4;vertical-align:middle;}
.liga-table tr{height:46px;}
.liga-table tr:hover td{background:#f8f8fb;}
.liga-table tr.top td:first-child{border-left:3px solid #2a7a2a;}
.liga-table tr.mid td:first-child{border-left:3px solid #ddd;}
.liga-table tr.releg td:first-child{border-left:3px solid #c0392b;}

.td-pos{width:36px;padding-left:1.2rem;font-family:'JetBrains Mono',monospace;font-size:.78rem;color:#ccc;text-align:left;}
.td-line{padding-left:.5rem;min-width:0;}
.td-pts{width:60px;text-align:right;font-family:'JetBrains Mono',monospace;}
.td-form{width:90px;text-align:center;}
.td-now{width:44px;text-align:right;padding-right:1.2rem;font-size:.95rem;line-height:1;}

.pts-num{font-size:1.05rem;color:#222;font-weight:500;line-height:1;}
.pts-rec{font-family:'JetBrains Mono',monospace;font-size:.42rem;color:#ccc;margin-top:1px;}

/* Line cell */
.line-cell{display:flex;align-items:center;gap:.55rem;min-width:0;overflow:hidden;}
.pip{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.52rem;font-weight:700;flex-shrink:0;letter-spacing:-.02em;}
.line-text{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;gap:1px;}
.line-label{font-family:'JetBrains Mono',monospace;font-size:.48rem;color:#999;white-space:nowrap;}
.line-desc-wrap{overflow:hidden;}
.line-desc{font-family:'JetBrains Mono',monospace;font-size:.42rem;white-space:nowrap;display:inline-block;font-style:italic;animation:marquee linear infinite;}
.line-desc.minor{color:#b07800;}
.line-desc.incident{color:#c0392b;}
@keyframes marquee{0%{transform:translateX(0);}15%{transform:translateX(0);}85%{transform:translateX(-100%);}100%{transform:translateX(-100%);}}

/* Form dots — inline-flex centered via text-align */
.form-dots{display:inline-flex;gap:3px;align-items:center;}
.fd{width:11px;height:11px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:.32rem;font-weight:500;}
.fd.W{background:#d4edda;color:#1a7a2a;}
.fd.D{background:#fff3cd;color:#856404;}
.fd.L{background:#f8d7da;color:#c0392b;}
.fd.none{background:#eee;}

/* Status */
.now-clear{color:#27ae60;}
.now-minor{color:#e67e22;}
.now-incident{color:#c0392b;}
.now-pending{color:#ddd;font-size:.7rem;}

/* Zone separator rows */
.zone-row td{padding:.22rem 1.2rem;font-family:'JetBrains Mono',monospace;font-size:.46rem;letter-spacing:.16em;text-transform:uppercase;background:#f5f5f8;border-bottom:1px solid #e8e8ee;border-left:3px solid #ddd;color:#aaa;}
.zone-row.top td{color:#2a7a2a;border-left-color:#2a7a2a;background:#f0faf0;}
.zone-row.releg td{color:#c0392b;border-left-color:#c0392b;background:#fff5f5;}

/* Legend */
.legend{display:flex;gap:1rem;padding:.5rem 1.2rem;border-top:1px solid #ebebef;align-items:center;flex-wrap:wrap;background:#fff;}
.legend-item{display:flex;align-items:center;gap:.35rem;font-family:'JetBrains Mono',monospace;font-size:.46rem;color:#aaa;}

/* Footer */
.footer{padding:.5rem 1.2rem;font-family:'JetBrains Mono',monospace;font-size:.42rem;color:#444;letter-spacing:.05em;display:flex;gap:1rem;flex-wrap:wrap;background:#fff;border-top:1px solid #ebebef;}
.footer a{color:#888;text-decoration:none;}
.footer a:hover{color:#333;}

.state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;gap:.8rem;font-family:'JetBrains Mono',monospace;text-align:center;background:#fff;}
.state-ico{font-size:2rem;}
.state-msg{font-size:.62rem;color:#aaa;max-width:320px;line-height:1.9;}

@media(max-width:600px){
  .th-form,.td-form{display:none;}
  .pip{width:26px;height:26px;font-size:.48rem;}
  .city-tab{padding:.45rem .65rem;font-size:.75rem;}
  .hdr-badge{min-width:90px;}
  .hdr-badge-title{font-size:1.4rem;}
  .hdr-time{display:none;}
}
`;

function Row({ s, pos, total, city }) {
  const meta = city.lines[s.name] || {color:"#999",text:"#fff"};
  const isTop = pos < 3, isRel = pos >= total - 3;
  const zone = isTop ? "top" : isRel ? "releg" : "mid";
  const form = [...Array(5)].map((_,i) => {
    const off = 5 - s.recentForm.length;
    return i >= off ? s.recentForm[i-off] : null;
  });
  const sev = s.currentSeverity;
  const pipText = meta.pip || s.name;
  const label   = meta.label || null;
  const desc    = sev !== "clear" ? s.currentDetail : null;
  const dur     = desc ? `${Math.max(6, desc.length * 0.15)}s` : "0s";

  const nowEl = s.checks === 0
    ? <span className="now-pending">—</span>
    : sev === "incident" ? <span className="now-incident">✗</span>
    : sev === "minor"    ? <span className="now-minor">!</span>
    :                      <span className="now-clear">✓</span>;

  return (
    <tr className={zone}>
      <td className="td-pos">{pos+1}</td>
      <td className="td-line">
        <div className="line-cell">
          <div className="pip" style={{background:meta.color,color:meta.text}}>{pipText}</div>
          <div className="line-text">
            {label && <div className="line-label">{label}</div>}
            {desc  && <div className="line-desc-wrap"><span className={`line-desc ${sev}`} style={{animationDuration:dur}}>{desc}</span></div>}
          </div>
        </div>
      </td>
      <td className="td-pts">
        <div className="pts-num">{s.seasonPts}</div>
        <div className="pts-rec">{s.checks>0?`${s.wins}W ${s.draws}D ${s.losses}L`:"—"}</div>
      </td>
      <td className="td-form">
        <div className="form-dots">
          {form.map((r,i) => <div key={i} className={`fd ${r??"none"}`}>{r??""}</div>)}
        </div>
      </td>
      <td className="td-now">{nowEl}</td>
    </tr>
  );
}

function Table({ standings, city }) {
  const n = standings.length;
  const relegStart = Math.max(n-3, 3);

  const thead = (
    <thead>
      <tr>
        <th>#</th>
        <th className="th-line">Line</th>
        <th className="th-pts">Pts</th>
        <th className="th-form">Form</th>
        <th className="th-now">Now</th>
      </tr>
    </thead>
  );

  if (n === 1) return (
    <table className="liga-table">
      {thead}
      <tbody>
        <tr className="zone-row top"><td colSpan={5}>Champions Metro Zone</td></tr>
        <Row s={standings[0]} pos={0} total={1} city={city} />
      </tbody>
      <tfoot><tr><td colSpan={5}><Legend /></td></tr></tfoot>
    </table>
  );

  const rows = [];
  standings.forEach((s, i) => {
    if (i === 0)          rows.push(<tr key="sep-top"   className="zone-row top"><td colSpan={5}>Champions Metro Zone</td></tr>);
    if (i === 3)          rows.push(<tr key="sep-mid"   className="zone-row mid"><td colSpan={5}>Mid-table</td></tr>);
    if (i === relegStart) rows.push(<tr key="sep-releg" className="zone-row releg"><td colSpan={5}>Relegation Zone</td></tr>);
    rows.push(<Row key={s.name} s={s} pos={i} total={n} city={city} />);
  });

  return (
    <table className="liga-table">
      {thead}
      <tbody>{rows}</tbody>
      <tfoot><tr><td colSpan={5}><Legend /></td></tr></tfoot>
    </table>
  );
}

function Legend() {
  return (
    <div className="legend">
      <div className="legend-item"><span style={{color:"#27ae60",fontSize:"1rem"}}>✓</span> Clean run (3 pts)</div>
      <div className="legend-item"><span style={{color:"#e67e22",fontSize:"1rem"}}>!</span> Station issues (1 pt)</div>
      <div className="legend-item"><span style={{color:"#c0392b",fontSize:"1rem"}}>✗</span> Service incident (0 pts)</div>
    </div>
  );
}

export default function App() {
  const [cityId,   setCityId]   = useState("barcelona");
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState(null);
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
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); busy.current = false; }
  }, [city.statusUrl]);

  useEffect(() => {
    setData(null); setLoading(true); setErr(null);
    cdRef.current = REFRESH_SEC;
    fetchData();
    const tick = setInterval(() => {
      cdRef.current = Math.max(0, cdRef.current-1);
      if (cdRef.current <= 0) { cdRef.current = REFRESH_SEC; fetchData(); }
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchData]);

  const standings = data?.lines ? buildStandings(data.lines) : null;
  const matchday  = data?.matchday ?? 0;
  const updated   = data?.updated ? new Date(data.updated) : null;
  const incCount  = standings?.filter(s=>s.currentSeverity==="incident").length??0;
  const altCount  = standings?.filter(s=>s.currentSeverity==="minor").length??0;
  const timeStr   = updated?.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})??"—";
  const dateStr   = updated?.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})??"—";
  const monthStr  = (updated??new Date()).toLocaleDateString("en-GB",{month:"long",year:"numeric"});

  const statusText = loading ? "Loading…"
    : err       ? "Could not load data"
    : incCount>0 ? `${incCount} service incident${incCount>1?"s":""}`
    : altCount>0 ? `All running · ${altCount} with station issues`
    : matchday===0 ? "Waiting for first data…"
    : "All lines clear";

  const badgeBg = city.id==="segunda"
    ? "linear-gradient(135deg,#EE1C25,#003082)"
    : city.color;

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="hdr">
        <div className="hdr-top">
          <div className="hdr-badge" style={{background:badgeBg}}>
            <div className="hdr-badge-sup">{city.code} Metro</div>
            <div className="hdr-badge-title">Liga</div>
          </div>
          <div className="hdr-mid">
            <div className="hdr-matchday">{city.name} · {monthStr}</div>
            <div className="hdr-info">{statusText}</div>
          </div>
          <div className="hdr-right">
            {updated && <div className="hdr-time">Updated<br/>{dateStr} {timeStr}</div>}
          </div>
        </div>
        <div className="city-tabs">
          {Object.values(CITIES).map(c => (
            <button key={c.id}
              className={`city-tab ${cityId===c.id?"active":""}`}
              style={cityId===c.id?{borderBottomColor:c.color,color:"#111"}:{}}
              onClick={()=>setCityId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="err-box">⚠ {err}</div>}

      {loading ? (
        <div className="state">
          <div className="state-ico">🚇</div>
          <div className="state-msg">Loading {city.name} metro liga…</div>
        </div>
      ) : standings ? (
        <div className="content-wrap">
          <Table standings={standings} city={city} />
          <div className="footer">
            <span>Metro Liga · Spanish metro reliability league</span>
            <span>Created by <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Joe Luca Dooley</a></span>
          </div>
        </div>
      ) : null}
    </div>
  );
}