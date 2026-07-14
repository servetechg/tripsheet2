import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { DRIVER_DOC_TYPES, PAY_TYPES, DISPATCH_REQUIRED_DOCS, DOC_STATUS_COLOR } from '@/lib/docTypes';
import { DocUploadModal } from '@/features/documents/DocUploadModal';

export function DriverOnboarding({ invite, company, onComplete }: any) {
  const [step, setStep] = useState(1); // 1=welcome, 2=profile, 3=documents, 4=contract, 5=done
  const TOTAL = 4;

  const [profile, setProfile] = useState({
    name:"", email:"", password:"", phone:"", dob:"", licenseNo:"",
    citizenship:"CA", address:"", emergencyName:"", emergencyPhone:"", fastCard:"", notes:""
  });
  const [docs,     setDocs]     = useState<any[]>([]); // uploaded docs array
  const [contract, setContract] = useState<any>(null);
  const [err,      setErr]      = useState("");

  const sn = company.shortName;
  const accent = sn.slice(-1);
  const base   = sn.slice(0,-1);

  const upd = (k,v) => setProfile(x=>({...x,[k]:v}));

  const saveDoc = (typeId, fileData) => {
    setDocs(p => {
      const ex = p.findIndex(d => d.type === typeId);
      const newDoc = { id:uid(), type:typeId, fileName:fileData.name, fileSize:fileData.size, fileType:fileData.fileType, fileData:fileData.data, uploadedAt:new Date().toLocaleDateString("en-CA"), expiryDate:fileData.expiry||"", notes:fileData.notes||"", status:"uploaded" };
      if (ex >= 0) { const n=[...p]; n[ex]=newDoc; return n; }
      return [...p, newDoc];
    });
  };

  const finish = () => {
    if (!contract?.signedByDriver) { setErr("Please sign the contract before submitting."); return; }
    onComplete(profile, docs, contract);
    setStep(5);
  };

  const Step1Welcome = () => (
    <div style={{ textAlign:"center", padding:"40px 24px" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>👋</div>
      <div style={{ fontSize:22, fontWeight:900, color:G.white, marginBottom:8 }}>
        Welcome to <span style={{ color:G.gold }}>{company.name}</span>
      </div>
      <div style={{ fontSize:13, color:G.muted, marginBottom:32, lineHeight:1.8 }}>
        You've been invited to join as a driver.<br/>
        This will take about 5 minutes to complete.<br/>
        You'll fill in your profile, upload your documents, and sign your employment contract.
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12, maxWidth:300, margin:"0 auto", marginBottom:32 }}>
        {[["1","Fill your profile","👤"],["2","Upload your documents","📁"],["3","Review & sign contract","📄"]].map(([n,l,ic])=>(
          <div key={n} style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:G.gold, color:G.onGold, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, flexShrink:0 }}>{n}</div>
            <span style={{ fontSize:13, color:G.text }}>{ic} {l}</span>
          </div>
        ))}
      </div>
      <Btn onClick={()=>setStep(2)} style={{ padding:"14px 40px", fontSize:14 }}>GET STARTED →</Btn>
    </div>
  );

  const Step2Profile = () => {
    const [localErr, setLocalErr] = useState("");
    const next = () => {
      if (!profile.name||!profile.email||!profile.password) { setLocalErr("Name, email and password are required."); return; }
      setLocalErr(""); setStep(3);
    };
    return (
      <div style={{ padding:"24px 20px" }}>
        <div style={{ fontSize:14, fontWeight:700, color:G.white, marginBottom:4 }}>👤 Your Profile</div>
        <div style={{ fontSize:11, color:G.muted, marginBottom:20 }}>Fill in your personal details. This creates your login account.</div>
        {localErr && <div style={{ background:G.errTint, border:`1px solid ${G.danger}44`, borderRadius:8, padding:"10px", fontSize:12, color:G.errText, marginBottom:12 }}>{localErr}</div>}

        <div style={{ fontSize:10, letterSpacing:2, color:G.info, marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>LOGIN DETAILS</div>
        <G2 cols={2}>
          <Inp label="Full Name *" value={profile.name} onChange={e=>upd("name",e.target.value)} placeholder="Your full legal name" />
          <Inp label="Email *" value={profile.email} onChange={e=>upd("email",e.target.value)} placeholder="your@email.com" />
        </G2>
        <Inp label="Password * (for app login)" value={profile.password} onChange={e=>upd("password",e.target.value)} placeholder="Choose a secure password" type="password" />

        <div style={{ fontSize:10, letterSpacing:2, color:G.gold, marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>PERSONAL DETAILS</div>
        <G2 cols={2}>
          <Inp label="Phone" value={profile.phone} onChange={e=>upd("phone",e.target.value)} placeholder="+1 (403) 000-0000" />
          <Inp label="Date of Birth" value={profile.dob} onChange={e=>upd("dob",e.target.value)} type="date" />
        </G2>
        <G2 cols={2}>
          <Inp label="Driver's License No." value={profile.licenseNo} onChange={e=>upd("licenseNo",e.target.value)} placeholder="e.g. AB-123456" />
          <Sel label="Citizenship" value={profile.citizenship} onChange={e=>upd("citizenship",e.target.value)}>
            {["CA","US","IN","MX","Other"].map(c=><option key={c}>{c}</option>)}
          </Sel>
        </G2>
        <Inp label="Home Address" value={profile.address} onChange={e=>upd("address",e.target.value)} placeholder="Full address" />
        <Inp label="FAST Card # (if you have one)" value={profile.fastCard} onChange={e=>upd("fastCard",e.target.value)} placeholder="Optional" />

        <div style={{ fontSize:10, letterSpacing:2, color:G.muted, marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>EMERGENCY CONTACT</div>
        <G2 cols={2}>
          <Inp label="Emergency Contact Name" value={profile.emergencyName} onChange={e=>upd("emergencyName",e.target.value)} placeholder="Full name" />
          <Inp label="Emergency Phone" value={profile.emergencyPhone} onChange={e=>upd("emergencyPhone",e.target.value)} placeholder="+1 (403) 000-0000" />
        </G2>

        <div style={{ display:"flex", gap:10, marginTop:8 }}>
          <Btn variant="outline" onClick={()=>setStep(1)}>← BACK</Btn>
          <Btn onClick={next} style={{ flex:1, padding:14 }}>NEXT: UPLOAD DOCUMENTS →</Btn>
        </div>
      </div>
    );
  };

  const Step3Documents = () => {
    const [uploading, setUploading] = useState<any>(null);
    const required = DRIVER_DOC_TYPES.filter(t=>t.required);
    const optional = DRIVER_DOC_TYPES.filter(t=>!t.required);
    const getDoc = (typeId) => docs.find(d=>d.type===typeId);
    const uploaded = DRIVER_DOC_TYPES.filter(t=>getDoc(t.id)).length;
    const missingRequired = required.filter(t=>!getDoc(t.id)).length;

    return (
      <div style={{ padding:"24px 20px" }}>
        <div style={{ fontSize:14, fontWeight:700, color:G.white, marginBottom:4 }}>📁 Upload Documents</div>
        <div style={{ fontSize:11, color:G.muted, marginBottom:4 }}>Upload clear photos or PDFs of your documents.</div>
        <div style={{ fontSize:11, color:G.gold, marginBottom:20 }}>{uploaded} uploaded · {missingRequired} required missing</div>

        <div style={{ fontSize:10, letterSpacing:2, color:G.danger, marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>REQUIRED DOCUMENTS *</div>
        {required.map(docType=>{
          const doc = getDoc(docType.id);
          return (
            <div key={docType.id} style={{ background:G.card, border:`1px solid ${doc?G.success+"66":G.danger+"44"}`, borderRadius:10, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:20 }}>{docType.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:G.text }}>{docType.label}</div>
                  {doc && <div style={{ fontSize:10, color:G.success, marginTop:1 }}>✓ {doc.fileName}</div>}
                  {!doc && <div style={{ fontSize:10, color:G.danger, marginTop:1 }}>Required — not uploaded</div>}
                </div>
              </div>
              <button onClick={()=>setUploading(docType)} style={{ background:doc?G.card2:G.gold, color:doc?"#aaa":"#000", border:doc?`1px solid ${G.border2}`:"none", borderRadius:7, padding:"7px 14px", fontSize:11, fontWeight:800, cursor:"pointer" }}>
                {doc?"↑ REPLACE":"↑ UPLOAD"}
              </button>
            </div>
          );
        })}

        <div style={{ fontSize:10, letterSpacing:2, color:G.muted, marginBottom:10, marginTop:16, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>OPTIONAL DOCUMENTS</div>
        {optional.map(docType=>{
          const doc = getDoc(docType.id);
          return (
            <div key={docType.id} style={{ background:G.card, border:`1px solid ${doc?G.success+"44":G.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>{docType.icon}</span>
                <div>
                  <div style={{ fontSize:12, color:doc?G.text:G.muted }}>{docType.label}</div>
                  {doc && <div style={{ fontSize:10, color:G.success }}>✓ {doc.fileName}</div>}
                </div>
              </div>
              <button onClick={()=>setUploading(docType)} style={{ background:"transparent", border:`1px solid ${doc?G.success:G.border2}`, color:doc?G.success:G.muted, borderRadius:7, padding:"6px 12px", fontSize:11, cursor:"pointer" }}>
                {doc?"↑ REPLACE":"↑ UPLOAD"}
              </button>
            </div>
          );
        })}

        <div style={{ display:"flex", gap:10, marginTop:16 }}>
          <Btn variant="outline" onClick={()=>setStep(2)}>← BACK</Btn>
          <Btn onClick={()=>setStep(4)} style={{ flex:1, padding:14 }}>NEXT: REVIEW CONTRACT →</Btn>
        </div>

        {uploading && (
          <DocUploadModal
            docType={uploading}
            onUpload={(typeId, fileData)=>{ saveDoc(typeId, fileData); setUploading(null); }}
            onClose={()=>setUploading(null)}
          />
        )}
      </div>
    );
  };

  const Step4Contract = () => {
    const [localContract, setLocalContract] = useState(contract || { signedByDriver:false, signedByAdmin:false });
    const upd = (k,v) => setLocalContract(x=>({...x,[k]:v}));

    return (
      <div style={{ padding:"24px 20px" }}>
        <div style={{ fontSize:14, fontWeight:700, color:G.white, marginBottom:4 }}>📄 Employment Contract</div>
        <div style={{ fontSize:11, color:G.muted, marginBottom:20 }}>Review your employment terms set by {company.name} and sign below.</div>

        {localContract.payType ? (
          <div style={{ background:G.card2, border:`1px solid ${G.gold}44`, borderRadius:12, padding:18, marginBottom:16 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:G.gold, marginBottom:14 }}>YOUR EMPLOYMENT TERMS</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Pay Structure", PAY_TYPES.find(p=>p.id===localContract.payType)?.label||"—"],
                ["Base Rate", `${localContract.payUnit||"CAD"} ${localContract.payRate||"—"} ${PAY_TYPES.find(p=>p.id===localContract.payType)?.unit||""}`],
                ["Detention",localContract.detentionRate?`${localContract.payUnit} ${localContract.detentionRate}/hr after 2hrs free`:"—"],
                ["Wait Time", localContract.waitRate?`${localContract.payUnit} ${localContract.waitRate}/hr`:"—"],
                ["Vacation Pay", localContract.vacationPct?`${localContract.vacationPct}%`:"4%"],
                ["Probation",   localContract.trialDays?`${localContract.trialDays} days`:"90 days"],
                ["Notice",      localContract.noticeDays?`${localContract.noticeDays} days`:"14 days"],
                ["Benefits",    localContract.benefits||"—"],
              ].map(([k,v])=>(
                <div key={k} style={{ background:G.card, borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:9, color:G.muted, letterSpacing:2, textTransform:"uppercase" }}>{k}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:G.text, marginTop:3 }}>{v}</div>
                </div>
              ))}
            </div>
            {localContract.notes && (
              <div style={{ marginTop:12, padding:"10px", background:G.card, borderRadius:8, fontSize:11, color:G.muted }}>
                <strong>Additional Terms:</strong> {localContract.notes}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background:G.card2, border:`1px solid ${G.gold}33`, borderRadius:12, padding:20, marginBottom:16, textAlign:"center" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>⏳</div>
            <div style={{ fontSize:13, color:G.muted }}>Your employer hasn't set contract terms yet.</div>
            <div style={{ fontSize:11, color:G.muted, marginTop:4 }}>You can still sign to confirm your agreement to standard terms. Your employer will add the pay details.</div>
          </div>
        )}

        {/* Standard terms */}
        <div style={{ background:G.inset, border:`1px solid ${G.border}`, borderRadius:10, padding:14, marginBottom:16, fontSize:11, color:G.muted, lineHeight:1.8 }}>
          <div style={{ color:G.text, fontWeight:700, marginBottom:6 }}>STANDARD TERMS</div>
          I agree to operate all vehicles safely and in compliance with all federal/provincial regulations including HOS, ELD, and border crossing requirements. I will maintain a valid Class 1/CDL licence and all required endorsements. I will report all accidents and violations within 24 hours. Pay is contingent on proper completion of trip sheets and eManifest filings. This agreement is governed by the laws of the Province of Alberta, Canada.
        </div>

        {/* Driver signature */}
        <div
          onClick={()=>upd("signedByDriver",!localContract.signedByDriver)}
          style={{ background:localContract.signedByDriver?`${G.success}22`:G.card2, border:`2px solid ${localContract.signedByDriver?G.success:G.border2}`, borderRadius:12, padding:"18px", cursor:"pointer", textAlign:"center", marginBottom:16, transition:"all .2s" }}
        >
          {localContract.signedByDriver ? (
            <>
              <div style={{ fontSize:28 }}>✅</div>
              <div style={{ fontSize:14, fontWeight:800, color:G.success, marginTop:6 }}>SIGNED BY {profile.name?.toUpperCase()||"DRIVER"}</div>
              <div style={{ fontSize:11, color:G.muted, marginTop:4 }}>Tap to unsign</div>
            </>
          ) : (
            <>
              <div style={{ fontSize:28 }}>✍️</div>
              <div style={{ fontSize:14, fontWeight:800, color:G.muted, marginTop:6 }}>TAP TO SIGN CONTRACT</div>
              <div style={{ fontSize:11, color:G.muted, marginTop:4 }}>As {profile.name||"Driver"} · {new Date().toLocaleDateString("en-CA")}</div>
            </>
          )}
        </div>

        {err && <div style={{ background:G.errTint, border:`1px solid ${G.danger}44`, borderRadius:8, padding:"10px", fontSize:12, color:G.errText, marginBottom:12 }}>{err}</div>}

        <div style={{ display:"flex", gap:10 }}>
          <Btn variant="outline" onClick={()=>setStep(3)}>← BACK</Btn>
          <Btn
            onClick={()=>{ setContract({...localContract}); finish(); }}
            style={{ flex:1, padding:14, opacity:localContract.signedByDriver?1:0.5 }}
          >
            ✓ SUBMIT APPLICATION
          </Btn>
        </div>
      </div>
    );
  };

  const Step5Done = () => (
    <div style={{ textAlign:"center", padding:"40px 24px" }}>
      <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
      <div style={{ fontSize:22, fontWeight:900, color:G.success, marginBottom:8 }}>Application Submitted!</div>
      <div style={{ fontSize:13, color:G.muted, marginBottom:24, lineHeight:1.8 }}>
        Your profile, documents, and signed contract have been sent to <strong style={{ color:G.white }}>{company.name}</strong>.<br/>
        They will review everything and set up your login shortly.<br/>
        Your login email is: <span style={{ color:G.gold }}>{profile.email}</span>
      </div>
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:16, maxWidth:300, margin:"0 auto", fontSize:11, color:G.muted, lineHeight:2 }}>
        <div>✓ Profile saved</div>
        <div>✓ {docs.length} document{docs.length!==1?"s":""} uploaded</div>
        <div>✓ Contract signed</div>
      </div>
    </div>
  );

  return (
    <div style={{ ...page() }}>
      {/* Header */}
      <div style={{ background:G.card, borderBottom:`2px solid ${G.gold}`, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:22, fontWeight:900 }}>{base}<span style={{ color:G.gold }}>{accent}</span></div>
          <div style={{ fontSize:10, letterSpacing:2, color:G.muted }}>DRIVER ONBOARDING</div>
        </div>
        {step < 5 && (
          <div style={{ fontSize:11, color:G.muted }}>Step {step-1} of {TOTAL}</div>
        )}
      </div>

      {/* Progress bar */}
      {step > 1 && step < 5 && (
        <div style={{ height:3, background:G.border }}>
          <div style={{ height:"100%", background:G.gold, width:`${((step-1)/TOTAL)*100}%`, transition:"width .3s" }} />
        </div>
      )}

      {/* Step content */}
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        {step===1 && <Step1Welcome />}
        {step===2 && <Step2Profile />}
        {step===3 && <Step3Documents />}
        {step===4 && <Step4Contract />}
        {step===5 && <Step5Done />}
      </div>
    </div>
  );
}
