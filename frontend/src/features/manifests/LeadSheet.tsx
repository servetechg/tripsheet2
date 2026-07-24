import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2, Icons } from '@/components/ui';
import { EM_STATUS, CA_PORTS, US_PORTS } from '@/features/manifests/constants';

export function LeadSheet({ manifest:m, company, carrier, onBack }: any) {
  const ref = useRef<any>(null);
  const isACI = m.type==="ACI";
  const statusInfo = EM_STATUS[m.status]||EM_STATUS.draft;

  // Generate fake barcode-style visual from CRN string
  const BarcodeViz = ({ value }) => {
    const bars = value.split("").map((c,i)=>{
      const w = ((c.charCodeAt(0)%3)+1)*2;
      const h = 40+((c.charCodeAt(0)%3)*10);
      return <div key={i} style={{ width:w, height:h, background:"#000", marginRight:1, display:"inline-block", verticalAlign:"bottom" }} />;
    });
    return (
      <div style={{ textAlign:"center", padding:"10px 0" }}>
        <div style={{ display:"inline-flex", alignItems:"flex-end", gap:0, border:"1px solid #ddd", padding:"8px 12px", background:"#fff" }}>{bars}</div>
        <div style={{ fontSize:11, letterSpacing:3, marginTop:4, fontFamily:"monospace", color:"#000" }}>{value}</div>
      </div>
    );
  };

  const doPrint = () => {
    const w = window.open("","_blank");
    if (!w || !ref.current) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${m.type} Lead Sheet - ${m.crn}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 portrait;margin:15mm 15mm}.page{width:100%}.header{background:#000;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}.logo{font-size:20pt;font-weight:900;letter-spacing:-1px}.type-badge{background:${isACI?G.info:G.purple};color:#fff;padding:4px 12px;border-radius:4px;font-size:9pt;font-weight:700;letter-spacing:2px}.body{padding:20px}.barcode-section{text-align:center;border:2px solid #000;padding:20px;margin:16px 0}.barcode-bars{display:inline-flex;align-items:flex-end;gap:1px;border:1px solid #ddd;padding:8px 12px}.crn-label{font-size:8pt;color:#666;letter-spacing:2px;margin-bottom:4px}.crn-val{font-size:20pt;font-weight:900;letter-spacing:3px;font-family:monospace}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #ddd;margin-bottom:12px}.info-cell{padding:10px 14px;border-bottom:1px solid #ddd;border-right:1px solid #ddd}.info-label{font-size:7pt;letter-spacing:2px;color:#888;text-transform:uppercase}.info-val{font-size:11pt;font-weight:700;margin-top:2px}.shipments-table{width:100%;border-collapse:collapse;margin-top:12px}.shipments-table th{background:#333;color:#fff;padding:6px 10px;font-size:8pt;text-align:left}.shipments-table td{padding:7px 10px;border-bottom:1px solid #ddd;font-size:9pt}.status-box{text-align:center;border:2px solid ${statusInfo.color};padding:10px;margin-top:12px}.status-label{font-size:14pt;font-weight:900;color:${statusInfo.color};letter-spacing:3px}.footer{margin-top:16px;padding-top:10px;border-top:1px solid #ddd;font-size:7.5pt;color:#888;display:flex;justify-content:space-between}@media print{button{display:none!important}}</style></head><body>
${ref.current.innerHTML}
</body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),400);
  };

  return (
    <div style={{ fontFamily:FONT_UI, background:"#c8c8c8", minHeight:"100vh" }}>
      {/* Controls */}
      <div style={{ background:G.card2, borderBottom:`2px solid ${isACI?G.info:G.purple}`, padding:"12px 16px", display:"flex", gap:12, alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <Btn onClick={onBack} style={{ padding:"9px 16px" }}>← BACK</Btn>
        <span style={{ fontSize:11, fontWeight:700, color: isACI?G.info:G.purple, flex:1, letterSpacing:2 }}>{m.type} eMAANIFEST LEAD SHEET</span>
        <Btn onClick={doPrint} style={{ padding:"9px 20px", background: isACI?G.info:G.purple, display:'inline-flex', alignItems:'center', gap:6 }}>
          {Icons.print({ size: 16, color: '#fff' })}
          PRINT LEAD SHEET
        </Btn>
      </div>

      {/* A4 Lead Sheet */}
      <div style={{ padding:"20px 12px 60px", display:"flex", justifyContent:"center" }}>
        <div style={{ width:"210mm", background:"#fff", boxShadow:"0 6px 40px rgba(0,0,0,.35)", boxSizing:"border-box" }}>
          <div ref={ref}>
            {/* Header */}
            <div style={{ background:"#000", color:"#fff", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, letterSpacing:-1 }}>{company.shortName.slice(0,-1)}<span style={{ color:G.gold }}>{company.shortName.slice(-1)}</span></div>
              <div style={{ textAlign:"center" }}>
                <div style={{ background: isACI?G.info:G.purple, color:"#fff", padding:"4px 16px", borderRadius:4, fontSize:11, fontWeight:700, letterSpacing:2 }}>{m.type} eMANIFEST</div>
                <div style={{ fontSize:9, color:"#aaa", marginTop:3, letterSpacing:2 }}>{isACI?"CBSA — ADVANCE COMMERCIAL INFO":"CBP — AUTOMATED COMMERCIAL ENV"}</div>
              </div>
              <div style={{ textAlign:"right", fontSize:9, color:"#aaa" }}>
                <div>{company.name}</div>
                <div>{isACI?`CBSA: ${carrier.cbsaCarrierCode||"—"}`:`SCAC: ${carrier.scacCode||"—"}`}</div>
              </div>
            </div>

            <div style={{ padding:"20px" }}>
              {/* Status */}
              <div style={{ textAlign:"center", border:`3px solid ${statusInfo.color}`, padding:"8px", marginBottom:16, borderRadius:4 }}>
                <div style={{ fontSize:18, fontWeight:900, color:statusInfo.color, letterSpacing:4 }}>{statusInfo.label}</div>
                {m.status==="accepted" && <div style={{ fontSize:10, color:G.muted, marginTop:2 }}>Present this sheet to border officer · Officer will stamp as proof of report</div>}
              </div>

              {/* Barcode section */}
              <div style={{ textAlign:"center", border:"2px solid #000", padding:"16px", marginBottom:16 }}>
                <div style={{ fontSize:8, letterSpacing:3, color:"#888", marginBottom:6, textTransform:"uppercase" }}>Conveyance Reference Number (CRN)</div>
                {/* Visual barcode */}
                <div style={{ display:"flex", justifyContent:"center", alignItems:"flex-end", gap:1, background:"#fff", padding:"8px 12px", marginBottom:6 }}>
                  {m.crn.split("").map((c,i)=>{
                    const w=((c.charCodeAt(0)%3)+1)*3;
                    const h=30+((c.charCodeAt(0)%4)*8);
                    return <div key={i} style={{ width:w, height:h, background:"#000", display:"inline-block" }} />;
                  })}
                </div>
                <div style={{ fontSize:20, fontWeight:900, letterSpacing:4, fontFamily:"monospace", color:"#000" }}>{m.crn}</div>
              </div>

              {/* Info grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0, border:"1px solid #ddd", marginBottom:12 }}>
                {[
                  ["Carrier",       company.name],
                  ["Carrier Code",  isACI?carrier.cbsaCarrierCode:carrier.scacCode],
                  ["Driver",        m.driverName||"—"],
                  ["Truck #",       m.truckNo||"—"],
                  ["Trailer #",     m.trailerNo||"—"],
                  ["Port of Entry", m.portName||m.portCode||"—"],
                  ["ETA",           `${m.eta||"—"} ${m.etaTime||""}`],
                  ["Shipments",     m.shipments?.length||0],
                  ["Created",       m.createdAt],
                  ["Direction",     isACI?"Entering Canada":"Entering USA"],
                ].map(([lbl,val])=>(
                  <div key={lbl} style={{ padding:"9px 14px", borderBottom:"1px solid #ddd", borderRight:"1px solid #ddd" }}>
                    <div style={{ fontSize:7, letterSpacing:2, color:"#888", textTransform:"uppercase" }}>{lbl}</div>
                    <div style={{ fontSize:11, fontWeight:700, marginTop:2, color:"#000" }}>{String(val)}</div>
                  </div>
                ))}
              </div>

              {/* Shipments table */}
              <div style={{ fontSize:8, letterSpacing:2, color:"#888", marginBottom:6, textTransform:"uppercase" }}>SHIPMENTS / CARGO</div>
              <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:16 }}>
                <thead>
                  <tr>
                    {["#","Type",isACI?"CCN/PARS":"PAPS","Commodity","Shipper","Consignee","Pcs","Wt"].map(h=>(
                      <th key={h} style={{ background:"#1a1a1a", color:"#D4A017", padding:"6px 8px", textAlign:"left", fontSize:7.5, letterSpacing:1, borderRight:"1px solid #333" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(m.shipments||[]).map((s,i)=>(
                    <tr key={s.id} style={{ background:i%2===1?"#f7f7f7":"#fff" }}>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9, textAlign:"center" }}>{i+1}</td>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9, fontWeight:700 }}>{s.type}</td>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9, fontFamily:"monospace" }}>{s.ccn}</td>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9 }}>{s.commodityDesc||"—"}</td>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9 }}>{s.shipperName||"—"}</td>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9 }}>{s.consigneeName||"—"}</td>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9 }}>{s.pieces||"—"}</td>
                      <td style={{ padding:"6px 8px", border:"1px solid #ddd", fontSize:9 }}>{s.weight?`${s.weight}${s.weightUnit}`:"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Officer stamp area */}
              <div style={{ border:"2px dashed #ccc", padding:"16px", textAlign:"center", marginBottom:16, borderRadius:4 }}>
                <div style={{ fontSize:9, color:"#aaa", letterSpacing:2, marginBottom:8 }}>OFFICER STAMP / PROOF OF REPORT</div>
                <div style={{ width:120, height:60, border:"1px dashed #ccc", margin:"0 auto", borderRadius:4 }} />
              </div>

              {/* Compliance footer */}
              <div style={{ fontSize:8, color:"#888", lineHeight:1.6, borderTop:"1px solid #eee", paddingTop:8, display:"flex", justifyContent:"space-between" }}>
                <span>{isACI?"CBSA ACI eManifest — Must be filed 1hr before border":"CBP ACE eManifest — Must be filed 1hr before US border"}</span>
                <span>Generated: {new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
