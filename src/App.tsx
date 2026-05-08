// force update 1
import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// --- 類型與常數 ---
type Mode = "recurve_individual" | "recurve_team" | "recurve_mixed" | "compound_individual" | "compound_team" | "compound_mixed";
type Side = "left" | "right";
type ArrowValue = number | "X" | "M" | "";

type OverlayState = {
  mode: Mode; 
  arrowsPerEnd: number; 
  setNo: number; 
  endNo: number;
  isVisible: boolean; 
  playerA: { name: string; setPts: number; arrows: ArrowValue[]; total: number; };
  playerB: { name: string; setPts: number; arrows: ArrowValue[]; total: number; };
  weather: {
    windSpeed: number;
    windDeg: number;
    stationName: string;
    isAuto: boolean;
  };
  customColor1: string; customColor2: string;
  offsetX: number; offsetY: number; scale: number; overlayWidth: number;
  colors: {
    nameBg: string;
    nameText: string;
    arrowBg: string;
    arrowText: string;
    statsBg: string;
    statsText: string;
  };
};

const CWA_API_KEY = "CWA-94EEA30F-6C53-469B-A844-517F1C23CECF";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const OVERLAY_SLUG = import.meta.env.VITE_OVERLAY_SLUG ?? "archery-main";
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const MODES: Record<Mode, { label: string; arrowsPerEnd: number; system: "set" | "end" }> = {
  recurve_individual: { label: "反曲弓・個人 (積點)", arrowsPerEnd: 3, system: "set" },
  recurve_team: { label: "反曲弓・團體 (積點)", arrowsPerEnd: 6, system: "set" },
  recurve_mixed: { label: "反曲弓・混雙 (積點)", arrowsPerEnd: 4, system: "set" },
  compound_individual: { label: "複合弓・個人 (總分)", arrowsPerEnd: 3, system: "end" },
  compound_team: { label: "複合弓・團體 (總分)", arrowsPerEnd: 6, system: "end" },
  compound_mixed: { label: "複合弓・混雙 (總分)", arrowsPerEnd: 4, system: "end" },
};

function makeInitialState(mode: Mode = "recurve_individual"): OverlayState {
  const cfg = MODES[mode];
  return {
    mode, 
    arrowsPerEnd: cfg.arrowsPerEnd, 
    setNo: 1, 
    endNo: 1,
    isVisible: true,
    playerA: { name: "選手 A", setPts: 0, arrows: Array(cfg.arrowsPerEnd).fill(""), total: 0 },
    playerB: { name: "選手 B", setPts: 0, arrows: Array(cfg.arrowsPerEnd).fill(""), total: 0 },
    weather: { windSpeed: 0.0, windDeg: 0, stationName: "板橋", isAuto: false },
    customColor1: "#eeedff", customColor2: "#5a54f7",
    offsetX: 0, offsetY: 0, scale: 1, overlayWidth: 95,
    colors: {
      nameBg: "#1a1a1a",
      nameText: "#ffffff",
      arrowBg: "#ffffff",
      arrowText: "#0e0e0e",
      statsBg: "#ffffff",
      statsText: "#000000",
    },
  };
}

// --- 氣象抓取工具 ---
const fetchCwaWeather = async (station: string) => {
  try {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001?Authorization=${CWA_API_KEY}&StationName=${encodeURIComponent(station)}`;
    const res = await fetch(url);
    const data = await res.json();
    const s = data.records.Station[0];
    if (!s) return null;
    return {
      windSpeed: parseFloat(s.WeatherElement.WindSpeed),
      windDeg: parseFloat(s.WeatherElement.WindDirection),
    };
  } catch (e) {
    console.error("Fetch error:", e);
    return null;
  }
};

// --- 輔助組件 ---
const ColorPicker = ({ label, value, onChange }: any) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
    <span style={{ fontSize: "13px", fontWeight: 600, color: "#444" }}>{label}</span>
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ cursor: "pointer", border: "1px solid #ddd", borderRadius: "4px", width: "32px", height: "32px" }} />
      <input type="text" value={value.toUpperCase()} onChange={e => onChange(e.target.value)} style={{ width: "85px", fontSize: "12px", padding: "6px", border: "1px solid #ddd", borderRadius: "6px" }} />
    </div>
  </div>
);

const RangeInput = ({ label, value, min, max, step = 1, onChange }: any) => (
  <div style={{ marginBottom: "15px" }}>
    <label style={{ fontSize: "13px", fontWeight: 700, color: "#666" }}>{label}: {value}</label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "#5a54f7" }} />
  </div>
);

// --- 控制台 ---
// --- 控制台 ---
function ControlPage({ state, onMutate }: { state: OverlayState; onMutate: (fn: (d: OverlayState) => void) => void }) {
  const [activeTab, setActiveTab] = useState("match");
  const [sel, setSel] = useState<{ side: Side; idx: number }>({ side: "left", idx: 0 });

  const handleManualWeatherUpdate = async () => {
    const res = await fetchCwaWeather(state.weather.stationName);
    if (res) {
      onMutate(d => {
        d.weather.windSpeed = res.windSpeed;
        d.weather.windDeg = res.windDeg;
      });
      alert("天氣數據已同步成功！");
    }
  };

  const renderPlayerControl = (side: Side) => {
    const p = side === "left" ? state.playerA : state.playerB;
    const updateP = (fn: (p: any) => void) => onMutate(d => fn(side === "left" ? d.playerA : d.playerB));
    
    return (
      <div style={{ flex: 1, background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <div style={{ marginBottom: "10px", fontWeight: 700, color: side === "left" ? "#5a54f7" : "#ff4d4f" }}>
          {side === "left" ? "LEFT SIDE" : "RIGHT SIDE"}
        </div>
        <input style={{ ...inputS, marginBottom: "15px", fontWeight: 700 }} value={p.name} onChange={e => updateP(x => x.name = e.target.value)} placeholder="輸入選手姓名" />
        
        <div style={{ background: "#fcfcfc", padding: "10px", borderRadius: "10px", border: "1px dashed #ddd", marginBottom: "15px" }}>
          <div style={scoreRowS}>
            <span>積點 (SET PTS):</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={miniBtnS} onClick={() => updateP(x => x.setPts--)}>-1</button>
              <b style={{ minWidth: "25px", textAlign: "center", fontSize: "16px" }}>{p.setPts}</b>
              <button style={miniBtnS} onClick={() => updateP(x => x.setPts++)}>+1</button>
            </div>
          </div>
          <div style={scoreRowS}>
            <span>總分 (TOTAL):</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={miniBtnS} onClick={() => updateP(x => x.total--)}>-1</button>
              <b style={{ minWidth: "25px", textAlign: "center", fontSize: "16px" }}>{p.total}</b>
              <button style={miniBtnS} onClick={() => updateP(x => x.total++)}>+1</button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
          {p.arrows.map((v, i) => (
            <div key={i} onClick={() => setSel({ side, idx: i })} style={{ 
              flex: 1, height: "45px", borderRadius: "8px", border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900,
              borderColor: sel.side === side && sel.idx === i ? "#5a54f7" : "#f0f0f0", 
              background: sel.side === side && sel.idx === i ? "#eeedff" : "#fcfcfc", 
              cursor: "pointer", transition: "all 0.2s"
            }}>{v || "-"}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px" }}>
          {["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, "M"].map(kv => (
            <button key={kv} style={btnS()} onClick={() => {
              updateP(x => x.arrows[sel.idx] = kv);
              setSel(prev => ({ ...prev, idx: (prev.idx + 1) % state.arrowsPerEnd }));
            }}>{kv}</button>
          ))}
          <button style={{ ...btnS(), gridColumn: "span 2", color: "#ff4d4f" }} onClick={() => updateP(x => x.arrows = Array(state.arrowsPerEnd).fill(""))}>重置本輪</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto", background: "#f8f9fa", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* 頂部列 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", padding: "15px 20px", background: "#fff", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#1a1a1a" }}>射箭直播控制台</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#52c41a", animation: "pulse 2s infinite" }}></div>
            <span style={{ color: "#52c41a", fontSize: "12px", fontWeight: 600 }}>LIVE SYNCING</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button 
            style={{ ...btnS(), background: "#fff", color: "#ff4d4f", borderColor: "#ff4d4f", padding: "8px 16px" }}
            onClick={() => {
              if (window.confirm("⚠️ 確定要重置全場嗎？這將清除所有數據。")) {
                onMutate(d => {
                  Object.assign(d, makeInitialState(d.mode));
                  setSel({ side: "left", idx: 0 });
                });
              }
            }}
          >重置全場</button>
          <button 
            style={{ ...btnS(state.isVisible), background: state.isVisible ? "#5a54f7" : "#ff4d4f", color: "#fff", border: "none", padding: "8px 20px" }} 
            onClick={() => onMutate(d => d.isVisible = !d.isVisible)}
          >
            {state.isVisible ? "ON AIR" : "HIDDEN"}
          </button>
          <a href="/overlay" target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#666", fontSize: "14px", fontWeight: 600, padding: "8px 12px", border: "1px solid #ddd", borderRadius: "8px" }}>預覽 ↗</a>
        </div>
      </div>

      {/* 預覽視窗 */}
      <div style={{ background: "#000", borderRadius: "20px", marginBottom: "20px", aspectRatio: "16/9", overflow: "hidden", position: "relative", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
        <iframe src="/overlay" style={{ width: "1920px", height: "1080px", border: "none", transform: `scale(${1000/1920})`, transformOrigin: "top left" }} title="preview" />
      </div>

      {/* 頁籤切換 */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", background: "#fff", padding: "8px", borderRadius: "15px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        {["match", "appearance"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer", background: activeTab === t ? "#eeedff" : "transparent", color: activeTab === t ? "#5a54f7" : "#666", transition: "all 0.2s" }}>
            {t === "match" ? "比賽數據控制" : "介面外觀調整"}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", padding: "25px", borderRadius: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        {activeTab === "match" ? (
          <>
            {/* 比賽模式選擇 */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "25px", flexWrap: "wrap" }}>
              {Object.keys(MODES).map(m => (
                <button key={m} style={btnS(state.mode === m)} onClick={() => {
                  if(window.confirm("切換模式將重置分數，確定嗎？")) onMutate(d => Object.assign(d, makeInitialState(m as Mode)));
                }}>
                  {MODES[m as Mode].label}
                </button>
              ))}
            </div>

            {/* 選手控制區 */}
            <div style={{ display: "flex", gap: "20px" }}>
              {renderPlayerControl("left")}
              {renderPlayerControl("right")}
            </div>

            {/* 下一回合按鈕 */}
            <button style={{ width: "100%", height: "65px", marginTop: "25px", background: "#5a54f7", color: "#fff", border: "none", borderRadius: "16px", fontSize: "18px", fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 15px rgba(90, 84, 247, 0.3)" }}
              onClick={() => onMutate(d => {
                const sA = d.playerA.arrows.reduce((s,v)=>s+(v==="X"?10:v==="M"||v===""?0:Number(v)),0);
                const sB = d.playerB.arrows.reduce((s,v)=>s+(v==="X"?10:v==="M"||v===""?0:Number(v)),0);
                if (MODES[d.mode].system === "set") {
                  if (sA > sB) d.playerA.setPts += 2; else if (sB > sA) d.playerB.setPts += 2; else if (sA === sB && sA > 0) { d.playerA.setPts++; d.playerB.setPts++; }
                  d.setNo++;
                } else { d.playerA.total += sA; d.playerB.total += sB; d.endNo++; }
                d.playerA.arrows = Array(d.arrowsPerEnd).fill(""); d.playerB.arrows = Array(d.arrowsPerEnd).fill("");
                setSel({ side: "left", idx: 0 });
              })}
            >完成本回合 (SUBMIT END)</button>

            {/* 天氣快捷區 */}
            <div style={{ marginTop: "30px", paddingTop: "25px", borderTop: "1px dashed #eee" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <h4 style={{ margin: 0, color: "#333" }}>即時風速風向</h4>
                <div style={{ display: "flex", gap: "10px" }}>
                   <select style={{ ...inputS, width: "150px", padding: "5px 10px", fontSize: "14px" }} value={state.weather.stationName} onChange={e => onMutate(d => d.weather.stationName = e.target.value)}>
                    <option value="臺北">臺北站</option>
                    <option value="板橋">板橋站</option>
                    <option value="中壢">中壢站</option>
                    <option value="新竹">新竹站</option>
                    <option value="臺中">臺中站</option>
                  </select>
                  <button onClick={handleManualWeatherUpdate} style={{ padding: "5px 15px", background: "#eeedff", border: "none", borderRadius: "6px", color: "#5a54f7", fontWeight: 600, cursor: "pointer" }}>更新</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <RangeInput label={`手動微調風向: ${state.weather.windDeg}°`} value={state.weather.windDeg} min={0} max={360} onChange={(v: number) => onMutate(d => d.weather.windDeg = v)} />
                </div>
                <div style={{ width: "100px" }}>
                  <label style={{ fontSize: "12px", color: "#666" }}>風速 m/s</label>
                  <input type="number" step="0.1" style={inputS} value={state.weather.windSpeed} onChange={e => onMutate(d => d.weather.windSpeed = Number(e.target.value))} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
            <div>
              <h4 style={{ marginBottom: "20px", color: "#5a54f7" }}>佈局與縮放</h4>
              <RangeInput label="縮放比例" value={state.scale} min={0.5} max={1.5} step={0.01} onChange={(v: number) => onMutate(d => d.scale = v)} />
              <RangeInput label="水平偏移 (X)" value={state.offsetX} min={-800} max={800} onChange={(v: number) => onMutate(d => d.offsetX = v)} />
              <RangeInput label="垂直偏移 (Y)" value={state.offsetY} min={-500} max={500} onChange={(v: number) => onMutate(d => d.offsetY = v)} />
            </div>
            <div>
              <h4 style={{ marginBottom: "20px", color: "#5a54f7" }}>配色方案</h4>
              <ColorPicker label="姓名背板顏色" value={state.colors.nameBg} onChange={(v:any) => onMutate(d => d.colors.nameBg = v)} />
              <ColorPicker label="姓名文字顏色" value={state.colors.nameText} onChange={(v:any) => onMutate(d => d.colors.nameText = v)} />
              <ColorPicker label="統計框背景色" value={state.colors.statsBg} onChange={(v:any) => onMutate(d => d.colors.statsBg = v)} />
              <ColorPicker label="統計文字顏色" value={state.colors.statsText} onChange={(v:any) => onMutate(d => d.colors.statsText = v)} />
            </div>
          </div>
        )}
      </div>

      {/* 版權標記 Footer */}
      <div style={{ marginTop: "40px", padding: "30px 0", textAlign: "center", color: "#bbb", fontSize: "13px", borderTop: "1px solid #eee" }}>
        <div style={{ fontWeight: 700, color: "#999", marginBottom: "5px" }}>ARCHERY OVERLAY SYSTEM v2.0</div>
        <div>© 2026 Developed by LV PEIXUAN. All Rights Reserved.</div>
        <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.7 }}>Powered by React, Supabase & Vercel</div>
      </div>
    </div>
  );
}

// --- 觀戰畫面 ---
function OverlayPage({ state }: { state: OverlayState }) {
  const { colors, isVisible, weather } = state;
  // 計算當前畫面上箭值的總和
  const calcSum = (arr: any[]) => arr.reduce((s, v) => s + (v === "X" ? 10 : (v === "M" || v === "" ? 0 : Number(v))), 0);

  return (
    <div style={{ width: "1920px", height: "1080px", position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", bottom: "150px", left: "50%", width: `${state.overlayWidth}%`,
        opacity: isVisible ? 1 : 0,
        transform: `translateX(-50%) translate(${state.offsetX}px, ${isVisible ? state.offsetY : state.offsetY + 80}px) scale(${state.scale})`,
        transformOrigin: "bottom center",
        transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* 風向標 (維持原樣) */}
        <div style={{ 
          display: "flex", alignItems: "center", gap: "15px", 
          padding: "0 10px 10px 10px", color: colors.nameText, fontWeight: 900,
          transition: "all 0.5s ease"
        }}>
          <div style={{ 
            fontSize: "45px", 
            transform: `rotate(${weather.windDeg + 180}deg)`, 
            transition: "transform 1.5s cubic-bezier(0.65, 0, 0.35, 1)"
          }}>↑</div>
          <div style={{ fontSize: "30px", textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>{weather.windSpeed.toFixed(1)} m/s</div>
        </div>

        {[state.playerA, state.playerB].map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "2px" }}>
            {/* 姓名欄 */}
            <div style={{ width: "450px", height: "90px", background: colors.nameBg, color: colors.nameText, padding: "0 30px", fontSize: "40px", fontWeight: 900, display: "flex", alignItems: "center" }}>{p.name}</div>
            
            {/* 箭值欄 */}
            <div style={{ display: "flex", gap: "2px" }}>
              {p.arrows.map((v, idx) => (
                <div key={idx} style={{ width: "90px", height: "90px", background: colors.arrowBg, color: colors.arrowText, border: `1px solid #ddd`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "45px", fontWeight: 900 }}>{v}</div>
              ))}
            </div>

            {/* 中間格：顯示當前小計 (SUM) 或 積點 (SET PTS) */}
            <div style={{ width: "120px", height: "90px", background: colors.statsBg, color: colors.statsText, border: `2px solid ${colors.statsText}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 900 }}>{MODES[state.mode].system === "set" ? "SET PTS" : "SUM"}</span>
              <span style={{ fontSize: "45px", fontWeight: 900 }}>
                {MODES[state.mode].system === "set" ? p.setPts : calcSum(p.arrows)}
              </span>
            </div>

            {/* 最後一格：一律顯示總分 (TOTAL) */}
            <div style={{ width: "120px", height: "90px", background: colors.statsBg, color: colors.statsText, border: `2px solid ${colors.statsText}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 900 }}>TOTAL</span>
              <span style={{ fontSize: "45px", fontWeight: 900 }}>
                {p.total + calcSum(p.arrows)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- App 入口 ---
const scoreRowS = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "14px", fontWeight: 600 };
const miniBtnS = { padding: "2px 8px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "4px", background: "#fff" };
const btnS = (active = false) => ({ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd", background: active ? "#5a54f7" : "#fff", color: active ? "#fff" : "#333", cursor: "pointer", fontSize: "13px", fontWeight: 600 });
const inputS = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", outline: "none" };

export default function App() {
  const [state, setState] = useState<OverlayState>(makeInitialState());
  const isLocalUpdateRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!supabase) return;
    const loadInitial = async () => {
      const { data } = await supabase.from("overlay_states").select("state").eq("slug", OVERLAY_SLUG).maybeSingle();
      if (data?.state) setState(data.state as OverlayState);
    };
    loadInitial();
    const sub = supabase.channel(`sync-${OVERLAY_SLUG}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "overlay_states", filter: `slug=eq.${OVERLAY_SLUG}` }, (payload) => {
      if (!isLocalUpdateRef.current) setState(payload.new.state as OverlayState);
      isLocalUpdateRef.current = false;
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (!state.weather.isAuto) return;
    const interval = setInterval(async () => {
      const res = await fetchCwaWeather(stateRef.current.weather.stationName);
      if (res) {
        handleMutate(d => {
          d.weather.windSpeed = res.windSpeed;
          d.weather.windDeg = res.windDeg;
        });
      }
    }, 600000); 
    return () => clearInterval(interval);
  }, [state.weather.isAuto, state.weather.stationName]);

  const handleMutate = async (fn: (d: OverlayState) => void) => {
    const next = JSON.parse(JSON.stringify(stateRef.current));
    fn(next);
    setState(next);
    if (supabase) {
      isLocalUpdateRef.current = true;
      await supabase.from("overlay_states").upsert({ slug: OVERLAY_SLUG, state: next, updated_at: new Date().toISOString() }, { onConflict: "slug" });
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/control" replace />} />
        <Route path="/control" element={<ControlPage state={state} onMutate={handleMutate} />} />
        <Route path="/overlay" element={<OverlayPage state={state} />} />
      </Routes>
    </BrowserRouter>
  );
}