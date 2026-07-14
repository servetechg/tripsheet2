import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { DRIVER_DOC_TYPES, PAY_TYPES, DISPATCH_REQUIRED_DOCS, DOC_STATUS_COLOR } from '@/lib/docTypes';
import { DocUploadModal } from '@/features/documents/DocUploadModal';
import { DocViewer } from '@/features/documents/DocViewer';
import { AdminWageModal } from '@/features/contracts/AdminWageModal';

export function DriverProfile({ driver, company, loads, sheets, driverDocs, setDriverDocs, onEdit, onBack }: any) {
  const [docTab, setDocTab] = useState("documents");
  const [uploadModal, setUploadModal] = useState<any>(null);
  const [viewDoc, setViewDoc]         = useState<any>(null);
  const [showWage, setShowWage]       = useState(false);  // Admin sets wage
  const myContract = (driverDocs||[]).find(d=>d.driverId===driver.id&&d.type==="__contract__");

  const saveContract = (c) => {
    setDriverDocs(p => {
      const ex = p.find(x=>x.driverId===driver.id&&x.type==="__contract__");
      return ex ? p.map(x=>x.driverId===driver.id&&x.type==="__contract__"?{...x,...c}:x) : [...p,{...c,type:"__contract__",driverId:driver.id,companyId:company.id}];
    });
  };

  const myLoads  = loads.filter(l=>l.driverId===driver.id);
  const mySheets = sheets.filter(s=>s.driverId===driver.id);
  const myDocs   = (driverDocs||[]).filter(d=>d.driverId===driver.id);
  const active   = myLoads.find(l=>l.status==="in_transit");

  const getDoc = (typeId) => myDocs.find(d=>d.type===typeId);

  const uploadDoc = (typeId, fileData) => {
    const existing = myDocs.find(d=>d.type===typeId);
    const newDoc = {
      id: uid(), driverId:driver.id, companyId:company.id, type:typeId,
      fileName:  fileData.name, fileSize:fileData.size, fileType:fileData.fileType,
      fileData:  fileData.data, // base64
      uploadedAt:new Date().toLocaleDateString("en-CA"),
      expiryDate:fileData.expiry||"",
      status:    "uploaded", notes:fileData.notes||"",
    };
    setDriverDocs(p => existing
      ? p.map(d=>d.id===existing.id ? newDoc : d)
      : [...p, newDoc]
    );
    setUploadModal(null);
  };

  const deleteDoc = (docId) => { if(window.confirm("Delete this document?")) setDriverDocs(p=>p.filter(d=>d.id!==docId)); };

  const missingDocs = DRIVER_DOC_TYPES.filter(t=>t.required&&!getDoc(t.id)).length;
  const contractStatus = myContract
    ? (myContract.signedByDriver&&myContract.signedByAdmin ? "✓ Fully Signed" : myContract.signedByDriver ? "Driver Signed" : "Pending")
    : "No Contract";
  const stats = [
    ["Trips",    mySheets.length, G.gold   ],
    ["Loads",    myLoads.length,  G.info   ],
    ["Docs",     myDocs.length,   G.success],
    ["Missing",  missingDocs,     missingDocs>0?G.danger:G.success],
  ];

  return (
    <div style={{ ...pagePlain() }}>
      {/* Top bar */}
      <div style={{ background:G.card, borderBottom:`1px solid ${G.border}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${G.border2}`, color:G.muted, borderRadius:7, padding:"7px 14px", fontSize:11, cursor:"pointer" }}>← BACK</button>
          <span style={{ fontSize:12, fontWeight:700, color:G.gold, letterSpacing:2 }}>DRIVER PROFILE</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setShowWage(true)} style={{ background:G.goldTint, border:`1px solid ${G.gold}`, color:G.gold, borderRadius:7, padding:"8px 16px", fontSize:11, fontWeight:800, cursor:"pointer" }}>💰 {myContract?"EDIT WAGE":"SET WAGE"}</button>
          <button onClick={onEdit} style={{ background:G.gold, color:G.onGold, border:"none", borderRadius:7, padding:"8px 16px", fontSize:11, fontWeight:800, cursor:"pointer" }}>✏️ EDIT</button>
        </div>
      </div>

      <div style={{ padding:"16px 14px 40px", maxWidth:800, margin:"0 auto" }}>
        {/* Driver header card */}
        <Card>
          <div style={{ display:"flex", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", background:`${G.gold}22`, border:`2px solid ${G.gold}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>👤</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:20, fontWeight:900, color:G.text }}>{driver.name}</div>
              <div style={{ fontSize:12, color:G.muted, marginTop:2 }}>{driver.email}</div>
              <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                <Pill color={active?G.gold:G.success}>{active?"IN TRANSIT":"AVAILABLE"}</Pill>
                {driver.citizenship && <Pill color={G.info}>{driver.citizenship}</Pill>}
                {driver.fastCard    && <Pill color={G.purple}>FAST CARD</Pill>}
                <Pill color={myContract?.signedByDriver&&myContract?.signedByAdmin?G.success:myContract?G.gold:G.danger}>📄 {contractStatus}</Pill>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, minWidth:260 }}>
              {stats.map(([l,v,c])=>(
                <div key={l} style={{ background:G.card2, borderRadius:8, padding:"10px 6px", textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:8, letterSpacing:1, color:G.muted, marginTop:1 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Info grid */}
        <Card>
          <SectionTitle>PERSONAL INFORMATION</SectionTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
            {[
              ["Phone",       driver.phone||"—"],
              ["Date of Birth",driver.dob||"—"],
              ["License No.", driver.licenseNo||"—"],
              ["FAST Card",   driver.fastCard||"—"],
              ["Address",     driver.address||"—"],
              ["Citizenship", driver.citizenship||"—"],
              ["Emergency",   driver.emergencyName||"—"],
              ["Emerg. Phone",driver.emergencyPhone||"—"],
            ].map(([k,v])=>(
              <div key={k} style={{ background:G.card2, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, letterSpacing:2, color:G.muted, textTransform:"uppercase" }}>{k}</div>
                <div style={{ fontSize:13, fontWeight:600, color:G.text, marginTop:3 }}>{v}</div>
              </div>
            ))}
          </div>
          {driver.notes && <div style={{ marginTop:12, padding:"10px 12px", background:G.card2, borderRadius:8, fontSize:12, color:G.muted }}>{driver.notes}</div>}
        </Card>

        {/* Sub-tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          {[
            ["documents","📁 DOCUMENTS"],
            ["trips",    "📋 TRIP SHEETS"],
            ["loads",    "🚚 LOAD HISTORY"],
          ].map(([id,label])=>(
            <button key={id} onClick={()=>setDocTab(id)} style={{ background:docTab===id?G.gold:"transparent", color:docTab===id?G.onGold:G.muted, border:`1px solid ${docTab===id?G.gold:G.border}`, borderRadius:8, padding:"9px 18px", fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>{label}</button>
          ))}
        </div>

        {/* DOCUMENTS TAB */}
        {docTab==="documents" && (
          <div>
            <div style={{ background:G.successTint, border:`1px solid ${G.success}33`, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:11, color:G.muted }}>
              📎 Upload driver documents as images or PDFs. Files stored in localStorage. <span style={{ color:G.gold }}>Required docs</span> marked with *.
            </div>
            {/* Employment contract quick-access card */}
            <div style={{ background:G.card, border:`1px solid ${myContract?G.success+"66":G.gold+"44"}`, borderRadius:10, padding:"14px 16px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22 }}>📄</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:G.text }}>Employment Contract</div>
                  {myContract
                    ? <div style={{ fontSize:11, color:G.muted, marginTop:2 }}>
                        Pay: {myContract.payUnit} {myContract.payRate} · {PAY_TYPES.find(p=>p.id===myContract.payType)?.label||myContract.payType} · Updated: {myContract.updatedAt}
                        {myContract.signedByAdmin&&myContract.signedByDriver ? <span style={{ color:G.success }}> · ✓ Fully signed</span> : <span style={{ color:G.gold }}> · Pending signatures</span>}
                      </div>
                    : <div style={{ fontSize:11, color:G.danger, marginTop:2 }}>Not created yet</div>
                  }
                </div>
              </div>
              <button onClick={()=>setShowWage(true)} style={{ background:G.gold, color:G.onGold, border:"none", borderRadius:7, padding:"8px 16px", fontSize:11, fontWeight:800, cursor:"pointer" }}>
                {myContract ? "💰 EDIT WAGE" : "💰 SET WAGE"}
              </button>
            </div>
            {DRIVER_DOC_TYPES.map(docType=>{
              const doc = getDoc(docType.id);
              const statusColor = doc ? (doc.status==="expired"?G.danger:doc.status==="expiring_soon"?G.gold:G.success) : (docType.required?G.danger:G.muted);
              const statusLabel = doc ? (doc.status==="expired"?"EXPIRED":doc.status==="expiring_soon"?"EXPIRING SOON":"UPLOADED") : (docType.required?"MISSING *":"NOT UPLOADED");
              return (
                <div key={docType.id} style={{ background:G.card, border:`1px solid ${doc?G.border:docType.required?G.danger+"44":G.border}`, borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:22 }}>{docType.icon}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:G.text }}>{docType.label}{docType.required && <span style={{ color:G.danger }}> *</span>}</div>
                        {doc && (
                          <div style={{ fontSize:11, color:G.muted, marginTop:2 }}>
                            {doc.fileName} · {doc.uploadedAt}
                            {doc.expiryDate && <span style={{ color:G.gold }}> · Expires: {doc.expiryDate}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                      <Pill color={statusColor}>{statusLabel}</Pill>
                      {doc && (
                        <>
                          <button onClick={()=>setViewDoc(doc)} style={{ background:"transparent", border:`1px solid ${G.gold}`, color:G.gold, borderRadius:6, padding:"5px 12px", fontSize:11, cursor:"pointer", fontWeight:700 }}>👁 VIEW</button>
                          <button onClick={()=>deleteDoc(doc.id)} style={{ background:"transparent", border:`1px solid ${G.danger}`, color:G.danger, borderRadius:6, padding:"5px 12px", fontSize:11, cursor:"pointer" }}>🗑</button>
                        </>
                      )}
                      <button onClick={()=>setUploadModal(docType)} style={{ background:G.gold, color:G.onGold, border:"none", borderRadius:6, padding:"7px 14px", fontSize:11, cursor:"pointer", fontWeight:800 }}>
                        {doc?"↑ REPLACE":"↑ UPLOAD"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TRIPS TAB */}
        {docTab==="trips" && (
          <div>
            <div style={{ fontSize:10, letterSpacing:3, color:G.muted, marginBottom:12 }}>TRIP SHEETS ({mySheets.length})</div>
            {mySheets.length===0
              ? <Card style={{ textAlign:"center", padding:40 }}><div style={{ fontSize:30 }}>📋</div><div style={{ color:G.muted, marginTop:8 }}>No trip sheets yet.</div></Card>
              : [...mySheets].sort((a,b)=>b.createdAt>=a.createdAt?1:-1).map(s=>{
                  const cad=(s.expenses||[]).filter(e=>e.currency==="CAD").reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
                  return (
                    <Card key={s.id}>
                      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:14 }}>Truck #{s.header?.truckNo||"—"}</div>
                          <div style={{ fontSize:11, color:G.muted }}>{s.header?.startDate} → {s.header?.endDate}</div>
                          <div style={{ fontSize:11, color:G.muted }}>{s.trips?.length||0} leg(s) · {s.expenses?.length||0} expense(s)</div>
                          {cad>0 && <div style={{ fontSize:11, color:G.success }}>CAD {cad.toFixed(2)}</div>}
                        </div>
                        <div style={{ fontSize:10, color:G.gold }}>{s.createdAt}</div>
                      </div>
                    </Card>
                  );
                })
            }
          </div>
        )}

        {/* LOADS TAB */}
        {docTab==="loads" && (
          <div>
            <div style={{ fontSize:10, letterSpacing:3, color:G.muted, marginBottom:12 }}>LOAD HISTORY ({myLoads.length})</div>
            {myLoads.length===0
              ? <Card style={{ textAlign:"center", padding:40 }}><div style={{ fontSize:30 }}>🚚</div><div style={{ color:G.muted, marginTop:8 }}>No loads yet.</div></Card>
              : myLoads.map(l=>(
                  <Card key={l.id}>
                    <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                      <div>
                        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                          <span style={{ fontWeight:700, color:G.gold }}>{l.id}</span>
                          <Pill color={{assigned:G.info,in_transit:G.gold,delivered:G.success,cancelled:G.danger}[l.status]||G.muted}>{l.status.replace("_"," ").toUpperCase()}</Pill>
                        </div>
                        <div style={{ fontSize:12, color:G.text }}>🚛 {l.truckNo||"—"} · 📦 {l.trailerNo||"—"}</div>
                        <div style={{ fontSize:11, color:G.muted }}>📍 {l.origin} → {l.destination}</div>
                        {l.pickupTime && <div style={{ fontSize:11, color:G.muted }}>Pickup: {l.pickupTime}</div>}
                      </div>
                    </div>
                  </Card>
                ))
            }
          </div>
        )}
      </div>

      {/* Upload modal */}
      {uploadModal  && <DocUploadModal docType={uploadModal} onUpload={uploadDoc} onClose={()=>setUploadModal(null)} />}
      {viewDoc      && <DocViewer doc={viewDoc} onClose={()=>setViewDoc(null)} />}
      {showWage && (
        <AdminWageModal
          driver={driver} company={company}
          existingContract={myContract}
          onSave={saveContract}
          onClose={()=>setShowWage(false)}
        />
      )}
    </div>
  );
}
