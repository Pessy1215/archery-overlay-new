// Vercel Update Test
import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// --- 類型與常數定義 ---
type Mode = "recurve_individual" | "recurve_team" | "recurve_mixed" | "compound_individual" | "compound_team" | "compound_mixed";
type Side = "left" | "right";
type ArrowValue = number | "X" | "M" | "";

interface OverlayState {
  mode: Mode;
  arrowsPerEnd: number;
  setNo: number;
  endNo: number;
  windSpeed: string; 
  windDeg: number;   
  playerA: { name: string; setPts: number; arrows: ArrowValue[]; total: number; };
  playerB: { name: string; setPts: number; arrows: ArrowValue[]; total: number; };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const OVERLAY_SLUG = import.meta.env.VITE_OVERLAY_SLUG ?? "archery-main";
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = HAS_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const MODES: Record<Mode, { label: string; arrowsPerEnd: number; system: "set" | "end" }> = {
  recurve_individual: { label: "反曲弓・個人 (積點)", arrowsPerEnd: 3, system: "set" },
  recurve_team: { label: "反曲弓・團體 (積點)", arrowsPerEnd: 6, system: "set" },
  recurve_mixed: { label: "反曲弓・混雙 (積點)", arrowsPerEnd: 4, system: "set" },
  compound_individual: { label: "複合弓・個人 (總分)", arrowsPerEnd: 3, system: "end" },
  compound_team: { label: "複合弓・團體 (總分)", arrowsPerEnd: 6, system: "end" },
  compound_mixed: { label: "複合弓・混雙 (總分)", arrowsPerEnd: 4, system: "end" },
};

const KEY_VALUES: ArrowValue[] = ["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, "M"];

// --- 核心邏輯 ---
function v2p(v: ArrowValue) {
  if (v === "X") return 10;
  if (v === "M" || v === "" || v == null) return 0;
  return Number(v) || 0;
}

function calcSum(arrows: ArrowValue[]) { 
  if (!arrows) return 0;
  return arrows.reduce((s, v) => s + v2p(v), 0); 
}

function makeInitialState(mode: Mode = "recurve_individual"): OverlayState {
  const cfg = MODES[mode];
  const isMulti = cfg.label.includes("團體") || cfg.label.includes("混雙");
  return {
    mode,
    arrowsPerEnd: cfg.arrowsPerEnd,
    setNo: 1, endNo: 1,
    windSpeed: "0.0",
    windDeg: 0,
    playerA: { name: isMulti ? "A 隊" : "選手 A", setPts: 0, arrows: Array(cfg.arrowsPerEnd).fill(""), total: 0 },
    playerB: { name: isMulti ? "B 隊" : "選手 B", setPts: 0, arrows: Array(cfg.arrowsPerEnd).fill(""), total: 0 },
  };
}

// --- 分數網頁組件 ---
function OverlayPage({ state }: { state: OverlayState }) {
  const isSetSystem = MODES[state.mode]?.system === "set";
  const visualRotation = (state.windDeg || 0) - 270;

  const renderPlayer = (p: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
      <div style={{ 
        width: 350, 
        height: 75, 
        background: 'linear-gradient(90deg, #eacee5ff 0%, #c77bb4ff 70%, #a34593ff 100%)', 
        color: '#fff', 
        padding: '0 30px', 
        fontSize: 28, 
        fontWeight: 900, 
        display: 'flex', 
        alignItems: 'center',
        textShadow: '1px 1px 2px rgba(0,0,0,0.2)' 
      }}>{p.name}</div>
      
      <div style={{ display: 'flex', gap: 5, margin: '0 5px' }}>
        {(p.arrows || []).map((v: any, i: number) => (
          <div key={i} style={{ width: 75, height: 75, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 35, fontWeight: 900, color: '#9B4D8F', border: '1px solid #eee' }}>{v}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <div style={{ width: 90, height: 75, background: 'rgba(255, 255, 255, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #9B4D8F' }}>
          <span style={{ fontSize: 10, color: '#9B4D8F', fontWeight: 800 }}>SET SUM</span>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#9B4D8F' }}>{calcSum(p.arrows)}</span>
        </div>
        <div style={{ width: 100, height: 75, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #9B4D8F' }}>
          <span style={{ fontSize: 10, color: '#aaa', fontWeight: 800 }}>{isSetSystem ? 'SET PTS' : 'TOTAL'}</span>
          <span style={{ fontSize: 32, fontWeight: 900, color: isSetSystem ? '#333' : '#9B4D8F' }}>{isSetSystem ? p.setPts : (Number(p.total) || 0) + calcSum(p.arrows)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: '1920px', height: '1080px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 80px 100px 80px', boxSizing: 'border-box', background: 'transparent' }}>
      <div style={{ width: 80, background: '#fff', border: '2px solid #9B4D8F', marginBottom: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#9B4D8F' }}>WIND</span>
        <div style={{ fontSize: 40, color: '#9B4D8F', fontWeight: 900, transform: `rotate(${visualRotation}deg)`, transition: 'transform 0.5s ease' }}>↑</div>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#333' }}>{state.windSpeed || "0.0"} <small style={{fontSize: 10}}>m/s</small></span>
      </div>
      {renderPlayer(state.playerA)}
      {renderPlayer(state.playerB)}
    </div>
  );
}

// --- 控制台組件 ---
function ControlPage({ state, onMutate, conn }: { state: OverlayState, onMutate: (fn: (d: OverlayState) => void) => void, conn: string }) {
  const [sel, setSel] = useState<{side: Side, idx: number}>({side: 'left', idx: 0});
  const [nameA, setNameA] = useState(state.playerA.name);
  const [nameB, setNameB] = useState(state.playerB.name);

  useEffect(() => { setNameA(state.playerA.name); setNameB(state.playerB.name); }, [state.playerA.name, state.playerB.name]);

  const fetchWeather = async () => {
    try {
      const CWA_API_KEY = "CWA-94EEA30F-6C53-469B-A844-517F1C23CECF"; 
      const res = await fetch(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001?Authorization=${CWA_API_KEY}&format=JSON&StationId=C0C700`);
      if (!res.ok) throw new Error("CWA API Error");
      const data = await res.json();
      const station = data.records?.Station?.[0];
      if (station && station.WeatherElement) {
        onMutate(d => {
          d.windSpeed = Number(station.WeatherElement.WindSpeed || 0).toFixed(1);
          d.windDeg = Number(station.WeatherElement.WindDirection || 0);
        });
      }
    } catch (e) { alert("天氣抓取失敗"); }
  };

  const renderSide = (side: Side) => {
    const p = side === 'left' ? state.playerA : state.playerB;
    return (
      <div style={{ flex: 1, background: '#fff', padding: 15, borderRadius: 12, border: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
          <input style={{ flex: 1, padding: 8 }} value={side==='left'?nameA:nameB} onChange={e=>side==='left'?setNameA(e.target.value):setNameB(e.target.value)} />
          <button style={btnS(true)} onClick={()=>onMutate(d=> { (side==='left'?d.playerA:d.playerB).name = (side==='left'?nameA:nameB) })}>改名</button>
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
          {p.arrows.map((v, i) => (
            <div key={i} onClick={() => setSel({ side, idx: i })} style={{ flex: 1, height: 45, border: '2px solid', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, borderColor: (sel.side === side && sel.idx === i) ? '#9B4D8F' : '#eee', cursor: 'pointer' }}>{v || '-'}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {KEY_VALUES.map(kv => (
            <button key={kv} style={btnS()} onClick={() => {
              onMutate(d => { (side === 'left' ? d.playerA : d.playerB).arrows[sel.idx] = kv; });
              setSel(prev => ({ ...prev, idx: (prev.idx + 1) % state.arrowsPerEnd }));
            }}>{kv}</button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 15, maxWidth: 900, margin: '0 auto', background: '#f4f4f4', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
        <h3>控制台 ({conn})</h3>
        <Link to="/overlay" target="_blank">打開觀戰畫面 ↗</Link>
      </div>
      <div style={{ display: 'flex', gap: 15 }}>{renderSide('left')}{renderSide('right')}</div>
      <button style={{ width: '100%', height: 60, marginTop: 20, background: '#9B4D8F', color: '#fff', borderRadius: 12, fontWeight: 900 }} onClick={() => onMutate(d => {
          const sA = calcSum(d.playerA.arrows), sB = calcSum(d.playerB.arrows);
          if (MODES[d.mode].system === "set") {
            if (sA > sB) d.playerA.setPts += 2; else if (sA < sB) d.playerB.setPts += 2; else if (sA === sB && sA > 0) { d.playerA.setPts += 1; d.playerB.setPts += 1; }
          } else { d.playerA.total += sA; d.playerB.total += sB; }
          d.playerA.arrows = Array(d.arrowsPerEnd).fill(""); d.playerB.arrows = Array(d.arrowsPerEnd).fill("");
      })}>完成本回合</button>
    </div>
  );
}

const btnS = (active = false) => ({ padding: '8px', borderRadius: 6, background: active ? '#111' : '#fff', color: active ? '#fff' : '#111', cursor: 'pointer' });

// --- 主程式 ---
export default function App() {
  const [state, setState] = useState<OverlayState>(makeInitialState());
  const [isLoaded, setIsLoaded] = useState(false);
  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (supabase) {
        const { data } = await supabase.from("overlay_states").select("state").eq("slug", OVERLAY_SLUG).maybeSingle();
        if (data?.state) setState(data.state as OverlayState);
      }
      setIsLoaded(true);
    };
    init();
    let channel: any;
    if (supabase) {
      channel = supabase.channel(`sync-${OVERLAY_SLUG}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "overlay_states", filter: `slug=eq.${OVERLAY_SLUG}` }, (p) => {
          if (!isLocalUpdateRef.current) setState(p.new.state as OverlayState);
          isLocalUpdateRef.current = false;
        }).subscribe();
    }
    return () => { if (supabase && channel) supabase.removeChannel(channel); };
  }, []);

  const handleMutate = (fn: (d: OverlayState) => void) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      if (supabase) {
        isLocalUpdateRef.current = true;
        supabase.from("overlay_states").upsert({ slug: OVERLAY_SLUG, state: next, updated_at: new Date().toISOString() }, { onConflict: "slug" });
      }
      return next;
    });
  };

  if (!isLoaded) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/control" replace />} />
        <Route path="/control" element={<ControlPage state={state} onMutate={handleMutate} conn={HAS_SUPABASE ? "同步中" : "離線"} />} />
        <Route path="/overlay" element={<OverlayPage state={state} />} />
      </Routes>
    </BrowserRouter>
  );
}