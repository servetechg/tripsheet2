import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';

export function ThemeToggle({ mode, onToggle }: any) {
  const isLight = mode === "light";
  return (
    <button
      onClick={onToggle}
      title={isLight ? "Switch to dark mode" : "Switch to light / outdoor mode"}
      style={{ background:G.card2, border:`1px solid ${G.border2}`, color:G.text, borderRadius:RADIUS.pill, padding:"7px 12px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:FONT_UI }}
    >
      <span>{isLight ? "☀️" : "🌙"}</span>
      <span style={{ fontSize:10, letterSpacing:1, color:G.muted, textTransform:"uppercase" }}>{isLight ? "Light" : "Dark"}</span>
    </button>
  );
}
