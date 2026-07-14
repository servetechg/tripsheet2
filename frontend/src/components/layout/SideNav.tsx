import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';

export function SideNav({ tabs, active, onChange, logo, subtitle }: any) {
  return (
    <div style={{ width:224, minWidth:224, background:G.card, borderRight:`1px solid ${G.border}`, display:"flex", flexDirection:"column", minHeight:"100vh", position:"fixed", left:0, top:0, zIndex:300 }}>
      <div style={{ padding:"22px 20px 14px", borderBottom:`1px solid ${G.border}` }}>
        <div style={{ fontSize:24, fontWeight:900, letterSpacing:-1, color:G.text }}>{logo.slice(0,-1)}<span style={{ color:G.gold }}>{logo.slice(-1)}</span></div>
        <div style={{ fontSize:9, letterSpacing:3, color:G.muted, marginTop:3, textTransform:"uppercase" }}>{subtitle}</div>
      </div>
      <div style={{ flex:1, padding:"10px 10px", overflowY:"auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background: active===t.id ? G.goldBg : "transparent", border: active===t.id ? `1px solid ${G.gold}33` : "1px solid transparent", borderRadius:10, cursor:"pointer", marginBottom:3, textAlign:"left" }}>
            <span style={{ fontSize:17 }}>{t.icon}</span>
            <span style={{ fontSize:11, color: active===t.id ? G.gold : G.muted, fontWeight: active===t.id ? 700:400, textTransform:"uppercase", letterSpacing:0.5 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
