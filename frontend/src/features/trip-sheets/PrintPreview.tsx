import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';

export function PrintPreview({ company, header, trips, expenses, notes, onBack }: any) {
  const ref = useRef<any>(null);
  const sn = company.shortName || "CO";
  const accent = sn.slice(-1), base = sn.slice(0,-1);
  const cad = expenses.filter(e=>e.currency==="CAD").reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
  const usd = expenses.filter(e=>e.currency==="USD").reduce((a,e)=>a+(parseFloat(e.amount)||0),0);

  // Always show at least 10 data rows in trip table (fill with blank rows)
  const filledTrips = trips.length < 10 ? [...trips, ...Array(10 - trips.length).fill(null)] : trips;
  // Always show at least 6 expense rows
  const realExps = expenses.filter(e=>e.amount||e.description||e.category);
  const filledExps = realExps.length < 6 ? [...realExps, ...Array(6 - realExps.length).fill(null)] : realExps;

  const PRINT_CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#000;
         -webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{size:A4 portrait;margin:8mm 10mm}
    .page{width:100%;font-size:9pt}
    /* HEADER */
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;
         padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid #000}
    .logo{font-size:28pt;font-weight:900;letter-spacing:-1px;line-height:1;font-family:Arial,Helvetica,sans-serif}
    .logo-x{color:#D4A017}
    .logo-tag{font-size:7pt;letter-spacing:3px;color:#777;margin-top:2px;text-transform:uppercase}
    .logo-addr{font-size:8pt;color:#555;margin-top:6px;line-height:1.6}
    /* TRUCK BOX */
    .truck-box{border:2px solid #000;min-width:195px;text-align:center}
    .truck-box-hdr{background:#000;color:#D4A017;font-size:7pt;letter-spacing:2px;
                   padding:4px 8px;font-weight:700;text-transform:uppercase}
    .truck-no{font-size:26pt;font-weight:900;padding:4px 12px 5px;border-bottom:1px solid #000;
              font-family:Arial,Helvetica,sans-serif;text-align:center}
    .truck-dates{display:flex}
    .truck-date{flex:1;border-right:1px solid #000}
    .truck-date:last-child{border-right:none}
    .truck-date-lbl{background:#000;color:#D4A017;font-size:6.5pt;letter-spacing:1.5px;
                    padding:3px 6px;text-align:center;font-weight:700;text-transform:uppercase}
    .truck-date-val{font-size:10pt;font-weight:700;padding:4px 6px;text-align:center}
    /* DRIVERS */
    .drivers{display:flex;gap:16px;margin-bottom:10px}
    .driver-field{flex:1;border-bottom:1px solid #000;padding-bottom:4px}
    .driver-lbl{font-size:6.5pt;letter-spacing:2px;color:#999;text-transform:uppercase;font-weight:400}
    .driver-name{font-size:12pt;font-weight:700;margin-top:2px;min-height:18px}
    /* TABLES */
    table{width:100%;border-collapse:collapse;margin-bottom:10px}
    .tbl-banner{background:#000;color:#D4A017;font-size:8pt;letter-spacing:3px;
                padding:6px 10px;text-align:left;font-weight:700;text-transform:uppercase}
    .col-hdr{background:#1a1a1a;color:#d0d0d0;font-size:7pt;letter-spacing:1px;
             padding:6px 8px;font-weight:700;text-align:left;text-transform:uppercase;
             border-right:1px solid #555;border-bottom:2px solid #555}
    .col-hdr:last-child{border-right:none}
    .cell{font-size:8.5pt;padding:6px 7px;border:1px solid #aaa;vertical-align:top;min-height:22px}
    .cell:last-child{border-right:none}
    .cell-alt{background:#f7f7f7}
    .note-row td{background:#fffbe6;font-size:8pt;color:#555;font-style:italic;
                 padding:4px 10px;border-bottom:1px solid #e8e0c0}
    /* TOTALS */
    .total-lbl{text-align:right;font-weight:700;font-size:9pt;border-top:2px solid #000!important}
    .total-val{font-weight:900;font-size:11pt;color:#D4A017;border-top:2px solid #000!important}
    /* SIGS */
    .sigs{display:flex;gap:24px;margin-top:20px}
    .sig{flex:1;border-top:1px solid #000;padding-top:4px;
         font-size:7pt;color:#999;letter-spacing:1px;text-transform:uppercase}
    /* FOOTER */
    .footer{margin-top:12px;padding-top:6px;border-top:1px solid #e0e0e0;
            display:flex;justify-content:space-between;font-size:7pt;color:#bbb}
    @media print{button{display:none!important}}
  `;

  const doPrint = () => {
    const w = window.open("","_blank");
    if (!w || !ref.current) return;
    w.document.write("<!DOCTYPE html><html><head><title>" + sn + "-TripSheet-" + (header.truckNo||"000") + "</title><style>" + PRINT_CSS + "</style></head><body>" + ref.current.innerHTML + "</body></html>");
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  // ── The actual A4 sheet markup (screen + print identical) ──
  const Sheet = () => (
    <div className="page" style={{ fontFamily:"Arial,Helvetica,sans-serif", fontSize:11, color:"#000", width:"100%" }}>

      {/* ═══ HEADER ═══ */}
      <div className="hdr" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", paddingBottom:8, marginBottom:10, borderBottom:"2px solid #000" }}>
        {/* Logo + address */}
        <div>
          <div style={{ fontSize:30, fontWeight:900, letterSpacing:-1, lineHeight:1, fontFamily:"Arial,Helvetica,sans-serif" }}>
            {base}<span style={{ color:"#D4A017" }}>{accent}</span>
          </div>
          {company.tagline && <div style={{ fontSize:7.5, letterSpacing:3, color:"#777", marginTop:3, textTransform:"uppercase" }}>{company.tagline}</div>}
          {company.address && (
            <div style={{ fontSize:8.5, color:"#555", marginTop:6, lineHeight:1.65 }}>
              {company.address.split(",").map((seg,i) => <div key={i}>{seg.trim()}</div>)}
            </div>
          )}
        </div>

        {/* Truck box — exact layout from your screenshots */}
        <div style={{ border:"2px solid #000", minWidth:195, textAlign:"center" }}>
          <div style={{ background:"#000", color:"#D4A017", fontSize:7.5, letterSpacing:2, padding:"4px 8px", fontWeight:700, textTransform:"uppercase", textAlign:"center" }}>
            TRUCK UNIT NO.
          </div>
          <div style={{ fontSize:28, fontWeight:900, padding:"4px 10px 5px", borderBottom:"1px solid #000", textAlign:"center", fontFamily:"Arial,Helvetica,sans-serif" }}>
            {header.truckNo || "—"}
          </div>
          <div style={{ display:"flex" }}>
            <div style={{ flex:1, borderRight:"1px solid #000" }}>
              <div style={{ background:"#000", color:"#D4A017", fontSize:6.5, letterSpacing:1.5, padding:"3px 6px", fontWeight:700, textTransform:"uppercase", textAlign:"center" }}>START DATE</div>
              <div style={{ fontSize:10, fontWeight:700, padding:"4px 6px", textAlign:"center" }}>{header.startDate || "—"}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ background:"#000", color:"#D4A017", fontSize:6.5, letterSpacing:1.5, padding:"3px 6px", fontWeight:700, textTransform:"uppercase", textAlign:"center" }}>END DATE</div>
              <div style={{ fontSize:10, fontWeight:700, padding:"4px 6px", textAlign:"center" }}>{header.endDate || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DRIVER NAMES ═══ */}
      <div style={{ display:"flex", gap:16, marginBottom:12 }}>
        {[["DRIVER NAME 1", header.driver1], ["DRIVER NAME 2", header.driver2]].map(([lbl,val]) => (
          <div key={lbl} style={{ flex:1, borderBottom:"1px solid #000", paddingBottom:4 }}>
            <div style={{ fontSize:7, letterSpacing:2, color:"#999", textTransform:"uppercase", marginBottom:2 }}>{lbl}</div>
            <div style={{ fontSize:13, fontWeight:700 }}>{val || " "}</div>
          </div>
        ))}
      </div>

      {/* ═══ TRIP INFORMATION TABLE ═══ */}
      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:10 }}>
        <thead>
          <tr>
            <th colSpan={6} style={{ background:"#000", color:"#D4A017", fontSize:8.5, letterSpacing:3, padding:"6px 10px", textAlign:"left", fontWeight:700, textTransform:"uppercase" }}>
              TRIP INFORMATION
            </th>
          </tr>
          <tr>
            {[["TRIP NO.",14],["PICKUP DATE",14],["DROP DATE",13],["TRAILER NO.",14],["FROM",22],["TO",23]].map(([h,w],i,a) => (
              <th key={h} style={{ background:"#1a1a1a", color:"#d0d0d0", fontSize:7.5, letterSpacing:1, padding:"6px 8px", textAlign:"left", fontWeight:700, textTransform:"uppercase", borderRight: i<a.length-1 ? "1px solid #555" : "none", width:w+"%", borderBottom:"2px solid #555" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filledTrips.map((t, i) => t ? (
            <Fragment key={t.id}>
              <tr style={{ background: i%2===1 ? "#f7f7f7" : "#fff" }}>
                {[t.tripNo, t.pickupDate, t.dropDate, t.trailerNo, t.from, t.to].map((v,j,a) => (
                  <td key={j} style={{ fontSize:9, padding:"6px 7px", borderBottom:"1px solid #aaa", borderRight:j<a.length-1?"1px solid #aaa":"none", border:"1px solid #aaa", verticalAlign:"top", fontWeight:j===0?600:400, minHeight:22 }}>
                    {v || ""}
                  </td>
                ))}
              </tr>
              {t.notes && (
                <tr key={t.id+"_n"} style={{ background:"#fffbe6" }}>
                  <td colSpan={6} style={{ fontSize:8.5, padding:"4px 10px", color:"#555", fontStyle:"italic", borderBottom:"1px solid #e8e0c0" }}>
                    📝 {t.notes}
                  </td>
                </tr>
              )}
            </Fragment>
          ) : (
            <tr key={"bt"+i} style={{ background: i%2===1 ? "#f7f7f7" : "#fff" }}>
              {[0,1,2,3,4,5].map(j => (
                <td key={j} style={{ fontSize:9, padding:"6px 7px", border:"1px solid #aaa", height:24 }}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ═══ EXPENSE SHEET TABLE ═══ */}
      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:10 }}>
        <thead>
          <tr>
            <th colSpan={5} style={{ background:"#000", color:"#D4A017", fontSize:8.5, letterSpacing:3, padding:"6px 10px", textAlign:"left", fontWeight:700, textTransform:"uppercase" }}>
              EXPENSE SHEET
            </th>
          </tr>
          <tr>
            {[["#",5],["CATEGORY",18],["DESCRIPTION",35],["RECEIPT #",18],["AMOUNT",24]].map(([h,w],i,a) => (
              <th key={h} style={{ background:"#1a1a1a", color:"#d0d0d0", fontSize:7.5, letterSpacing:1, padding:"6px 8px", textAlign:"left", fontWeight:700, textTransform:"uppercase", borderRight:i<a.length-1?"1px solid #555":"none", width:w+"%", borderBottom:"2px solid #555" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filledExps.map((e, i) => e ? (
            <tr key={e.id} style={{ background: i%2===1 ? "#f7f7f7" : "#fff" }}>
              <td style={{ fontSize:9, padding:"6px 7px", border:"1px solid #aaa", textAlign:"center" }}>{i+1}</td>
              <td style={{ fontSize:9, padding:"6px 7px", border:"1px solid #aaa" }}>{e.category}</td>
              <td style={{ fontSize:9, padding:"6px 7px", border:"1px solid #aaa" }}>{e.description||""}</td>
              <td style={{ fontSize:9, padding:"6px 7px", border:"1px solid #aaa" }}>{e.receiptNo||""}</td>
              <td style={{ fontSize:9, padding:"6px 7px", border:"1px solid #aaa", fontWeight:600 }}>
                {e.amount ? e.currency+" "+parseFloat(e.amount).toFixed(2) : ""}
              </td>
            </tr>
          ) : (
            <tr key={"be"+i} style={{ background: i%2===1 ? "#f7f7f7" : "#fff" }}>
              {[0,1,2,3,4].map(j => <td key={j} style={{ fontSize:9, padding:"6px 7px", border:"1px solid #aaa", height:22 }}>&nbsp;</td>)}
            </tr>
          ))}
          {/* Totals row */}
          {cad>0 && (
            <tr>
              <td colSpan={4} style={{ fontSize:9, padding:"7px", textAlign:"right", fontWeight:700, borderTop:"2px solid #000", borderBottom:"none" }}>TOTAL (CAD)</td>
              <td style={{ fontSize:11, padding:"7px", fontWeight:900, color:"#D4A017", borderTop:"2px solid #000", borderBottom:"none" }}>CAD {cad.toFixed(2)}</td>
            </tr>
          )}
          {usd>0 && (
            <tr>
              <td colSpan={4} style={{ fontSize:9, padding:"7px", textAlign:"right", fontWeight:700, borderBottom:"none" }}>TOTAL (USD)</td>
              <td style={{ fontSize:11, padding:"7px", fontWeight:900, color:"#D4A017", borderBottom:"none" }}>USD {usd.toFixed(2)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ═══ NOTES ═══ */}
      {notes && (
        <div style={{ border:"1px solid #ddd", padding:"6px 10px", marginBottom:12, fontSize:9, color:"#444", background:"#fafafa" }}>
          <strong>Notes: </strong>{notes}
        </div>
      )}

      {/* ═══ SIGNATURE LINES ═══ */}
      <div style={{ display:"flex", gap:24, marginTop:18 }}>
        {["Driver Signature", "Dispatcher Signature", "Date"].map(l => (
          <div key={l} style={{ flex:1, borderTop:"1px solid #000", paddingTop:5 }}>
            <div style={{ fontSize:7, color:"#aaa", letterSpacing:1, textTransform:"uppercase" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{ marginTop:12, paddingTop:5, borderTop:"1px solid #e8e8e8", display:"flex", justifyContent:"space-between", fontSize:7, color:"#bbb" }}>
        <span>{company.name || sn}</span>
        <span>Truck #{header.truckNo||"—"} &nbsp;·&nbsp; {header.startDate} – {header.endDate}</span>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:FONT_UI, background:"#b0b8c0", minHeight:"100vh" }}>
      {/* Top bar */}
      <div style={{ background:"#111", borderBottom:"2px solid #D4A017", padding:"11px 16px", display:"flex", gap:12, alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <Btn onClick={onBack} style={{ padding:"9px 16px", fontSize:12 }}>← BACK</Btn>
        <span style={{ fontSize:11, fontWeight:700, color:"#D4A017", flex:1, letterSpacing:2 }}>TRIP SHEET · A4 PREVIEW</span>
        <Btn onClick={doPrint} style={{ padding:"9px 20px", fontSize:12 }}>🖨 PRINT / SAVE PDF</Btn>
      </div>

      {/* A4 page — 210mm wide, shadow, white background */}
      <div style={{ padding:"20px 10px 60px", display:"flex", justifyContent:"center", alignItems:"flex-start" }}>
        <div style={{ width:"210mm", minHeight:"297mm", background:"#fff", boxShadow:"0 4px 32px rgba(0,0,0,0.45)", padding:"11mm 12mm", boxSizing:"border-box", position:"relative" }}>
          <div ref={ref}><Sheet /></div>
        </div>
      </div>
    </div>
  );
}
