import './index.css';
import { useState, useEffect, useCallback, useRef } from "react";
import { Analytics } from '@vercel/analytics/react';

// ─── CONSTANTS & STORAGE ────────────────────────────────────────────────────

const PASTEL_COLORS = [
  "#F2A7B0","#F7C59F","#A8C5A0","#F6E27A",
  "#A8BFDF","#D4A5C9","#F4B183","#98C9A3",
];

const JARS_KEY    = "tj-jars";
const TOKEN_KEY   = "tj-tokens";
const EXPIRY_KEY  = "tj-expiry";
const STARTER_KEY = "tj-starter";
const INTRO_KEY   = "tj-intro";
const NICKNAME_KEY= "tj-nickname";
const ACTIVE_JAR  = "tj-activeJar";

const STARTER_TOKENS = 7;
const ACCESS_HOURS   = 24;
const JAR_CAPACITY   = 25;
const MAX_JARS       = 5;

const WHIMSICAL_NAMES = [
  "sleepy pebble","tiny comet","noodle cloud","moss muffin",
  "velvet fog","cozy spore","damp acorn","gentle static",
  "moon crumb","soft boulder","quiet ember","fern whisper",
  "pudding star","lavender hum","soggy biscuit","porch light",
  "cloud nap","warm glitch","small orbit","blurry moth",
  "linen ghost","tuesday dream","wandering sock","foggy lantern",
];

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── BLOB SHAPE PATHS ───────────────────────────────────────────────────────

const BLOB_VARIANTS = [
  "M0,-1 C0.6,-0.9 1.1,-0.3 1,0.4 C0.9,1.1 0.2,1.3 -0.4,1.1 C-1,0.9 -1.2,0.2 -1,-0.3 C-0.8,-0.9 -0.6,-1.1 0,-1",
  "M0,-1 C0.5,-1.1 1.1,-0.5 1.1,0.1 C1.1,0.8 0.5,1.3 -0.1,1.2 C-0.7,1.1 -1.2,0.6 -1.1,-0.1 C-1,-0.7 -0.5,-0.9 0,-1",
  "M0.1,-1 C0.7,-0.8 1.2,-0.2 1,0.5 C0.8,1.2 0.1,1.3 -0.5,1 C-1.1,0.7 -1.1,0 -0.9,-0.5 C-0.7,-1 -0.5,-1.2 0.1,-1",
  "M0,-0.9 C0.6,-1.1 1.2,-0.4 1.1,0.3 C1,1 0.3,1.4 -0.3,1.2 C-0.9,1 -1.3,0.3 -1.1,-0.3 C-0.9,-0.9 -0.6,-0.7 0,-0.9",
  "M-0.1,-1 C0.5,-1 1.1,-0.4 1.1,0.2 C1.1,0.9 0.4,1.3 -0.2,1.2 C-0.8,1.1 -1.2,0.5 -1.1,-0.2 C-1,-0.8 -0.7,-1 -0.1,-1",
];

function BlobShape({ color, x, y, size, opacity = 0.88, seed = 0, completed = false }) {
  const path = BLOB_VARIANTS[seed % BLOB_VARIANTS.length];
  const r = size / 2;
  return (
    <g transform={`translate(${x},${y}) scale(${r})`} opacity={completed ? 0.35 : opacity}>
      <path d={path} fill={color} stroke="#6B4226" strokeWidth={1.5 / r} strokeLinejoin="round"
        strokeDasharray={completed ? `${6/r},${3/r}` : "none"} />
    </g>
  );
}

// Small inline blob for list items
function MiniBlob({ color, seed = 0, size = 28, completed = false }) {
  const path = BLOB_VARIANTS[seed % BLOB_VARIANTS.length];
  return (
    <svg width={size} height={size} viewBox="-1.4 -1.4 2.8 2.8" style={{ flexShrink: 0 }}>
      <path d={path} fill={color} stroke="#6B4226" strokeWidth={0.18}
        opacity={completed ? 0.4 : 0.9}
        strokeDasharray={completed ? "0.25,0.12" : "none"} />
    </svg>
  );
}

function JarSVG({ thoughts, onJarClick, isAnimating, jarName, lidVariant = 0 }) {
  const maxBlobs = JAR_CAPACITY;
  const count    = thoughts.length;

  // Blob grid: 5 cols × 5 rows = 25 capacity, centered in jar interior (x:50-170, y:100-270)
  // Each position is staggered naturally so blobs spread evenly with no right-gap
  const COLS = 5;
  const jarLeft = 52, jarRight = 168;
  const jarInnerWidth = jarRight - jarLeft; // 116px
  const colStep = jarInnerWidth / COLS;     // 23.2px per column
  const blobPositions = thoughts.map((t, i) => {
    const col  = i % COLS;
    const row  = Math.floor(i / COLS);
    const rowStagger = (row % 2) * (colStep / 2);
    const baseX = jarLeft + colStep * col + colStep / 2 + rowStagger;
    const baseY = 262 - row * 34 + (col % 2) * 5;
    return { x: baseX, y: Math.max(100, baseY), color: PASTEL_COLORS[t.colorIndex], seed: t.blobSeed, completed: t.completed };
  });

  const fillLevel = count > 0 ? Math.max(102, 278 - (count / maxBlobs) * 168) : 280;
  const labelText = jarName || "thought jar";
  const labelSize = labelText.length > 16 ? "8" : labelText.length > 12 ? "10" : "12";
  const subText   = count === 0 ? "add your first thought" : `${count} / ${maxBlobs} thoughts`;

  return (
    <svg viewBox="0 0 220 300" width="100%"
      style={{
        maxWidth: 340, cursor: "pointer",
        filter: isAnimating ? "drop-shadow(0 0 18px #F4B18355)" : "none",
        transition: "filter 0.4s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        transform: isAnimating ? "scale(1.03)" : "scale(1)",
        transformOrigin: "center bottom",
      }}
      onClick={onJarClick} role="button" aria-label="click jar to reveal a thought">

      <ellipse cx={110} cy={295} rx={65} ry={8} fill="#C9A87A" opacity={0.25} />

      {/* Body fill */}
      <path d="M48,85 C44,90 38,105 36,125 C33,150 32,180 33,210 C34,240 36,262 40,272 C44,280 50,285 62,287 C75,289 95,290 110,290 C125,290 145,289 158,287 C170,285 176,280 180,272 C184,262 186,240 187,210 C188,180 187,150 184,125 C182,105 176,90 172,85 Z"
        fill="#FFF8EC" stroke="#6B4226" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M52,90 C49,100 44,118 42,140 C39,165 38,192 39,218 C40,244 42,263 46,272 C50,279 56,282 68,284 C82,286 96,287 110,287 C124,287 138,286 152,284 C164,282 170,279 174,272 C178,263 180,244 181,218 C182,192 181,165 178,140 C176,118 171,100 168,90 Z"
        fill="#FFFDF7" opacity={0.6} />

      <clipPath id="jarClip">
        <path d="M52,90 C49,100 44,118 42,140 C39,165 38,192 39,218 C40,244 42,263 46,272 C50,279 56,282 68,284 C82,286 96,287 110,287 C124,287 138,286 152,284 C164,282 170,279 174,272 C178,263 180,244 181,218 C182,192 181,165 178,140 C176,118 171,100 168,90 Z" />
      </clipPath>
      <g clipPath="url(#jarClip)">
        {count > 0 && (
          <rect x={38} y={fillLevel} width={144} height={200} fill="#FDE8C8" opacity={0.22} />
        )}
        {blobPositions.map((b, i) => (
          <BlobShape key={thoughts[i].id} color={b.color} x={b.x} y={b.y}
            size={18 + (b.seed % 3) * 4} seed={b.seed} opacity={0.82} completed={b.completed} />
        ))}
      </g>

      {/* Neck */}
      <path d="M70,58 C65,62 58,68 54,78 C51,83 50,85 48,85 L172,85 C170,85 169,83 166,78 C162,68 155,62 150,58 Z"
        fill="#FFF8EC" stroke="#6B4226" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Lid — 5 variants, each jar gets one based on lidVariant */}
      {lidVariant === 0 && <>
        {/* Classic yellow band + round knob */}
        <rect x={58} y={36} width={104} height={24} rx={6} fill="#E8C87A" stroke="#6B4226" strokeWidth="3.5" strokeLinejoin="round" />
        <line x1={64} y1={44} x2={156} y2={44} stroke="#6B4226" strokeWidth="1.5" strokeLinecap="round" opacity={0.4} />
        <ellipse cx={110} cy={36} rx={14} ry={7} fill="#D4A840" stroke="#6B4226" strokeWidth="3" />
      </>}
      {lidVariant === 1 && <>
        {/* Dusty pink lid + small bow/ribbon knob */}
        <rect x={58} y={36} width={104} height={24} rx={6} fill="#F2A7B0" stroke="#6B4226" strokeWidth="3.5" strokeLinejoin="round" />
        <line x1={64} y1={48} x2={156} y2={48} stroke="#6B4226" strokeWidth="1.5" strokeLinecap="round" opacity={0.35} />
        {/* Bow */}
        <path d="M102,33 C104,29 108,30 110,33 C112,30 116,29 118,33 C116,37 112,36 110,33 C108,36 104,37 102,33 Z"
          fill="#E8859A" stroke="#6B4226" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={110} cy={33} r={2.5} fill="#6B4226" />
      </>}
      {lidVariant === 2 && <>
        {/* Sage green lid + wavy top edge + small pebble knob */}
        <path d="M58,60 L58,42 C58,38 62,36 68,36 C80,34 100,33 110,33 C120,33 140,34 152,36 C158,36 162,38 162,42 L162,60 C162,60 110,62 58,60 Z"
          fill="#A8C5A0" stroke="#6B4226" strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx={110} cy={34} rx={12} ry={5} fill="#7FAF78" stroke="#6B4226" strokeWidth="2.5" />
      </>}
      {lidVariant === 3 && <>
        {/* Butter yellow + crosshatch texture marks + flat square knob */}
        <rect x={58} y={36} width={104} height={24} rx={4} fill="#F6E27A" stroke="#6B4226" strokeWidth="3.5" strokeLinejoin="round" />
        <line x1={80} y1={38} x2={76} y2={58} stroke="#6B4226" strokeWidth="1" opacity={0.2} />
        <line x1={96} y1={37} x2={92} y2={59} stroke="#6B4226" strokeWidth="1" opacity={0.2} />
        <line x1={112} y1={36} x2={108} y2={60} stroke="#6B4226" strokeWidth="1" opacity={0.2} />
        <line x1={128} y1={37} x2={124} y2={59} stroke="#6B4226" strokeWidth="1" opacity={0.2} />
        <rect x={100} y={28} width={20} height={10} rx={3} fill="#E8C840" stroke="#6B4226" strokeWidth="2.5" />
      </>}
      {lidVariant === 4 && <>
        {/* Lavender lid + tiny dots doodle + oval pebble */}
        <rect x={58} y={36} width={104} height={24} rx={8} fill="#D4A5C9" stroke="#6B4226" strokeWidth="3.5" strokeLinejoin="round" />
        <circle cx={78} cy={48} r={2} fill="#6B4226" opacity={0.25} />
        <circle cx={90} cy={44} r={1.5} fill="#6B4226" opacity={0.2} />
        <circle cx={102} cy={50} r={2} fill="#6B4226" opacity={0.25} />
        <circle cx={116} cy={44} r={1.5} fill="#6B4226" opacity={0.2} />
        <circle cx={130} cy={49} r={2} fill="#6B4226" opacity={0.25} />
        <circle cx={142} cy={44} r={1.5} fill="#6B4226" opacity={0.2} />
        <ellipse cx={110} cy={35} rx={16} ry={6} fill="#C490B8" stroke="#6B4226" strokeWidth="2.5" />
      </>}

      {/* Shine */}
      <path d="M52,110 C50,130 49,155 50,175" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity={0.55} />
      <path d="M56,95 C54,100 53,107 53,112" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" opacity={0.45} />

      {/* Label */}
      <path d="M60,170 C58,168 57,167 58,165 L162,165 C163,167 162,168 160,170 L160,210 C162,212 163,213 162,215 L58,215 C57,213 58,212 60,210 Z"
        fill="white" stroke="#6B4226" strokeWidth="2" opacity={0.75} strokeLinejoin="round" />
      <text x={110} y={185} textAnchor="middle" fontFamily="'MyFreehandFont5'" fontSize={labelSize} fill="#6B4226" fontWeight="700">
        {labelText}
      </text>
      <text x={110} y={204} textAnchor="middle" fontFamily="'Montserrat', 'Helvetica Neue', Arial, sans-serif"
        fontSize="7.5" fill="#8B6040" opacity={0.85}>
        {subText}
      </text>


    </svg>
  );
}

// ─── RETRO TV ───────────────────────────────────────────────────────────────

function RetroTV({ onOpenAd }) {
  const [isFlickering, setIsFlickering] = useState(false);
  const [staticFrame, setStaticFrame]   = useState(0);
  const flickerTimer = useRef(null);

  const handleTVClick = () => {
    if (isFlickering) return;
    setIsFlickering(true);
    let frame = 0;
    flickerTimer.current = setInterval(() => {
      frame++;
      setStaticFrame(frame % 4);
      if (frame >= 8) {
        clearInterval(flickerTimer.current);
        setIsFlickering(false);
        setStaticFrame(0);
        onOpenAd?.();
      }
    }, 80);
  };

  const staticPatterns = [
    [[22,36,62,36],[22,44,50,44],[22,52,58,52],[22,59,48,59]],
    [[22,38,55,38],[22,43,62,43],[22,50,44,50],[22,57,60,57]],
    [[22,37,48,37],[22,45,62,45],[22,51,52,51],[22,58,42,58]],
    [[22,39,60,39],[22,42,46,42],[22,53,62,53],[22,56,50,56]],
  ];
  const lines = staticPatterns[staticFrame];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ fontFamily: "var(--font-hand)", fontSize: 12, color: "#C87A50", opacity: 0.8, whiteSpace: "nowrap" }}>
        earn tokens!
      </div>
      <svg viewBox="0 0 96 88" width={70} height={64} onClick={handleTVClick}
        style={{ cursor: "pointer", transition: "transform 0.15s", transform: isFlickering ? "scale(1.04)" : "scale(1)" }}>
        <rect x={6} y={14} width={76} height={60} rx={7} fill="#D4C5B0" stroke="#6B4226" strokeWidth={2.5} />
        <rect x={14} y={21} width={50} height={38} rx={4}
          fill={isFlickering ? "#A8C5B0" : "#7B9BAA"} stroke="#6B4226" strokeWidth={2} />
        {lines.map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isFlickering ? "#E8F4E0" : "white"}
            strokeWidth={isFlickering ? 1.5 : 1} opacity={isFlickering ? 0.55 : 0.25} />
        ))}
        <rect x={14} y={21} width={50} height={38} rx={4} fill="white" opacity={isFlickering ? 0.25 : 0.1} />
        <line x1={34} y1={14} x2={22} y2={2} stroke="#6B4226" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={48} y1={14} x2={60} y2={2} stroke="#6B4226" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={74} cy={34} r={5.5} fill="#B8A88A" stroke="#6B4226" strokeWidth={2} />
        <circle cx={74} cy={34} r={2} fill="#6B4226" />
        <circle cx={74} cy={54} r={5.5} fill="#B8A88A" stroke="#6B4226" strokeWidth={2} />
        <circle cx={74} cy={54} r={2} fill="#6B4226" />
        <rect x={20} y={72} width={9} height={10} rx={3} fill="#B8A88A" stroke="#6B4226" strokeWidth={2} />
        <rect x={52} y={72} width={9} height={10} rx={3} fill="#B8A88A" stroke="#6B4226" strokeWidth={2} />
      </svg>
    </div>
  );
}

// ─── TOKEN COIN ─────────────────────────────────────────────────────────────

function TokenCoin({ count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg viewBox="0 0 44 44" width={38} height={38}>
        <circle cx={22} cy={22} r={20} fill="#F6C94A" stroke="#6B4226" strokeWidth={2.8} />
        <circle cx={22} cy={22} r={15} fill="#EDAE1C" stroke="#6B4226" strokeWidth={1.5} opacity={0.6} />
        <polygon points="22,10 24.4,18.5 33.5,18.5 26.3,23.5 28.7,32 22,27 15.3,32 17.7,23.5 10.5,18.5 19.6,18.5"
          fill="#FDE78A" stroke="#6B4226" strokeWidth={1.2} strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 26, fontWeight: 700, color: "#6B4226", lineHeight: 1.3 }}>
        {count}
      </span>
    </div>
  );
}

// ─── LIST ICON ──────────────────────────────────────────────────────────────

function ListIcon({ onClick }) {
  return (
    <button onClick={onClick} aria-label="view all thoughts"
      style={{ background:"#FFF8EC",border:"2px solid #C9A87A",borderRadius:"50%",
        width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0,WebkitTapHighlightColor:"transparent",
        touchAction:"manipulation" }}>
      <svg viewBox="0 0 18 18" width={14} height={14}>
        <circle cx={3.5} cy={5} r={2} fill="#F2A7B0" stroke="#6B4226" strokeWidth={0.8}/>
        <circle cx={3.5} cy={9} r={2} fill="#A8BFDF" stroke="#6B4226" strokeWidth={0.8}/>
        <circle cx={3.5} cy={13} r={2} fill="#F6E27A" stroke="#6B4226" strokeWidth={0.8}/>
        <line x1={7.5} y1={5} x2={17} y2={5} stroke="#A07850" strokeWidth={1.5} strokeLinecap="round"/>
        <line x1={7.5} y1={9} x2={16} y2={9} stroke="#A07850" strokeWidth={1.5} strokeLinecap="round"/>
        <line x1={7.5} y1={13} x2={16.5} y2={13} stroke="#A07850" strokeWidth={1.5} strokeLinecap="round"/>
      </svg>
    </button>
  );
}

// ─── THOUGHT REVEAL POPUP ───────────────────────────────────────────────────

function ThoughtReveal({ thought, onClose, onComplete }) {
  if (!thought) return null;

  const blobColor = PASTEL_COLORS[thought.colorIndex ?? 0];
  const blobPaths = [
    "M160,20 C220,0 310,30 330,100 C350,170 300,240 220,260 C140,280 60,250 30,180 C0,110 40,50 80,30 C110,14 130,32 160,20 Z",
    "M170,15 C240,5 320,50 335,120 C350,190 295,255 215,265 C135,275 55,235 25,165 C-5,95 35,40 90,20 C130,5 140,22 170,15 Z",
    "M150,25 C215,0 315,45 330,115 C345,185 295,248 210,262 C125,276 50,240 22,170 C-6,100 38,45 85,25 C118,10 118,38 150,25 Z",
    "M165,18 C235,2 318,48 332,118 C346,188 292,252 212,264 C132,276 52,238 24,168 C-4,98 38,42 92,22 C126,8 128,32 165,18 Z",
  ];
  const blobPath    = blobPaths[thought.blobSeed % blobPaths.length];
  const formattedDate = new Date(thought.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(107,66,38,0.15)",backdropFilter:"blur(4px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"1.5rem" }} onClick={onClose}>
      <div style={{ position:"relative",cursor:"default",display:"flex",flexDirection:"column",alignItems:"center" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ position:"relative",width:"min(92vw, 420px)" }}>
          <svg viewBox="0 0 360 290" width="100%"
            style={{ display:"block", filter:"drop-shadow(4px 6px 0px rgba(107,66,38,0.28))" }}>
            <path d={blobPath} fill={thought.completed ? "#D4C5B0" : blobColor} stroke="#6B4226" strokeWidth="3" strokeLinejoin="round" />
            <path d={blobPath} fill="white" opacity={0.12} transform="scale(0.82) translate(32, 26)" />
          </svg>
          <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",
            alignItems:"center",justifyContent:"center",padding:"2.5rem 2.8rem",textAlign:"center" }}>
            <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(16px,3.1vw,20px)",
              color:"#6B4226",opacity:0.7,marginBottom:8,letterSpacing:1,lineHeight:1.6,paddingBottom:2,overflow:"visible" }}>
              {thought.completed ? "a completed thought" : "a thought from the jar"}
            </p>
            <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(22px,5.5vw,32px)",
              color:"#3D2510",lineHeight:1.6,paddingBottom:4,overflow:"visible",marginBottom:8,wordBreak:"break-word",hyphens:"auto",
              textDecoration: thought.completed ? "line-through" : "none", opacity: thought.completed ? 0.6 : 1 }}>
              {thought.text}
            </p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(10px,1.8vw,12px)",color:"#6B4226",opacity:0.6 }}>
              {formattedDate}
            </p>
          </div>
        </div>
        <div style={{ display:"flex",gap:10,marginTop:16 }}>
          {!thought.completed && (
            <button onClick={() => { onComplete(thought.id); onClose(); }}
              style={{ background:"#A8C5A0",border:"2.5px solid #6B4226",borderRadius:50,
                padding:"10px 22px",fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,
                color:"#3D2510",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226",whiteSpace:"nowrap" }}>
              mark complete
            </button>
          )}
          <button onClick={onClose}
            style={{ background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,
              padding:"10px 22px",fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,
              color:"white",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226",whiteSpace:"nowrap" }}>
            put it back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── JAR FULL MODAL ──────────────────────────────────────────────────────────

function JarFullModal({ tokens, onConfirm, onCancel, onOpenTV, atJarLimit = false }) {
  const [jarName, setJarName] = useState("");
  const [suggestion, setSuggestion] = useState(() => WHIMSICAL_NAMES[Math.floor(Math.random() * WHIMSICAL_NAMES.length)]);
  const canAfford = tokens >= 1;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(107,66,38,0.22)",backdropFilter:"blur(5px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:"1.5rem" }}
      onClick={onCancel}>
      <div style={{ background:"#FFFDF5",border:"3px solid #6B4226",borderRadius:20,
        width:"min(92vw,420px)",padding:"2rem 1.8rem",boxShadow:"6px 8px 0 #C9A87A" }}
        onClick={e => e.stopPropagation()}>
        {atJarLimit ? (
          <>
            <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(22px,4vw,30px)",
              color:"#3D2510",marginBottom:10,lineHeight:1.6,paddingBottom:4,overflow:"visible",display:"block" }}>
              your collection is full for now
            </p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#A07850",lineHeight:1.75,marginBottom:8 }}>
              you already have 5 jars — maybe there are still little things waiting to be rediscovered in the ones you have.
            </p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#B89070",lineHeight:1.65,marginBottom:20,fontStyle:"italic" }}>
              revisit one, complete a few thoughts, and a new jar will feel even more special when the time comes.
            </p>
            <button onClick={onCancel}
              style={{ width:"100%",background:"#E8C87A",border:"2.5px solid #6B4226",borderRadius:50,
                padding:"11px 0",fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,
                color:"#3D2510",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226" }}>
              back to my jars
            </button>
          </>
        ) : (
          <>
        <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(22px,4vw,30px)",
          color:"#3D2510",marginBottom:10,lineHeight:1.6,paddingBottom:4,overflow:"visible",display:"block" }}>
          create a new jar
        </p>
        <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#A07850",lineHeight:1.65,marginBottom:18 }}>
          {canAfford
            ? "a new jar costs 1 token. give it a name and keep going."
            : "you need 1 token to open a new jar. watch a cozy broadcast to earn one."}
        </p>
        {canAfford ? (
          <>
            <input value={jarName} onChange={e => {
                setJarName(e.target.value);
                if (e.target.value.trim().toLowerCase() === suggestion.toLowerCase()) {
                  let next; let t=0;
                  do { next = WHIMSICAL_NAMES[Math.floor(Math.random()*WHIMSICAL_NAMES.length)]; t++; }
                  while (next === suggestion && t < 30);
                  setSuggestion(next);
                }
              }}
              onKeyDown={e => e.key === "Enter" && onConfirm(jarName.trim() || suggestion)}
              placeholder={suggestion} maxLength={24}
              style={{ width:"100%",background:"white",border:"2.5px solid #6B4226",borderRadius:50,
                padding:"11px 20px",fontFamily:"var(--font-body)",fontSize:15,color:"#3D2510",
                outline:"none",boxShadow:"3px 4px 0 #C9A87A",textAlign:"center",marginBottom:10 }} />
            {/* Suggestion chip */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16 }}>
              <span style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#A07850" }}>or go with</span>
              <button onClick={() => {
                  setJarName(suggestion);
                  let next; let t=0; const cur=suggestion;
                  do { next = WHIMSICAL_NAMES[Math.floor(Math.random()*WHIMSICAL_NAMES.length)]; t++; }
                  while (next === cur && t < 30);
                  setSuggestion(next);
                }}
                style={{ background:"#FBF5E8",border:"1.8px solid #C9A87A",borderRadius:50,
                  padding:"4px 12px",fontFamily:"var(--font-hand)",fontSize:15,color:"#6B4226",
                  cursor:"pointer",whiteSpace:"nowrap" }}>
                {suggestion}
              </button>
              <button onClick={() => {
                  let next; let t=0;
                  do { next = WHIMSICAL_NAMES[Math.floor(Math.random()*WHIMSICAL_NAMES.length)]; t++; }
                  while (next === suggestion && t < 30);
                  setSuggestion(next);
                }}
                aria-label="shuffle name"
                style={{ background:"transparent",border:"1.8px solid #C9A87A",borderRadius:"50%",
                  width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",
                  justifyContent:"center",color:"#A07850",fontSize:13,flexShrink:0 }}>
                ↻
              </button>
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={() => onConfirm(jarName.trim() || suggestion)}
                style={{ flex:1,background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,
                  padding:"11px 0",fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,
                  color:"white",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226" }}>
                open new jar (1 token)
              </button>
              <button onClick={onCancel}
                style={{ background:"transparent",border:"2px solid #C9A87A",borderRadius:"50%",
                  width:44,height:44,flexShrink:0,fontFamily:"var(--font-body)",fontSize:16,
                  fontWeight:500,color:"#A07850",cursor:"pointer",display:"flex",
                  alignItems:"center",justifyContent:"center" }}>
                X
              </button>
            </div>
          </>
        ) : (
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={onOpenTV}
              style={{ flex:1,background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,
                padding:"11px 0",fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,
                color:"white",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226" }}>
              turn on cozy tv
            </button>
            <button onClick={onCancel}
              style={{ background:"transparent",border:"2px solid #C9A87A",borderRadius:"50%",
                width:44,height:44,flexShrink:0,fontFamily:"var(--font-body)",fontSize:16,
                fontWeight:500,color:"#A07850",cursor:"pointer",display:"flex",
                alignItems:"center",justifyContent:"center" }}>
              X
            </button>
          </div>
        )}
          </> 
        )}
      </div>
    </div>
  );
}

// ─── THOUGHTS LIST MODAL ─────────────────────────────────────────────────────

function ThoughtsListModal({ jars, onClose, onComplete, onDelete, onSwitchJar, activeJarId }) {
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // "all" shows every jar, or filter by jar id
  const [filterJar, setFilterJar] = useState("all");

  const displayThoughts = (filterJar === "all"
    ? jars.flatMap(jar => jar.thoughts.map(t => ({ ...t, jarName: jar.name, jarId: jar.id })))
    : (jars.find(j => j.id === filterJar)?.thoughts || []).map(t => ({
        ...t,
        jarName: jars.find(j => j.id === filterJar)?.name || "",
        jarId: filterJar,
      }))
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleTabClick = (jarId) => {
    setFilterJar(jarId);
    if (jarId !== "all") onSwitchJar(jarId);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(251,245,232,0.97)",backdropFilter:"blur(6px)",
      zIndex:200,display:"flex",flexDirection:"column",overflow:"clip" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"1rem 1.5rem 0.8rem",borderBottom:"2px solid #E8D8C0",flexShrink:0 }}>
        <h2 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(22px,4vw,30px)",color:"#3D2510",
            lineHeight:1.6,paddingBottom:6,overflow:"visible",display:"block" }}>
          all thoughts
        </h2>
        <button onClick={onClose}
          style={{ background:"#FBF5E8",border:"2px solid #6B4226",borderRadius:"50%",
            width:36,height:36,cursor:"pointer",fontFamily:"var(--font-body)",fontSize:16,
            fontWeight:500,color:"#6B4226",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          X
        </button>
      </div>

      {/* Mini-jar selector cards */}
      <div style={{ display:"flex",gap:10,overflowX:"auto",padding:"0.9rem 1.5rem",
        borderBottom:"2px solid #F0E4D0",flexShrink:0,
        scrollbarWidth:"none" }}>
        {/* "all jars" card */}
        <button onClick={() => setFilterJar("all")}
          style={{ background: filterJar==="all" ? "#FFF8EC" : "transparent",
            border:"2px solid " + (filterJar==="all" ? "#6B4226" : "#D4C5B0"),
            borderRadius:14,padding:"8px 12px",cursor:"pointer",flexShrink:0,
            display:"flex",flexDirection:"column",alignItems:"center",gap:4,
            boxShadow: filterJar==="all" ? "2px 3px 0 #C9A87A" : "none",
            transition:"all 0.15s" }}>
          {/* Stack of 3 tiny blobs to represent "all" */}
          <svg viewBox="0 0 36 28" width={36} height={28}>
            <ellipse cx={10} cy={20} rx={7} ry={6} fill="#F2A7B0" stroke="#6B4226" strokeWidth={1.2}/>
            <ellipse cx={22} cy={16} rx={6} ry={5} fill="#A8BFDF" stroke="#6B4226" strokeWidth={1.2}/>
            <ellipse cx={30} cy={22} rx={5} ry={4.5} fill="#F6E27A" stroke="#6B4226" strokeWidth={1.2}/>
          </svg>
          <span style={{ fontFamily:"var(--font-body)",fontSize:10,color: filterJar==="all"?"#3D2510":"#A07850",
            fontWeight: filterJar==="all"?600:400, whiteSpace:"nowrap" }}>all jars</span>
        </button>

        {jars.map((jar, idx) => {
          const variant = jar.id % 5;
          const fillPct = jar.thoughts.length / 25;
          const isActive = filterJar === jar.id;
          const isCurrentJar = jar.id === activeJarId;
          // Lid fill colors per variant
          const lidColors = ["#E8C87A","#F2A7B0","#A8C5A0","#F6E27A","#D4A5C9"];
          const lidColor = lidColors[variant];
          return (
            <button key={jar.id} onClick={() => handleTabClick(jar.id)}
              style={{ background: isActive ? "#FFF8EC" : "transparent",
                border:"2px solid " + (isActive ? "#6B4226" : "#D4C5B0"),
                borderRadius:14,padding:"8px 10px",cursor:"pointer",flexShrink:0,
                display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                boxShadow: isActive ? "2px 3px 0 #C9A87A" : "none",
                position:"relative",transition:"all 0.15s" }}>
              {/* Active jar dot */}
              {isCurrentJar && (
                <span style={{ position:"absolute",top:4,right:4,width:6,height:6,
                  borderRadius:"50%",background:"#E85D3A",border:"1px solid #6B4226" }} />
              )}
              {/* Mini jar SVG with lid variant + fill level */}
              <svg viewBox="0 0 38 48" width={38} height={48}>
                {/* Jar body */}
                <path d="M6,14 C5,16 4,19 4,23 C3,28 3,34 4,39 C5,42 7,44 11,45 C15,46 18,46 19,46 C20,46 23,46 27,45 C31,44 33,42 34,39 C35,34 35,28 34,23 C34,19 33,16 32,14 Z"
                  fill="#FFF8EC" stroke="#6B4226" strokeWidth={2} strokeLinejoin="round"/>
                {/* Fill level */}
                {fillPct > 0 && (
                  <clipPath id={`fill-${jar.id}`}>
                    <path d="M6,14 C5,16 4,19 4,23 C3,28 3,34 4,39 C5,42 7,44 11,45 C15,46 18,46 19,46 C20,46 23,46 27,45 C31,44 33,42 34,39 C35,34 35,28 34,23 C34,19 33,16 32,14 Z" />
                  </clipPath>
                )}
                {fillPct > 0 && (
                  <rect x={3} y={Math.max(14, 45 - fillPct * 30)} width={34} height={32}
                    fill="#FDE8C8" opacity={0.5} clipPath={`url(#fill-${jar.id})`} />
                )}
                {/* Neck */}
                <path d="M12,9 C11,10 9,12 9,14 L29,14 C29,12 27,10 26,9 Z"
                  fill="#FFF8EC" stroke="#6B4226" strokeWidth={1.8} strokeLinejoin="round"/>
                {/* Lid */}
                <rect x={9} y={5} width={20} height={6} rx={2} fill={lidColor} stroke="#6B4226" strokeWidth={1.8}/>
                {/* Lid knob */}
                <ellipse cx={19} cy={5} rx={4} ry={2} fill={lidColor} stroke="#6B4226" strokeWidth={1.5}
                  style={{ filter:"brightness(0.88)" }}/>
              </svg>
              <span style={{ fontFamily:"var(--font-body)",fontSize:10,color: isActive?"#3D2510":"#A07850",
                fontWeight: isActive?600:400,
                maxWidth:52,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                {jar.name}
              </span>
              <span style={{ fontFamily:"var(--font-body)",fontSize:9,color:"#B89070" }}>
                {jar.thoughts.length}/25
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ flex:1,overflowY:"auto",padding:"1rem 1.5rem",display:"flex",flexDirection:"column",gap:10 }}>
        {displayThoughts.length === 0 && (
          <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#A07850",textAlign:"center",marginTop:40 }}>
            no thoughts yet — add one to your jar!
          </p>
        )}
        {displayThoughts.map(t => (
          <div key={t.id}
            style={{ display:"flex",alignItems:"center",gap:12,background:"white",
              border:`2px solid ${t.completed ? "#D4C5B0" : "#E8D8C0"}`,borderRadius:16,
              padding:"10px 14px",opacity: t.completed ? 0.72 : 1 }}>
            <MiniBlob color={PASTEL_COLORS[t.colorIndex ?? 0]} seed={t.blobSeed ?? 0} completed={t.completed} />
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#3D2510",lineHeight:1.45,
                textDecoration: t.completed ? "line-through" : "none",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                {t.text}
              </p>
              <p style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#A07850",marginTop:2 }}>
                {t.jarName} · {new Date(t.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                {t.completed && " · done"}
              </p>
            </div>
            <div style={{ display:"flex",gap:6,flexShrink:0 }}>
              {!t.completed && (
                <button onClick={() => onComplete(t.jarId, t.id)}
                  title="mark complete"
                  style={{ background:"#A8C5A0",border:"1.8px solid #6B4226",borderRadius:50,
                    padding:"5px 10px",fontFamily:"var(--font-body)",fontSize:11,fontWeight:500,
                    color:"#3D2510",cursor:"pointer",whiteSpace:"nowrap" }}>
                  done
                </button>
              )}
              {deleteConfirm && deleteConfirm.jarId === t.jarId && deleteConfirm.thoughtId === t.id ? (
                <div style={{ display:"flex",gap:4 }}>
                  <button onClick={() => { onDelete(t.jarId, t.id); setDeleteConfirm(null); }}
                    style={{ background:"#E85D3A",border:"1.8px solid #6B4226",borderRadius:50,
                      padding:"5px 10px",fontFamily:"var(--font-body)",fontSize:11,fontWeight:500,
                      color:"white",cursor:"pointer" }}>
                    yes, delete
                  </button>
                  <button onClick={() => setDeleteConfirm(null)}
                    style={{ background:"#FBF5E8",border:"1.8px solid #C9A87A",borderRadius:50,
                      padding:"5px 10px",fontFamily:"var(--font-body)",fontSize:11,
                      color:"#A07850",cursor:"pointer" }}>
                    keep
                  </button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm({ jarId: t.jarId, thoughtId: t.id })}
                  title="delete thought"
                  style={{ background:"transparent",border:"1.8px solid #D4C5B0",borderRadius:"50%",
                    width:30,height:30,cursor:"pointer",fontFamily:"var(--font-body)",fontSize:14,
                    color:"#C9A87A",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TV AD POPUP ─────────────────────────────────────────────────────────────

function FloatingCoin({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 1200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
      zIndex:500,pointerEvents:"none",animation:"coinFloat 1.2s cubic-bezier(0.22,1,0.36,1) forwards" }}>
      <style>{`@keyframes coinFloat{0%{opacity:0;transform:translate(-50%,-50%) scale(0.4)}25%{opacity:1;transform:translate(-50%,-80%) scale(1.3)}65%{opacity:1;transform:translate(-50%,-140%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-200%) scale(0.9)}}`}</style>
      <svg viewBox="0 0 64 64" width={64} height={64}>
        <circle cx={32} cy={32} r={30} fill="#F6C94A" stroke="#6B4226" strokeWidth={3} />
        <circle cx={32} cy={32} r={22} fill="#EDAE1C" stroke="#6B4226" strokeWidth={1.5} opacity={0.7} />
        <polygon points="32,16 35.5,27 47,27 38,34 41,45 32,38 23,45 26,34 17,27 28.5,27"
          fill="#FDE78A" stroke="#6B4226" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const ADS = [
  { bg:"#A8C5A0", label:"brought to you by", brand:"cozy corner candles", tagline:"hand-poured, small-batch, very sleepy", icon:"candle" },
  { bg:"#F7C59F", label:"a message from",    brand:"nap cloud pillows",    tagline:"scientifically proven to be very soft", icon:"pillow" },
  { bg:"#A8BFDF", label:"today's sponsor",   brand:"wandering teapot co.", tagline:"pour slowly. think less. sip more.", icon:"teapot" },
];

function AdIllustration({ icon }) {
  if (icon === "candle") return (
    <svg viewBox="0 0 80 90" width={80} height={90}>
      <ellipse cx={40} cy={20} rx={7} ry={10} fill="#F6C94A" stroke="#6B4226" strokeWidth={1.5} />
      <ellipse cx={40} cy={24} rx={3.5} ry={5} fill="#FDE78A" />
      <line x1={40} y1={30} x2={40} y2={36} stroke="#6B4226" strokeWidth={1.8} strokeLinecap="round" />
      <rect x={28} y={36} width={24} height={42} rx={6} fill="#FFF8EC" stroke="#6B4226" strokeWidth={2} />
      <ellipse cx={34} cy={38} rx={3} ry={4} fill="#FFF8EC" stroke="#6B4226" strokeWidth={1.5} />
      <ellipse cx={48} cy={40} rx={2.5} ry={3.5} fill="#FFF8EC" stroke="#6B4226" strokeWidth={1.5} />
    </svg>
  );
  if (icon === "pillow") return (
    <svg viewBox="0 0 90 70" width={90} height={70}>
      <rect x={8} y={12} width={74} height={48} rx={20} fill="#D4A5C9" stroke="#6B4226" strokeWidth={2.5} />
      <path d="M45,18 C38,30 38,42 45,54" fill="none" stroke="#6B4226" strokeWidth={1.5} strokeDasharray="3,3" opacity={0.4} />
      <ellipse cx={22} cy={26} rx={8} ry={6} fill="#D4A5C9" stroke="#6B4226" strokeWidth={1.5} />
      <ellipse cx={68} cy={26} rx={8} ry={6} fill="#D4A5C9" stroke="#6B4226" strokeWidth={1.5} />
      <ellipse cx={22} cy={50} rx={8} ry={6} fill="#D4A5C9" stroke="#6B4226" strokeWidth={1.5} />
      <ellipse cx={68} cy={50} rx={8} ry={6} fill="#D4A5C9" stroke="#6B4226" strokeWidth={1.5} />
    </svg>
  );
  return (
    <svg viewBox="0 0 90 80" width={90} height={80}>
      <ellipse cx={42} cy={50} rx={30} ry={24} fill="#A8BFDF" stroke="#6B4226" strokeWidth={2.5} />
      <path d="M70,44 C80,40 84,34 80,28" fill="none" stroke="#6B4226" strokeWidth={3} strokeLinecap="round" />
      <path d="M14,42 C4,40 2,56 14,58" fill="none" stroke="#6B4226" strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={42} cy={27} rx={18} ry={6} fill="#A8BFDF" stroke="#6B4226" strokeWidth={2} />
      <ellipse cx={42} cy={22} rx={5} ry={4} fill="#7B9BAA" stroke="#6B4226" strokeWidth={1.8} />
      <path d="M76,24 C74,18 78,14 76,8" fill="none" stroke="#6B4226" strokeWidth={1.5} strokeLinecap="round" opacity={0.45} />
    </svg>
  );
}

const AD_DURATION = 15;

function TVAdPopup({ onClose, onEarnToken }) {
  const adIndex  = useRef(Math.floor(Math.random() * ADS.length)).current;
  const ad       = ADS[adIndex];
  const [secondsLeft, setSecondsLeft] = useState(AD_DURATION);
  const [done,      setDone]      = useState(false);
  const [rewarded,  setRewarded]  = useState(false);
  const [showCoin,  setShowCoin]  = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current); setDone(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleClaim = () => {
    if (!done || rewarded) return;
    setRewarded(true); setShowCoin(true); onEarnToken();
  };
  const progress = ((AD_DURATION - secondsLeft) / AD_DURATION) * 100;

  return (
    <>
      <div style={{ position:"fixed",inset:0,background:"rgba(61,37,16,0.45)",backdropFilter:"blur(5px)",
        zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem" }}
        onClick={done && rewarded ? onClose : undefined}>
        <div style={{ background:"#FBF5E8",border:"3px solid #6B4226",borderRadius:20,
          width:"min(92vw,420px)",boxShadow:"6px 8px 0 #C9A87A" }}
          onClick={e => e.stopPropagation()}>

          <div style={{ background:"#3D2510",padding:"8px 18px",display:"flex",
            alignItems:"center",justifyContent:"space-between",
            borderRadius:"16px 16px 0 0" }}>
            <span className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:24,color:"#F6C94A",letterSpacing:1,
              lineHeight:1.6,paddingBottom:4,overflow:"visible",display:"inline-block" }}>
              ch. 7 — cozy tv
            </span>
            <div style={{ display:"flex",gap:6,alignItems:"center" }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"#E85D3A" }} />
              <span style={{ fontFamily:"var(--font-body)",fontSize:10,color:"#F6C94A",opacity:0.8 }}>live</span>
            </div>
          </div>

          <div style={{ background:ad.bg,padding:"28px 24px 22px",display:"flex",flexDirection:"column",
            alignItems:"center",gap:10,borderBottom:"2.5px solid #6B4226" }}>
            <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#6B4226",opacity:0.7,letterSpacing:1 }}>
              {ad.label}
            </p>
            <AdIllustration icon={ad.icon} />
            <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:28,color:"#3D2510",textAlign:"center",lineHeight:1.6,paddingBottom:6,overflow:"visible" }}>
              {ad.brand}
            </p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#6B4226",opacity:0.75,textAlign:"center",fontStyle:"italic" }}>
              {ad.tagline}
            </p>
          </div>

          <div style={{ padding:"18px 24px 22px",display:"flex",flexDirection:"column",gap:14 }}>
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center" }}>
                <span style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#A07850" }}>
                  {done ? "ready to claim!" : "watch to earn a token"}
                </span>
                <span style={{ fontFamily:"var(--font-body)",fontSize:16,fontWeight:500,
                  color: done ? "#4A8C50" : "#C87A50",transition:"color 0.4s" }}>
                  {done ? "done!" : `${secondsLeft}s`}
                </span>
              </div>
              <div style={{ height:10,background:"#E8D8C0",borderRadius:50,border:"1.5px solid #6B4226",overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${progress}%`,background: done ? "#A8C5A0" : "#F6C94A",
                  borderRadius:50,transition:"width 1s linear, background 0.4s" }} />
              </div>
            </div>
            <div style={{ display:"flex",gap:10 }}>
              {!rewarded ? (
                <button onClick={handleClaim} disabled={!done}
                  style={{ flex:1,background: done ? "#E85D3A" : "#D4C5B0",border:"2.5px solid #6B4226",
                    borderRadius:50,padding:"11px 0",fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,
                    color: done ? "white" : "#A09080",cursor: done ? "pointer" : "not-allowed",
                    boxShadow: done ? "3px 4px 0 #6B4226" : "none",transition:"background 0.3s, box-shadow 0.3s",
                    whiteSpace:"nowrap" }}>
                  {done ? "claim token" : "watching..."}
                </button>
              ) : (
                <button onClick={onClose}
                  style={{ flex:1,background:"#A8C5A0",border:"2.5px solid #6B4226",borderRadius:50,
                    padding:"11px 0",fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,
                    color:"#3D2510",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226",whiteSpace:"nowrap" }}>
                  token earned
                </button>
              )}
              <button onClick={onClose} aria-label="close"
                style={{ background:"transparent",border:"2px solid #C9A87A",borderRadius:"50%",
                  width:44,height:44,flexShrink:0,fontFamily:"var(--font-body)",fontSize:16,fontWeight:500,
                  color:"#A07850",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  lineHeight:1.3 }}>
                X
              </button>
            </div>
          </div>
        </div>
      </div>
      {showCoin && <FloatingCoin onDone={() => setShowCoin(false)} />}
    </>
  );
}

// ─── ADD THOUGHT INPUT ───────────────────────────────────────────────────────

function AddThoughtInput({ onAdd, disabled = false }) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onAdd(text.trim()); setText("");
    inputRef.current?.focus();
  };

  return (
    <div style={{ display:"flex",alignItems:"center",gap:10,background:"white",
      border:`2.5px solid ${isFocused && !disabled ? "#C87A50" : "#6B4226"}`,
      borderRadius:50,padding:"10px 12px 10px 22px",width:"100%",maxWidth:480,
      boxShadow: isFocused && !disabled ? "4px 5px 0px #C9A87A" : "3px 4px 0px #C9A87A",
      transition:"box-shadow 0.2s, border-color 0.2s",
      opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
        onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        placeholder="drop a thought in the jar…" maxLength={280}
        style={{ flex:1,border:"none",outline:"none",background:"transparent",
          fontFamily:"var(--font-body)",fontSize:17,color:"#3D2510",caretColor:"#C87A50" }}
        aria-label="type your thought" />
      <button onClick={handleSubmit} disabled={!text.trim()}
        style={{ background: text.trim() ? "#E85D3A" : "#D4C5B0",border:"2.5px solid #6B4226",
          borderRadius:50,width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",
          cursor: text.trim() ? "pointer" : "not-allowed",transition:"background 0.2s",flexShrink:0,
          boxShadow: text.trim() ? "2px 3px 0 #6B4226" : "none" }} aria-label="add thought">
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth={2.8} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function Toast({ message, visible }) {
  return (
    <div style={{ position:"fixed",bottom:32,left:"50%",
      transform:`translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      opacity: visible ? 1 : 0,transition:"all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      background:"#3D2510",color:"white",fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,
      padding:"10px 24px",borderRadius:50,pointerEvents:"none",zIndex:200,whiteSpace:"nowrap" }}
      role="status" aria-live="polite">
      {message}
    </div>
  );
}

// ─── LOCKED OVERLAY ──────────────────────────────────────────────────────────

function LockedOverlay({ onOpenTV }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(251,245,232,0.88)",
      backdropFilter:"blur(6px)",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",zIndex:400,gap:24,padding:"2rem 1.5rem",textAlign:"center" }}>
      <svg viewBox="0 0 110 140" width={100} height={130} style={{ opacity:0.55,filter:"grayscale(0.3)" }}>
        <ellipse cx={55} cy={137} rx={32} ry={5} fill="#C9A87A" opacity={0.15} />
        <path d="M24,42 C21,46 18,55 17,66 C15,80 15,96 16,110 C17,122 19,130 22,134 C25,138 29,140 38,141 C46,142 50,143 55,143 C60,143 64,142 72,141 C81,140 85,138 88,134 C91,130 93,122 94,110 C95,96 95,80 93,66 C92,55 89,46 86,42 Z"
          fill="#EDE8DA" stroke="#6B4226" strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M34,28 C31,30 28,34 27,39 C25,41 25,42 24,42 L86,42 C85,42 85,41 83,39 C82,34 79,30 76,28 Z"
          fill="#EDE8DA" stroke="#6B4226" strokeWidth={2.5} strokeLinejoin="round" />
        <rect x={28} y={17} width={54} height={13} rx={4} fill="#D4C5A0" stroke="#6B4226" strokeWidth={2.5} />
        <ellipse cx={55} cy={17} rx={8} ry={4} fill="#C4A840" stroke="#6B4226" strokeWidth={2} />
        <text x={68} y={75} fontFamily="'MyFreehandFont5'" fontSize={18} fill="#6B4226" opacity={0.4}>z</text>
        <text x={76} y={60} fontFamily="'MyFreehandFont5'" fontSize={13} fill="#6B4226" opacity={0.3}>z</text>
        <text x={82} y={48} fontFamily="'MyFreehandFont5'" fontSize={10} fill="#6B4226" opacity={0.2}>z</text>
      </svg>
      <h2 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(26px,5vw,38px)",color:"#3D2510",lineHeight:1.6,paddingBottom:6,overflow:"visible",display:"block" }}>
        the jar is resting
      </h2>
      <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",color:"#A07850",lineHeight:1.7,maxWidth:340 }}>
        turn on cozy tv to keep the jar glowing — a short broadcast unlocks another day.
      </p>
      <button onClick={onOpenTV}
        style={{ background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,
          padding:"12px 36px",fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,
          color:"white",cursor:"pointer",boxShadow:"4px 5px 0 #6B4226" }}>
        turn on cozy tv
      </button>
    </div>
  );
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────

function PulsingBlob({ color, style: s }) {
  return (
    <div style={{ width:120,height:120,borderRadius:"62% 38% 55% 45% / 48% 58% 42% 52%",
      background:color,border:"2.5px solid #6B4226",animation:"blobPulse 3.5s ease-in-out infinite",...s }} />
  );
}

function OnboardingFlow({ onComplete }) {
  const [screen, setScreen] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [suggestion, setSuggestion] = useState(() =>
    WHIMSICAL_NAMES[Math.floor(Math.random() * WHIMSICAL_NAMES.length)]
  );
  const inputRef = useRef(null);

  const advance = (next) => {
    setLeaving(true);
    setTimeout(() => { setLeaving(false); setScreen(next); }, 320);
  };
  const handleNicknameSubmit = () => {
    const chosen = nicknameInput.trim() || suggestion;
    onComplete(chosen);
  };
  const refreshSuggestion = (currentInput) => {
    const typed = typeof currentInput === "string" ? currentInput.trim().toLowerCase() : nicknameInput.trim().toLowerCase();
    let next;
    let tries = 0;
    do {
      next = WHIMSICAL_NAMES[Math.floor(Math.random() * WHIMSICAL_NAMES.length)];
      tries++;
    } while ((next === suggestion || next.toLowerCase() === typed) && tries < 30);
    setSuggestion(next);
  };
  useEffect(() => {
    if (screen === 4 && inputRef.current) setTimeout(() => inputRef.current?.focus(), 350);
  }, [screen]);

  const screenStyle = {
    opacity: leaving ? 0 : 1,
    transform: leaving ? "translateY(12px)" : "translateY(0)",
    transition: "opacity 0.32s ease, transform 0.32s ease",
    display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:24,maxWidth:420,width:"100%",overflow:"visible",
  };

  const btn = (label, onClick) => (
    <button onClick={onClick}
      style={{ background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,padding:"13px 40px",
        fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,color:"white",cursor:"pointer",
        boxShadow:"4px 5px 0 #6B4226",whiteSpace:"nowrap",marginTop:8 }}>
      {label}
    </button>
  );

  return (
    <div style={{ position:"fixed",inset:0,background:"#FBF5E8",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",zIndex:900,padding:"2rem 1.5rem" }}>
      <style>{`
        @keyframes blobPulse{0%,100%{transform:scale(1) rotate(-2deg);border-radius:62% 38% 55% 45% / 48% 58% 42% 52%}50%{transform:scale(1.06) rotate(2deg);border-radius:48% 52% 40% 60% / 58% 44% 56% 42%}}
        @keyframes floatUp{0%{opacity:0;transform:translateY(18px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>
      <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.06,pointerEvents:"none" }}>
        <pattern id="ob-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#6B4226" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#ob-dots)" />
      </svg>
      <div style={{ position:"absolute",bottom:40,display:"flex",gap:10 }}>
        {[1,2,3,4].map(n => (
          <div key={n} style={{ width: n===screen?22:8, height:8, borderRadius:50,
            background: n===screen?"#E85D3A":"#D4C5B0", border:"1.5px solid #6B4226",
            transition:"all 0.3s ease" }} />
        ))}
      </div>
      <div style={screenStyle}>
        {screen===1 && <>
          <svg viewBox="0 0 110 155" width={110} height={155} style={{ animation:"floatUp 0.6s ease both" }}>
            <ellipse cx={55} cy={137} rx={32} ry={5} fill="#C9A87A" opacity={0.22} />
            <path d="M24,42 C21,46 18,55 17,66 C15,80 15,96 16,110 C17,122 19,130 22,134 C25,138 29,140 38,141 C46,142 50,143 55,143 C60,143 64,142 72,141 C81,140 85,138 88,134 C91,130 93,122 94,110 C95,96 95,80 93,66 C92,55 89,46 86,42 Z" fill="#FFF8EC" stroke="#6B4226" strokeWidth={2.5} strokeLinejoin="round" />
            <path d="M34,28 C31,30 28,34 27,39 C25,41 25,42 24,42 L86,42 C85,42 85,41 83,39 C82,34 79,30 76,28 Z" fill="#FFF8EC" stroke="#6B4226" strokeWidth={2.5} strokeLinejoin="round" />
            <rect x={28} y={17} width={54} height={13} rx={4} fill="#E8C87A" stroke="#6B4226" strokeWidth={2.5} />
            <ellipse cx={55} cy={17} rx={8} ry={4} fill="#D4A840" stroke="#6B4226" strokeWidth={2} />
            <clipPath id="ob-jar"><path d="M27,45 C24,55 21,70 20,85 C18,102 18,115 19,126 C21,134 25,138 33,139 C42,141 48,141 55,141 C62,141 68,141 77,139 C85,138 89,134 91,126 C92,115 92,102 90,85 C89,70 86,55 83,45 Z" /></clipPath>
            <g clipPath="url(#ob-jar)">
              <ellipse cx={40} cy={120} rx={12} ry={10} fill="#F2A7B0" stroke="#6B4226" strokeWidth={1.2} />
              <ellipse cx={65} cy={112} rx={10} ry={9} fill="#A8BFDF" stroke="#6B4226" strokeWidth={1.2} />
              <ellipse cx={52} cy={126} rx={9} ry={8} fill="#F6E27A" stroke="#6B4226" strokeWidth={1.2} />
            </g>
            <path d="M26,55 C25,65 24,78 25,88" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
          </svg>
          <h1 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(34px,6vw,52px)",color:"#3D2510",lineHeight:1.6,paddingBottom:10,overflow:"visible",display:"block",animation:"floatUp 0.6s ease 0.1s both" }}>welcome to thought jar</h1>
          <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(14px,2.2vw,17px)",color:"#A07850",lineHeight:1.65,animation:"floatUp 0.6s ease 0.2s both" }}>a tiny home for wandering thoughts</p>
          {btn("open the jar", () => advance(2))}
        </>}
        {screen===2 && <>
          <div style={{ display:"flex",gap:16,animation:"floatUp 0.6s ease both" }}>
            <PulsingBlob color="#F2A7B0" style={{ width:80,height:80 }} />
            <PulsingBlob color="#A8BFDF" style={{ width:64,height:64,marginTop:24,animationDelay:"0.6s" }} />
            <PulsingBlob color="#F6E27A" style={{ width:72,height:72,marginTop:10,animationDelay:"1.2s" }} />
          </div>
          <h2 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(28px,5vw,42px)",color:"#3D2510",lineHeight:1.6,paddingBottom:10,overflow:"visible",display:"block",animation:"floatUp 0.6s ease 0.1s both" }}>drop little thoughts in</h2>
          <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(14px,2.2vw,16px)",color:"#A07850",lineHeight:1.7,animation:"floatUp 0.6s ease 0.2s both" }}>type anything — a feeling, an idea, a small wonder. click the jar later to rediscover them.</p>
          {btn("got it", () => advance(3))}
        </>}
        {screen===3 && <>
          {/* Token coin + TV side by side — shows the relationship visually */}
          <div style={{ display:"flex",alignItems:"center",gap:18,animation:"floatUp 0.6s ease both" }}>
            {/* Coin */}
            <svg viewBox="0 0 72 72" width={72} height={72}>
              <circle cx={36} cy={36} r={32} fill="#F6C94A" stroke="#6B4226" strokeWidth={2.5} />
              <circle cx={36} cy={36} r={24} fill="#EDAE1C" stroke="#6B4226" strokeWidth={1.2} opacity={0.6} />
              <polygon points="36,19 38.8,29 50,29 41.5,35 44.3,45 36,39 27.7,45 30.5,35 22,29 33.2,29"
                fill="#FDE78A" stroke="#6B4226" strokeWidth={1.4} strokeLinejoin="round" />
            </svg>
            {/* Arrow */}
            <svg viewBox="0 0 28 18" width={22} height={14}>
              <path d="M2,9 L20,9 M14,3 L22,9 L14,15" fill="none" stroke="#C9A87A" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {/* Mini TV */}
            <svg viewBox="0 0 72 68" width={68} height={64}>
              <rect x={4} y={10} width={58} height={46} rx={6} fill="#D4C5B0" stroke="#6B4226" strokeWidth={2.2} />
              <rect x={11} y={16} width={38} height={29} rx={3} fill="#7B9BAA" stroke="#6B4226" strokeWidth={1.8} />
              <rect x={11} y={16} width={38} height={29} rx={3} fill="white" opacity={0.12} />
              <line x1={26} y1={10} x2={18} y2={2} stroke="#6B4226" strokeWidth={2} strokeLinecap="round"/>
              <line x1={36} y1={10} x2={44} y2={2} stroke="#6B4226" strokeWidth={2} strokeLinecap="round"/>
              <circle cx={57} cy={27} r={4} fill="#B8A88A" stroke="#6B4226" strokeWidth={1.5}/>
              <circle cx={57} cy={27} r={1.5} fill="#6B4226"/>
              <circle cx={57} cy={42} r={4} fill="#B8A88A" stroke="#6B4226" strokeWidth={1.5}/>
              <circle cx={57} cy={42} r={1.5} fill="#6B4226"/>
              <rect x={16} y={56} width={7} height={8} rx={2} fill="#B8A88A" stroke="#6B4226" strokeWidth={1.5}/>
              <rect x={40} y={56} width={7} height={8} rx={2} fill="#B8A88A" stroke="#6B4226" strokeWidth={1.5}/>
            </svg>
          </div>
          <h2 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(28px,5vw,42px)",color:"#3D2510",lineHeight:1.6,paddingBottom:10,overflow:"visible",display:"block",animation:"floatUp 0.6s ease 0.1s both" }}>keeping the jar glowing</h2>
          <div style={{ display:"flex",flexDirection:"column",gap:12,animation:"floatUp 0.6s ease 0.2s both" }}>
            <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(14px,2.2vw,16px)",color:"#A07850",lineHeight:1.7 }}>you'll start with <strong style={{ color:"#3D2510" }}>7 free days</strong> on us — our little welcome gift.</p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(14px,2.2vw,16px)",color:"#A07850",lineHeight:1.7 }}>after that, watching a short cozy broadcast on the little tv unlocks another day with the jar.</p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",color:"#B89070",lineHeight:1.6,fontStyle:"italic" }}>no accounts, no pressure — just a quiet little exchange that keeps this place alive.</p>
          </div>
          {btn("keep the jar glowing", () => advance(4))}
        </>}
        {screen===4 && <>
          <svg viewBox="0 0 70 88" width={70} height={88} style={{ animation:"floatUp 0.6s ease both" }}>
            <path d="M15,27 C13,30 11,36 10,44 C9,54 9,64 10,72 C11,79 13,83 16,85 C19,87 24,88 35,88 C46,88 51,87 54,85 C57,83 59,79 60,72 C61,64 61,54 60,44 C59,36 57,30 55,27 Z" fill="#FFF8EC" stroke="#6B4226" strokeWidth={2} strokeLinejoin="round"/>
            <path d="M22,17 C20,19 18,22 17,25 C16,26 15,27 15,27 L55,27 C55,27 54,26 53,25 C52,22 50,19 48,17 Z" fill="#FFF8EC" stroke="#6B4226" strokeWidth={2} strokeLinejoin="round"/>
            <rect x={18} y={10} width={34} height={9} rx={3} fill="#E8C87A" stroke="#6B4226" strokeWidth={2}/>
            <ellipse cx={35} cy={10} rx={6} ry={3} fill="#D4A840" stroke="#6B4226" strokeWidth={1.8}/>
          </svg>
          <h2 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(24px,4.5vw,38px)",color:"#3D2510",lineHeight:1.6,paddingBottom:10,overflow:"visible",display:"block",animation:"floatUp 0.6s ease 0.1s both" }}>what should we name the jar?</h2>
          <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",color:"#A07850",lineHeight:1.65,animation:"floatUp 0.6s ease 0.15s both" }}>something cozy, silly, or entirely made up</p>
          <div style={{ width:"100%",display:"flex",flexDirection:"column",gap:12,animation:"floatUp 0.6s ease 0.2s both" }}>
            <input ref={inputRef} value={nicknameInput} onChange={e => {
                setNicknameInput(e.target.value);
                if (e.target.value.trim().toLowerCase() === suggestion.toLowerCase()) refreshSuggestion(e.target.value);
              }}
              onKeyDown={e => e.key==="Enter" && handleNicknameSubmit()}
              placeholder={suggestion} maxLength={28}
              style={{ width:"100%",background:"white",border:"2.5px solid #6B4226",borderRadius:50,
                padding:"12px 24px",fontFamily:"var(--font-body)",fontSize:16,color:"#3D2510",
                outline:"none",boxShadow:"3px 4px 0 #C9A87A",textAlign:"center",caretColor:"#C87A50" }}
              aria-label="enter your nickname" />
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <span style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#A07850" }}>or go with</span>
              <button onClick={() => {
                  setNicknameInput(suggestion);
                  // After placing into input, pick a fresh suggestion
                  let next;
                  let t = 0;
                  const cur = suggestion;
                  do {
                    next = WHIMSICAL_NAMES[Math.floor(Math.random() * WHIMSICAL_NAMES.length)];
                    t++;
                  } while (next === cur && t < 30);
                  setSuggestion(next);
                }}
                style={{ background:"#FBF5E8",border:"1.8px solid #C9A87A",borderRadius:50,
                  padding:"5px 14px",fontFamily:"var(--font-hand)",fontSize:16,color:"#6B4226",
                  cursor:"pointer",whiteSpace:"nowrap" }}>
                {suggestion}
              </button>
              <button onClick={refreshSuggestion} aria-label="shuffle name"
                style={{ background:"transparent",border:"1.8px solid #C9A87A",borderRadius:"50%",
                  width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",
                  justifyContent:"center",color:"#A07850",fontSize:14,flexShrink:0 }}>
                ↻
              </button>
            </div>
          </div>
          <button onClick={handleNicknameSubmit}
            style={{ background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,padding:"13px 40px",
              fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,color:"white",cursor:"pointer",
              boxShadow:"4px 5px 0 #6B4226",whiteSpace:"nowrap",marginTop:4 }}>
            open my jar
          </button>
        </>}
      </div>
    </div>
  );
}

// ─── INFO BUTTON ────────────────────────────────────────────────────────────

function InfoButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="about thought jar"
      style={{ background:"#FFF8EC",border:"2px solid #C9A87A",borderRadius:"50%",
        width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0,WebkitTapHighlightColor:"transparent",
        touchAction:"manipulation" }}>
      <svg viewBox="0 0 20 20" width={14} height={14}>
        <circle cx={10} cy={10} r={9} fill="none" stroke="#A07850" strokeWidth={1.8}/>
        <line x1={10} y1={8.5} x2={10} y2={14} stroke="#A07850" strokeWidth={2} strokeLinecap="round"/>
        <circle cx={10} cy={6} r={1.2} fill="#A07850"/>
      </svg>
    </button>
  );
}

// ─── NEW JAR BUTTON ──────────────────────────────────────────────────────────

function NewJarButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="create new jar"
      style={{ background:"#FFF8EC",border:"2px solid #C9A87A",borderRadius:"50%",
        width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0,WebkitTapHighlightColor:"transparent",
        touchAction:"manipulation" }}>
      <svg viewBox="0 0 20 20" width={15} height={15}>
        {/* Mini jar body */}
        <path d="M4,8 C3,9 3,11 3,13 C3,15 4,16 6,16.5 C7.5,17 9,17 10,17 C11,17 12.5,17 14,16.5 C16,16 17,15 17,13 C17,11 17,9 16,8 Z"
          fill="none" stroke="#A07850" strokeWidth={1.5} strokeLinejoin="round"/>
        {/* Jar neck */}
        <path d="M6.5,5.5 L6,8 L14,8 L13.5,5.5 Z" fill="none" stroke="#A07850" strokeWidth={1.5} strokeLinejoin="round"/>
        {/* Lid */}
        <rect x={6} y={3.5} width={8} height={2.5} rx={1} fill="none" stroke="#A07850" strokeWidth={1.3}/>
        {/* Plus sign overlay */}
        <line x1={10} y1={10} x2={10} y2={14.5} stroke="#A07850" strokeWidth={1.5} strokeLinecap="round"/>
        <line x1={7.8} y1={12.2} x2={12.2} y2={12.2} stroke="#A07850" strokeWidth={1.5} strokeLinecap="round"/>
      </svg>
    </button>
  );
}

// ─── HOME SCREEN BUTTON ─────────────────────────────────────────────────────

function HomeScreenButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="add to home screen"
      style={{ background:"#FFF8EC",border:"2px solid #C9A87A",borderRadius:"50%",
        width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0,
        WebkitTapHighlightColor:"transparent",touchAction:"manipulation" }}>
      <svg viewBox="0 0 20 20" width={15} height={15}>
        {/* Phone outline */}
        <rect x={4} y={1} width={12} height={17} rx={2.5} fill="none" stroke="#A07850" strokeWidth={1.5}/>
        {/* Home button dot */}
        <circle cx={10} cy={15.5} r={1} fill="#A07850"/>
        {/* Plus sign on screen */}
        <line x1={10} y1={5.5} x2={10} y2={11} stroke="#A07850" strokeWidth={1.4} strokeLinecap="round"/>
        <line x1={7.2} y1={8.2} x2={12.8} y2={8.2} stroke="#A07850" strokeWidth={1.4} strokeLinecap="round"/>
      </svg>
    </button>
  );
}

// ─── HOME SCREEN MODAL ───────────────────────────────────────────────────────

function HomeScreenModal({ onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(107,66,38,0.25)",backdropFilter:"blur(5px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:"1.5rem" }}
      onClick={onClose}>
      <div style={{ background:"#FFFDF5",border:"2.5px solid #6B4226",borderRadius:20,
        width:"min(92vw,400px)",padding:"2rem 1.8rem",boxShadow:"6px 8px 0 #C9A87A" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
          <svg viewBox="0 0 24 24" width={24} height={24}>
            <rect x={4} y={1} width={16} height={22} rx={3} fill="none" stroke="#6B4226" strokeWidth={1.8}/>
            <circle cx={12} cy={19.5} r={1.2} fill="#6B4226"/>
            <line x1={12} y1={7} x2={12} y2={14} stroke="#6B4226" strokeWidth={1.8} strokeLinecap="round"/>
            <line x1={8.5} y1={10.5} x2={15.5} y2={10.5} stroke="#6B4226" strokeWidth={1.8} strokeLinecap="round"/>
          </svg>
          <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(18px,3.5vw,24px)",
            color:"#3D2510",lineHeight:1.5,overflow:"visible",paddingBottom:2 }}>
            add to home screen
          </p>
        </div>

        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          {/* iPhone */}
          <div style={{ background:"#FBF5E8",borderRadius:12,padding:"12px 14px",border:"1.5px solid #E8D8C0" }}>
            <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#A07850",marginBottom:6,fontWeight:600,letterSpacing:0.3 }}>
              on iphone
            </p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#5C3D22",lineHeight:1.7 }}>
              open this page in <strong>safari</strong>, tap the{" "}
              <span style={{ display:"inline-flex",alignItems:"center",gap:2,verticalAlign:"middle" }}>
                <svg viewBox="0 0 16 16" width={14} height={14} style={{ display:"inline-block" }}>
                  <rect x={2} y={7} width={12} height={8} rx={1.5} fill="none" stroke="#6B4226" strokeWidth={1.2}/>
                  <line x1={8} y1={1} x2={8} y2={10} stroke="#6B4226" strokeWidth={1.2} strokeLinecap="round"/>
                  <polyline points="5,3.5 8,1 11,3.5" fill="none" stroke="#6B4226" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>{" "}
              share button, then choose <strong>add to home screen</strong>.
            </p>
          </div>

          {/* Android */}
          <div style={{ background:"#FBF5E8",borderRadius:12,padding:"12px 14px",border:"1.5px solid #E8D8C0" }}>
            <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#A07850",marginBottom:6,fontWeight:600,letterSpacing:0.3 }}>
              on android
            </p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#5C3D22",lineHeight:1.7 }}>
              open this page in <strong>chrome</strong>, tap the <strong>⋮</strong> menu in the top right, then choose <strong>add to home screen</strong>.
            </p>
          </div>

          <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#B89070",lineHeight:1.6,fontStyle:"italic",textAlign:"center" }}>
            once added, it will feel just like a real app.
          </p>
        </div>

        <button onClick={onClose}
          style={{ marginTop:18,width:"100%",background:"#E8C87A",border:"2px solid #6B4226",
            borderRadius:50,padding:"10px 0",fontFamily:"var(--font-body)",fontSize:14,
            fontWeight:500,color:"#3D2510",cursor:"pointer",boxShadow:"2px 3px 0 #6B4226" }}>
          got it
        </button>
      </div>
    </div>
  );
}

// ─── INFO MODAL ──────────────────────────────────────────────────────────────

// Reusable mini hand-drawn heart SVG
function TinyHeart() {
  return (
    <svg viewBox="0 0 22 20" width={20} height={18} style={{ flexShrink:0, display:"inline-block", verticalAlign:"middle" }}>
      <path d="M11,17 C11,17 2,10.5 2,5.5 C2,3 3.8,1 6,1 C7.6,1 9,2 11,4 C13,2 14.4,1 16,1 C18.2,1 20,3 20,5.5 C20,10.5 11,17 11,17 Z"
        fill="#F2A7B0" stroke="#6B4226" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M5.5,5 C6.2,3.8 7.6,3.5 8.5,4.2"
        fill="none" stroke="white" strokeWidth={1} strokeLinecap="round" opacity={0.55}/>
    </svg>
  );
}

function InfoModal({ onClose }) {
  const [page, setPage] = useState("note"); // "note" | "howto" | "settings"
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleReset = () => {
    // Clear all app localStorage keys
    [
      "tj-jars","tj-tokens","tj-expiry","tj-starter",
      "tj-intro","tj-nickname","tj-activeJar",
      "thought-jar-thoughts","thought-jar-tokens",
    ].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const HOW_TO = [
    { icon: "💭", head: "adding thoughts", body: "type anything into the input bar and press enter. your thought becomes a little blob inside the jar." },
    { icon: "🫙", head: "rediscovering thoughts", body: "click the jar to pull out a random thought. it's a gentle surprise from your past self." },
    { icon: "◫",  head: "viewing all thoughts", body: "tap the list icon to see every thought across all your jars. you can mark them complete or remove them there." },
    { icon: "↔",  head: "switching jars", body: "inside the list view, tap any jar card at the top to switch to that jar and see its thoughts." },
    { icon: "✦",  head: "tokens",  body: "each token gives you one day of access. you start with 7 free days as a welcome gift." },
    { icon: "📺", head: "cozy tv", body: "when your tokens run out, watch a short cozy broadcast on the little tv to unlock another day." },
  ];

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(107,66,38,0.25)",backdropFilter:"blur(5px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:"1.5rem" }}
      onClick={onClose}>
      <div style={{ position:"relative",cursor:"default",maxWidth:420,width:"100%",
        maxHeight:"90vh",display:"flex",flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        {/* Tab switcher row */}
        <div style={{ display:"flex",gap:0,marginBottom:-2,position:"relative",zIndex:1,paddingLeft:4 }}>
          {[
            { id:"note",     label:"a tiny note" },
            { id:"howto",    label:"how to use" },
            { id:"settings", label:"settings" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setPage(tab.id)}
              style={{ background: page===tab.id ? "#FFFDF0" : "#F0E8D8",
                border:"2.5px solid #6B4226",
                borderBottom: page===tab.id ? "2.5px solid #FFFDF0" : "2.5px solid #6B4226",
                borderRadius:"10px 10px 0 0",
                padding:"6px 16px",marginRight:4,
                fontFamily:"var(--font-body)",fontSize:12,fontWeight: page===tab.id?600:400,
                color: page===tab.id ? "#3D2510" : "#A07850",
                cursor:"pointer",whiteSpace:"nowrap" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── PAGE: maker note (postcard) ── */}
        {page === "note" && (
          <div style={{ position:"relative" }}>
            {/* Stamp */}
            <div style={{ position:"absolute",top:-8,right:12,zIndex:2 }}>
              <svg viewBox="0 0 38 46" width={38} height={46}>
                <rect x={3} y={3} width={32} height={40} rx={2} fill="#FFF8EC" stroke="#6B4226" strokeWidth={1.5} strokeDasharray="2.5,2"/>
                <rect x={6} y={6} width={26} height={34} rx={1} fill="#E8C87A" stroke="#6B4226" strokeWidth={1}/>
                <path d="M13,20 C12,21 11,23 11,25 C11,28 12,30 14,31 C16,31.5 18,32 19,32 C20,32 22,31.5 24,31 C26,30 27,28 27,25 C27,23 26,21 25,20 Z" fill="#FFF8EC" stroke="#6B4226" strokeWidth={1} strokeLinejoin="round"/>
                <path d="M15,17 C14,17.5 13,19 13,20 L25,20 C25,19 24,17.5 23,17 Z" fill="#FFF8EC" stroke="#6B4226" strokeWidth={1}/>
                <rect x={14} y={14} width={10} height={4} rx={1} fill="#E8C87A" stroke="#6B4226" strokeWidth={1}/>
              </svg>
            </div>
            {/* Card */}
            <div style={{ background:"#FFFDF0",border:"2.5px solid #6B4226",borderRadius:"0 10px 10px 10px",
              padding:"1.6rem 1.8rem 1.5rem",
              boxShadow:"5px 7px 0 #C9A87A",
              backgroundImage:"repeating-linear-gradient(transparent,transparent 27px,#E8D8C022 27px,#E8D8C022 28px)",
              overflowY:"auto",maxHeight:"70vh" }}>
              <button onClick={onClose}
                style={{ position:"absolute",top:16,left:18,background:"transparent",border:"none",
                  cursor:"pointer",fontFamily:"var(--font-body)",fontSize:13,color:"#A07850",opacity:0.7,padding:0 }}>
                ← close
              </button>
              <div style={{ marginTop:20,display:"flex",flexDirection:"column",gap:14 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <TinyHeart />
                  <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(20px,3.5vw,26px)",color:"#3D2510",lineHeight:1.6,paddingBottom:4,overflow:"visible" }}>
                    a tiny note
                  </p>
                </div>
                <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(14px,2.2vw,17px)",color:"#5C3D22",lineHeight:1.85,overflow:"visible",paddingBottom:4 }}>
                  i built this because i kept forgetting the little things — small ideas, moments i wanted to return to. by the weekend, they'd just vanish.
                </p>
                <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(14px,2.2vw,17px)",color:"#5C3D22",lineHeight:1.85,overflow:"visible",paddingBottom:4,fontStyle:"italic" }}>
                  so i made a jar to hold them.
                </p>
                <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(14px,2.2vw,17px)",color:"#5C3D22",lineHeight:1.85,overflow:"visible",paddingBottom:4 }}>
                  each jar holds 25 thoughts on purpose — not a list to fill, but a small space to revisit and actually cherish.
                </p>
                <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(13px,2vw,15px)",color:"#8B6040",lineHeight:1.7,marginTop:4,overflow:"visible",paddingBottom:4 }}>
                  i hope it feels like a cozy corner that's just for you.
                </p>
                {/* Sign-off — bottom right, postcard signature style */}
                <div style={{ display:"flex",justifyContent:"flex-end",alignItems:"center",
                  gap:8,marginTop:8,paddingTop:10,
                  borderTop:"1px solid #E8D8C0" }}>
                  {/* Tiny pink blob doodle */}
                  <svg viewBox="-1.2 -1.2 2.4 2.4" width={22} height={22} style={{ flexShrink:0,opacity:0.85 }}>
                    <path d="M0,-1 C0.5,-1.1 1.1,-0.5 1.1,0.1 C1.1,0.8 0.5,1.3 -0.1,1.2 C-0.7,1.1 -1.2,0.6 -1.1,-0.1 C-1,-0.7 -0.5,-0.9 0,-1"
                      fill="#F2A7B0" stroke="#6B4226" strokeWidth={0.16} />
                  </svg>
                  <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(14px,2.2vw,17px)",
                    color:"#8B6040",lineHeight:1.4,overflow:"visible",paddingBottom:2,
                    fontStyle:"italic" }}>
                    with love, jes
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE: how to use ── */}
        {page === "howto" && (
          <div style={{ background:"#FFFDF5",border:"2.5px solid #6B4226",borderRadius:"0 10px 10px 10px",
            boxShadow:"5px 7px 0 #C9A87A",overflowY:"auto",maxHeight:"70vh" }}>
            <button onClick={onClose}
              style={{ position:"sticky",top:12,left:18,float:"left",background:"transparent",border:"none",
                cursor:"pointer",fontFamily:"var(--font-body)",fontSize:13,color:"#A07850",
                opacity:0.7,padding:"12px 18px 0",display:"block" }}>
              ← close
            </button>
            <div style={{ padding:"1rem 1.8rem 1.5rem",clear:"both",display:"flex",flexDirection:"column",gap:16 }}>
              {HOW_TO.map((item, i) => (
                <div key={i} style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                  <span style={{ fontSize:18,flexShrink:0,marginTop:2,lineHeight:1 }}>{item.icon}</span>
                  <div>
                    <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(15px,2.5vw,18px)",color:"#3D2510",
                      lineHeight:1.5,overflow:"visible",paddingBottom:2,marginBottom:3 }}>
                      {item.head}
                    </p>
                    <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(12px,1.9vw,14px)",color:"#6B5040",lineHeight:1.7 }}>
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PAGE: settings ── */}
        {page === "settings" && (
          <div style={{ background:"#FFFDF5",border:"2.5px solid #6B4226",
            borderRadius:"0 10px 10px 10px",
            boxShadow:"5px 7px 0 #C9A87A",overflowY:"auto",maxHeight:"70vh" }}>
            <button onClick={onClose}
              style={{ position:"sticky",top:12,left:18,float:"left",background:"transparent",border:"none",
                cursor:"pointer",fontFamily:"var(--font-body)",fontSize:13,color:"#A07850",
                opacity:0.7,padding:"12px 18px 0",display:"block" }}>
              ← close
            </button>
            <div style={{ padding:"1rem 1.8rem 1.8rem",clear:"both",display:"flex",flexDirection:"column",gap:20 }}>
              <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(18px,3vw,22px)",
                color:"#3D2510",lineHeight:1.5,overflow:"visible",paddingBottom:2 }}>
                settings
              </p>

              {/* Reset memory */}
              <div style={{ background:"#FBF5E8",border:"1.5px solid #E8D8C0",borderRadius:14,padding:"16px" }}>
                <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#3D2510",
                  fontWeight:600,marginBottom:6 }}>
                  reset memory
                </p>
                <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#6B5040",lineHeight:1.65,marginBottom:14 }}>
                  clears all your jars, thoughts, tokens, and returns the app to the beginning.
                </p>

                {!resetConfirm ? (
                  <button onClick={() => setResetConfirm(true)}
                    style={{ background:"#FFF8EC",border:"2px solid #C9A87A",borderRadius:50,
                      padding:"9px 20px",fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,
                      color:"#A07850",cursor:"pointer",width:"100%" }}>
                    reset everything
                  </button>
                ) : (
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#C87A50",
                      lineHeight:1.6,fontStyle:"italic",textAlign:"center" }}>
                      this will empty your jars and reset the app back to the beginning. are you sure?
                    </p>
                    <div style={{ display:"flex",gap:10 }}>
                      <button onClick={handleReset}
                        style={{ flex:1,background:"#E85D3A",border:"2px solid #6B4226",borderRadius:50,
                          padding:"9px 0",fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,
                          color:"white",cursor:"pointer",boxShadow:"2px 3px 0 #6B4226" }}>
                        yes, reset
                      </button>
                      <button onClick={() => setResetConfirm(false)}
                        style={{ flex:1,background:"#A8C5A0",border:"2px solid #6B4226",borderRadius:50,
                          padding:"9px 0",fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,
                          color:"#3D2510",cursor:"pointer",boxShadow:"2px 3px 0 #6B4226" }}>
                        keep my jars
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function ThoughtJar() {
  // ── Jars state: array of { id, name, thoughts[] }
  // Migrate legacy single-jar data on first load
  const [jars, setJars] = useState(() => {
    const saved = load(JARS_KEY, null);
    if (saved) return saved;
    // Migrate from old STORAGE_KEY if exists
    const old = load("thought-jar-thoughts", null);
    const nickname = load(NICKNAME_KEY, null);
    const firstJar = {
      id: Date.now(),
      name: nickname ? nickname : "my jar",
      thoughts: (old || []).map((t, i) => ({
        ...t,
        colorIndex: i % PASTEL_COLORS.length,
        blobSeed: i % 5,
        completed: false,
      })),
    };
    return [firstJar];
  });

  const [activeJarIndex, setActiveJarIndex] = useState(() => load(ACTIVE_JAR, 0));
  const [tokens, setTokens]       = useState(() => load(TOKEN_KEY, STARTER_TOKENS - 1));
  const [revealedThought, setRevealedThought] = useState(null);
  const [isJarAnimating, setIsJarAnimating]   = useState(false);
  const [toast, setToast]         = useState({ message: "", visible: false });
  const [tvAdOpen, setTvAdOpen]   = useState(false);
  const [showList, setShowList]   = useState(false);
  const [showJarFull, setShowJarFull] = useState(false);
  const [showNewJar, setShowNewJar]   = useState(false);
  const [showInfo, setShowInfo]       = useState(false);
  const [showHomeScreen, setShowHomeScreen] = useState(false);
  const [showDecPicker, setShowDecPicker] = useState(false);
  const toastTimer = useRef(null);

  const [nickname, setNickname]   = useState(() => load(NICKNAME_KEY, null));
  const [showOnboarding, setShowOnboarding] = useState(() => !load(INTRO_KEY, false));
  const [tokenExpiry, setTokenExpiry]       = useState(() => load(EXPIRY_KEY, null));
  const [starterRemaining, setStarterRemaining] = useState(() => load(STARTER_KEY, STARTER_TOKENS));

  const isAccessActive = tokenExpiry && Date.now() < new Date(tokenExpiry).getTime();
  const isLocked = !showOnboarding && !isAccessActive && starterRemaining <= 0;

  // Derived active jar (clamp index in case jar was removed)
  const safeIdx  = Math.min(activeJarIndex, Math.max(0, jars.length - 1));
  const activeJar = jars[safeIdx] || jars[0];
  const currentThoughts = activeJar?.thoughts || [];

  // ── Persist ──────────────────────────────────────────────────────────────
  useEffect(() => { save(JARS_KEY, jars); }, [jars]);
  useEffect(() => { save(TOKEN_KEY, tokens); }, [tokens]);
  useEffect(() => { save(EXPIRY_KEY, tokenExpiry); }, [tokenExpiry]);
  useEffect(() => { save(STARTER_KEY, starterRemaining); }, [starterRemaining]);
  useEffect(() => { save(ACTIVE_JAR, safeIdx); }, [safeIdx]);

  const didInitAccess = useRef(false);
  useEffect(() => {
    if (showOnboarding || didInitAccess.current) return;
    didInitAccess.current = true;
    if (!isAccessActive && starterRemaining > 0) {
      const expiry = new Date(Date.now() + ACCESS_HOURS * 60 * 60 * 1000).toISOString();
      setTokenExpiry(expiry);
      setStarterRemaining(r => r - 1);
    }
  }, [showOnboarding, isAccessActive, starterRemaining]);

  useEffect(() => {
    const id = setInterval(() => setTokenExpiry(p => p), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: msg, visible: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2400);
  }, []);

  const updateActiveJar = useCallback((updater) => {
    setJars(prev => prev.map((jar, i) => i === safeIdx ? { ...jar, thoughts: updater(jar.thoughts) } : jar));
  }, [safeIdx]);


  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handleOnboardingComplete = useCallback((chosenNickname) => {
    save(INTRO_KEY, true);
    save(NICKNAME_KEY, chosenNickname);
    setNickname(chosenNickname);
    setShowOnboarding(false);
    // Update first jar name
    setJars(prev => prev.map((jar, i) => i === 0 ? { ...jar, name: chosenNickname } : jar));
    const expiry = new Date(Date.now() + ACCESS_HOURS * 60 * 60 * 1000).toISOString();
    setTokenExpiry(expiry);
    setStarterRemaining(r => Math.max(0, r - 1));
    didInitAccess.current = true;
  }, []);

  const handleAddThought = useCallback((text) => {
    if (currentThoughts.length >= JAR_CAPACITY) {
      setShowJarFull(true);
      return;
    }
    const colorIndex = currentThoughts.length % PASTEL_COLORS.length;
    const blobSeed   = currentThoughts.length % 5;
    const newThought = {
      id: Date.now(), text,
      createdAt: new Date().toISOString(),
      colorIndex, blobSeed, completed: false,
    };
    updateActiveJar(prev => [...prev, newThought]);
    setIsJarAnimating(true);
    setTimeout(() => setIsJarAnimating(false), 600);
    showToast("thought dropped in");
  }, [currentThoughts.length, updateActiveJar, showToast]);

  const handleJarClick = useCallback(() => {
    if (currentThoughts.length === 0) { showToast("the jar is empty! add a thought"); return; }
    const random = currentThoughts[Math.floor(Math.random() * currentThoughts.length)];
    setIsJarAnimating(true);
    setTimeout(() => { setIsJarAnimating(false); setRevealedThought(random); }, 400);
  }, [currentThoughts, showToast]);

  const handleComplete = useCallback((jarId, thoughtId) => {
    setJars(prev => prev.map(jar => jar.id !== jarId ? jar : {
      ...jar,
      thoughts: jar.thoughts.map(t => t.id === thoughtId ? { ...t, completed: true } : t),
    }));
    showToast("thought completed");
  }, [showToast]);

  const handleDelete = useCallback((jarId, thoughtId) => {
    setJars(prev => prev.map(jar => jar.id !== jarId ? jar : {
      ...jar,
      thoughts: jar.thoughts.filter(t => t.id !== thoughtId),
    }));
    // If the revealed thought was deleted, close it
    setRevealedThought(prev => prev?.id === thoughtId ? null : prev);
    showToast("thought removed");
  }, [showToast]);

  const handleCompleteFromReveal = useCallback((thoughtId) => {
    handleComplete(activeJar.id, thoughtId);
    setRevealedThought(prev => prev ? { ...prev, completed: true } : null);
  }, [activeJar?.id, handleComplete]);

  const handleCreateNewJar = useCallback((jarName) => {
    if (jars.length >= MAX_JARS) { setShowNewJar(true); return; }
    if (tokens < 1) return;
    const newJar = { id: Date.now(), name: jarName || "new jar", thoughts: [] };
    setJars(prev => {
      setActiveJarIndex(prev.length); // switch to new jar (index = current length before push)
      return [...prev, newJar];
    });
    setTokens(t => t - 1);
    setShowJarFull(false);
    setShowNewJar(false);
    setShowJarFull(false);
    showToast(`"${newJar.name}" opened — 1 token used`);
  }, [tokens, jars.length, showToast]);

  const handleOpenAd    = useCallback(() => setTvAdOpen(true), []);
  const handleCloseAd   = useCallback(() => setTvAdOpen(false), []);
  const handleEarnToken = useCallback(() => {
    const expiry = new Date(Date.now() + ACCESS_HOURS * 60 * 60 * 1000).toISOString();
    setTokenExpiry(expiry);
    setTokens(prev => prev + 1);
    showToast("token earned — another day with the jar");
  }, [showToast]);

  // Jar navigation
  const canGoPrev = safeIdx > 0;
  const canGoNext = safeIdx < jars.length - 1;
  const goPrev = () => setActiveJarIndex(i => Math.max(0, i - 1));
  const goNext = () => setActiveJarIndex(i => Math.min(jars.length - 1, i + 1));

  return (
    <>

      {showOnboarding && <OnboardingFlow onComplete={handleOnboardingComplete} />}

      <div className="clip-x app-root" style={{ minHeight:"100vh",width:"100%",background:"#FBF5E8",display:"flex",
        flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",
        padding:"2rem 1.5rem",fontFamily:"var(--font-body)",
        opacity: showOnboarding ? 0 : 1, transition:"opacity 0.4s ease" }}>

        {/* Dot grid background */}
        <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.06,pointerEvents:"none" }}>
          <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#6B4226" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Header */}
        <header style={{ position:"absolute",top:0,left:0,right:0,display:"flex",
          alignItems:"flex-start",justifyContent:"space-between",padding:"1.2rem 2rem",
          zIndex:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            {/* Mini blob app icon */}
            <svg viewBox="-1.3 -1.3 2.6 2.6" width={30} height={30} style={{ flexShrink:0 }}>
              <path d="M0,-1 C0.6,-0.9 1.1,-0.3 1,0.4 C0.9,1.1 0.2,1.3 -0.4,1.1 C-1,0.9 -1.2,0.2 -1,-0.3 C-0.8,-0.9 -0.6,-1.1 0,-1"
                fill="#F6E27A" stroke="#6B4226" strokeWidth={0.18} />
            </svg>
            <h1 className="hand-text" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(26px,4.2vw,40px)",
              fontWeight:700,color:"#3D2510",letterSpacing:0.5,
              lineHeight:1.6,overflow:"visible",paddingBottom:10,display:"block" }}>
              thoughts jar
            </h1>

          </div>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5 }}>
            <TokenCoin count={tokens} />
            {tokens > 0 && (
              <span style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#A07850",opacity:0.85 }}>
                {tokens} {tokens===1?"day":"days"} left
              </span>
            )}
            <div style={{ display:"flex",flexDirection:"column",gap:5,alignItems:"center",
              marginTop:4,position:"relative",zIndex:20 }}>
              <InfoButton onClick={() => setShowInfo(true)} />
              <ListIcon onClick={() => setShowList(true)} />
              <NewJarButton onClick={() => setShowNewJar(true)} />
              <HomeScreenButton onClick={() => setShowHomeScreen(true)} />
            </div>
          </div>
        </header>



        {/* Decorative dots */}
        <svg viewBox="0 0 200 200" width={160} height={160}
          style={{ position:"absolute",top:55,left:0,opacity:0.08,pointerEvents:"none" }}>
          <circle cx={30} cy={80} r={4} fill="#C87A50" />
          <circle cx={65} cy={42} r={2.5} fill="#C87A50" />
          <circle cx={100} cy={105} r={3.5} fill="#C87A50" />
          <circle cx={15} cy={130} r={2} fill="#C87A50" />
        </svg>

        {/* Main content */}
        <main style={{ display:"flex",flexDirection:"column",alignItems:"center",
          gap:"clamp(6px,1.5vh,14px)",width:"100%",maxWidth:520,
          marginTop:"clamp(60px,9vh,84px)",
          paddingBottom:"clamp(24px,4vh,48px)",
          position:"relative" }}>

          {/* The Jar — shifted slightly left to create separation from TV */}
          <div style={{ width:"100%",maxWidth:"min(380px,82vw)",
            marginLeft:"auto", marginRight:"auto",
            transform:"translateX(clamp(-28px,-5vw,-10px))",
            transition:"opacity 0.5s ease, filter 0.5s ease",
            opacity: isLocked?0.45:1, filter: isLocked?"grayscale(0.5)":"none" }}>
            <JarSVG thoughts={currentThoughts} onJarClick={handleJarClick}
              isAnimating={isJarAnimating} jarName={activeJar?.name}
              lidVariant={(activeJar?.id ?? 0) % 5} />
          </div>

          <AddThoughtInput onAdd={handleAddThought} disabled={isLocked} />

          {/* Hint text — below the input */}
          <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(12px,1.8vw,14px)",
            color:"#A07850",textAlign:"center",opacity:0.75,lineHeight:1.5 }}>
            {currentThoughts.length === 0
              ? "add a thought, and it will float inside the jar"
              : currentThoughts.length >= JAR_CAPACITY
                ? "this jar is full — create a new one with a token"
                : "click the jar to rediscover a forgotten thought"}
          </p>

          {/* TV — absolutely positioned bottom-right of main, above input area */}
          <div className="tv-widget" style={{
            position:"absolute",
            right:0,
            bottom:"clamp(130px,22vh,160px)",
            flexDirection:"column",alignItems:"center",
            opacity:0.88,zIndex:2 }}>
            <RetroTV onOpenAd={handleOpenAd} />
          </div>
        </main>
      </div>

      {isLocked && <LockedOverlay onOpenTV={handleOpenAd} />}

      {(showJarFull || showNewJar) && (
        <JarFullModal tokens={tokens}
          atJarLimit={jars.length >= MAX_JARS}
          onConfirm={handleCreateNewJar}
          onCancel={() => { setShowJarFull(false); setShowNewJar(false); }}
          onOpenTV={() => { setShowJarFull(false); setShowNewJar(false); setTvAdOpen(true); }} />
      )}
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showHomeScreen && <HomeScreenModal onClose={() => setShowHomeScreen(false)} />}

      {showList && (
        <ThoughtsListModal jars={jars} onClose={() => setShowList(false)}
          onComplete={handleComplete} onDelete={handleDelete}
          activeJarId={activeJar?.id}
          onSwitchJar={(jarId) => {
            const idx = jars.findIndex(j => j.id === jarId);
            if (idx >= 0) setActiveJarIndex(idx);
          }} />
      )}

      <ThoughtReveal thought={revealedThought} onClose={() => setRevealedThought(null)}
        onComplete={handleCompleteFromReveal} />

      {tvAdOpen && <TVAdPopup onClose={handleCloseAd} onEarnToken={handleEarnToken} />}
      <Toast message={toast.message} visible={toast.visible} />
      <Analytics />
    </>
  );
}
