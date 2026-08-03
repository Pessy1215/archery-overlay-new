import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// --- 類型與常數 ---
type Mode =
  | "recurve_individual"
  | "recurve_team"
  | "recurve_mixed"
  | "compound_individual"
  | "compound_team"
  | "compound_mixed";
type Side = "left" | "right";
type ArrowValue = number | "X" | "M" | "";

type PlayerState = {
  name: string;
  setPts: number;
  arrows: ArrowValue[];
  total: number;
};

type OverlayState = {
  mode: Mode;
  arrowsPerEnd: number;
  setNo: number;
  endNo: number;
  isVisible: boolean;
  playerA: PlayerState;
  playerB: PlayerState;
  weather: {
    windSpeed: number;
    windDeg: number;
    stationName: string;
    isAuto: boolean;
  };
  offsetX: number;
  offsetY: number;
  scale: number;
  overlayWidth: number;
};

const CWA_API_KEY = import.meta.env.VITE_CWA_API_KEY ?? "CWA-94EEA30F-6C53-469B-A844-517F1C23CECF";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const OVERLAY_SLUG = import.meta.env.VITE_OVERLAY_SLUG ?? "archery-main";
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = HAS_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const PINK = "#8CCDC6";
const PINK_LIGHT = "#A8DDD8";
const PINK_PALE = "#EEF9F7";
const PANEL_BG = "#ffffff";
const PAGE_BG = "#f4f4f4";

const MODES: Record<
  Mode,
  {
    label: string;
    arrowsPerEnd: number;
    system: "set" | "end";
    category: "individual" | "team" | "mixed";
  }
> = {
  recurve_individual: {
    label: "反曲弓・個人 (積點)",
    arrowsPerEnd: 3,
    system: "set",
    category: "individual",
  },
  recurve_team: {
    label: "反曲弓・團體 (積點)",
    arrowsPerEnd: 6,
    system: "set",
    category: "team",
  },
  recurve_mixed: {
    label: "反曲弓・混雙 (積點)",
    arrowsPerEnd: 4,
    system: "set",
    category: "mixed",
  },
  compound_individual: {
    label: "複合弓・個人 (總分)",
    arrowsPerEnd: 3,
    system: "end",
    category: "individual",
  },
  compound_team: {
    label: "複合弓・團體 (總分)",
    arrowsPerEnd: 6,
    system: "end",
    category: "team",
  },
  compound_mixed: {
    label: "複合弓・混雙 (總分)",
    arrowsPerEnd: 4,
    system: "end",
    category: "mixed",
  },
};

const KEY_VALUES: ArrowValue[] = [
  "X",
  10,
  9,
  8,
  7,
  6,
  5,
  4,
  3,
  2,
  1,
  0,
  "M",
];

function v2p(v: ArrowValue): number {
  if (v === "X") return 10;
  if (v === "M" || v === "" || v == null) return 0;
  return Number(v) || 0;
}

function calcSum(arrows: ArrowValue[]): number {
  return arrows.reduce<number>((sum, value) => sum + v2p(value), 0);
}

function defaultPlayerName(mode: Mode, side: Side): string {
  const category = MODES[mode].category;
  const suffix = side === "left" ? "A" : "B";
  return category === "individual" ? `選手 ${suffix}` : `${suffix} 隊`;
}

function makeInitialState(mode: Mode = "recurve_individual"): OverlayState {
  const cfg = MODES[mode];
  return {
    mode,
    arrowsPerEnd: cfg.arrowsPerEnd,
    setNo: 1,
    endNo: 1,
    isVisible: true,
    playerA: {
      name: defaultPlayerName(mode, "left"),
      setPts: 0,
      arrows: Array(cfg.arrowsPerEnd).fill(""),
      total: 0,
    },
    playerB: {
      name: defaultPlayerName(mode, "right"),
      setPts: 0,
      arrows: Array(cfg.arrowsPerEnd).fill(""),
      total: 0,
    },
    weather: {
      windSpeed: 0,
      windDeg: 0,
      stationName: "花蓮",
      isAuto: false,
    },
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    overlayWidth: 95,
  };
}

function normalizeState(raw: Partial<OverlayState> | null | undefined): OverlayState {
  const mode = raw?.mode && MODES[raw.mode] ? raw.mode : "recurve_individual";
  const base = makeInitialState(mode);
  const arrowsPerEnd = MODES[mode].arrowsPerEnd;

  const normalizePlayer = (
    player: Partial<PlayerState> | undefined,
    side: Side,
  ): PlayerState => ({
    name: player?.name ?? defaultPlayerName(mode, side),
    setPts: Number(player?.setPts ?? 0),
    total: Number(player?.total ?? 0),
    arrows: Array.from({ length: arrowsPerEnd }, (_, index) =>
      player?.arrows?.[index] ?? "",
    ),
  });

  return {
    ...base,
    ...raw,
    mode,
    arrowsPerEnd,
    setNo: Number(raw?.setNo ?? 1),
    endNo: Number(raw?.endNo ?? 1),
    isVisible: raw?.isVisible ?? true,
    playerA: normalizePlayer(raw?.playerA, "left"),
    playerB: normalizePlayer(raw?.playerB, "right"),
    weather: {
      ...base.weather,
      ...(raw?.weather ?? {}),
      stationName: "花蓮",
      windSpeed: Number(raw?.weather?.windSpeed ?? 0),
      windDeg: Number(raw?.weather?.windDeg ?? 0),
    },
    offsetX: Number(raw?.offsetX ?? 0),
    offsetY: Number(raw?.offsetY ?? 0),
    scale: Number(raw?.scale ?? 1),
    overlayWidth: Number(raw?.overlayWidth ?? 95),
  };
}

// --- 中央氣象署資料 ---
async function fetchCwaWeather(station: string) {
  if (!CWA_API_KEY) {
    console.warn("尚未設定 VITE_CWA_API_KEY，無法抓取中央氣象署資料。");
    return null;
  }

  try {
    const url =
      "https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001" +
      `?Authorization=${encodeURIComponent(CWA_API_KEY)}` +
      `&StationName=${encodeURIComponent(station)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`CWA request failed: ${response.status}`);

    const data = await response.json();
    const stationData = data?.records?.Station?.[0];
    if (!stationData) return null;

    const windSpeed = Number(stationData?.WeatherElement?.WindSpeed);
    const windDeg = Number(stationData?.WeatherElement?.WindDirection);

    return {
      windSpeed: Number.isFinite(windSpeed) ? windSpeed : 0,
      windDeg: Number.isFinite(windDeg) ? windDeg : 0,
    };
  } catch (error) {
    console.error("CWA weather fetch error:", error);
    return null;
  }
}

const btnS = (active = false) => ({
  padding: "8px 10px",
  borderRadius: 7,
  border: active ? `1px solid ${PINK}` : "1px solid #ddd",
  background: active ? PINK : "#fff",
  color: active ? "#fff" : "#111",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 700,
});

const miniBtn = {
  padding: "4px 9px",
  borderRadius: 5,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
};

const inputS = {
  width: "100%",
  padding: "9px",
  borderRadius: 7,
  border: "1px solid #ccc",
  fontSize: "15px",
  boxSizing: "border-box" as const,
};

function RangeInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: "#666" }}>
        {label}: {value}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: "100%", accentColor: PINK }}
      />
    </div>
  );
}

// --- 控制台 ---
function ControlPage({
  state,
  onMutate,
  conn,
}: {
  state: OverlayState;
  onMutate: (fn: (draft: OverlayState) => void) => void;
  conn: string;
}) {
  const [activeTab, setActiveTab] = useState<"match" | "position">("match");
  const [sel, setSel] = useState<{ side: Side; idx: number }>({
    side: "left",
    idx: 0,
  });
  const [nameA, setNameA] = useState(state.playerA.name);
  const [nameB, setNameB] = useState(state.playerB.name);

  useEffect(() => {
    setNameA(state.playerA.name);
    setNameB(state.playerB.name);
  }, [state.playerA.name, state.playerB.name]);

  const updatePlayer = (side: Side, fn: (player: PlayerState) => void) => {
    onMutate((draft) => fn(side === "left" ? draft.playerA : draft.playerB));
  };

  const modifyArrow = (side: Side, delta: number) => {
    onMutate((draft) => {
      const player = side === "left" ? draft.playerA : draft.playerB;
      const current = player.arrows[sel.idx];
      const nextValue = Math.max(0, Math.min(10, v2p(current) + delta));
      player.arrows[sel.idx] = nextValue === 0 ? "M" : nextValue;
    });
  };

  const handleManualWeatherUpdate = async () => {
    const result = await fetchCwaWeather("花蓮");
    if (!result) return;
    onMutate((draft) => {
      draft.weather.windSpeed = result.windSpeed;
      draft.weather.windDeg = result.windDeg;
    });
  };

  const renderPlayerControl = (side: Side) => {
    const player = side === "left" ? state.playerA : state.playerB;
    const isSelectedSide = sel.side === side;
    const draftName = side === "left" ? nameA : nameB;
    const setDraftName = side === "left" ? setNameA : setNameB;
    const categoryLabel =
      MODES[state.mode].category === "individual" ? "個人" : "隊伍";

    return (
      <div
        style={{
          flex: 1,
          background: PANEL_BG,
          padding: 15,
          borderRadius: 12,
          border: "1px solid #ddd",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          <input
            style={{ ...inputS, flex: 1 }}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <button
            style={btnS(true)}
            onClick={() => updatePlayer(side, (player) => (player.name = draftName))}
          >
            改名
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 10,
            background: "#f9f9f9",
            padding: 12,
            borderRadius: 8,
            border: "1px dashed #ccc",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: "#666", fontWeight: 700 }}>
              {categoryLabel}積點 (SET PTS):
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                style={miniBtn}
                onClick={() =>
                  updatePlayer(side, (player) => {
                    player.setPts -= 1;
                  })
                }
              >
                -1
              </button>
              <strong
                style={{
                  fontSize: 22,
                  color: PINK,
                  minWidth: 30,
                  textAlign: "center",
                }}
              >
                {player.setPts}
              </strong>
              <button
                style={miniBtn}
                onClick={() =>
                  updatePlayer(side, (player) => {
                    player.setPts += 1;
                  })
                }
              >
                +1
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid #eee",
              paddingTop: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "#666", fontWeight: 700 }}>
              {categoryLabel}總分 (TOTAL):
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                style={miniBtn}
                onClick={() =>
                  updatePlayer(side, (player) => {
                    player.total -= 1;
                  })
                }
              >
                -1
              </button>
              <strong
                style={{
                  fontSize: 22,
                  color: "#333",
                  minWidth: 30,
                  textAlign: "center",
                }}
              >
                {player.total}
              </strong>
              <button
                style={miniBtn}
                onClick={() =>
                  updatePlayer(side, (player) => {
                    player.total += 1;
                  })
                }
              >
                +1
              </button>
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#999",
              textAlign: "center",
              marginTop: 4,
            }}
          >
            目前模式：
            <span style={{ color: PINK, fontWeight: 700 }}>
              {MODES[state.mode].label}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 15 }}>
          {player.arrows.map((value, index) => (
            <div
              key={index}
              onClick={() => setSel({ side, idx: index })}
              style={{
                flex: 1,
                minWidth: 0,
                height: 45,
                border: "2px solid",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                borderColor:
                  isSelectedSide && sel.idx === index ? PINK : "#eee",
                cursor: "pointer",
                background: "#fff",
              }}
            >
              {value || "-"}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          <button
            style={{ ...miniBtn, flex: 1, height: 40 }}
            onClick={() => modifyArrow(side, 1)}
          >
            +1 分
          </button>
          <button
            style={{ ...miniBtn, flex: 1, height: 40 }}
            onClick={() => modifyArrow(side, -1)}
          >
            -1 分
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4,
          }}
        >
          {KEY_VALUES.map((value) => (
            <button
              key={String(value)}
              style={btnS()}
              onClick={() => {
                updatePlayer(side, (player) => {
                  player.arrows[sel.idx] = value;
                });
                setSel((previous) => ({
                  ...previous,
                  side,
                  idx: (previous.idx + 1) % state.arrowsPerEnd,
                }));
              }}
            >
              {value}
            </button>
          ))}
          <button
            style={{ ...btnS(), gridColumn: "span 2", background: "#f0f0f0" }}
            onClick={() =>
              updatePlayer(side, (player) => {
                player.arrows = Array(state.arrowsPerEnd).fill("");
              })
            }
          >
            清空此人
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: 15,
        maxWidth: 1000,
        margin: "0 auto",
        fontFamily: "Arial, 'Noto Sans TC', sans-serif",
        background: PAGE_BG,
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 15,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0 }}>
          控制台{" "}
          <small style={{ fontWeight: 400, color: "#888" }}>({conn})</small>
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href="/overlay"
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: "none",
              color: PINK,
              fontSize: 14,
              fontWeight: 700,
              padding: "7px 4px",
            }}
          >
            觀戰畫面 ↗
          </a>
          <button
            style={{ ...btnS(state.isVisible), minWidth: 105 }}
            onClick={() => onMutate((draft) => (draft.isVisible = !draft.isVisible))}
          >
            {state.isVisible ? "隱藏 Overlay" : "顯示 Overlay"}
          </button>
          <button
            style={{ ...miniBtn, color: "red" }}
            onClick={() => {
              if (!window.confirm("確定重置全場比賽？")) return;
              onMutate((draft) => Object.assign(draft, makeInitialState(draft.mode)));
              setSel({ side: "left", idx: 0 });
            }}
          >
            重置全場
          </button>
        </div>
      </div>

      <div
        style={{
          background: PANEL_BG,
          padding: 15,
          borderRadius: 12,
          border: "1px solid #ddd",
          marginBottom: 15,
        }}
      >
        <h4 style={{ color: PINK, margin: "0 0 12px" }}>風向與天氣</h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <label style={{ fontSize: 12, display: "block", marginBottom: 5 }}>
              風速 (m/s)
            </label>
            <input
              type="number"
              step="0.1"
              style={inputS}
              value={state.weather.windSpeed}
              onChange={(event) =>
                onMutate(
                  (draft) =>
                    (draft.weather.windSpeed = Number(event.target.value)),
                )
              }
            />
          </div>
          <div>
            <label style={{ fontSize: 12, display: "block", marginBottom: 5 }}>
              天氣位置
            </label>
            <div
              style={{
                ...inputS,
                background: "#f9f9f9",
                color: "#555",
                fontWeight: 700,
              }}
            >
              花蓮德興棒球場（花蓮觀測站）
            </div>
          </div>
        </div>

        <button
          style={{
            width: "100%",
            height: 44,
            background: PINK_PALE,
            color: PINK,
            border: `1px solid ${PINK_LIGHT}`,
            borderRadius: 9,
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            marginBottom: 15,
          }}
          onClick={handleManualWeatherUpdate}
        >
          更新中央氣象署資料
        </button>

        <div
          style={{
            background: "#f9f9f9",
            padding: 15,
            borderRadius: 9,
            border: "1px dashed #ccc",
          }}
        >
          <RangeInput
            label="現場風向角度"
            value={state.weather.windDeg}
            min={0}
            max={360}
            onChange={(value) =>
              onMutate((draft) => (draft.weather.windDeg = value))
            }
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#666",
            }}
          >
            <input
              type="checkbox"
              checked={state.weather.isAuto}
              onChange={(event) =>
                onMutate(
                  (draft) => (draft.weather.isAuto = event.target.checked),
                )
              }
            />
            啟用每 10 分鐘自動更新
          </label>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 15,
          background: "#fff",
          padding: 7,
          borderRadius: 12,
          border: "1px solid #ddd",
        }}
      >
        <button
          style={{ ...btnS(activeTab === "match"), flex: 1 }}
          onClick={() => setActiveTab("match")}
        >
          比賽控制
        </button>
        <button
          style={{ ...btnS(activeTab === "position"), flex: 1 }}
          onClick={() => setActiveTab("position")}
        >
          位置與縮放
        </button>
      </div>

      {activeTab === "match" ? (
        <>
          <div
            style={{
              background: "#fff",
              padding: 10,
              borderRadius: 12,
              marginBottom: 15,
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              border: "1px solid #ddd",
            }}
          >
            {(Object.keys(MODES) as Mode[]).map((mode) => (
              <button
                key={mode}
                style={btnS(state.mode === mode)}
                onClick={() => {
                  onMutate((draft) => Object.assign(draft, makeInitialState(mode)));
                  setSel({ side: "left", idx: 0 });
                }}
              >
                {MODES[mode].label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 15,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            {renderPlayerControl("left")}
            {renderPlayerControl("right")}
          </div>

          <button
            style={{
              width: "100%",
              height: 60,
              marginTop: 20,
              background: PINK,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 20,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(140,205,198,0.35)",
            }}
            onClick={() =>
              onMutate((draft) => {
                const scoreA = calcSum(draft.playerA.arrows);
                const scoreB = calcSum(draft.playerB.arrows);

                // TOTAL 只在按下「完成本回合」後才正式累加。
                draft.playerA.total += scoreA;
                draft.playerB.total += scoreB;

                if (MODES[draft.mode].system === "set") {
                  if (scoreA > scoreB) draft.playerA.setPts += 2;
                  else if (scoreB > scoreA) draft.playerB.setPts += 2;
                  else if (scoreA === scoreB && scoreA > 0) {
                    draft.playerA.setPts += 1;
                    draft.playerB.setPts += 1;
                  }
                  draft.setNo += 1;
                } else {
                  draft.endNo += 1;
                }

                draft.playerA.arrows = Array(draft.arrowsPerEnd).fill("");
                draft.playerB.arrows = Array(draft.arrowsPerEnd).fill("");
                setSel({ side: "left", idx: 0 });
              })
            }
          >
            完成本回合（自動判定局分）
          </button>
        </>
      ) : (
        <div
          style={{
            background: "#fff",
            padding: 20,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        >
          <h4 style={{ marginTop: 0, color: PINK }}>Overlay 位置與大小</h4>
          <RangeInput
            label="縮放比例"
            value={state.scale}
            min={0.5}
            max={1.5}
            step={0.01}
            onChange={(value) => onMutate((draft) => (draft.scale = value))}
          />
          <RangeInput
            label="左右偏移 (X)"
            value={state.offsetX}
            min={-800}
            max={800}
            onChange={(value) => onMutate((draft) => (draft.offsetX = value))}
          />
          <RangeInput
            label="上下偏移 (Y)"
            value={state.offsetY}
            min={-500}
            max={500}
            onChange={(value) => onMutate((draft) => (draft.offsetY = value))}
          />
          <RangeInput
            label="Overlay 寬度 (%)"
            value={state.overlayWidth}
            min={50}
            max={100}
            onChange={(value) =>
              onMutate((draft) => (draft.overlayWidth = value))
            }
          />
          <button
            style={{ ...btnS(), width: "100%" }}
            onClick={() =>
              onMutate((draft) => {
                draft.offsetX = 0;
                draft.offsetY = 0;
                draft.scale = 1;
                draft.overlayWidth = 95;
              })
            }
          >
            重置位置與縮放
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: 35,
          padding: "25px 0",
          textAlign: "center",
          color: "#bbb",
          fontSize: 13,
          borderTop: "1px solid #ddd",
        }}
      >
        <div style={{ fontWeight: 700, color: "#999", marginBottom: 5 }}>
          ARCHERY OVERLAY SYSTEM
        </div>
        <div>© 2026 Developed by LV PEIXUAN. All Rights Reserved.</div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
          Powered by React, Supabase & Vercel
        </div>
      </div>
    </div>
  );
}

// --- Overlay ---
function OverlayPage({ state }: { state: OverlayState }) {
  const isSetSystem = MODES[state.mode].system === "set";

  const renderPlayer = (player: PlayerState) => {
    const currentEndSum = calcSum(player.arrows);

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 15,
          marginBottom: 25,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: 350,
            minWidth: 350,
            background: `linear-gradient(90deg, ${PINK_LIGHT}, ${PINK})`,
            color: "#fff",
            padding: "15px 30px",
            borderRadius: "40px 0 0 40px",
            fontSize: 28,
            fontWeight: 900,
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>

        <div style={{ display: "flex", gap: 10, margin: "0 10px" }}>
          {player.arrows.map((value, index) => (
            <div
              key={index}
              style={{
                width: 55,
                height: 55,
                background: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 900,
                color: PINK,
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
              }}
            >
              {value}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              width: 90,
              height: 75,
              background: "rgba(255,255,255,0.94)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              border: `2px solid ${PINK_LIGHT}`,
            }}
          >
            <span style={{ fontSize: 10, color: PINK, fontWeight: 800 }}>
              SET SUM
            </span>
            <span style={{ fontSize: 32, fontWeight: 900, color: PINK }}>
              {currentEndSum}
            </span>
          </div>

          <div
            style={{
              width: 90,
              height: 75,
              background: "#fff",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            }}
          >
            <span style={{ fontSize: 10, color: "#aaa", fontWeight: 800 }}>
              {isSetSystem ? "SET PTS" : "TOTAL"}
            </span>
            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: isSetSystem ? "#333" : PINK,
              }}
            >
              {isSetSystem ? player.setPts : player.total}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        background: "transparent",
        fontFamily: "Arial, 'Noto Sans TC', sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 80,
          width: `${state.overlayWidth}%`,
          opacity: state.isVisible ? 1 : 0,
          transform: `translateX(-50%) translate(${state.offsetX}px, ${
            state.isVisible ? state.offsetY : state.offsetY + 80
          }px) scale(${state.scale})`,
          transformOrigin: "bottom center",
          transition:
            "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 10px 12px 10px",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          <div
            style={{
              fontSize: 42,
              lineHeight: 1,
              transform: `rotate(${state.weather.windDeg + 180}deg)`,
              transformOrigin: "center",
              transition: "transform 1.5s cubic-bezier(0.65, 0, 0.35, 1)",
              textShadow: "2px 2px 5px rgba(0,0,0,0.65)",
            }}
          >
            ↑
          </div>
          <div
            style={{
              fontSize: 28,
              textShadow: "2px 2px 5px rgba(0,0,0,0.65)",
            }}
          >
            {state.weather.windSpeed.toFixed(1)} m/s
          </div>
        </div>

        {renderPlayer(state.playerA)}
        {renderPlayer(state.playerB)}
      </div>
    </div>
  );
}

// --- App ---
export default function App() {
  const [state, setState] = useState<OverlayState>(makeInitialState());
  const [isLoaded, setIsLoaded] = useState(false);
  const stateRef = useRef(state);
  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const init = async () => {
      if (supabase) {
        const { data, error } = await supabase
          .from("overlay_states")
          .select("state")
          .eq("slug", OVERLAY_SLUG)
          .maybeSingle();

        if (error) console.error("Initial state load error:", error);
        if (data?.state) setState(normalizeState(data.state));
      }
      setIsLoaded(true);
    };

    void init();

    if (!supabase) return;

    const channel = supabase
      .channel(`sync-${OVERLAY_SLUG}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "overlay_states",
          filter: `slug=eq.${OVERLAY_SLUG}`,
        },
        (payload) => {
          if (!isLocalUpdateRef.current && payload.new && "state" in payload.new) {
            setState(normalizeState(payload.new.state as Partial<OverlayState>));
          }
          isLocalUpdateRef.current = false;
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleMutate = (fn: (draft: OverlayState) => void) => {
    const next = structuredClone(stateRef.current);
    fn(next);
    const normalized = normalizeState(next);

    stateRef.current = normalized;
    setState(normalized);

    if (supabase) {
      isLocalUpdateRef.current = true;
      void supabase
        .from("overlay_states")
        .upsert(
          {
            slug: OVERLAY_SLUG,
            state: normalized,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" },
        )
        .then(({ error }) => {
          if (error) {
            isLocalUpdateRef.current = false;
            console.error("State sync error:", error);
          }
        });
    }
  };

  useEffect(() => {
    if (!state.weather.isAuto) return;

    const updateWeather = async () => {
      const current = stateRef.current;
      const result = await fetchCwaWeather("花蓮");
      if (!result) return;

      handleMutate((draft) => {
        draft.weather.windSpeed = result.windSpeed;
        draft.weather.windDeg = result.windDeg;
      });
    };

    void updateWeather();
    const interval = window.setInterval(updateWeather, 600_000);
    return () => window.clearInterval(interval);
  }, [state.weather.isAuto]);

  if (!isLoaded) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/control" replace />} />
        <Route
          path="/control"
          element={
            <ControlPage
              state={state}
              onMutate={handleMutate}
              conn={HAS_SUPABASE ? "同步中" : "離線"}
            />
          }
        />
        <Route path="/overlay" element={<OverlayPage state={state} />} />
      </Routes>
    </BrowserRouter>
  );
}

