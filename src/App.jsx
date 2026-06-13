import './index.css';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Analytics } from '@vercel/analytics/react';

// ─── CONSTANTS & STORAGE ────────────────────────────────────────────────────

const PASTEL_COLORS = [
  "#F2A7B0","#F7C59F","#A8C5A0","#F6E27A",
  "#A8BFDF","#D4A5C9","#F4B183","#98C9A3",
];

const JARS_KEY    = "tj-jars";
const INTRO_KEY   = "tj-intro";
const NICKNAME_KEY= "tj-nickname";
const ACTIVE_JAR  = "tj-activeJar";
const HS_PROMPT_KEY= "tj-hsPromptSeen";
const MUSIC_KEY    = "tj-musicMuted";
const MUSIC_VOL_KEY= "tj-musicVol";
const MEMORY_KEY      = "tj-memory";    // { jarId, thoughtId, date }
const BLOB_TEACHER_KEY = "tj-blob-taught"; // true once blob teacher is done

const JAR_CAPACITY        = 25;
const MEMORY_MIN_THOUGHTS = 4;    // jar must have at least this many thoughts
const MEMORY_AGE_DAYS     = 3;    // prefer thoughts at least this old
const MEMORY_SHOW_CHANCE  = 0.55; // 55% chance to show on a fresh day (feels occasional)

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

function BlobShape({ color, x, y, size, opacity = 0.88, seed = 0, completed = false, floatPhase = 0 }) {
  const path = BLOB_VARIANTS[seed % BLOB_VARIANTS.length];
  const r = size / 2;
  const delay = `-${(floatPhase / 360 * 6).toFixed(2)}s`;

  return (
    <g
      transform={`translate(${x},${y}) scale(${r})`}
      opacity={completed ? 0.35 : opacity}
    >
      <g style={{ animation: `blobFloat 6s ease-in-out ${delay} infinite` }}>
        <path
          d={path}
          fill={color}
          stroke="#6B4226"
          strokeWidth={1.5 / r}
          strokeLinejoin="round"
          strokeDasharray={completed ? `${6 / r},${3 / r}` : "none"}
        />
      </g>
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

function JarSVG({ thoughts, onJarClick, isAnimating, jarName, lidVariant = 0, onLabelClick }) {
  const maxBlobs = JAR_CAPACITY;
  const count    = thoughts.length;

  // Organic blob positions: seeded pseudo-random so each thought has a stable,
  // natural-looking position that doesn't shift when other thoughts are added/removed.
  // Uses the thought's id as a stable seed to avoid re-layout on every render.
  const blobPositions = thoughts.map((t) => {
    // Stable hash from thought id → deterministic but organic-looking position
    const h  = (t.id * 2654435761 >>> 0) % 1000;
    const h2 = (t.id * 40503 + 1013904223 >>> 0) % 1000;
    const h3 = (t.id * 69069 + 12345 >>> 0) % 1000;
    // Jar interior x: 58-162, y: 100-270
    const baseX = 62 + (h  / 1000) * 92;
    const baseY = 110 + (h2 / 1000) * 148;
    // Small organic jitter for extra naturalness
    const jitterX = ((h3 / 1000) - 0.5) * 14;
    const jitterY = ((h  / 1000) - 0.5) * 10;
    return {
      x: Math.max(62, Math.min(158, baseX + jitterX)),
      y: Math.max(108, Math.min(268, baseY + jitterY)),
      color: PASTEL_COLORS[t.colorIndex],
      seed:  t.blobSeed,
      completed: t.completed,
      floatPhase: (h3 % 360), // unique phase per blob for staggered float
    };
  });

  const fillLevel = count > 0 ? Math.max(102, 278 - (count / maxBlobs) * 168) : 280;
  const labelText = jarName || "thought jar";
  const labelSize = labelText.length > 16 ? "8" : labelText.length > 12 ? "10" : "12";
  const subText   = count === 0 ? "add your first thought" : `${count} / ${maxBlobs} thoughts`;

  return (
    <svg viewBox="0 0 220 300" width="100%"
      style={{
        maxWidth: 380, cursor: "pointer",
        filter: isAnimating ? "drop-shadow(0 0 18px #F4B18355)" : "none",
        transition: "filter 0.4s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        transform: "scale(1)",
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
            size={18 + (b.seed % 3) * 4} seed={b.seed} opacity={0.82} completed={b.completed} floatPhase={b.floatPhase ?? 0} />
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
      <text x={110} y={185} textAnchor="middle" fontFamily="'MyFreehandFont5'" fontSize={labelSize} fill="#6B4226" fontWeight="700"
        onClick={e => { e.stopPropagation(); onLabelClick?.(); }}
        style={{ cursor:"pointer" }}>
        {labelText}
      </text>
      {/* Tiny edit hint under label — only show if onLabelClick provided */}
      <text x={110} y={204} textAnchor="middle" fontFamily="'Montserrat', 'Helvetica Neue', Arial, sans-serif"
        fontSize="7.5" fill="#8B6040" opacity={0.85}>
        {subText}
      </text>


    </svg>
  );
}

// ─── MUSIC HOOK ─────────────────────────────────────────────────────────────

function useBackgroundMusic() {
  const audioRef = useRef(null);
  const [muted, setMuted]   = useState(() => load(MUSIC_KEY, false));
  const [volume, setVolume] = useState(() => load(MUSIC_VOL_KEY, 0.35));
  const started = useRef(false);

  // Init audio element once — safe against missing file
  useEffect(() => {
    try {
      const audio = new Audio('/music.mp3');
      audio.loop   = true;
      audio.volume = volume;
      audio.muted  = muted;
      audio.onerror = () => { /* file missing — silently ignore */ };
      audioRef.current = audio;
    } catch (e) { /* audio API unavailable */ }
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    };
  }, []); // eslint-disable-line

  // Pause music when user leaves the app/tab, resume when they return
useEffect(() => {
  const handleVisibilityChange = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (document.hidden) {
      audio.dataset.wasPlaying = audio.paused ? "false" : "true";
      audio.pause();
    } else {
      if (audio.dataset.wasPlaying === "true" && !muted) {
        audio.play().catch(() => {});
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}, [muted]);
  
  // Start playback on first user interaction (browser autoplay policy)
  useEffect(() => {
    const start = () => {
      if (started.current || !audioRef.current || muted) return;
      started.current = true;
      audioRef.current.play().catch(() => {});
    };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown',     start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown',     start);
    };
  }, [muted]);

  // Sync muted state
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = muted;
    save(MUSIC_KEY, muted);
    if (!muted && started.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [muted]);

  // Sync volume
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    save(MUSIC_VOL_KEY, volume);
  }, [volume]);

  return { muted, setMuted, volume, setVolume };
}

// ─── THOUGHT REVEAL POPUP ───────────────────────────────────────────────────

function ThoughtReveal({ thought, onClose, onComplete, onReroll, onOpenList }) {
  const [shaking, setShaking] = useState(false);
  if (!thought) return null;

  const handleReroll = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    setTimeout(() => onReroll(), 120);
  };

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
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"1.2rem" }} onClick={onClose}>
      <style>{`@keyframes blobShake{0%,100%{transform:translateX(0) rotate(0deg)}15%{transform:translateX(-8px) rotate(-2deg)}30%{transform:translateX(7px) rotate(2deg)}45%{transform:translateX(-6px) rotate(-1.5deg)}60%{transform:translateX(5px) rotate(1deg)}75%{transform:translateX(-3px) rotate(-0.5deg)}90%{transform:translateX(2px) rotate(0.3deg)}}`}</style>
      <div style={{ position:"relative",cursor:"default",display:"flex",flexDirection:"column",alignItems:"center",
        width:"min(92vw, 420px)" }}
        onClick={e => e.stopPropagation()}>

        {/* Blob with icons pinned to top-right corner */}
        <div style={{ position:"relative",width:"100%",
          animation: shaking ? "blobShake 0.45s ease" : "none" }}>
          <svg viewBox="0 0 360 290" width="100%"
            style={{ display:"block", filter:"drop-shadow(4px 6px 0px rgba(107,66,38,0.28))" }}>
            <path d={blobPath} fill={thought.completed ? "#D4C5B0" : blobColor} stroke="#6B4226" strokeWidth="3" strokeLinejoin="round" />
            <path d={blobPath} fill="white" opacity={0.12} transform="scale(0.82) translate(32, 26)" />
          </svg>

          {/* Dice + list icons — pinned top-right, following blob curve */}
          <div style={{
  position:"absolute",
  top:"10%",
  right:"4%",
  display:"flex",
  flexDirection:"column",
  gap:10,
  zIndex:10,
  pointerEvents:"auto",
}}>
            <button onClick={e => { e.stopPropagation(); handleReroll(); }} aria-label="roll again"
              style={{ background:"rgba(255,248,236,0.95)",border:"2.5px solid #6B4226",borderRadius:"50%",
                width:46,height:46,display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",boxShadow:"2px 3px 0 rgba(107,66,38,0.35)",flexShrink:0,
                WebkitTapHighlightColor:"transparent",touchAction:"manipulation" }}>
              {/* Mini 3D dice — same isometric style as main dice */}
              <img
  src="/icons/dice.svg"
  alt="dice"
  style={{
    width: 26,
    height: 24,
    pointerEvents: "none",
  }}
/>
            </button>
            <button onClick={e => { e.stopPropagation(); onOpenList(); }} aria-label="view all thoughts"
              style={{ background:"rgba(255,248,236,0.95)",border:"2.5px solid #6B4226",borderRadius:"50%",
                width:46,height:46,display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",boxShadow:"2px 3px 0 rgba(107,66,38,0.35)",flexShrink:0,
                WebkitTapHighlightColor:"transparent",touchAction:"manipulation" }}>
              <img
  src="/icons/list-no-border.svg"
  alt="list"
  style={{
    width: 22,
    height: 22,
    pointerEvents: "none",
  }}
/>
            </button>
          </div>

          {/* Thought text — centred inside blob */}
          <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",
            alignItems:"center",justifyContent:"center",padding:"2rem 3.5rem 2rem 2rem",textAlign:"center" }}>
            <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(14px,2.8vw,22px)",
              color:"#6B4226",opacity:0.7,marginBottom:6,letterSpacing:1,lineHeight:1.5,overflow:"visible" }}>
              {thought.completed ? "a completed thought" : "a thought from the jar"}
            </p>
            <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(20px,5vw,32px)",
              color:"#3D2510",lineHeight:1.5,overflow:"visible",marginBottom:6,wordBreak:"break-word",hyphens:"auto",
              textDecoration: thought.completed ? "line-through" : "none", opacity: thought.completed ? 0.6 : 1 }}>
              {thought.text}
            </p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(10px,1.8vw,14px)",color:"#6B4226",opacity:0.55 }}>
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Action buttons — single horizontal row below blob */}
        <div style={{ display:"flex",gap:10,marginTop:14,justifyContent:"center",flexWrap:"nowrap" }}>

          {!thought.completed && (
            <button onClick={() => { onComplete(thought.id); onClose(); }}
              style={{ background:"#A8C5A0",border:"2.5px solid #6B4226",borderRadius:50,
                padding:"10px 18px",fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,
                color:"#3D2510",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226",whiteSpace:"nowrap" }}>
              mark complete
            </button>
          )}
          <button onClick={onClose}
            style={{ background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,
              padding:"10px 18px",fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,
              color:"white",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226",whiteSpace:"nowrap" }}>
            put it back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── JAR FULL MODAL ──────────────────────────────────────────────────────────

function JarFullModal({ onConfirm, onCancel }) {
  const [jarName, setJarName] = useState("");
  const [suggestion, setSuggestion] = useState(() => WHIMSICAL_NAMES[Math.floor(Math.random() * WHIMSICAL_NAMES.length)]);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(107,66,38,0.22)",backdropFilter:"blur(5px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:"1.5rem" }}
      onClick={onCancel}>
      <div style={{
  background:"#FFFDF5",
  border:"3px solid #6B4226",
  borderRadius:20,
  width:"min(92vw,420px)",
  minHeight:420,
  padding:"2rem 1.8rem",
  boxShadow:"6px 8px 0 #C9A87A",
  display:"flex",
  flexDirection:"column",
  justifyContent:"space-between",
}}
onClick={e => e.stopPropagation()}>
        <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(22px,4vw,30px)",
          color:"#3D2510",marginBottom:10,lineHeight:1.6,paddingBottom:4,overflow:"visible",display:"block" }}>
          create a new jar
        </p>
        <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#A07850",lineHeight:1.65,marginBottom:18 }}>
          give it a name and keep going.
        </p>
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
                open new jar
              </button>
              <button onClick={onCancel}
                style={{ background:"transparent",border:"2px solid #C9A87A",borderRadius:"50%",
                  width:44,height:44,flexShrink:0,fontFamily:"var(--font-body)",fontSize:16,
                  fontWeight:500,color:"#A07850",cursor:"pointer",display:"flex",
                  alignItems:"center",justifyContent:"center" }}>
                X
              </button>
            </div>
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

        {/* Between-jars ad — inside the horizontal jar strip, after the 2nd jar.
            Only renders when there are ≥4 jars. Never covers jar buttons.
            Rendered as a flex child inside the strip so it scrolls with the jars. */}
        {jars.map((jar, idx) => {
          const variant = jar.id % 5;
          const fillPct = jar.thoughts.length / 25;
          const isActive = filterJar === jar.id;
          const isCurrentJar = jar.id === activeJarId;
          const lidColors = ["#E8C87A","#F2A7B0","#A8C5A0","#F6E27A","#D4A5C9"];
          const lidColor = lidColors[variant];
          return (
            <React.Fragment key={jar.id}>
              <button onClick={() => handleTabClick(jar.id)}
                style={{ background: isActive ? "#FFF8EC" : "transparent",
                  border:"2px solid " + (isActive ? "#6B4226" : "#D4C5B0"),
                  borderRadius:14,padding:"8px 10px",cursor:"pointer",flexShrink:0,
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                  boxShadow: isActive ? "2px 3px 0 #C9A87A" : "none",
                  position:"relative",transition:"all 0.15s" }}>
                {isCurrentJar && (
                  <span style={{ position:"absolute",top:4,right:4,width:6,height:6,
                    borderRadius:"50%",background:"#E85D3A",border:"1px solid #6B4226" }} />
                )}
                <svg viewBox="0 0 38 48" width={38} height={48}>
                  <path d="M6,14 C5,16 4,19 4,23 C3,28 3,34 4,39 C5,42 7,44 11,45 C15,46 18,46 19,46 C20,46 23,46 27,45 C31,44 33,42 34,39 C35,34 35,28 34,23 C34,19 33,16 32,14 Z"
                    fill="#FFF8EC" stroke="#6B4226" strokeWidth={2} strokeLinejoin="round"/>
                  {fillPct > 0 && (
                    <clipPath id={`fill-${jar.id}`}>
                      <path d="M6,14 C5,16 4,19 4,23 C3,28 3,34 4,39 C5,42 7,44 11,45 C15,46 18,46 19,46 C20,46 23,46 27,45 C31,44 33,42 34,39 C35,34 35,28 34,23 C34,19 33,16 32,14 Z" />
                    </clipPath>
                  )}
                  {fillPct > 0 && (
                    <rect x={3} y={Math.max(14, 45 - fillPct * 30)} width={34} height={32}
                      fill="#FDE8C8" opacity={0.5} clipPath={`url(#fill-${jar.id})`} />
                  )}
                  <path d="M12,9 C11,10 9,12 9,14 L29,14 C29,12 27,10 26,9 Z"
                    fill="#FFF8EC" stroke="#6B4226" strokeWidth={1.8} strokeLinejoin="round"/>
                  <rect x={9} y={5} width={20} height={6} rx={2} fill={lidColor} stroke="#6B4226" strokeWidth={1.8}/>
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
            </React.Fragment>
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
        {displayThoughts.map((t, idx) => (
          <React.Fragment key={t.id}>
            <div
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
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── DAILY BROADCAST ────────────────────────────────────────────────────────

const BROADCAST_KEY     = "tj-broadcast-today";
const BROADCAST_IDX_KEY = "tj-broadcast-history";

const COZY_BROADCASTS = [
  // gentle encouragement
  "you don't need to solve everything today.",
  "small steps still count.",
  "even a little bit of effort is still effort.",
  "you showed up. that matters more than you think.",
  "it's okay if today was just about getting through it.",
  "progress doesn't always look like progress while it's happening.",
  "rest is part of the work.",
  "you are allowed to take things slowly.",
  "one small thing done is better than ten things left undone from exhaustion.",
  "being gentle with yourself is a skill worth practising.",
  "you don't have to be at full capacity to be worth something.",
  "there is still time.",
  "nothing is ruined.",
  "a quiet day is still a day.",
  "some things only need to happen once to change everything.",
  "it's fine to need more time.",
  "you are doing better than it feels like right now.",
  "trying again tomorrow is a completely valid plan.",
  "the hardest part is often just beginning, and you already did that.",
  "not every day needs to be meaningful — ordinary days count too.",

  // cozy observations
  "somewhere right now someone is making tea and thinking of nothing in particular.",
  "the best kind of afternoon is one with no obligations and soft lighting.",
  "a blanket, a window, and a quiet hour can fix more than people admit.",
  "rain sounds exist for a reason.",
  "some rooms just feel safer than others. find those rooms.",
  "the smell of something baking in another room is a small miracle.",
  "late evenings have a different kind of quiet. the good kind.",
  "there is a version of you that knows how to rest. she is in there.",
  "a warm drink in both hands is its own kind of meditation.",
  "nothing has to be productive to be worth doing.",
  "slow mornings are a form of luxury that costs nothing.",
  "sitting by a window and watching the world is a completely valid use of time.",
  "some of the nicest moments are ones that don't get written down anywhere.",
  "it is okay to want a cozy life. that's a real thing to want.",
  "soft lighting makes everything feel more manageable.",

  // blob messages
  "blob would like to remind you to drink some water.",
  "blob is proud of you for showing up.",
  "blob says it's okay if today was weird.",
  "blob left a little warmth on the couch cushion for you.",
  "blob doesn't need you to be perfect. blob just likes that you're here.",
  "blob wanted you to know: you smell nice and your handwriting is charming.",
  "blob is floating nearby in case you need company.",
  "blob has reviewed your day and decided you did fine, actually.",
  "blob report: everything is a little wobbly but basically okay.",
  "blob noticed you kept going even when it was hard. blob respects that.",
  "blob is small and soft and thinks you deserve a snack.",
  "blob says: the jar will still be here whenever you come back.",
  "blob gentle reminder: breathe out slowly.",
  "blob picked up a quiet signal today and it was specifically for you.",
  "blob has no notes. blob thinks you're doing great.",

  // Thoughts Jar universe
  "the jar doesn't mind waiting for you.",
  "your thoughts are safe inside the jar. they're not going anywhere.",
  "the jar has been holding things quietly all day.",
  "today's signal arrived safely.",
  "the antenna picked up a very cozy signal today.",
  "the jar knows some thoughts need longer to become clear.",
  "the blobs inside the jar are floating around softly, just existing.",
  "a thought dropped in today and it immediately felt at home.",
  "the jar holds everything without judgment. that's its whole job.",
  "the blobs are resting. they had a full day.",
  "some thoughts just need a place to sit for a while before they make sense.",
  "the jar fills slowly. that's how it's supposed to work.",
  "tiny jar update: cozy in here. warm. a little crowded but in a good way.",
  "the jar remembered all your thoughts so you don't have to carry them.",
  "every thought you drop in is one less thing your brain has to hold alone.",

  // tiny emotional reassurances
  "you are not behind. there is no schedule.",
  "it's okay to feel multiple things at once even when they contradict each other.",
  "your feelings are not overreactions. they are information.",
  "being tired is not a moral failing.",
  "not everyone has to understand what you're going through.",
  "you are allowed to change your mind about things.",
  "asking for help is not the same as giving up.",
  "it's okay if you are still figuring things out. most people are.",
  "a hard week doesn't mean a hard life.",
  "you are not responsible for other people's moods.",
  "grief takes as long as it takes. there's no fast track.",
  "you are not too sensitive. you are paying attention.",
  "the version of you from two years ago would be quietly impressed right now.",
  "you don't have to earn your rest.",
  "being a work in progress is the only honest state anyone can be in.",

  // whimsical notes
  "today's forecast: mostly gentle, with scattered moments of unexpected okayness.",
  "tiny weather report: cozy with a chance of snacks.",
  "the little tv picked up a signal from somewhere soft and sent it here for you.",
  "ch. 7 has been broadcasting comfort to small apartments since forever.",
  "a message arrived from somewhere slightly warmer than here. it's for you.",
  "signal quality: warm. content: soft. duration: as long as you need.",
  "today's transmission comes wrapped in something that smells faintly of old books.",
  "the static cleared and just for a moment it said: you're going to be okay.",
  "somewhere a small creature is building a nest. things are being made cozy.",
  "the antenna wobbled a little and then found the softest frequency.",
  "tiny broadcast from a very small station: you are not alone in the weird.",
  "the channel changes slowly here. there is no rush.",
  "a cloud shaped like a question mark passed by, and then it wasn't a question anymore.",
  "this signal travels very far to reach you. it thinks the journey is worth it.",

  // rainy day messages
  "rain makes everything feel more indoors in a good way.",
  "a grey day is still a full day.",
  "rainy afternoons were made for low expectations and warm socks.",
  "the kind of tired that comes with rain is actually okay to give into.",
  "puddles exist so that at least one small part of the world is reflecting the sky.",
  "even the clouds are just water taking a break from being somewhere else.",
  "bad weather is the universe's way of giving you permission to stay in.",
  "some feelings are like rain — they pass if you don't fight them.",
  "a good rain changes the smell of the whole world. that's not nothing.",
  "you are allowed to like the rain even when everyone else complains about it.",

  // fresh start messages
  "tomorrow is just today with everything reset.",
  "a new day doesn't require anything of you except showing up to it.",
  "even a small change in the morning can make the whole day feel different.",
  "fresh starts don't have to be dramatic to be real.",
  "you can begin again very quietly. no announcement necessary.",
  "every morning is technically a soft reboot.",
  "you don't need a new year or a monday to start something gentle.",
  "things can shift slowly and still count as changing.",
  "not every beginning feels exciting. some feel more like relief.",
  "you are always allowed to try again.",

  // reflection prompts
  "what was one small thing today that didn't go wrong?",
  "is there something you've been carrying that you're ready to set down for a minute?",
  "what would feel good to drop into the jar tonight?",
  "is there a thought that's been floating around asking for somewhere to land?",
  "what are you quieter about than you used to be? is that okay?",
  "what would you tell a friend who was having your exact kind of week?",
  "is there something small you did today that you haven't given yourself credit for?",
  "what does rest look like for you right now, specifically?",
  "some thoughts are hard to name. you don't have to name them today.",
  "what is one thing the jar is holding for you that you haven't thought about in a while?",

  // originals
  "someone somewhere is probably making tea right now, standing quietly in their kitchen while the rest of the world keeps rushing without them.",
  "today feels like folded laundry, warm lamps, and the strange comfort of finally putting your phone down for a little while.",
  "the little blob thinks tomorrow might be softer. not perfect, not magical — just a little easier to carry than today was.",
  "tiny midnight forecast: overthinking with occasional moments of clarity, followed by emotional support music playing faintly in another room.",
  "sometimes the most meaningful days are the ones that leave almost no evidence behind except a slightly calmer nervous system.",
  "the little jar noticed you came back again today. that probably means some small part of you still believes tomorrow is worth reaching.",
  "nothing dramatic happened today, and maybe that is its own kind of miracle. quiet days count too.",
  "some thoughts are not meant to be solved immediately. some are only asking for somewhere safe to rest for the night.",
];

// Pick today's broadcast — stable per calendar day, cycles through all messages
function getDailyBroadcast() {
  const todayKey = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const stored = load(BROADCAST_KEY, null);
  if (stored && stored.date === todayKey) return stored.message;

  // Build a shuffled cycle so messages don't repeat until all seen
  let history = load(BROADCAST_IDX_KEY, []);
  const total = COZY_BROADCASTS.length;
  history = history.filter(i => i < total);
  if (history.length >= total) history = [];

  const remaining = Array.from({ length: total }, (_, i) => i).filter(i => !history.includes(i));
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  const message = COZY_BROADCASTS[pick];

  save(BROADCAST_IDX_KEY, [...history, pick]);
  save(BROADCAST_KEY, { date: todayKey, message });
  return message;
}

// ─── RETRO TV (cozy illustrated) ────────────────────────────────────────────

// The TV widget: illustrated hand-drawn style, click to expand broadcast in-place
function CozyTV({ broadcast }) {
  const [expanded, setExpanded] = useState(false);
  const [isFlickering, setIsFlickering] = useState(false);
  const [staticFrame, setStaticFrame] = useState(0);
  const flickerTimer = useRef(null);

  const handleTVClick = () => {
    if (isFlickering || expanded) return;
    setIsFlickering(true);
    let frame = 0;
    flickerTimer.current = setInterval(() => {
      frame++;
      setStaticFrame(frame % 4);
      if (frame >= 7) {
        clearInterval(flickerTimer.current);
        setIsFlickering(false);
        setStaticFrame(0);
        setExpanded(true);
      }
    }, 90);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setExpanded(false);
  };

  const staticPatterns = [
    [[14,24,46,24],[14,30,38,30],[14,36,44,36],[14,41,34,41]],
    [[14,25,40,25],[14,29,46,29],[14,34,36,34],[14,40,43,40]],
    [[14,24,36,24],[14,31,46,31],[14,37,40,37],[14,42,34,42]],
    [[14,26,44,26],[14,30,36,30],[14,36,46,36],[14,42,38,42]],
  ];
  const staticLines = staticPatterns[staticFrame];

  // Short preview text (first ~36 chars)
  const preview = broadcast.length > 36 ? broadcast.slice(0, 36).trimEnd() + "…" : broadcast;

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:0 }}>
      {/* Label above TV */}
      <div style={{
        fontFamily:"var(--font-hand)",
        fontSize:12,
        color:"#8B4A2F",
        opacity: expanded ? 0 : 0.9,
        whiteSpace:"nowrap",
        marginBottom:3,
        transition:"opacity 0.2s",
        pointerEvents:"none",
      }}>
        today's broadcast ✦
      </div>

      {/* TV body */}
      <div
        onClick={handleTVClick}
        style={{
          cursor: expanded ? "default" : "pointer",
          position:"relative",
          transition:"transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
          transform: isFlickering ? "scale(1.05)" : "scale(1)",
        }}
        aria-label="open today's broadcast"
        role="button"
      >
        {/* Hand-drawn TV SVG — cream casing, warm felt-y aesthetic */}
        <svg
          viewBox="0 0 110 100"
          width={expanded ? 0 : 88}
          height={expanded ? 0 : 80}
          style={{
            display: expanded ? "none" : "block",
            filter:"drop-shadow(3px 4px 0px rgba(107,66,38,0.22))",
            overflow:"visible",
          }}
        >
          {/* Soft drop shadow blob under TV */}
          <ellipse cx={55} cy={97} rx={34} ry={5} fill="#C9A87A" opacity={0.18} />

          {/* TV casing — warm cream, slightly wobbly hand-drawn rect */}
          <path
            d="M8,22 C7,20 8,16 12,15 L98,15 C102,15 103,19 103,22 L103,84 C103,88 100,90 96,90 L14,90 C10,90 7,88 8,84 Z"
            fill="#F5ECD7"
            stroke="#6B4226"
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {/* Casing inner shadow — top edge warmth */}
          <path
            d="M12,18 L98,18 C101,18 102,20 102,22 L102,26 C94,24 16,24 8,26 L8,22 C8,20 9,18 12,18 Z"
            fill="#E8D8B8"
            opacity={0.5}
          />

          {/* Screen bezel */}
          <rect x={14} y={20} width={64} height={50} rx={5}
            fill="#3D2A1A" stroke="#6B4226" strokeWidth={1.8} />

          {/* Screen glow — the actual screen area */}
          <rect x={17} y={23} width={58} height={44} rx={3}
            fill={isFlickering ? "#8FBBA8" : "#6A8FA0"} />

          {/* Screen content: static lines when idle, or message preview */}
          {!isFlickering ? (
            <>
              {/* Idle: scanlines + tiny blob on screen */}
              <line x1={21} y1={30} x2={71} y2={30} stroke="white" strokeWidth={0.8} opacity={0.18} />
              <line x1={21} y1={36} x2={71} y2={36} stroke="white" strokeWidth={0.8} opacity={0.18} />
              <line x1={21} y1={42} x2={71} y2={42} stroke="white" strokeWidth={0.8} opacity={0.18} />
              <line x1={21} y1={48} x2={71} y2={48} stroke="white" strokeWidth={0.8} opacity={0.18} />
              <line x1={21} y1={54} x2={71} y2={54} stroke="white" strokeWidth={0.8} opacity={0.18} />
              <line x1={21} y1={60} x2={71} y2={60} stroke="white" strokeWidth={0.8} opacity={0.18} />
              {/* Tiny broadcast label on screen */}
              <text x={46} y={39} textAnchor="middle"
                fontFamily="'Montserrat',Arial,sans-serif" fontSize={5}
                fill="white" opacity={0.55} letterSpacing={0.3}>
                ch. 7
              </text>
              {/* Tiny blob on screen */}
              <path d="M46,44 C49,42 53,44 52,48 C51,52 47,53 44,51 C41,49 41,46 43,44 C44,43 45,45 46,44 Z"
                fill="#F2A7B0" opacity={0.7} />
              <text x={46} y={57} textAnchor="middle"
                fontFamily="'Montserrat',Arial,sans-serif" fontSize={4.5}
                fill="white" opacity={0.5}>
                tap to tune in
              </text>
            </>
          ) : (
            /* Flickering static */
            staticLines.map(([x1,y1,x2,y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#E8F4E0" strokeWidth={1.8} opacity={0.6} />
            ))
          )}

          {/* Screen glare */}
          <path d="M19,25 C22,24 28,24 30,27 C27,30 21,30 19,27 Z"
            fill="white" opacity={0.22} />

          {/* Right side panel — knobs + speaker */}
          {/* Speaker grille dots */}
          <circle cx={87} cy={30} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={87} cy={34} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={87} cy={38} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={91} cy={30} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={91} cy={34} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={91} cy={38} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={95} cy={30} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={95} cy={34} r={1.2} fill="#C9A87A" opacity={0.7} />
          <circle cx={95} cy={38} r={1.2} fill="#C9A87A" opacity={0.7} />

          {/* Dial knobs */}
          <circle cx={88} cy={53} r={5.5} fill="#E8D0A8" stroke="#6B4226" strokeWidth={1.8} />
          <circle cx={88} cy={53} r={2} fill="#C9A87A" />
          <line x1={88} y1={50} x2={88} y2={48} stroke="#6B4226" strokeWidth={1.2} strokeLinecap="round" />

          <circle cx={88} cy={67} r={4.5} fill="#E8D0A8" stroke="#6B4226" strokeWidth={1.8} />
          <circle cx={88} cy={67} r={1.6} fill="#C9A87A" />

          {/* Feet / legs */}
          <rect x={20} y={89} width={10} height={6} rx={3} fill="#E8D0A8" stroke="#6B4226" strokeWidth={1.8} />
          <rect x={70} y={89} width={10} height={6} rx={3} fill="#E8D0A8" stroke="#6B4226" strokeWidth={1.8} />

          {/* Antennas — slightly wonky */}
          <line x1={36} y1={15} x2={28} y2={2} stroke="#6B4226" strokeWidth={2} strokeLinecap="round" />
          <line x1={54} y1={15} x2={64} y2={3} stroke="#6B4226" strokeWidth={2} strokeLinecap="round" />
          {/* Antenna tips */}
          <circle cx={28} cy={2} r={2} fill="#F2A7B0" stroke="#6B4226" strokeWidth={1.2} />
          <circle cx={64} cy={3} r={2} fill="#A8BFDF" stroke="#6B4226" strokeWidth={1.2} />
        </svg>

        {/* ── EXPANDED STATE: TV grows to show full broadcast ── */}
        {expanded && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width:"min(88vw,340px)",
              background:"#F5ECD7",
              border:"2.5px solid #6B4226",
              borderRadius:18,
              boxShadow:"5px 6px 0 #C9A87A, 0 2px 18px rgba(107,66,38,0.13)",
              overflow:"hidden",
              animation:"tvExpand 0.28s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <style>{`
              @keyframes tvExpand {
                from { opacity:0; transform:scale(0.88) translateY(8px); }
                to   { opacity:1; transform:scale(1) translateY(0); }
              }
            `}</style>

            {/* TV top bar with antennas */}
            <div style={{ position:"relative",background:"#F5ECD7",paddingTop:14,paddingBottom:2,display:"flex",justifyContent:"center" }}>
              {/* Antennas */}
              <svg viewBox="0 0 120 22" width={120} height={22} style={{ position:"absolute",top:0,left:"50%",transform:"translateX(-50%)" }}>
                <line x1={48} y1={20} x2={36} y2={2} stroke="#6B4226" strokeWidth={2} strokeLinecap="round" />
                <line x1={72} y1={20} x2={84} y2={2} stroke="#6B4226" strokeWidth={2} strokeLinecap="round" />
                <circle cx={36} cy={2} r={2.5} fill="#F2A7B0" stroke="#6B4226" strokeWidth={1.2} />
                <circle cx={84} cy={2} r={2.5} fill="#A8BFDF" stroke="#6B4226" strokeWidth={1.2} />
              </svg>
            </div>

            {/* Screen — the broadcast display area */}
            <div style={{
              margin:"0 12px 12px",
              background:"#2C1E12",
              borderRadius:10,
              padding:"16px 18px 18px",
              border:"2px solid #6B4226",
              position:"relative",
              overflow:"hidden",
            }}>
              {/* Scanline overlay */}
              <div style={{
                position:"absolute",inset:0,
                backgroundImage:"repeating-linear-gradient(transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px)",
                pointerEvents:"none",borderRadius:8,
              }} />
              {/* Screen glare */}
              <div style={{
                position:"absolute",top:6,left:8,width:36,height:16,
                background:"rgba(255,255,255,0.07)",borderRadius:"50%",
                transform:"rotate(-15deg)",pointerEvents:"none",
              }} />

              {/* Channel tag */}
              <p style={{
                fontFamily:"'Montserrat',Arial,sans-serif",
                fontSize:9,
                color:"#F6C94A",
                letterSpacing:2,
                marginBottom:10,
                opacity:0.8,
                textTransform:"uppercase",
              }}>
                ✦ ch. 7 · tiny broadcast
              </p>

              {/* The message */}
              <p style={{
                fontFamily:"var(--font-hand)",
                fontSize:"clamp(15px,3.5vw,19px)",
                color:"#FFF8EC",
                lineHeight:1.65,
                position:"relative",
                zIndex:1,
              }}>
                {broadcast}
              </p>

              {/* Bottom dots */}
              <div style={{ display:"flex",gap:5,marginTop:14,opacity:0.45 }}>
                {[0,1,2].map(i=>(
                  <span key={i} style={{ width:4,height:4,borderRadius:"50%",background:"#F6C94A",display:"inline-block" }} />
                ))}
              </div>
            </div>

            {/* Bottom casing strip with knob + close */}
            <div style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"6px 16px 12px",
            }}>
              {/* Decorative knobs */}
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <div style={{ width:14,height:14,borderRadius:"50%",background:"#E8D0A8",border:"2px solid #6B4226" }} />
                <div style={{ width:10,height:10,borderRadius:"50%",background:"#E8D0A8",border:"1.5px solid #C9A87A" }} />
              </div>
              {/* Speaker dots */}
              <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
                {[0,1,2].map(row=>(
                  <div key={row} style={{ display:"flex",gap:3 }}>
                    {[0,1,2,3].map(col=>(
                      <div key={col} style={{ width:3,height:3,borderRadius:"50%",background:"#C9A87A",opacity:0.6 }} />
                    ))}
                  </div>
                ))}
              </div>
              {/* Close */}
              <button
                onClick={handleClose}
                aria-label="close broadcast"
                style={{
                  background:"#E8D0A8",
                  border:"2px solid #6B4226",
                  borderRadius:"50%",
                  width:28,height:28,
                  cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:"var(--font-body)",fontSize:12,
                  color:"#6B4226",fontWeight:700,
                  boxShadow:"1px 2px 0 #C9A87A",
                  flexShrink:0,
                }}
              >
                ×
              </button>
            </div>

            {/* Feet */}
            <div style={{ display:"flex",justifyContent:"space-between",padding:"0 24px 10px" }}>
              <div style={{ width:20,height:8,borderRadius:4,background:"#E8D0A8",border:"1.5px solid #C9A87A" }} />
              <div style={{ width:20,height:8,borderRadius:4,background:"#E8D0A8",border:"1.5px solid #C9A87A" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── MEMORY RESURFACING ──────────────────────────────────────────────────────

// Decide which thought (if any) to resurface for a given jar today.
// Returns a thought object or null.
function pickMemoryThought(jar) {
  if (!jar || jar.thoughts.length < MEMORY_MIN_THOUGHTS) return null;

  const todayKey = new Date().toISOString().slice(0, 10);
  const stored   = load(MEMORY_KEY, null);

  // Already have a valid stored memory for this jar today — reuse it
  if (stored && stored.date === todayKey && stored.jarId === jar.id) {
    if (stored.thoughtId === null) return null; // explicitly decided not to show today
    const found = jar.thoughts.find(t => t.id === stored.thoughtId);
    return found || null;
  }

  // New day (or different jar) — decide fresh
  // Roll the chance gate first
  if (Math.random() > MEMORY_SHOW_CHANCE) {
    save(MEMORY_KEY, { date: todayKey, jarId: jar.id, thoughtId: null });
    return null;
  }

  const now = Date.now();
  const ageThreshold = MEMORY_AGE_DAYS * 24 * 60 * 60 * 1000;

  // Prefer: non-completed, old enough (has createdAt)
  const preferred = jar.thoughts.filter(t =>
    !t.completed &&
    t.createdAt &&
    (now - new Date(t.createdAt).getTime()) >= ageThreshold
  );

  // Fallback: non-completed thoughts from the first half of the array (older by position)
  const fallback = jar.thoughts.filter(t => !t.completed);
  const halfLen  = Math.ceil(fallback.length / 2);
  const olderHalf = fallback.slice(0, halfLen);

  const pool = preferred.length > 0 ? preferred
    : olderHalf.length > 0 ? olderHalf
    : fallback;

  if (pool.length === 0) {
    save(MEMORY_KEY, { date: todayKey, jarId: jar.id, thoughtId: null });
    return null;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  save(MEMORY_KEY, { date: todayKey, jarId: jar.id, thoughtId: pick.id });
  return pick;
}

// MemoryResurface — full-viewport flex wrapper guarantees true mobile centering.
// Rendered OUTSIDE the app-root div (which has overflow:hidden) so nothing clips it.
function MemoryResurface({ thought, onDismiss, onExpand }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Dismiss mobile keyboard before showing overlay — blur any focused input/textarea
    // so the keyboard collapses and doesn't cramp or misplace the overlay.
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      active.blur();
      // Brief pause so the keyboard finishes closing before we fade in
      const t = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const dismiss = (e) => {
    e?.stopPropagation();
    setLeaving(true);
    setTimeout(onDismiss, 350);
  };

  const expand = (e) => {
    e?.stopPropagation();
    setLeaving(true);
    setTimeout(onExpand, 200);
  };

  const blobColor = PASTEL_COLORS[(thought.colorIndex ?? 0) % PASTEL_COLORS.length];

  const ago = (() => {
    if (!thought.createdAt) return null;
    const days = Math.floor((Date.now() - new Date(thought.createdAt).getTime()) / 86400000);
    if (days < 1)   return null;
    if (days === 1) return "yesterday";
    if (days < 7)   return `${days} days ago`;
    if (days < 14)  return "last week";
    const weeks = Math.floor(days / 7);
    if (weeks < 5)  return `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
    return "a while ago";
  })();

  return (
    <>
      <style>{`
        /* ── backdrop ── */
        @keyframes memBackdropIn  { from{opacity:0} to{opacity:1} }
        @keyframes memBackdropOut { from{opacity:1} to{opacity:0} }

        /* ── spark ── */
        @keyframes memSparkPop {
          0%  {opacity:0;transform:scale(0.2)}
          40% {opacity:1;transform:scale(1.3)}
          65% {transform:scale(0.88)}
          100%{opacity:1;transform:scale(1)}
        }
        @keyframes memSparkGlow {
          0%,100%{box-shadow:0 0 6px 3px rgba(246,201,74,0.55),0 0 14px 6px rgba(246,201,74,0.22)}
          50%    {box-shadow:0 0 11px 5px rgba(246,201,74,0.8),0 0 24px 10px rgba(246,201,74,0.32)}
        }

        /* ── blob + bubble ── */
        @keyframes memBlobRise {
          0%  {opacity:0;transform:translateY(20px) scale(0.82)}
          62% {opacity:1;transform:translateY(-5px) scale(1.06)}
          100%{opacity:1;transform:translateY(0)    scale(1)}
        }
        @keyframes memSpeechIn {
          0%  {opacity:0;transform:scale(0.7) translateX(-6px)}
          70% {opacity:1;transform:scale(1.04)}
          100%{opacity:1;transform:scale(1)}
        }

        /* ── card ── */
        @keyframes memCardReveal {
          0%  {opacity:0;transform:translateY(14px) scale(0.95)}
          68% {opacity:1;transform:translateY(-3px) scale(1.01)}
          100%{opacity:1;transform:translateY(0)    scale(1)}
        }

        /* ── idle animations ── */
        @keyframes memFloat  {0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)}}
        @keyframes memBobble {0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)}}

        /* ── exit ── */
        @keyframes memOut {
          from{opacity:1;transform:translateY(0) scale(1)}
          to  {opacity:0;transform:translateY(14px) scale(0.94)}
        }

        /* paper texture on note card */
        .mem-note::before {
          content:"";
          position:absolute;
          inset:0;
          border-radius:inherit;
          background:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 27px,
              rgba(201,168,122,0.10) 27px,
              rgba(201,168,122,0.10) 28px
            );
          pointer-events:none;
        }
      `}</style>

      {/* ── Full-viewport backdrop — flex centers the scene, tap to dismiss ── */}
      <div
        onClick={dismiss}
        style={{
          position:"fixed", inset:0,
          width:"100vw", height:"100dvh",
          zIndex:9999,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          background:"rgba(53,32,12,0.14)",
          backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)",
          boxSizing:"border-box",
          animation: leaving ? "memBackdropOut 0.4s ease forwards"
                             : "memBackdropIn 0.5s ease forwards",
          opacity: visible ? undefined : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        {/* ── Scene — stops click-through ── */}
        <div
          onClick={e=>e.stopPropagation()}
          style={{
            display:"flex", flexDirection:"column", alignItems:"center", gap:0,
            width:"min(88vw,360px)", maxWidth:360, boxSizing:"border-box",
            animation: leaving
              ? "memOut 0.4s ease forwards"
              : "memFloat 9s ease-in-out 2s infinite",
          }}
        >

          {/* 1 ── Spark */}
          <div style={{
            width:11, height:11, borderRadius:"50%",
            background:"#F6C94A",
            marginBottom:9,
            animation: visible && !leaving
              ? "memSparkPop 0.55s cubic-bezier(0.22,1,0.36,1) forwards, memSparkGlow 2.8s ease-in-out 0.55s infinite"
              : "none",
            opacity: visible ? undefined : 0,
          }} />

          {/* 2 ── Blob row: blob left, speech bubble right */}
          <div style={{
            display:"flex", flexDirection:"row",
            alignItems:"flex-end",
            gap:8,
            marginBottom:10,
            animation: visible && !leaving ? "memBobble 5s ease-in-out 1.1s infinite" : "none",
          }}>

            {/* Blob */}
            <div style={{
              animation: visible && !leaving
                ? "memBlobRise 0.95s cubic-bezier(0.22,1,0.36,1) 0.2s both"
                : "none",
              opacity: visible ? undefined : 0,
              position:"relative", display:"inline-block", flexShrink:0,
            }}>
              {/* Glow halo */}
              <div style={{
                position:"absolute", inset:-10, borderRadius:"50%",
                background:`radial-gradient(circle,${blobColor}50 0%,transparent 68%)`,
                pointerEvents:"none",
              }} />
              <svg viewBox="-1.3 -1.3 2.6 2.6" width={64} height={64} style={{display:"block"}}>
                <path
                  d={BLOB_VARIANTS[thought.blobSeed % BLOB_VARIANTS.length]}
                  fill={blobColor} stroke="#6B4226" strokeWidth={0.12} opacity={0.95}
                />
                {/* eyes */}
                <circle cx={-0.27} cy={-0.15} r={0.135} fill="#6B4226" opacity={0.72}/>
                <circle cx={ 0.27} cy={-0.15} r={0.135} fill="#6B4226" opacity={0.72}/>
                {/* smile */}
                <path d="M -0.17 0.18 Q 0 0.35 0.17 0.18"
                  fill="none" stroke="#6B4226" strokeWidth={0.1} strokeLinecap="round" opacity={0.6}/>
              </svg>
            </div>

            {/* Speech bubble — SVG so it looks hand-drawn */}
            <div style={{
              animation: visible && !leaving
                ? "memSpeechIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.85s both"
                : "none",
              opacity: visible ? undefined : 0,
              marginBottom:10,       /* aligns bubble tail near blob mouth */
              flexShrink:1,
            }}>
              <svg
                viewBox="0 0 148 58"
                width={148} height={58}
                xmlns="http://www.w3.org/2000/svg"
                style={{overflow:"visible", display:"block"}}
              >
                {/* Hand-drawn bubble body — slightly imperfect path */}
                <path
                  d="M8,6 C6,4 9,2 14,2 L134,2 C140,2 146,5 146,10
                     L146,38 C146,44 140,48 134,48 L42,48
                     C40,48 38,50 34,57 C32,52 30,50 26,48
                     L14,48 C8,48 2,44 2,38 L2,10 C2,6 5,4 8,6 Z"
                  fill="#FFFDF5"
                  stroke="#C9A87A"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Speech text */}
                <text
                  x="74" y="20"
                  textAnchor="middle"
                  fontFamily="Georgia,'Times New Roman',serif"
                  fontStyle="italic"
                  fontSize="11"
                  fill="#A07850"
                  letterSpacing="0.2"
                >i found this again...</text>
                {/* Age pill text as second line if present */}
                {ago && (
                  <text
                    x="74" y="37"
                    textAnchor="middle"
                    fontFamily="'Montserrat',Arial,sans-serif"
                    fontSize="9.5"
                    fill="#C9A87A"
                    letterSpacing="0.1"
                  >{ago}</text>
                )}
              </svg>
            </div>

          </div>{/* end blob row */}

          {/* 3 ── Memory note card */}
          <div
            className="mem-note"
            style={{
              width:"100%", boxSizing:"border-box",
              position:"relative",
              /* warm off-white paper feel */
              background:"linear-gradient(160deg,#FFFEF8 0%,#FFF8EC 100%)",
              /* imperfect rounded corners — slightly different per corner */
              borderRadius:"18px 22px 20px 16px",
              border:"2px solid #D4B896",
              /* layered shadow: soft depth + paper lift + subtle warm tint */
              boxShadow:
                "0 2px 0 #E8D0A8," +
                "0 4px 0 #DFC49A," +
                "0 8px 24px rgba(107,66,38,0.13)," +
                "1px 2px 8px rgba(201,168,122,0.18)",
              overflow:"hidden",
              animation: visible && !leaving
                ? "memCardReveal 0.85s cubic-bezier(0.22,1,0.36,1) 0.5s both"
                : "none",
              opacity: visible ? undefined : 0,
            }}
          >
            {/* Torn-paper top edge — decorative SVG strip */}
            <svg
              viewBox="0 0 360 10" width="100%" height="10"
              preserveAspectRatio="none"
              style={{display:"block",marginBottom:-1}}
            >
              <path
                d="M0,8 C18,2 36,10 54,6 C72,2 90,9 108,5
                   C126,1 144,8 162,6 C180,4 198,9 216,5
                   C234,1 252,8 270,4 C288,0 306,7 324,5
                   C342,3 355,8 360,6 L360,0 L0,0 Z"
                fill="#E8D4B8" opacity="0.4"
              />
            </svg>

            {/* Thought text — tap to open, primary visual focus */}
            <div
              onClick={expand}
              role="button"
              aria-label="open this thought"
              style={{
                padding:"20px 24px 16px",
                cursor:"pointer",
                boxSizing:"border-box",
                WebkitTapHighlightColor:"transparent",
                touchAction:"manipulation",
              }}
            >
              {/* Decorative quote mark */}
              <div style={{
                fontFamily:"Georgia,serif",
                fontSize:44,
                color:"#E0C8A8",
                lineHeight:0.55,
                marginBottom:10,
                userSelect:"none",
                textAlign:"left",
              }}>"</div>

              <p style={{
                fontFamily:"var(--font-hand)",
                fontSize:"clamp(20px,5.5vw,24px)",
                color:"#3D2510",
                lineHeight:1.72,
                margin:0,
                textAlign:"center",
                wordBreak:"break-word",
                overflowWrap:"break-word",
                hyphens:"auto",
                letterSpacing:"0.01em",
              }}>
                {thought.text}
              </p>
            </div>

            {/* Faint ruled line above buttons */}
            <div style={{
              height:1,
              margin:"0 20px",
              background:"linear-gradient(90deg,transparent,#E0C8A8 20%,#E0C8A8 80%,transparent)",
              opacity:0.5,
            }}/>

            {/* Buttons */}
            <div style={{
              display:"flex", gap:8,
              padding:"14px 18px 18px",
              justifyContent:"center",
              flexWrap:"wrap", boxSizing:"border-box",
            }}>
              <button
                onClick={expand}
                style={{
                  background:"#A8C5A0",
                  border:"2px solid #6B4226",
                  borderRadius:50,
                  padding:"9px 22px",
                  fontFamily:"var(--font-body)",
                  fontSize:13, fontWeight:500,
                  color:"#3D2510",
                  cursor:"pointer",
                  boxShadow:"2px 3px 0 #6B4226",
                  WebkitTapHighlightColor:"transparent",
                  touchAction:"manipulation",
                  boxSizing:"border-box",
                }}
              >
                thanks, little blob
              </button>
              <button
                onClick={dismiss}
                style={{
                  background:"transparent",
                  border:"2px solid #D4C5B0",
                  borderRadius:50,
                  padding:"9px 22px",
                  fontFamily:"var(--font-body)",
                  fontSize:13,
                  color:"#A07850",
                  cursor:"pointer",
                  WebkitTapHighlightColor:"transparent",
                  touchAction:"manipulation",
                  boxSizing:"border-box",
                }}
              >
                let it drift away
              </button>
            </div>

          </div>{/* end note card */}
        </div>{/* end scene wrapper */}
      </div>{/* end viewport */}
    </>
  );
}

// ─── BLOB TEACHER ────────────────────────────────────────────────────────────
// First-visit guided tour. Highlights work by temporarily elevating the target
// element's z-index above the dim layer via an injected <style> tag — the live
// element stays 100% visible at its original colours. No clip-path, no polygons,
// no rendering artefacts. Fonts: Montserrat (var(--font-body)) throughout.

const BLOB_TEACHER_STEPS = [
  // 0 — welcome, no highlight
  { blob:"#F2A7B0", speech:"hi! i'm blob. i'll show you around.",                  target:null  },
  // 1 — input field + plus button
  { blob:"#F6E27A", speech:"drop thoughts here whenever you'd like.",              target:"input" },
  // 2 — jar
  { blob:"#A8C5A0", speech:"tap the jar to rediscover something you've written before.", target:"jar" },
  // 3 — dice
  { blob:"#A8BFDF", speech:"tap the dice for a random thought.",                   target:"dice" },
  // 4 — TV — stronger dim so TV is clearly the focus
  { blob:"#F4B183", speech:"the little tv shares a new daily broadcast every day.", target:"tv", strongDim:true },
  // 5 — memory resurfacing preview (no target; preview card shown below)
  { blob:"#D4A5C9", speech:"sometimes i'll bring old thoughts back for you.",      target:null, preview:true },
  // 6 — farewell, no highlight
  { blob:"#F2A7B0", speech:"that's it. this is your space. i'll be around.",      target:null, last:true },
];

// Measured rect of a data-bt-target element, with padding
function getTargetRect(targetKey, pad = 22) {
  if (!targetKey) return null;
  const el = document.querySelector(`[data-bt-target="${targetKey}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top:r.top-pad, left:r.left-pad, right:r.right+pad, bottom:r.bottom+pad,
           width:r.width+pad*2, height:r.height+pad*2 };
}

// ── MemoryResurfacePreview ────────────────────────────────────────────────────
// Static mockup of the real MemoryResurface popup — does NOT touch production
// resurfacing logic. Shown during the onboarding step that explains the feature.
const PREVIEW_THOUGHT = "be kinder to yourself.";
const PREVIEW_BLOB_COLOR = "#D4A5C9";

function MemoryResurfacePreview() {
  return (
    <>
      <style>{`
        @keyframes previewFadeUp {
          from { opacity:0; transform:translateY(10px) scale(0.95); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes previewBobble {
          0%,100% { transform:translateY(0px); }
          50%      { transform:translateY(-3px); }
        }
        @keyframes previewSparkle {
          0%,100%{ opacity:0.3; transform:scale(1);   }
          50%    { opacity:0.6; transform:scale(1.2);  }
        }
      `}</style>

      {/* Outer wrapper: 80% opacity + slight scale-down makes preview feel secondary */}
      <div style={{
        width:"min(78vw,270px)", margin:"2px auto 0",
        opacity:0.80,
        transform:"scale(0.92)",
        transformOrigin:"top center",
        animation:"previewFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.25s both",
      }}>
        {/* Sparkle + blob row above card */}
        <div style={{ display:"flex", flexDirection:"row", alignItems:"flex-end",
          gap:5, marginBottom:5, paddingLeft:3 }}>
          {/* Tiny golden spark — muted */}
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#F6C94A",
            animation:"previewSparkle 2.4s ease-in-out infinite",
            boxShadow:"0 0 4px 1px rgba(246,201,74,0.3)",
            flexShrink:0, marginBottom:12 }} />
          {/* Preview blob + speech bubble */}
          <div style={{ display:"flex", flexDirection:"row", alignItems:"flex-end", gap:5 }}>
            <div style={{ position:"relative", flexShrink:0,
              animation:"previewBobble 4.5s ease-in-out infinite" }}>
              <div style={{ position:"absolute", inset:-5, borderRadius:"50%",
                background:`radial-gradient(circle,${PREVIEW_BLOB_COLOR}33 0%,transparent 68%)`,
                pointerEvents:"none" }}/>
              <svg viewBox="-1.3 -1.3 2.6 2.6" width={38} height={38} style={{display:"block"}}>
                <path d={BLOB_VARIANTS[2]} fill={PREVIEW_BLOB_COLOR}
                  stroke="#6B4226" strokeWidth={0.13} opacity={0.88}/>
                <circle cx={-0.27} cy={-0.15} r={0.12} fill="#6B4226" opacity={0.65}/>
                <circle cx={ 0.27} cy={-0.15} r={0.12} fill="#6B4226" opacity={0.65}/>
                <path d="M -0.16 0.17 Q 0 0.32 0.16 0.17"
                  fill="none" stroke="#6B4226" strokeWidth={0.1}
                  strokeLinecap="round" opacity={0.55}/>
              </svg>
            </div>
            {/* "i found this again..." speech bubble */}
            <div style={{ position:"relative", background:"#FFFDF5",
              border:"1.5px solid #C9A87A", borderRadius:"12px 12px 12px 3px",
              padding:"5px 9px", boxShadow:"1px 1px 0 #E8D0A8",
              marginBottom:5, maxWidth:130 }}>
              <div style={{ position:"absolute", left:-7, bottom:7, width:0, height:0,
                borderTop:"4px solid transparent", borderBottom:"4px solid transparent",
                borderRight:"7px solid #C9A87A" }}/>
              <div style={{ position:"absolute", left:-4, bottom:8, width:0, height:0,
                borderTop:"3px solid transparent", borderBottom:"3px solid transparent",
                borderRight:"5px solid #FFFDF5" }}/>
              <p style={{ margin:0, fontFamily:"var(--font-body)", fontStyle:"italic",
                fontSize:10, color:"#A07850", lineHeight:1.35, whiteSpace:"nowrap" }}>
                i found this again...
              </p>
            </div>
          </div>
        </div>

        {/* Memory note card — matches real card but slightly muted */}
        <div style={{
          background:"linear-gradient(160deg,#FFFEF8 0%,#FFF8EC 100%)",
          borderRadius:"12px 15px 13px 10px",
          border:"1.5px solid #D4B896",
          boxShadow:"0 2px 0 #E8D0A8, 0 3px 12px rgba(107,66,38,0.09)",
          overflow:"hidden",
        }}>
          {/* Torn-paper top edge */}
          <svg viewBox="0 0 270 7" width="100%" height="7" preserveAspectRatio="none"
            style={{display:"block", marginBottom:-1}}>
            <path d="M0,5 C13,1 26,6 39,4 C52,2 65,6 78,3 C91,0 104,5 117,4
                     C130,3 143,6 156,3 C169,0 182,5 195,3 C208,1 221,5 234,3
                     C247,1 260,5 270,4 L270,0 L0,0 Z"
              fill="#E8D4B8" opacity="0.35"/>
          </svg>
          {/* Label */}
          <div style={{ padding:"6px 10px 3px", borderBottom:"1px solid #F0E4D0",
            display:"flex", alignItems:"center", gap:3 }}>
            <span style={{ fontFamily:"var(--font-body)", fontSize:9, color:"#A07850",
              fontStyle:"italic", letterSpacing:0.15 }}>✦ a thought floated back...</span>
          </div>
          {/* Thought text */}
          <div style={{ padding:"8px 12px 10px" }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:22, color:"#E8D0A8",
              lineHeight:0.5, marginBottom:5, userSelect:"none" }}>"</div>
            <p style={{ margin:0, fontFamily:"var(--font-body)", fontStyle:"italic",
              fontSize:"clamp(12px,3.5vw,14px)", color:"#4A3018",
              lineHeight:1.55, textAlign:"center" }}>
              {PREVIEW_THOUGHT}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function BlobTeacher({ onDone }) {
  const [step, setStep]       = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [glowRect, setGlowRect] = useState(null);

  const current    = BLOB_TEACHER_STEPS[step];
  const isLast     = !!current.last;
  const hasPreview = !!current.preview;
  const blobVariant = step % BLOB_VARIANTS.length;

  // ── Fade in on first mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // ── Measure glow-ring target position when step changes
  useEffect(() => {
    if (!current.target) { setGlowRect(null); return; }
    const t = setTimeout(() => setGlowRect(getTargetRect(current.target, 22)), 80);
    return () => clearTimeout(t);
  }, [step, current.target]);

  // ── Elevate the target element above the dim layer while highlighted.
  //    Injecting z-index: 8504 lifts the live element above the dim (8500),
  //    glow ring (8502), and panel (8503) so it is fully visible at original
  //    colours. We do NOT add position:relative because some targets already
  //    use position:absolute or transforms that must not be disturbed.
  //    isolation:isolate creates a stacking context without moving the element.
  useEffect(() => {
    if (!current.target) return;
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-bt-highlight", "true");
    styleEl.textContent = `
      [data-bt-target="${current.target}"] {
        z-index: 8504 !important;
        isolation: isolate;
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      const el = document.querySelector('style[data-bt-highlight]');
      if (el) el.remove();
    };
  }, [step, current.target]);

  const advance = () => {
    if (isLast) { finish(); return; }
    setLeaving(true);
    setTimeout(() => { setLeaving(false); setStep(s => s + 1); }, 240);
  };

  const finish = () => { save(BLOB_TEACHER_KEY, true); onDone(); };

  // ── Position the blob/bubble/button panel relative to the glow rect
  const computePanelPos = () => {
    if (!glowRect || !visible) return { bottom:"10vh" };
    const vh = window.innerHeight;
    const spaceBelow = vh - glowRect.bottom;
    const spaceAbove = glowRect.top;
    if (spaceBelow >= 170) return { top: `${glowRect.bottom + 18}px` };
    if (spaceAbove >= 170) return { bottom: `${vh - glowRect.top + 18}px` };
    return { bottom: "10vh" };
  };
  const panelPos = computePanelPos();

  const isStrongDim = !!current.strongDim;

  return (
    <>
      <style>{`
        @keyframes btFadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes btBlobIn   { 0%{opacity:0;transform:translateY(12px) scale(0.88)}
                                65%{opacity:1;transform:translateY(-3px) scale(1.04)}
                               100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes btBlobOut  { from{opacity:1;transform:scale(1)}
                                  to{opacity:0;transform:translateY(8px) scale(0.9)} }
        @keyframes btSpeechIn { 0%{opacity:0;transform:scale(0.82) translateX(-4px)}
                               70%{opacity:1;transform:scale(1.03)}
                              100%{opacity:1;transform:scale(1)} }
        @keyframes btCardIn   { 0%{opacity:0;transform:translateY(8px) scale(0.96)}
                               70%{opacity:1;transform:translateY(-1px) scale(1.01)}
                              100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes btBobble   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes btGlowPulse {
          0%,100%{ box-shadow: 0 0 0 4px rgba(246,201,74,0.25),
                               0 0 20px 8px rgba(246,201,74,0.18); }
          50%    { box-shadow: 0 0 0 7px rgba(246,201,74,0.48),
                               0 0 34px 16px rgba(246,201,74,0.32); }
        }
        @keyframes btGlowPulseStrong {
          0%,100%{ box-shadow: 0 0 0 6px rgba(246,201,74,0.4),
                               0 0 28px 12px rgba(246,201,74,0.3),
                               0 0 48px 22px rgba(246,201,74,0.14); }
          50%    { box-shadow: 0 0 0 9px rgba(246,201,74,0.65),
                               0 0 40px 18px rgba(246,201,74,0.48),
                               0 0 64px 32px rgba(246,201,74,0.22); }
        }
      `}</style>

      {/* ── Smooth full-screen dim — plain rgba, no clip-path, zero artefacts ── */}
      <div
        onClick={advance}
        style={{
          position:"fixed", inset:0,
          width:"100vw", height:"100dvh",
          zIndex:8500,
          background: isStrongDim ? "rgba(28,14,4,0.72)" : "rgba(40,22,8,0.54)",
          animation: visible ? "btFadeIn 0.45s ease forwards" : "none",
          opacity: visible ? undefined : 0,
          pointerEvents: visible ? "auto" : "none",
          transition:"background 0.3s ease",
        }}
      />

      {/* ── Golden glow ring around the highlighted element ─────────────────
           z-index 8502 sits above the dim (8500) but below the elevated
           target element (8504) and the panel (8503). pointer-events:none
           so clicks fall through to the elevated element itself.            ── */}
      {glowRect && visible && (
        <div
          style={{
            position:"fixed",
            top:    glowRect.top,
            left:   glowRect.left,
            width:  glowRect.width,
            height: glowRect.height,
            borderRadius: 22,
            border: isStrongDim
              ? "2.5px solid rgba(246,201,74,0.85)"
              : "2px solid rgba(246,201,74,0.6)",
            animation: isStrongDim
              ? "btGlowPulseStrong 2s ease-in-out infinite"
              : "btGlowPulse 2.2s ease-in-out infinite",
            zIndex:8502,
            pointerEvents:"none",  /* clicks fall through to the elevated element */
            background:"transparent",
          }}
        />
      )}

      {/* ── Blob + speech + preview + buttons panel ── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position:"fixed",
          ...panelPos,
          left:"50%",
          transform:"translateX(-50%)",
          width:"min(88vw, 340px)",
          maxWidth:340,
          zIndex:8503,
          display:"flex",
          flexDirection:"column",
          alignItems:"center",
          gap:0,
          boxSizing:"border-box",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        {/* Progress dots */}
        <div style={{ display:"flex", gap:6, marginBottom:16,
          animation: visible ? "btCardIn 0.5s ease 0.05s both" : "none" }}>
          {BLOB_TEACHER_STEPS.map((_, i) => (
            <div key={i} style={{
              width:i===step?18:7, height:7, borderRadius:50,
              background:i===step?"#E85D3A":i<step?"#A8C5A0":"#D4C5B0",
              border:"1.5px solid #6B4226", transition:"all 0.3s ease",
            }}/>
          ))}
        </div>

        {/* Blob + speech bubble row */}
        <div style={{
          display:"flex", flexDirection:"row", alignItems:"flex-end", gap:8, marginBottom:10,
          animation: leaving
            ? "btBlobOut 0.24s ease forwards"
            : visible ? "btBobble 5s ease-in-out 0.8s infinite" : "none",
        }}>
          {/* Blob */}
          <div style={{
            animation: leaving ? "none" : visible
              ? "btBlobIn 0.8s cubic-bezier(0.22,1,0.36,1) 0.1s both" : "none",
            position:"relative", display:"inline-block", flexShrink:0,
          }}>
            <div style={{ position:"absolute", inset:-8, borderRadius:"50%",
              background:`radial-gradient(circle,${current.blob}44 0%,transparent 68%)`,
              pointerEvents:"none" }}/>
            <svg viewBox="-1.3 -1.3 2.6 2.6" width={60} height={60} style={{display:"block"}}>
              <path d={BLOB_VARIANTS[blobVariant]} fill={current.blob}
                stroke="#6B4226" strokeWidth={0.12} opacity={0.95}/>
              <circle cx={-0.27} cy={-0.15} r={0.13} fill="#6B4226" opacity={0.7}/>
              <circle cx={ 0.27} cy={-0.15} r={0.13} fill="#6B4226" opacity={0.7}/>
              <path d="M -0.17 0.18 Q 0 0.34 0.17 0.18"
                fill="none" stroke="#6B4226" strokeWidth={0.1} strokeLinecap="round" opacity={0.6}/>
            </svg>
          </div>

          {/* Speech bubble — Montserrat, HTML div, wraps naturally */}
          <div style={{
            animation: leaving ? "none" : visible
              ? "btSpeechIn 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.65s both" : "none",
            marginBottom:8, flexShrink:1, maxWidth:220,
          }}>
            <div style={{
              position:"relative",
              background:"#FFFDF5",
              border:"2px solid #C9A87A",
              borderRadius:"16px 16px 16px 4px",
              padding:"9px 13px",
              boxShadow:"2px 2px 0 #E8D0A8",
            }}>
              {/* Tail → blob */}
              <div style={{ position:"absolute", left:-10, bottom:10, width:0, height:0,
                borderTop:"6px solid transparent", borderBottom:"6px solid transparent",
                borderRight:"10px solid #C9A87A" }}/>
              <div style={{ position:"absolute", left:-7, bottom:11, width:0, height:0,
                borderTop:"5px solid transparent", borderBottom:"5px solid transparent",
                borderRight:"8px solid #FFFDF5" }}/>
              <p style={{
                margin:0,
                fontFamily:"var(--font-body)",    /* Montserrat */
                fontStyle:"italic",
                fontSize:"clamp(11px,3.2vw,13px)",
                color:"#A07850",
                lineHeight:1.5,
                whiteSpace:"normal",
                wordBreak:"break-word",
              }}>{current.speech}</p>
            </div>
          </div>
        </div>

        {/* Memory Resurfacing preview card — shown on the preview step */}
        {hasPreview && visible && !leaving && (
          <MemoryResurfacePreview />
        )}

        {/* Action buttons */}
        <div style={{
          display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap",
          marginTop: hasPreview ? 12 : 0,
          animation: visible ? "btCardIn 0.6s ease 0.3s both" : "none",
        }}>
          <button onClick={advance} style={{
            background:isLast?"#A8C5A0":"#E85D3A",
            border:"2.5px solid #6B4226", borderRadius:50, padding:"10px 28px",
            fontFamily:"var(--font-body)",    /* Montserrat */
            fontSize:14, fontWeight:500,
            color:isLast?"#3D2510":"white",
            cursor:"pointer", boxShadow:"3px 4px 0 #6B4226",
            WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
          }}>
            {isLast ? "i'm ready" : "next →"}
          </button>
          {!isLast && (
            <button onClick={finish} style={{
              background:"transparent", border:"none",
              fontFamily:"var(--font-body)",    /* Montserrat */
              fontSize:13, color:"#A07850",
              cursor:"pointer", padding:"10px 8px", opacity:0.7,
              WebkitTapHighlightColor:"transparent",
            }}>
              skip
            </button>
          )}
        </div>
      </div>
    </>
  );
}



// ─── COMPLETION STARDUST ─────────────────────────────────────────────────────
// Lightweight particle burst shown when a thought is marked complete.
// Renders into a fixed full-viewport canvas so it never affects layout.
// Particles are plain divs — no canvas API, no external libraries.

const STARDUST_SHAPES = ["✦","✧","⋆","·","★","✺","✸"];
const STARDUST_COLORS = ["#F6C94A","#F2A7B0","#A8C5A0","#C9A87A","#D4B8E0","#A8BFD4","#F6C94A"];

function Stardust({ active, onDone }) {
  const [particles, setParticles] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    // Generate 22 particles with randomised properties
    const ps = Array.from({ length: 22 }, (_, i) => ({
      id: i,
      shape: STARDUST_SHAPES[Math.floor(Math.random() * STARDUST_SHAPES.length)],
      color: STARDUST_COLORS[Math.floor(Math.random() * STARDUST_COLORS.length)],
      // spread across 30%–70% of viewport width, centred
      left: 30 + Math.random() * 40,      // vw
      // start from roughly screen-centre, each drifts up a different amount
      top: 35 + Math.random() * 30,        // vh at start
      dx: (Math.random() - 0.5) * 60,     // px horizontal drift
      dy: -(40 + Math.random() * 80),     // px vertical rise
      rot: (Math.random() - 0.5) * 360,   // deg rotation
      size: 12 + Math.random() * 14,       // px font-size
      delay: Math.random() * 0.25,         // s stagger
      dur: 0.9 + Math.random() * 0.5,     // s animation duration
    }));
    setParticles(ps);
    // Auto-clean after longest particle finishes (max delay+dur ≈ 1.8s, add buffer)
    timerRef.current = setTimeout(() => {
      setParticles([]);
      onDone?.();
    }, 2200);
    return () => clearTimeout(timerRef.current);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active && particles.length === 0) return null;

  return (
    <div style={{
      position:"fixed", inset:0,
      width:"100vw", height:"100dvh",
      zIndex:9998,                    // below MemoryResurface (9999) but above everything else
      pointerEvents:"none",           // never blocks taps
      overflow:"hidden",
    }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position:"absolute",
            left:`${p.left}vw`,
            top:`${p.top}vh`,
            fontSize:p.size,
            color:p.color,
            userSelect:"none",
            pointerEvents:"none",
            willChange:"transform,opacity",
            animation:`stardustFly ${p.dur}s cubic-bezier(0.22,1,0.36,1) ${p.delay}s forwards`,
            // CSS custom properties drive the per-particle drift
            "--dx":`${p.dx}px`,
            "--dy":`${p.dy}px`,
            "--rot":`${p.rot}deg`,
          }}
        >
          {p.shape}
        </div>
      ))}
      <style>{`
        @keyframes stardustFly {
          0%   { opacity:0;   transform:translate(0,0) rotate(0deg) scale(0.4); }
          18%  { opacity:1;   transform:translate(calc(var(--dx)*0.2),calc(var(--dy)*0.2)) rotate(calc(var(--rot)*0.2)) scale(1.1); }
          100% { opacity:0;   transform:translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(0.6); }
        }
      `}</style>
    </div>
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

// ─── FOOTER ─────────────────────────────────────────────────────────────────

function AppFooter() {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      padding: "8px 16px 10px",
      textAlign: "center",
      pointerEvents: "none",
      zIndex: 5,
    }}>
      <p style={{
        fontFamily: "var(--font-body)",
        fontSize: 10,
        color: "#A07850",
        opacity: 0.55,
        letterSpacing: 0.3,
        margin: 0,
      }}>
        © 2026 little thoughts studio. all rights reserved.
      </p>
    </div>
  );
}

// ─── PWA GATE ───────────────────────────────────────────────────────────────

function isPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function BrowserGate() {
  // Hard gate: shows full-screen add-to-home-screen instructions
  // Only rendered when NOT in PWA/standalone mode
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#FBF5E8",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", zIndex: 2000, padding: "2rem 1.5rem",
    }}>
      {/* Dot grid */}
      <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.06,pointerEvents:"none" }}>
        <pattern id="bg-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#6B4226" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#bg-dots)" />
      </svg>

      <div style={{ maxWidth: 380, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, position: "relative" }}>
        {/* App icon blob */}
        <svg viewBox="-1.3 -1.3 2.6 2.6" width={56} height={56}>
          <path d="M0,-1 C0.6,-0.9 1.1,-0.3 1,0.4 C0.9,1.1 0.2,1.3 -0.4,1.1 C-1,0.9 -1.2,0.2 -1,-0.3 C-0.8,-0.9 -0.6,-1.1 0,-1"
            fill="#F6E27A" stroke="#6B4226" strokeWidth={0.18} />
        </svg>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-hand)", fontSize: "clamp(30px,6vw,42px)",
            color: "#3D2510", lineHeight: 1.5, overflow: "visible", paddingBottom: 4, marginBottom: 8 }}>
            thoughts jar
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "clamp(14px,2.5vw,16px)",
            color: "#A07850", lineHeight: 1.65 }}>
            best experienced as a home screen app.
          </p>
        </div>

        {/* Instructions card */}
        <div style={{ background: "#FFFDF5", border: "2.5px solid #6B4226", borderRadius: 20,
          width: "100%", padding: "1.5rem 1.6rem", boxShadow: "5px 6px 0 #C9A87A",
          display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ background: "#FBF5E8", borderRadius: 12, padding: "12px 14px", border: "1.5px solid #E8D8C0" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "#A07850",
              marginBottom: 5, fontWeight: 600, letterSpacing: 0.3 }}>
              on iphone
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#5C3D22", lineHeight: 1.7 }}>
              open in <strong>safari</strong> → tap the{" "}
              <svg viewBox="0 0 16 16" width={13} height={13} style={{ display: "inline-block", verticalAlign: "middle" }}>
                <rect x={2} y={7} width={12} height={8} rx={1.5} fill="none" stroke="#6B4226" strokeWidth={1.2}/>
                <line x1={8} y1={1} x2={8} y2={10} stroke="#6B4226" strokeWidth={1.2} strokeLinecap="round"/>
                <polyline points="5,3.5 8,1 11,3.5" fill="none" stroke="#6B4226" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>{" "}
              share icon → <strong>add to home screen</strong>
            </p>
          </div>

          <div style={{ background: "#FBF5E8", borderRadius: 12, padding: "12px 14px", border: "1.5px solid #E8D8C0" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "#A07850",
              marginBottom: 5, fontWeight: 600, letterSpacing: 0.3 }}>
              on android
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#5C3D22", lineHeight: 1.7 }}>
              open in <strong>chrome</strong> → tap <strong>⋮</strong> → <strong>add to home screen</strong>
            </p>
          </div>

          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#B89070",
            lineHeight: 1.6, fontStyle: "italic", textAlign: "center" }}>
            once added, it opens just like a real app — no browser bar, no distractions.
          </p>
        </div>

        <AppFooter />
      </div>
    </div>
  );
}

// ─── HOME SCREEN PROMPT ─────────────────────────────────────────────────────

function HomeScreenPrompt({ onDone }) {
  // Detect if already in standalone (PWA) mode — skip if so
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  // Auto-skip in standalone
  useEffect(() => { if (isStandalone) onDone(); }, [isStandalone, onDone]);

  if (isStandalone) return null;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(251,245,232,0.92)",
      backdropFilter:"blur(8px)",display:"flex",alignItems:"center",
      justifyContent:"center",zIndex:1100,padding:"1.5rem" }}>
      <div style={{ background:"#FFFDF0",border:"2.5px solid #6B4226",borderRadius:20,
        width:"min(92vw,400px)",padding:"1.8rem 1.8rem 1.5rem",
        boxShadow:"6px 8px 0 #C9A87A" }}>
        {/* Tiny phone icon */}
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
          <svg viewBox="0 0 24 24" width={22} height={22}>
            <rect x={4} y={1} width={16} height={22} rx={3} fill="none" stroke="#6B4226" strokeWidth={1.8}/>
            <circle cx={12} cy={19.5} r={1.2} fill="#6B4226"/>
            <line x1={12} y1={7} x2={12} y2={14} stroke="#6B4226" strokeWidth={1.8} strokeLinecap="round"/>
            <line x1={8.5} y1={10.5} x2={15.5} y2={10.5} stroke="#6B4226" strokeWidth={1.8} strokeLinecap="round"/>
          </svg>
          <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(16px,3.5vw,20px)",
            color:"#3D2510",lineHeight:1.4,overflow:"visible",paddingBottom:2 }}>
            best used as a home screen app
          </p>
        </div>
                <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#6B5040",lineHeight:1.7,marginBottom:10 }}>
          thoughts jar currently saves your thoughts locally on this device.
        </p>

        <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#6B5040",lineHeight:1.7,marginBottom:10 }}>
          before you start filling your jar, please add the app to your home screen first so your thoughts stay in the same place.
        </p>

        <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#C65A4A",fontWeight:700,lineHeight:1.6,marginBottom:14 }}>
          starting in browser first may not carry your thoughts over later
        </p>
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
          <div style={{ background:"#FBF5E8",borderRadius:10,padding:"9px 12px",border:"1.5px solid #E8D8C0" }}>
            <p style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#A07850",fontWeight:600,marginBottom:3 }}>on iphone</p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#5C3D22",lineHeight:1.6 }}>
              open in safari → tap share → choose <strong>add to home screen</strong>
            </p>
          </div>
          <div style={{ background:"#FBF5E8",borderRadius:10,padding:"9px 12px",border:"1.5px solid #E8D8C0" }}>
            <p style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#A07850",fontWeight:600,marginBottom:3 }}>on android</p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#5C3D22",lineHeight:1.6 }}>
              open in chrome → tap menu → choose <strong>add to home screen</strong>
            </p>
          </div>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onDone}
            style={{ flex:1,background:"#E85D3A",border:"2px solid #6B4226",borderRadius:50,
              padding:"10px 0",fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,
              color:"white",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226" }}>
            continue in browser
          </button>
        </div>
        <p style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#B89070",textAlign:"center",
          marginTop:10,fontStyle:"italic" }}>
          you can add it later via the home screen icon in the menu
        </p>
      </div>
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
  const goBack = () => {
    if (screen <= 1) return;
    setLeaving(true);
    setTimeout(() => { setLeaving(false); setScreen(s => s - 1); }, 320);
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
      <div style={{ position:"absolute",bottom:32,display:"flex",flexDirection:"column",
        alignItems:"center",gap:10 }}>
        <div style={{ display:"flex",gap:10 }}>
          {[1,2,3,4].map(n => (
            <div key={n} style={{ width: n===screen?22:8, height:8, borderRadius:50,
              background: n===screen?"#E85D3A":"#D4C5B0", border:"1.5px solid #6B4226",
              transition:"all 0.3s ease" }} />
          ))}
        </div>
        {screen > 1 && (
          <button onClick={goBack}
            style={{ background:"transparent",border:"none",cursor:"pointer",
              fontFamily:"var(--font-body)",fontSize:12,color:"#A07850",opacity:0.7,
              display:"flex",alignItems:"center",gap:4 }}>
            ← back
          </button>
        )}
      </div>
      <div style={screenStyle}>
        {screen===1 && <>
          {/* Welcome jar — rounded candy-jar style matching icon set */}
          <svg viewBox="0 0 120 150" width={120} height={150} style={{ animation:"floatUp 0.6s ease both" }}>
            {/* Shadow */}
            <ellipse cx={60} cy={146} rx={36} ry={6} fill="#C9A87A" opacity={0.22}/>
            {/* Jar body — rounder, wider */}
            <path d="M16,55 C12,62 10,76 9,92 C8,110 8,124 10,133 C13,140 20,144 35,146 C46,147 54,147 60,147 C66,147 74,147 85,146 C100,144 107,140 110,133 C112,124 112,110 111,92 C110,76 108,62 104,55 Z"
              fill="#FFFBF0" stroke="#6B4226" strokeWidth={3} strokeLinejoin="round"/>
            {/* Neck */}
            <path d="M30,38 C28,42 24,48 20,55 L100,55 C96,48 92,42 90,38 Z"
              fill="#FFFBF0" stroke="#6B4226" strokeWidth={3} strokeLinejoin="round"/>
            {/* Lid — wide amber rectangle with rounded corners */}
            <rect x={22} y={22} width={76} height={18} rx={8}
              fill="#E8C87A" stroke="#6B4226" strokeWidth={3} strokeLinejoin="round"/>
            {/* Lid clasp — small oval */}
            <ellipse cx={60} cy={22} rx={12} ry={6}
              fill="#D4A840" stroke="#6B4226" strokeWidth={2.5}/>
            {/* Blobs inside jar */}
            <clipPath id="welcome-jar-clip">
              <path d="M18,58 C14,68 12,84 11,100 C10,116 10,128 12,136 C15,142 22,145 37,146 C48,147 55,147 60,147 C65,147 72,147 83,146 C98,145 105,142 108,136 C110,128 110,116 109,100 C108,84 106,68 102,58 Z"/>
            </clipPath>
            <g clipPath="url(#welcome-jar-clip)">
              {/* Pink blob */}
              <ellipse cx={40} cy={128} rx={18} ry={15} fill="#F2A7B0" stroke="#6B4226" strokeWidth={2}/>
              {/* Yellow blob */}
              <ellipse cx={62} cy={133} rx={15} ry={13} fill="#F6E27A" stroke="#6B4226" strokeWidth={2}/>
              {/* Blue blob */}
              <ellipse cx={82} cy={126} rx={16} ry={14} fill="#A8BFDF" stroke="#6B4226" strokeWidth={2}/>
            </g>
            {/* Shine */}
            <path d="M18,68 C17,80 16,96 17,108" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" opacity={0.45}/>
          </svg>
          <h1 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(34px,6vw,52px)",color:"#3D2510",lineHeight:1.6,paddingBottom:10,overflow:"visible",display:"block",animation:"floatUp 0.6s ease 0.1s both" }}>welcome to thoughts jar</h1>
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
          <div style={{ animation:"floatUp 0.6s ease both" }}>
            <svg viewBox="0 0 72 68" width={88} height={82}>
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
          <h2 style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(28px,5vw,42px)",color:"#3D2510",lineHeight:1.6,paddingBottom:10,overflow:"visible",display:"block",animation:"floatUp 0.6s ease 0.1s both" }}>a tiny daily broadcast</h2>
          <div style={{ display:"flex",flexDirection:"column",gap:12,animation:"floatUp 0.6s ease 0.2s both" }}>
            <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(14px,2.2vw,16px)",color:"#A07850",lineHeight:1.7 }}>tap the little tv whenever you want a cozy message for the day.</p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",color:"#B89070",lineHeight:1.6,fontStyle:"italic" }}>just a quiet signal from somewhere soft.</p>
          </div>
          {btn("tune in later", () => advance(4))}
        </>}
        {screen===4 && <>
          <img
            src="/icons/full-jar.svg"
            alt="jar"
            style={{
              width: 70,
              height: "auto",
              animation: "floatUp 0.6s ease both",
            }}
          />
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

function InfoModal({ onClose, musicMuted = false, setMusicMuted = () => {}, musicVolume = 0.35, setMusicVolume = () => {}, initialPage = "note" }) {
  const [page, setPage] = useState(initialPage); // "note" | "howto" | "settings"
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleReset = () => {
    // Clear all app localStorage keys
    [
      "tj-jars","tj-intro","tj-nickname","tj-activeJar",
      "tj-hsPromptSeen","tj-musicMuted","tj-musicVol",
      "thought-jar-thoughts",
    ].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const HOW_TO = [
    { icon: "💭", head: "adding thoughts", body: "type anything into the input bar and press enter. your thought becomes a little blob inside the jar." },
    { icon: "🎲", head: "using the dice", body: "tap the little dice above the jar to pull a random thought. you can roll as many times as you like." },
    { icon: "🫙", head: "rediscovering thoughts", body: "clicking the jar also pulls a random thought — a gentle surprise from your past self." },
    { icon: "◫",  head: "viewing all thoughts", body: "tap the list icon to see every thought across all your jars. you can mark them complete or remove them there." },
    { icon: "↔",  head: "switching jars", body: "inside the list view, tap any jar card at the top to switch to that jar and see its thoughts." },
    { icon: "📺", head: "daily broadcast", body: "tap the little tv to open a cozy message for the day. close it with the X or by tapping outside." },
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
                <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",color:"#5C3D22",lineHeight:1.85 }}>
                  i built this because i kept forgetting the little things — small ideas, moments i wanted to return to. by the weekend, they'd just vanish.
                </p>
                <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",color:"#5C3D22",lineHeight:1.85,fontStyle:"italic" }}>
                  so i made a jar to hold them.
                </p>
                <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",color:"#5C3D22",lineHeight:1.85 }}>
                  each jar holds 25 thoughts on purpose — not a list to fill, but a small space to revisit and actually cherish.
                </p>
                <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(12px,1.8vw,14px)",color:"#8B6040",lineHeight:1.7,marginTop:4 }}>
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

              {/* Music controls */}
              <div style={{ background:"#FBF5E8",border:"1.5px solid #E8D8C0",borderRadius:14,padding:"16px",marginBottom:0 }}>
                <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#3D2510",fontWeight:600,marginBottom:6 }}>
                  background music
                </p>
                <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#6B5040",lineHeight:1.6,marginBottom:12 }}>
                  soft looping music while you use the app.
                </p>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
                  <button onClick={() => setMusicMuted(m => !m)}
                    style={{ background: musicMuted ? "#FBF5E8" : "#A8C5A0",
                      border:"2px solid #6B4226",borderRadius:50,padding:"7px 16px",
                      fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,
                      color:"#3D2510",cursor:"pointer",
                      boxShadow: musicMuted ? "none" : "2px 3px 0 #6B4226",minWidth:80 }}>
                    {musicMuted ? "unmute" : "mute"}
                  </button>
                  <span style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#A07850" }}>
                    {musicMuted ? "music off" : "music on"}
                  </span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#A07850",flexShrink:0 }}>volume</span>
                  <input type="range" min="0" max="1" step="0.05"
                    value={musicVolume}
                    onChange={e => setMusicVolume(parseFloat(e.target.value))}
                    style={{ flex:1,accentColor:"#E85D3A",cursor:"pointer" }} />
                </div>
              </div>

              {/* Reset memory */}
              <div style={{ background:"#FBF5E8",border:"1.5px solid #E8D8C0",borderRadius:14,padding:"16px" }}>
                <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#3D2510",
                  fontWeight:600,marginBottom:6 }}>
                  reset memory
                </p>
                <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#6B5040",lineHeight:1.65,marginBottom:14 }}>
                  clears all your jars and thoughts, and returns the app to the beginning.
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

// ─── TUTORIAL OVERLAY ────────────────────────────────────────────────────────

const PRELOAD_ICON_PATHS = [
  "/icons/dice.svg",
  "/icons/list.svg",
  "/icons/full-jar.svg",
];

PRELOAD_ICON_PATHS.forEach(src => {
  const img = new Image();
  img.src = src;
});

const TUTORIAL_STEPS = [
  {
    icon: (
  <svg viewBox="0 0 60 60" width={52} height={52}>
    <path d="M12,18 C11,20 9,25 9,30 C8,37 8,44 9,49 C10,53 12,55 17,56 C22,57 26,57 30,57 C34,57 38,57 43,56 C48,55 50,53 51,49 C52,44 52,37 51,30 C51,25 49,20 48,18 Z"
      fill="#FFF8EC" stroke="#6B4226" strokeWidth={2.2} strokeLinejoin="round"/>
    <path d="M19,12 C18,13 17,15 16,17 C15,17.5 14,18 12,18 L48,18 C46,18 45,17.5 44,17 C43,15 42,13 41,12 Z"
      fill="#FFF8EC" stroke="#6B4226" strokeWidth={2.2} strokeLinejoin="round"/>
    <rect x={16} y={6} width={28} height={8} rx={3} fill="#E8C87A" stroke="#6B4226" strokeWidth={2}/>
    <ellipse cx={30} cy={6} rx={6} ry={3} fill="#D4A840" stroke="#6B4226" strokeWidth={1.8}/>
    <circle cx={44} cy={44} r={10} fill="#A8C5A0" stroke="#6B4226" strokeWidth={2}/>
    <line x1={44} y1={38} x2={44} y2={50} stroke="#6B4226" strokeWidth={2.2} strokeLinecap="round"/>
    <line x1={38} y1={44} x2={50} y2={44} stroke="#6B4226" strokeWidth={2.2} strokeLinecap="round"/>
  </svg>
),
    head: "drop a thought in",
    body: "type anything in the bar below — a feeling, an idea, something you want to remember. tap enter and it floats into the jar.",
  },
  {
    icon: (
          <img
      src="/icons/dice.svg"
      alt="jar"
      style={{
        width: 70,
        height: "auto",
      }}
    />
    ),
    head: "tap the dice to rediscover",
    body: "tap the dice above the jar to pull out a random thought. you can roll as many times as you like.",
  },
  {
    icon: (
      <img
  src="/icons/list.svg"
  alt="list"
  style={{
    width: 52,
    height: 52,
  }}
/>
    ),
    head: "see all your thoughts",
    body: "tap the list icon on the right to view every thought across all your jars. mark things done or remove them from there.",
  },
  {
    icon: (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <svg viewBox="0 0 22 18" width={22} height={18}>
      <path
        d="M14 3 L6 9 L14 15"
        fill="none"
        stroke="#6B4226"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>

    <img
      src="/icons/full-jar.svg"
      alt="jar"
      style={{ width: 42, height: 52 }}
    />

    <svg viewBox="0 0 22 18" width={22} height={18}>
      <path
        d="M8 3 L16 9 L8 15"
        fill="none"
        stroke="#6B4226"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
    ),
    head: "move between jars",
    body: "use the arrows on either side of the jar to navigate between your jars. create as many jars as you need.",
  },
  {
    icon: (
  <svg viewBox="0 0 64 64" width={52} height={52}>
    <path
      d="M32,6 C48,4 58,14 58,28 C58,44 46,60 32,58 C18,56 6,46 6,30 C6,14 16,8 32,6 Z"
      fill="#F2A7B0"
      stroke="#6B4226"
      strokeWidth={2.5}
      strokeLinejoin="round"
    />
    <path
      d="M20,32 L28,42 L46,22"
      fill="none"
      stroke="#6B4226"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
),
    head: "mark it done",
    body: "when a thought pops open, you can mark it complete or put it back. completed thoughts stay in the jar with a little strikethrough.",
  },
];

function TutorialOverlay({ onDone }) {
  const [step, setStep] = useState(0);
  const total = TUTORIAL_STEPS.length;
  const current = TUTORIAL_STEPS[step];
  const isLast = step === total - 1;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(61,37,16,0.5)",
      backdropFilter:"blur(6px)",display:"flex",alignItems:"center",
      justifyContent:"center",zIndex:900,padding:"1.5rem" }}>
      <div style={{ background:"#FFFDF5",border:"3px solid #6B4226",borderRadius:24,
        width:"min(92vw,400px)",padding:"2rem 1.8rem 1.6rem",
        boxShadow:"6px 8px 0 #C9A87A",display:"flex",flexDirection:"column",gap:20 }}>

        {/* Progress dots */}
        <div style={{ display:"flex",gap:6,justifyContent:"center" }}>
          {TUTORIAL_STEPS.map((_, i) => (
            <div key={i} style={{ width: i===step?20:7, height:7, borderRadius:50,
              background: i===step ? "#E85D3A" : i<step ? "#A8C5A0" : "#D4C5B0",
              border:"1.5px solid #6B4226", transition:"all 0.3s ease" }}/>
          ))}
        </div>

        {/* Icon */}
        <div style={{ display:"flex",justifyContent:"center" }}>
          {current.icon}
        </div>

        {/* Content */}
        <div style={{ textAlign:"center" }}>
          <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(20px,4vw,26px)",
            color:"#3D2510",lineHeight:1.5,overflow:"visible",paddingBottom:4,marginBottom:8 }}>
            {current.head}
          </p>
          <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(13px,2vw,15px)",
            color:"#6B5040",lineHeight:1.75 }}>
            {current.body}
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <button onClick={onDone}
            style={{ background:"transparent",border:"none",cursor:"pointer",
              fontFamily:"var(--font-body)",fontSize:13,color:"#A07850",
              padding:"8px 0",flexShrink:0,opacity:0.75 }}>
            skip
          </button>
          <button onClick={() => isLast ? onDone() : setStep(s => s+1)}
            style={{ flex:1,background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,
              padding:"12px 0",fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,
              color:"white",cursor:"pointer",boxShadow:"3px 4px 0 #6B4226" }}>
            {isLast ? "let's go" : "next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function ThoughtJar() {
  // ── Music
  const { muted: musicMuted, setMuted: setMusicMuted,
          volume: musicVolume, setVolume: setMusicVolume } = useBackgroundMusic();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, []);

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
  const [revealedThought, setRevealedThought] = useState(null);
  const [isJarAnimating, setIsJarAnimating]   = useState(false);
  const [toast, setToast]         = useState({ message: "", visible: false });
  const dailyBroadcast = useRef(getDailyBroadcast()).current;
  const [showList, setShowList]   = useState(false);
  const [showJarFull, setShowJarFull] = useState(false);
  const [showNewJar, setShowNewJar]   = useState(false);
  const [showInfo, setShowInfo]       = useState(false);
  const [infoInitPage, setInfoInitPage] = useState("note");
  const [editingJarName, setEditingJarName] = useState(false);
  const [jarNameInput, setJarNameInput] = useState("");
  const [showTutorial, setShowTutorial]   = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Memory resurfacing: track dismissed jars for the whole session.
  // Using a Set ref (not state) so jar switches don't trigger rerenders,
  // and dismissals persist across jar switches without resetting.
  const dismissedMemoryJars = useRef(new Set());
  const [memoryDismissedTick, setMemoryDismissedTick] = useState(0); // forces recompute after dismiss
  const [stardustActive, setStardustActive] = useState(false);
  const [showBlobTeacher, setShowBlobTeacher] = useState(false);
  const toastTimer = useRef(null);

  // ── Keyboard helper — blurs any active input/textarea to close mobile keyboard
  const blurKeyboard = useCallback(() => {
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) el.blur();
  }, []);

  // Show HS prompt if not yet seen — independent of onboarding state
  // PWA gate: detect if running as installed PWA or in browser
  const [isInPWA]      = useState(() => isPWA());
  const [showHSPrompt, setShowHSPrompt] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => !load(INTRO_KEY, false));

  // Derived active jar (clamp index in case jar was removed)
  const safeIdx  = Math.min(activeJarIndex, Math.max(0, jars.length - 1));
  const activeJar = jars[safeIdx] || jars[0];
  const currentThoughts = activeJar?.thoughts || [];

  // Memory resurfacing — recompute for the active jar.
  // dismissedMemoryJars tracks which jar IDs have been dismissed this session.
  // setMemoryDismissedTick bumps a counter to force this derivation to re-run after a dismiss.
  // Switching jars does NOT reset dismissals — each jar is dismissed independently.
  // eslint-disable-next-line no-unused-vars
  const _tick = memoryDismissedTick; // read tick so React includes it in render deps
  const memoryThought = (activeJar && !dismissedMemoryJars.current.has(activeJar.id))
    ? pickMemoryThought(activeJar)
    : null;

  // ── Persist ──────────────────────────────────────────────────────────────
  useEffect(() => { save(JARS_KEY, jars); }, [jars]);
  useEffect(() => { save(ACTIVE_JAR, safeIdx); }, [safeIdx]);

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
    setShowOnboarding(false);
    // Update first jar name
    setJars(prev => prev.map((jar, i) => i === 0 ? { ...jar, name: chosenNickname } : jar));

    // Show blob teacher unless already seen
    if (!load(BLOB_TEACHER_KEY, false)) {
      setTimeout(() => setShowBlobTeacher(true), 500);
    } else {
      // Returning user: show the tutorial hint instead
      setTimeout(() => { setShowTutorial(true); }, 700);
    }
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
    blurKeyboard(); // close mobile keyboard after submitting
  }, [currentThoughts.length, updateActiveJar, showToast, blurKeyboard]);

  const handleJarClick = useCallback(() => {
    blurKeyboard(); // close keyboard before showing thought reveal
    if (currentThoughts.length === 0) { showToast("this jar is empty — add thoughts to use it"); return; }
    const random = currentThoughts[Math.floor(Math.random() * currentThoughts.length)];
    setIsJarAnimating(true);
    setTimeout(() => { setIsJarAnimating(false); setRevealedThought(random); }, 400);
  }, [currentThoughts, showToast, blurKeyboard]);

  const handleComplete = useCallback((jarId, thoughtId) => {
    setJars(prev => prev.map(jar => jar.id !== jarId ? jar : {
      ...jar,
      thoughts: jar.thoughts.map(t => t.id === thoughtId ? { ...t, completed: true } : t),
    }));
    showToast("thought completed");
    setStardustActive(true);
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
    const newJar = { id: Date.now(), name: jarName || "new jar", thoughts: [] };
    setJars(prev => {
      setActiveJarIndex(prev.length); // switch to new jar (index = current length before push)
      return [...prev, newJar];
    });
    setShowJarFull(false);
    setShowNewJar(false);
    showToast(`"${newJar.name}" opened`);
  }, [showToast]);

  const handleRenameJar = useCallback((newName) => {
    if (!newName.trim()) return;
    setJars(prev => prev.map((jar, i) => i === safeIdx ? { ...jar, name: newName.trim() } : jar));
    setEditingJarName(false);
  }, [safeIdx]);

  // Jar navigation
  const canGoPrev = safeIdx > 0;
  const canGoNext = safeIdx < jars.length - 1;
  const goPrev = () => { blurKeyboard(); setActiveJarIndex(i => Math.max(0, i - 1)); };
  const goNext = () => { blurKeyboard(); setActiveJarIndex(i => Math.min(jars.length - 1, i + 1)); };

  return (
    <>
      {/* PWA gate: if not in PWA mode, show hard gate — no app interaction */}
      {!isInPWA && <BrowserGate />}

      {isInPWA && showHSPrompt && (
        <HomeScreenPrompt onDone={() => {
          setShowHSPrompt(false);
        }} />
      )}
      {isInPWA && !showHSPrompt && showOnboarding && <OnboardingFlow onComplete={handleOnboardingComplete} />}

     <div className="clip-x app-root" style={{
  minHeight:"100vh",
  height:"100dvh",
  maxHeight:"100dvh",
  width:"100%",
  background:"#FBF5E8",
  display:"flex",
  flexDirection:"column",
  alignItems:"center",
  justifyContent:"center",
  position:"relative",
  overflow:"hidden",
  overscrollBehavior:"none",
  padding:"2rem 1.5rem",
  fontFamily:"var(--font-body)",
  opacity: showOnboarding ? 0 : 1,
  transition:"opacity 0.4s ease",
  visibility: isInPWA ? "visible" : "hidden"
}}>

        {/* Dot grid background */}
        <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.06,pointerEvents:"none" }}>
          <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#6B4226" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Header */}
        <header style={{ position:"absolute",top:0,left:0,right:0,display:"flex",
          alignItems:"center",justifyContent:"space-between",padding:"1rem 1.4rem",
          zIndex:30 }}>

          {/* LEFT: blob icon + title */}
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <svg viewBox="-1.3 -1.3 2.6 2.6" width={30} height={30} style={{ flexShrink:0 }}>
              <path d="M0,-1 C0.6,-0.9 1.1,-0.3 1,0.4 C0.9,1.1 0.2,1.3 -0.4,1.1 C-1,0.9 -1.2,0.2 -1,-0.3 C-0.8,-0.9 -0.6,-1.1 0,-1"
                fill="#F6E27A" stroke="#6B4226" strokeWidth={0.18} />
            </svg>
            <h1 className="hand-text" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(22px,4vw,36px)",
              fontWeight:700,color:"#3D2510",letterSpacing:0.5,
              lineHeight:1.5,overflow:"visible",paddingBottom:6,display:"block" }}>
              thoughts jar
            </h1>
          </div>

          {/* RIGHT: app menu */}
          <div style={{ position:"relative" }}>
            <button
              onClick={() => { blurKeyboard(); setShowMenu(m => !m); }}
              aria-label="open menu"
              style={{
                display:"flex",alignItems:"center",gap:8,
                background:"#FFFDF0",
                border:"2px solid #C9A87A",
                borderRadius:50,
                padding:"8px 12px",
                cursor:"pointer",
                boxShadow: showMenu
                  ? "inset 1px 2px 4px rgba(107,66,38,0.12)"
                  : "2px 3px 0 #C9A87A",
                transition:"box-shadow 0.18s ease",
                WebkitTapHighlightColor:"transparent",
                touchAction:"manipulation",
              }}>
              <span style={{ fontFamily:"var(--font-body)",fontSize:14,fontWeight:600,
                color:"#3D2510",lineHeight:1.2 }}>
                menu
              </span>
              <svg viewBox="0 0 18 12" width={14} height={9} style={{ flexShrink:0,
                transform: showMenu ? "rotate(180deg)" : "rotate(0deg)",
                transition:"transform 0.22s ease" }}>
                <path d="M2,2 C5,5 9,8 9,9 C9,8 13,5 16,2"
                  fill="none" stroke="#A07850" strokeWidth={2.2}
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Dropdown card */}
            {showMenu && (
              <>
                {/* Click-outside backdrop */}
                <div
                  style={{ position:"fixed",inset:0,zIndex:28 }}
                  onClick={() => setShowMenu(false)}
                />
                <div style={{
                  position:"absolute",top:"calc(100% + 8px)",right:0,
                  background:"#FFFDF0",
                  border:"2px solid #C9A87A",
                  borderRadius:18,
                  minWidth:200,
                  boxShadow:"4px 6px 0 #C9A87A",
                  overflow:"hidden",
                  zIndex:29,
                }}>
                  {/* Menu items */}
                  {[
                    {
                      label: "info",
                        // Info: circle + i letterform matching reference
                        icon: (
                          <svg viewBox="0 0 24 28" width={16} height={19}>
                          <circle cx={12} cy={4} r={3.5} fill="none" stroke="#A07850" strokeWidth={2.2}/>
                          <path d="M10,11 C10,10 14,10 14,11 C13,14 11,20 10,24 C11,24 13,24 14,24"
                            fill="none" stroke="#A07850" strokeWidth={2.4}
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ),
                      action: () => { blurKeyboard(); setShowMenu(false); setShowInfo(true); },
                    },
                    {
                      label: "all thoughts",
                     // List: open circles + lines matching reference
                        icon: (
                         <img
  src="/icons/list.svg"
  alt="all thoughts"
  style={{
    width: 20,
    height: 20,
  }}
/>
                      ),
                      action: () => { blurKeyboard(); setShowMenu(false); setShowList(true); },
                    },
                    {
                      label: "new jar",
                      icon: (
                        <svg viewBox="0 0 20 20" width={18} height={18}>
                          <path d="M4,8 C3,9 3,11 3,13 C3,15 4,16 6,16.5 C7.5,17 9,17 10,17 C11,17 12.5,17 14,16.5 C16,16 17,15 17,13 C17,11 17,9 16,8 Z"
                            fill="none" stroke="#A07850" strokeWidth={1.5} strokeLinejoin="round"/>
                          <path d="M6.5,5.5 L6,8 L14,8 L13.5,5.5 Z" fill="none" stroke="#A07850" strokeWidth={1.5} strokeLinejoin="round"/>
                          <rect x={6} y={3.5} width={8} height={2.5} rx={1} fill="none" stroke="#A07850" strokeWidth={1.3}/>
                          <line x1={10} y1={10} x2={10} y2={14.5} stroke="#A07850" strokeWidth={1.5} strokeLinecap="round"/>
                          <line x1={7.8} y1={12.2} x2={12.2} y2={12.2} stroke="#A07850" strokeWidth={1.5} strokeLinecap="round"/>
                        </svg>
                      ),
                      action: () => { setShowMenu(false); setShowNewJar(true); },
                    },
                  ].map((item, i, arr) => (
                    <button key={item.label}
                      onClick={item.action}
                      style={{
                        display:"flex",alignItems:"center",gap:14,
                        width:"100%",padding:"13px 18px",
                        background:"transparent",border:"none",cursor:"pointer",
                        borderBottom: i < arr.length-1 ? "1.5px solid #F0E4D0" : "none",
                        WebkitTapHighlightColor:"transparent",
                        touchAction:"manipulation",
                        transition:"background 0.12s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background="#FFF8EC"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                      {item.icon}
                      <span style={{ fontFamily:"var(--font-body)",fontSize:15,
                        color:"#3D2510",fontWeight:500 }}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
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

        {/* Main content — maximises central screen zone between header, right bar and input */}
        <main style={{ display:"flex",flexDirection:"column",alignItems:"center",
          gap:"clamp(6px,1.2vh,14px)",width:"100%",maxWidth:480,
          marginTop:"clamp(28px,4.5vh,48px)",
          paddingBottom:"clamp(24px,4vh,48px)",
          position:"relative" }}>

          {/* Dice icon — above jar. Handdrawn 3D dice matching TV illustration style */}
          <button
            data-bt-target="dice"
            onClick={handleJarClick}
            aria-label="roll dice for a random thought"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              transform: "translateX(0px)",
              marginBottom: 28,
            }}>
            {/* Handdrawn 3D dice — matches reference: cube with rounded corners, clear pips */}
              <img
                src="/icons/dice.svg"
                alt="dice"
                style={{ width: 62, height: 62 }}
              />
          </button>

          {/* Jar + nav arrows — arrows close to jar body */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",
            gap:"clamp(2px,0.8vw,6px)", width:"100%" }}>

            {/* Left arrow — tight to jar */}
            <button
              onClick={goPrev} disabled={!canGoPrev}
              aria-label="previous jar"
              style={{
                transform:"translateY(-34px)",
                background:"none", border:"none", cursor: canGoPrev ? "pointer" : "default",
                padding:"0 2px", flexShrink:0, opacity: canGoPrev ? 1 : 0.2,
                WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
              }}>
              <svg viewBox="0 0 28 48" width={20} height={36}>
                <path d="M22,5 C20,7 8,21 5,24 C8,27 20,41 22,43"
                  fill="none" stroke="#6B4226" strokeWidth={4.5}
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Jar — maximises central space, left-shifted to balance right icon column */}
            <div data-bt-target="jar" style={{ flex:"1 1 auto", maxWidth:"min(400px,80vw)", minWidth:0,
              transform:"translate(0px, -64px)",
              transition:"opacity 0.5s ease, filter 0.5s ease",
              animation: isJarAnimating ? "jarShake 0.4s ease" : "none" }}>
              <style>{`
  @keyframes jarShake {
    0%, 100% {
      transform: translate(0px, -64px);
    }
    15% {
      transform: translate(-8px, -64px) rotate(-1.5deg);
    }
    30% {
      transform: translate(7px, -64px) rotate(1.5deg);
    }
    45% {
      transform: translate(-5px, -64px) rotate(-1deg);
    }
    60% {
      transform: translate(4px, -64px) rotate(0.8deg);
    }
    75% {
      transform: translate(-2px, -64px);
    }
  }
`}</style>
              <JarSVG thoughts={currentThoughts} onJarClick={handleJarClick}
                isAnimating={isJarAnimating} jarName={activeJar?.name}
                lidVariant={(activeJar?.id ?? 0) % 5}
                onLabelClick={() => { setJarNameInput(activeJar?.name || ""); setEditingJarName(true); }} />
            </div>

            {/* Right arrow — tight to jar */}
            <button
              onClick={goNext} disabled={!canGoNext}
              aria-label="next jar"
              style={{
                transform:"translateY(-34px)",
                background:"none", border:"none", cursor: canGoNext ? "pointer" : "default",
                padding:"0 2px", flexShrink:0, opacity: canGoNext ? 1 : 0.2,
                WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
              }}>
              <svg viewBox="0 0 28 48" width={20} height={36}>
                <path d="M6,5 C8,7 20,21 23,24 C20,27 8,41 6,43"
                  fill="none" stroke="#6B4226" strokeWidth={4.5}
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

          </div>

          <div data-bt-target="input" style={{width:"100%",maxWidth:480}}>
            <AddThoughtInput onAdd={handleAddThought} />
          </div>

          {/* Hint text — below the input */}
          <p style={{ fontFamily:"var(--font-body)",fontSize:"clamp(12px,1.8vw,14px)",
            color:"#A07850",textAlign:"center",opacity:0.75,lineHeight:1.5 }}>
            {currentThoughts.length === 0
              ? "add a thought, and it will float inside the jar"
              : currentThoughts.length >= JAR_CAPACITY
                ? "this jar is full — create a new one"
                : "tap the dice or jar to rediscover a thought"}
          </p>

          {/* TV — right edge, clears input bar comfortably */}
          <div data-bt-target="tv" className="tv-widget" style={{
            position:"absolute",
            right:0,
            bottom:"clamp(96px,16vh,130px)",
            flexDirection:"column",alignItems:"center",
            zIndex:2 }}>
            <CozyTV broadcast={dailyBroadcast} />
          </div>
        </main>
        {/* Footer */}
        <AppFooter />
      </div>

      {(showJarFull || showNewJar) && (
        <JarFullModal
          onConfirm={handleCreateNewJar}
          onCancel={() => { setShowJarFull(false); setShowNewJar(false); }} />
      )}
      {showInfo && <InfoModal onClose={() => { setShowInfo(false); setInfoInitPage("note"); }}
        musicMuted={musicMuted} setMusicMuted={setMusicMuted}
        musicVolume={musicVolume} setMusicVolume={setMusicVolume}
        initialPage={infoInitPage} />}
      {showList && (
        <ThoughtsListModal jars={jars} onClose={() => setShowList(false)}
          onComplete={handleComplete} onDelete={handleDelete}
          activeJarId={activeJar?.id}
          onSwitchJar={(jarId) => {
            const idx = jars.findIndex(j => j.id === jarId);
            if (idx >= 0) setActiveJarIndex(idx);
          }} />
      )}

      {/* Jar name edit modal */}
      {editingJarName && (
        <div style={{ position:"fixed",inset:0,background:"rgba(107,66,38,0.2)",backdropFilter:"blur(4px)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:"1.5rem" }}
          onClick={() => { blurKeyboard(); setEditingJarName(false); }}>
          <div style={{ background:"#FFFDF5",border:"2.5px solid #6B4226",borderRadius:20,
            width:"min(92vw,360px)",padding:"1.6rem 1.8rem",boxShadow:"5px 6px 0 #C9A87A" }}
            onClick={e => e.stopPropagation()}>
            <p className="fh" style={{ fontFamily:"var(--font-hand)",fontSize:"clamp(18px,3.5vw,24px)",
              color:"#3D2510",lineHeight:1.5,overflow:"visible",paddingBottom:4,marginBottom:12 }}>
              rename this jar
            </p>
            <input
              autoFocus
              value={jarNameInput}
              onChange={e => setJarNameInput(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") handleRenameJar(jarNameInput); if(e.key==="Escape") setEditingJarName(false); }}
              maxLength={24}
              placeholder={activeJar?.name || "name your jar"}
              style={{ width:"100%",background:"white",border:"2.5px solid #6B4226",borderRadius:50,
                padding:"11px 20px",fontFamily:"var(--font-body)",fontSize:15,color:"#3D2510",
                outline:"none",boxShadow:"3px 4px 0 #C9A87A",textAlign:"center",marginBottom:14,
                caretColor:"#C87A50" }}
            />
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={() => handleRenameJar(jarNameInput)}
                style={{ flex:1,background:"#E85D3A",border:"2.5px solid #6B4226",borderRadius:50,
                  padding:"10px 0",fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,
                  color:"white",cursor:"pointer",boxShadow:"2px 3px 0 #6B4226" }}>
                save
              </button>
              <button onClick={() => setEditingJarName(false)}
                style={{ background:"transparent",border:"2px solid #C9A87A",borderRadius:"50%",
                  width:44,height:44,flexShrink:0,fontFamily:"var(--font-body)",fontSize:16,
                  color:"#A07850",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                X
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory resurfacing — fixed overlay, renders above homepage without affecting layout */}
      {memoryThought && !revealedThought && (
        <MemoryResurface
          thought={memoryThought}
          onDismiss={() => {
            dismissedMemoryJars.current.add(activeJar.id);
            setMemoryDismissedTick(n => n + 1); // trigger recompute
          }}
          onExpand={() => {
            dismissedMemoryJars.current.add(activeJar.id);
            setMemoryDismissedTick(n => n + 1);
            setRevealedThought(memoryThought);
          }}
        />
      )}

      <ThoughtReveal thought={revealedThought} onClose={() => setRevealedThought(null)}
        onComplete={handleCompleteFromReveal}
        onReroll={() => {
          // Pick a new random thought (different from current if possible)
          const pool = currentThoughts.filter(t => t.id !== revealedThought?.id);
          const source = pool.length > 0 ? pool : currentThoughts;
          if (source.length === 0) return;
          const next = source[Math.floor(Math.random() * source.length)];
          setRevealedThought(next);
        }}
        onOpenList={() => { setRevealedThought(null); setShowList(true); }}
      />

      <Toast message={toast.message} visible={toast.visible} />
      <Stardust active={stardustActive} onDone={() => setStardustActive(false)} />
      {showBlobTeacher && (
        <BlobTeacher onDone={() => setShowBlobTeacher(false)} />
      )}
      {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
      <Analytics />
    </>
  );
}
