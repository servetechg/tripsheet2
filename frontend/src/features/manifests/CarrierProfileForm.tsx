import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';

export function CarrierProfileForm({ carrier, onSave, onClose }: any) {
  const [f, setF] = useState({ cbsaCarrierCode: carrier.cbsaCarrierCode||"", scacCode: carrier.scacCode||"", dotNumber: carrier.dotNumber||"", csnNumber: carrier.csnNumber||"", fastLane: carrier.fastLane||false });
  const upd = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div style={{ background:G.card, border:`1px solid ${G.gold}33`, borderRadius:12, padding:18, marginBottom:16 }}>
      <div style={{ fontSize:11, letterSpacing:3, color:G.gold, marginBottom:14, fontWeight:700 }}>CARRIER PROFILE</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <Inp label="CBSA Carrier Code (4 chars) *" value={f.cbsaCarrierCode} onChange={e=>upd("cbsaCarrierCode",e.target.value.toUpperCase().slice(0,4))} placeholder="e.g. MKX1" />
        <Inp label="SCAC Code (US, 4 chars) *" value={f.scacCode} onChange={e=>upd("scacCode",e.target.value.toUpperCase().slice(0,4))} placeholder="e.g. MKXT" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <Inp label="DOT Number" value={f.dotNumber} onChange={e=>upd("dotNumber",e.target.value)} placeholder="e.g. 12345678" />
        <Inp label="CSN (Carrier Security Number)" value={f.csnNumber} onChange={e=>upd("csnNumber",e.target.value)} placeholder="Optional" />
      </div>
      <div style={{ marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
        <input type="checkbox" id="fast" checked={f.fastLane} onChange={e=>upd("fastLane",e.target.checked)} style={{ width:18, height:18, cursor:"pointer" }} />
        <label htmlFor="fast" style={{ fontSize:12, color:G.text, cursor:"pointer" }}>FAST Lane eligible (30-min pre-arrival instead of 1hr)</label>
      </div>
      <div style={{ background:G.successTint, border:`1px solid ${G.success}33`, borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:11, color:G.muted }}>
        ℹ️ <strong style={{ color:G.success }}>Note:</strong> Real EDI submission requires registration with CBSA (ACI) and CBP (ACE). This module simulates the full workflow. To get live, contact CBSA TCCU or a certified software provider.
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <Btn onClick={()=>{ onSave(f); onClose(); }}>SAVE PROFILE</Btn>
        <Btn variant="outline" onClick={onClose}>CANCEL</Btn>
      </div>
    </div>
  );
}
