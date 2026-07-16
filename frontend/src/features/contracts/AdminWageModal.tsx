import { useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Inp, Sel } from '@/components/ui';
import { blank } from '@/lib/format';
import { PAY_TYPES } from '@/lib/docTypes';

export function AdminWageModal({ driver, company, existingContract, onSave, onClose }: any) {
  const today = new Date().toLocaleDateString("en-CA");
  const [f, setF] = useState({
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
    deductions:    existingContract?.deductions || existingContract?.payload?.deductions || "",
    notes:         existingContract?.notes || existingContract?.payload?.notes || "",
    startDate:     existingContract?.startDate     || today,
    signedByAdmin: true,
    signedByDriver: existingContract?.signedByDriver || false,
  });
  const upd = (k,v) => setF(x=>({...x,[k]:v}));
  const pt = PAY_TYPES.find(p=>p.id===f.payType)||PAY_TYPES[0];
  const [err, setErr] = useState("");

  const save = () => {
    if (blank(f.payRate)) { setErr("Pay rate is required."); return; }
    // Do not invent or reuse document ids — parent decides create vs update
    onSave({
      ...(existingContract?.id ? { id: existingContract.id } : {}),
      ...f,
      driverId:    driver.driverRecordId || driver.id,
      companyId:   company.id,
      driverName:  driver.name,
      companyName: company.name,
      createdAt:   existingContract?.createdAt || today,
      updatedAt:   today,
      signedByAdmin: true,
    });
  };

  return (
    <div style={{ position:"fixed",inset:0,background:G.overlay,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:G.card,border:`1px solid ${G.gold}55`,borderRadius:16,width:"100%",maxWidth:520,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column" }}>

        {/* Header */}
        <div style={{ background:G.card,borderBottom:`2px solid ${G.gold}`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:G.text }}>💰 SET DRIVER WAGE</div>
            <div style={{ fontSize:11,color:G.muted,marginTop:2 }}>{driver.name} · {company.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent",border:`1px solid ${G.border}`,color:G.muted,borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:16 }}>✕</button>
        </div>

        <div style={{ overflow:"auto",padding:"20px",flex:1 }}>
          {err && <div style={{ background:G.errTint,border:`1px solid ${G.danger}44`,borderRadius:8,padding:"10px",fontSize:12,color:G.errText,marginBottom:12 }}>{err}</div>}

          <Inp label="Effective Date" value={f.startDate} onChange={e=>upd("startDate",e.target.value)} type="date" />

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
            <div style={{ fontSize:10,letterSpacing:2,color:G.gold,marginBottom:10 }}>BASE PAY RATE *</div>
            <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:12 }}>
              <Inp label={`Rate (${pt.unit})`} value={f.payRate} onChange={e=>upd("payRate",e.target.value)} placeholder="e.g. 0.65" type="number" />
              <Sel label="Currency" value={f.payUnit} onChange={e=>upd("payUnit",e.target.value)}>
                <option value="CAD">🍁 CAD</option>
                <option value="USD">🇺🇸 USD</option>
              </Sel>
            </div>
            {f.payRate&&(
              <div style={{ background:`${G.gold}11`,border:`1px solid ${G.gold}33`,borderRadius:8,padding:"10px 14px",fontSize:15,fontWeight:900,color:G.gold }}>
                {pt.icon} {f.payUnit} {f.payRate} {pt.unit}
              </div>
            )}
          </div>

          <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.border}` }}>ADDITIONAL RATES</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Inp label="Team Rate" value={f.teamRate} onChange={e=>upd("teamRate",e.target.value)} placeholder="e.g. 0.50/km" />
            <Inp label="Detention ($/hr)" value={f.detentionRate} onChange={e=>upd("detentionRate",e.target.value)} placeholder="after 2hrs free" />
            <Inp label="Wait Time ($/hr)" value={f.waitRate} onChange={e=>upd("waitRate",e.target.value)} placeholder="e.g. 20" />
            <Inp label="Fuel Surcharge" value={f.fuelSurcharge} onChange={e=>upd("fuelSurcharge",e.target.value)} placeholder="e.g. 0.10/km" />
            <Inp label="Vacation Pay %" value={f.vacationPct} onChange={e=>upd("vacationPct",e.target.value)} placeholder="4" type="number" />
          </div>

          <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.border}` }}>TERMS</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Inp label="Probation (days)" value={f.trialDays} onChange={e=>upd("trialDays",e.target.value)} placeholder="90" type="number" />
            <Inp label="Notice Period (days)" value={f.noticeDays} onChange={e=>upd("noticeDays",e.target.value)} placeholder="14" type="number" />
          </div>
          <Inp label="Benefits" value={f.benefits} onChange={e=>upd("benefits",e.target.value)} placeholder="e.g. Health after 3 months" />
          <Inp label="Deductions" value={f.deductions} onChange={e=>upd("deductions",e.target.value)} placeholder="e.g. EI, CPP, Income Tax" />
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:6,textTransform:"uppercase" }}>Additional Notes</div>
            <textarea style={{ width:"100%",background:G.inset,border:`1px solid ${G.border2}`,borderRadius:8,padding:"11px 13px",color:G.text,fontSize:13,outline:"none",boxSizing:"border-box",minHeight:70,resize:"vertical",fontFamily:"monospace" }} value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Any special terms for this driver..." />
          </div>

          {/* Status */}
          <div style={{ background:G.card2,border:`1px solid ${G.border}`,borderRadius:10,padding:"12px 14px",fontSize:11,color:G.muted }}>
            <div style={{ color:G.text,fontWeight:700,marginBottom:4 }}>Signature Status</div>
            <div>🏢 Company: <span style={{ color:G.success }}>✓ Auto-signed by admin</span></div>
            <div style={{ marginTop:4 }}>👤 Driver: {f.signedByDriver ? <span style={{ color:G.success }}>✓ Signed</span> : <span style={{ color:G.gold }}>Pending — driver will sign via their dashboard</span>}</div>
          </div>
        </div>

        <div style={{ padding:"14px 20px",borderTop:`1px solid ${G.border}`,display:"flex",gap:10,background:G.inset }}>
          <Btn onClick={save} style={{ flex:1,padding:13 }}>💾 SAVE WAGE & TERMS</Btn>
          <Btn variant="outline" onClick={onClose}>CANCEL</Btn>
        </div>
      </div>
    </div>
  );
}
