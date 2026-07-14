import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';
import { EM_STATUS, CA_PORTS, US_PORTS } from '@/features/manifests/constants';

export function EManifestCard({ manifest:m, drivers, trucks, trailers, pending, error, onDismissError, onSubmit, onAccept, onReject, onCancel, onDelete, onEdit, onLeadSheet }: any) {
  const [expanded, setExpanded] = useState(false);
  const [countdown, setCountdown] = useState<any>(null);
  const driver  = drivers.find(d=>d.id===m.driverId);
  const truck   = trucks.find(t=>t.id===m.truckId);
  const trailer = trailers.find(t=>t.id===m.trailerId);
  const isACI   = m.type==="ACI";
  const statusInfo = EM_STATUS[m.status] || EM_STATUS.draft;

  // 1-hour countdown after accepted
  useEffect(()=>{
    if (m.status!=="accepted"||!m.acceptedAt) return;
    const tick = ()=>{
      const elapsed = (Date.now()-new Date(m.acceptedAt).getTime())/1000;
      const waitSecs = (m.fastLane?30:60)*60;
      const remaining = Math.max(0, waitSecs-elapsed);
      if (remaining===0) { setCountdown(null); return; }
      const mins = Math.floor(remaining/60);
      const secs = Math.floor(remaining%60);
      setCountdown(`${mins}:${secs.toString().padStart(2,"0")}`);
    };
    tick();
    const t = setInterval(tick,1000);
    return ()=>clearInterval(t);
  },[m.status,m.acceptedAt]);

  return (
    <div style={{ background:G.card, border:`1px solid ${m.status==="accepted"?G.success+"66":m.status==="rejected"?G.danger+"66":G.border}`, borderRadius:14, marginBottom:12, overflow:"hidden" }}>
      {/* Header row */}
      <div style={{ padding:"14px 16px", cursor:"pointer" }} onClick={()=>setExpanded(e=>!e)}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:800, color: isACI?G.info:G.purple }}>{m.type}</span>
              <span style={{ fontSize:11, color:G.gold, fontWeight:700, fontFamily:FONT_MONO }}>{m.crn}</span>
              <span style={{ background:statusInfo.color+"22", color:statusInfo.color, border:`1px solid ${statusInfo.color}44`, borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:700, letterSpacing:1 }}>{statusInfo.label}</span>
              {countdown && (
                <span style={{ background:"#D4A01722", color:G.gold, border:`1px solid ${G.gold}44`, borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:700, letterSpacing:1 }}>
                  ⏱ {countdown} until border
                </span>
              )}
              {m.status==="accepted"&&!countdown && (
                <span style={{ background:G.success+"22", color:G.success, border:`1px solid ${G.success}44`, borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:700 }}>
                  ✓ CLEARED TO CROSS
                </span>
              )}
            </div>
            <div style={{ fontSize:12, color:G.text }}>Driver: {driver?.name||m.driverName||"—"} · Truck: {truck?.unitNo||m.truckNo||"—"} · Trailer: {trailer?.unitNo||m.trailerNo||"—"}</div>
            <div style={{ fontSize:11, color:G.muted, marginTop:2 }}>Port: {m.portName||m.portCode} · ETA: {m.eta||"—"} {m.etaTime||""}</div>
            <div style={{ fontSize:11, color:G.muted }}>Shipments: {m.shipments?.length||0} · Created: {m.createdAt}</div>
            {m.status==="rejected"&&m.rejectionReason&&<div style={{ fontSize:11, color:G.danger, marginTop:4 }}>✗ Rejected: {m.rejectionReason}</div>}
          </div>
          <div style={{ fontSize:13, color:G.muted }}>{expanded?"▲":"▼"}</div>
        </div>
      </div>

      {/* Error banner from last failed gateway action */}
      {error && (
        <div style={{ margin:"0 16px 10px", background:G.dangerBg, border:`1px solid ${G.danger}44`, borderRadius:8, padding:"9px 12px", fontSize:11, color:G.danger, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <span>⚠️ {error}</span>
          <button onClick={e=>{e.stopPropagation();onDismissError();}} style={{ background:"none", border:"none", color:G.danger, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>✕</button>
        </div>
      )}

      {/* Action bar */}
      <div style={{ padding:"10px 16px", borderTop:`1px solid ${G.border}`, display:"flex", gap:8, flexWrap:"wrap", background:G.card2 }}>
        {m.status==="draft"     && <Btn disabled={!!pending} onClick={e=>{e.stopPropagation();onSubmit();}} style={{ padding:"7px 14px", fontSize:11, background:G.info, borderColor:G.info, opacity:pending?0.6:1 }}>{pending==="Submission"?"⏳ SUBMITTING…":"📤 SUBMIT"}</Btn>}
        {m.status==="submitted" && <Btn disabled={!!pending} onClick={e=>{e.stopPropagation();onAccept();}} style={{ padding:"7px 14px", fontSize:11, background:G.success, opacity:pending?0.6:1 }}>{pending==="Accept"?"⏳ PROCESSING…":"✓ MARK ACCEPTED"}</Btn>}
        {m.status==="submitted" && <Btn variant="danger" disabled={!!pending} onClick={e=>{e.stopPropagation();onReject();}} style={{ padding:"7px 14px", fontSize:11, opacity:pending?0.6:1 }}>{pending==="Reject"?"⏳ PROCESSING…":"✗ MARK REJECTED"}</Btn>}
        {m.status==="rejected"  && <Btn disabled={!!pending} onClick={e=>{e.stopPropagation();onEdit();}} style={{ padding:"7px 14px", fontSize:11 }}>✏️ EDIT & RESUBMIT</Btn>}
        {["draft","submitted","rejected"].includes(m.status) && <Btn variant="outline" disabled={!!pending} onClick={e=>{e.stopPropagation();onEdit();}} style={{ padding:"7px 14px", fontSize:11 }}>✏️ EDIT</Btn>}
        {!["delivered","cancelled"].includes(m.status) && m.status!=="draft" && <Btn variant="danger" disabled={!!pending} onClick={e=>{e.stopPropagation();onCancel();}} style={{ padding:"7px 14px", fontSize:11, opacity:pending?0.6:1 }}>{pending==="Cancellation"?"⏳ CANCELLING…":"CANCEL"}</Btn>}
        <Btn variant="ghost" onClick={e=>{e.stopPropagation();onLeadSheet();}} style={{ padding:"7px 14px", fontSize:11 }}>🖨 LEAD SHEET</Btn>
        {m.status==="draft" && <Btn variant="danger" disabled={!!pending} onClick={e=>{e.stopPropagation();onDelete();}} style={{ padding:"7px 14px", fontSize:11 }}>🗑 DELETE</Btn>}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding:"14px 16px", borderTop:`1px solid ${G.border}` }}>
          <div style={{ fontSize:10, letterSpacing:2, color:G.muted, marginBottom:10 }}>SHIPMENTS</div>
          {(m.shipments||[]).map((s,i)=>(
            <div key={s.id} style={{ background:G.card2, border:`1px solid ${G.border2}`, borderRadius:8, padding:"10px 14px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
                <div>
                  <span style={{ fontSize:11, fontWeight:700, color: isACI?G.info:G.purple }}>#{i+1} {s.type}</span>
                  <span style={{ fontSize:11, color:G.gold, marginLeft:10 }}>{s.ccn}</span>
                </div>
                <span style={{ fontSize:11, color:G.muted }}>{s.commodityDesc||"—"}</span>
              </div>
              <div style={{ fontSize:11, color:G.muted, marginTop:4 }}>
                {s.shipperName||"?"} ({s.shipperCountry}) → {s.consigneeName||"?"} ({s.consigneeCountry})
              </div>
              <div style={{ fontSize:11, color:G.muted }}>
                {s.pieces||"—"} pcs · {s.weight||"—"} {s.weightUnit} · Origin: {s.countryOfOrigin}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
