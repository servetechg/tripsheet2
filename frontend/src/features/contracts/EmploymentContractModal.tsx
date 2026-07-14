import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { DRIVER_DOC_TYPES, PAY_TYPES, DISPATCH_REQUIRED_DOCS, DOC_STATUS_COLOR } from '@/lib/docTypes';

export function EmploymentContractModal({ driver, company, existingContract, onSave, onClose }: any) {
  const today = new Date().toLocaleDateString("en-CA");
  const [f, setF] = useState({
    startDate:     existingContract?.startDate     || today,
    payType:       existingContract?.payType       || "per_mile",
    payRate:       existingContract?.payRate       || "",
    payUnit:       existingContract?.payUnit       || "CAD",
    teamRate:      existingContract?.teamRate      || "",
    detentionRate: existingContract?.detentionRate || "",
    waitRate:      existingContract?.waitRate      || "",
    fuelSurcharge: existingContract?.fuelSurcharge || "",
    vacationPct:   existingContract?.vacationPct   || "4",
    trialDays:     existingContract?.trialDays     || "90",
    noticeDays:    existingContract?.noticeDays    || "14",
    benefits:      existingContract?.benefits      || "",
    deductions:    existingContract?.deductions    || "",
    notes:         existingContract?.notes         || "",
    signedByAdmin:  existingContract?.signedByAdmin  || false,
    signedByDriver: existingContract?.signedByDriver || false,
  });
  const upd = (k,v) => setF(x=>({...x,[k]:v}));
  const pt = PAY_TYPES.find(p=>p.id===f.payType) || PAY_TYPES[0];

  const save = () => {
    onSave({ id:existingContract?.id||uid(), ...f, driverId:driver.id, companyId:company.id, driverName:driver.name, companyName:company.name, createdAt:existingContract?.createdAt||today, updatedAt:today });
    onClose();
  };

  const doPrint = () => {
    const sn=company.shortName; const accent=sn.slice(-1); const base=sn.slice(0,-1);
    const w=window.open("","_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Contract - ${driver.name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#000;padding:20mm;font-size:10pt}@page{size:A4;margin:15mm}
h2{font-size:11pt;margin:16px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.cell{background:#f9f9f9;border:1px solid #ddd;padding:8px 12px;border-radius:4px}
.lbl{font-size:7pt;color:#888;letter-spacing:1px;text-transform:uppercase}
.val{font-size:11pt;font-weight:700;margin-top:2px}
.rate-box{background:#fffbe6;border:2px solid #D4A017;padding:12px 16px;border-radius:6px;margin:12px 0}
.sig{flex:1;border-top:1px solid #000;padding-top:6px;font-size:8pt;color:#888}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #000">
  <div style="font-size:26pt;font-weight:900;letter-spacing:-1px">${base}<span style="color:#D4A017">${accent}</span>
    <div style="font-size:8pt;color:#777;letter-spacing:3px;margin-top:2px">${company.tagline||""}</div>
    <div style="font-size:9pt;color:#555;margin-top:4px">${company.address||""}</div>
  </div>
  <div style="text-align:right"><div style="font-size:16pt;font-weight:900">DRIVER EMPLOYMENT<br>CONTRACT</div><div style="font-size:9pt;color:#888;margin-top:4px">Effective: ${f.startDate}</div></div>
</div>
<h2>PARTIES</h2>
<div class="grid">
  <div class="cell"><div class="lbl">Employer</div><div class="val">${company.name}</div></div>
  <div class="cell"><div class="lbl">Driver / Employee</div><div class="val">${driver.name}</div></div>
  <div class="cell"><div class="lbl">Driver Email</div><div class="val">${driver.email}</div></div>
  <div class="cell"><div class="lbl">License No.</div><div class="val">${driver.licenseNo||"—"}</div></div>
</div>
<h2>COMPENSATION</h2>
<div class="rate-box">
  <div style="font-size:10pt;color:#888">${pt.icon} ${pt.label}</div>
  <div style="font-size:20pt;font-weight:900;color:#D4A017;margin-top:4px">${f.payUnit} ${f.payRate||"—"} <span style="font-size:11pt;font-weight:400;color:#888">${pt.unit}</span></div>
</div>
<div class="grid">
  ${f.teamRate?`<div class="cell"><div class="lbl">Team Rate</div><div class="val">${f.payUnit} ${f.teamRate}</div></div>`:""}
  ${f.detentionRate?`<div class="cell"><div class="lbl">Detention</div><div class="val">${f.payUnit} ${f.detentionRate}/hr after 2hrs</div></div>`:""}
  ${f.waitRate?`<div class="cell"><div class="lbl">Wait Time</div><div class="val">${f.payUnit} ${f.waitRate}/hr</div></div>`:""}
  ${f.fuelSurcharge?`<div class="cell"><div class="lbl">Fuel Surcharge</div><div class="val">${f.fuelSurcharge}</div></div>`:""}
  <div class="cell"><div class="lbl">Vacation Pay</div><div class="val">${f.vacationPct}% of gross</div></div>
</div>
<h2>EMPLOYMENT TERMS</h2>
<div class="grid">
  <div class="cell"><div class="lbl">Probation</div><div class="val">${f.trialDays} days</div></div>
  <div class="cell"><div class="lbl">Notice Period</div><div class="val">${f.noticeDays} days</div></div>
  ${f.benefits?`<div class="cell" style="grid-column:span 2"><div class="lbl">Benefits</div><div class="val">${f.benefits}</div></div>`:""}
  ${f.deductions?`<div class="cell" style="grid-column:span 2"><div class="lbl">Deductions</div><div class="val">${f.deductions}</div></div>`:""}
</div>
${f.notes?`<h2>ADDITIONAL TERMS</h2><p style="font-size:9pt;line-height:1.8;color:#333">${f.notes}</p>`:""}
<h2>STANDARD TERMS</h2>
<p style="font-size:8.5pt;line-height:1.8;color:#444">The driver agrees to operate all vehicles safely and in compliance with all federal/provincial regulations including HOS, ELD, and border crossing requirements. Driver shall maintain a valid Class 1/CDL licence and all required endorsements. All accidents and violations must be reported within 24 hours. Pay is contingent on proper completion of trip sheets and eManifest filings. This agreement is governed by the laws of the Province of Alberta, Canada.</p>
<div style="display:flex;gap:40px;margin-top:30px">
  <div class="sig"><div>${f.signedByDriver?"✓ SIGNED":"PENDING"}</div><div>Driver: ${driver.name}</div><div style="margin-top:18px;border-top:1px solid #000;padding-top:4px">Signature &nbsp;&nbsp;&nbsp;&nbsp; Date</div></div>
  <div class="sig"><div>${f.signedByAdmin?"✓ SIGNED":"PENDING"}</div><div>For: ${company.name}</div><div style="margin-top:18px;border-top:1px solid #000;padding-top:4px">Authorized Signature &nbsp; Date</div></div>
</div>
<div style="margin-top:16px;font-size:7pt;color:#bbb;border-top:1px solid #eee;padding-top:8px;display:flex;justify-content:space-between"><span>${company.name}</span><span>Generated: ${new Date().toLocaleString()}</span></div>
</body></html>`);
    w.document.close(); setTimeout(()=>w.print(),400);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:G.overlay,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:G.card,border:`1px solid ${G.gold}44`,borderRadius:16,width:"100%",maxWidth:580,maxHeight:"94vh",overflow:"hidden",display:"flex",flexDirection:"column" }}>
        {/* Header */}
        <div style={{ background:G.card,borderBottom:`2px solid ${G.gold}`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:G.text }}>📄 EMPLOYMENT CONTRACT</div>
            <div style={{ fontSize:11,color:G.muted,marginTop:2 }}>{driver.name} · {company.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent",border:`1px solid ${G.border}`,color:G.muted,borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:16 }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ overflow:"auto",padding:"20px",flex:1 }}>
          <Inp label="Contract Start Date" value={f.startDate} onChange={e=>upd("startDate",e.target.value)} type="date" />

          {/* Pay type */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:8,textTransform:"uppercase" }}>PAY STRUCTURE *</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {PAY_TYPES.map(p=>(
                <button key={p.id} onClick={()=>upd("payType",p.id)} style={{ background:f.payType===p.id?G.gold:"transparent",color:f.payType===p.id?G.onGold:G.muted,border:`1px solid ${f.payType===p.id?G.gold:G.border2}`,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rate */}
          <div style={{ background:G.card2,border:`1px solid ${G.gold}33`,borderRadius:10,padding:14,marginBottom:14 }}>
            <div style={{ fontSize:10,letterSpacing:2,color:G.gold,marginBottom:10 }}>BASE RATE</div>
            <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:12 }}>
              <Inp label={`Rate (${pt.unit})`} value={f.payRate} onChange={e=>upd("payRate",e.target.value)} placeholder="e.g. 0.65" type="number" />
              <Sel label="Currency" value={f.payUnit} onChange={e=>upd("payUnit",e.target.value)}>
                <option value="CAD">🍁 CAD</option>
                <option value="USD">🇺🇸 USD</option>
              </Sel>
            </div>
            {f.payRate && (
              <div style={{ background:`${G.gold}11`,border:`1px solid ${G.gold}33`,borderRadius:8,padding:"10px 14px",fontSize:14,fontWeight:800,color:G.gold }}>
                {pt.icon} {f.payUnit} {f.payRate} {pt.unit}
              </div>
            )}
          </div>

          {/* Extra rates */}
          <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.border}` }}>ADDITIONAL RATES</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Inp label="Team Rate" value={f.teamRate} onChange={e=>upd("teamRate",e.target.value)} placeholder="e.g. 0.55/km" />
            <Inp label="Detention ($/hr)" value={f.detentionRate} onChange={e=>upd("detentionRate",e.target.value)} placeholder="after 2hrs free" />
            <Inp label="Wait Time ($/hr)" value={f.waitRate} onChange={e=>upd("waitRate",e.target.value)} placeholder="e.g. 20" />
            <Inp label="Fuel Surcharge" value={f.fuelSurcharge} onChange={e=>upd("fuelSurcharge",e.target.value)} placeholder="e.g. 0.10/km" />
            <Inp label="Vacation Pay %" value={f.vacationPct} onChange={e=>upd("vacationPct",e.target.value)} placeholder="4" type="number" />
          </div>

          {/* Terms */}
          <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.border}` }}>TERMS</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Inp label="Probation (days)" value={f.trialDays} onChange={e=>upd("trialDays",e.target.value)} placeholder="90" type="number" />
            <Inp label="Notice Period (days)" value={f.noticeDays} onChange={e=>upd("noticeDays",e.target.value)} placeholder="14" type="number" />
          </div>
          <Inp label="Benefits" value={f.benefits} onChange={e=>upd("benefits",e.target.value)} placeholder="e.g. Health after 3 months" />
          <Inp label="Deductions" value={f.deductions} onChange={e=>upd("deductions",e.target.value)} placeholder="e.g. EI, CPP, Income Tax" />
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:6 }}>ADDITIONAL NOTES</div>
            <textarea style={{ width:"100%",background:G.inset,border:`1px solid ${G.border2}`,borderRadius:8,padding:"11px 13px",color:G.text,fontSize:13,outline:"none",boxSizing:"border-box",minHeight:70,resize:"vertical",fontFamily:"monospace" }} value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Any special terms..." />
          </div>

          {/* Signatures */}
          <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.border}` }}>E-SIGNATURES</div>
          <div style={{ display:"flex",gap:12,marginBottom:8 }}>
            <div onClick={()=>upd("signedByAdmin",!f.signedByAdmin)} style={{ flex:1,background:f.signedByAdmin?`${G.success}22`:G.card2,border:`2px solid ${f.signedByAdmin?G.success:G.border2}`,borderRadius:10,padding:"12px",cursor:"pointer",textAlign:"center" }}>
              <div style={{ fontSize:22 }}>🏢</div>
              <div style={{ fontSize:11,fontWeight:700,color:f.signedByAdmin?G.success:G.muted,marginTop:4 }}>{f.signedByAdmin?"✓ SIGNED":"TAP TO SIGN"}</div>
              <div style={{ fontSize:10,color:G.muted }}>{company.name}</div>
            </div>
            <div onClick={()=>upd("signedByDriver",!f.signedByDriver)} style={{ flex:1,background:f.signedByDriver?`${G.success}22`:G.card2,border:`2px solid ${f.signedByDriver?G.success:G.border2}`,borderRadius:10,padding:"12px",cursor:"pointer",textAlign:"center" }}>
              <div style={{ fontSize:22 }}>👤</div>
              <div style={{ fontSize:11,fontWeight:700,color:f.signedByDriver?G.success:G.muted,marginTop:4 }}>{f.signedByDriver?"✓ SIGNED":"TAP TO SIGN"}</div>
              <div style={{ fontSize:10,color:G.muted }}>{driver.name}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px",borderTop:`1px solid ${G.border}`,display:"flex",gap:10,background:G.inset,flexShrink:0 }}>
          <Btn onClick={save} style={{ flex:1,padding:13 }}>💾 SAVE CONTRACT</Btn>
          <Btn variant="ghost" onClick={doPrint} style={{ padding:"12px 18px" }}>🖨 PRINT PDF</Btn>
          <Btn variant="outline" onClick={onClose}>CANCEL</Btn>
        </div>
      </div>
    </div>
  );
}
