import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';

export function BottomNav({ tabs, active, onChange }: any) {
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:G.card, borderTop:`1px solid ${G.border}`, display:"flex", zIndex:500, paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ flex:1, background:"none", border:"none", padding:"10px 2px 8px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <span style={{ fontSize:19 }}>{t.icon}</span>
          <span style={{ fontSize:8.5, letterSpacing:0.5, color: active===t.id ? G.gold : G.muted, fontWeight: active===t.id ? 700:400, textTransform:"uppercase", lineHeight:1.2 }}>{t.label}</span>
          {active===t.id && <div style={{ width:20, height:2, background:G.gold, borderRadius:2, marginTop:1 }} />}
        </button>
      ))}
    </div>
  );
}
