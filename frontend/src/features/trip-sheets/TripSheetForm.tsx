import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { PrintPreview } from './PrintPreview';

const emptyTrip = () => ({ id: uid(), tripNo: '', trailerNo: '', pickupDate: '', dropDate: '', from: '', to: '', notes: '' });
const emptyExp = () => ({ id: uid(), category: 'Fuel', description: '', receiptNo: '', amount: '', currency: 'CAD' });

export function TripSheetForm({ company, user, editSheet, onSave, onBack }: any) {
  const [hdr,setHdr]    = useState(editSheet?.header || { truckNo:user.truckNo||"",startDate:"",endDate:"",driver1:user.name,driver2:"" });
  const [trips,setTrips]= useState(editSheet?.trips?.length ? editSheet.trips : [emptyTrip()]);
  const [exps,setExps]  = useState(editSheet?.expenses?.length ? editSheet.expenses : [emptyExp()]);
  const [notes,setNotes]= useState(editSheet?.notes||"");
  const [preview,setPreview]=useState(false);
  const [saving,setSaving]=useState(false);
  const updH=(k,v)=>setHdr(h=>({...h,[k]:v}));
  const updT=(id,k,v)=>setTrips(ts=>ts.map(t=>t.id===id?{...t,[k]:v}:t));
  const updE=(id,k,v)=>setExps(es=>es.map(e=>e.id===id?{...e,[k]:v}:e));
  const save=()=>{
    if (saving) return;
    setSaving(true);
    // Brief visible loading state so the action doesn't feel instant/silent
    setTimeout(async () => {
      try {
        await Promise.resolve(onSave({
          id: editSheet?.id || uid(),
          header:hdr, trips, expenses:exps, notes,
          companyId:company.id, driverId:user.id,
          createdAt: editSheet?.createdAt || new Date().toLocaleDateString("en-CA"),
          updatedAt: new Date().toLocaleDateString("en-CA"),
        }));
      } catch {
        // parent notifies; keep form open for retry
      } finally {
        setSaving(false);
      }
    }, 400);
  };
  if(preview) return <PrintPreview company={company} header={hdr} trips={trips} expenses={exps} notes={notes} onBack={()=>setPreview(false)}/>;

  const sn=company.shortName;
  return(
    <div style={{ ...page() }}>
      <div style={{ position:"sticky",top:0,zIndex:200,background:G.card,borderBottom:`1px solid ${G.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <Btn variant="outline" onClick={onBack} style={{ padding:"8px 14px",fontSize:11 }}>← BACK</Btn>
          <div>
            <span style={{ fontSize:11,letterSpacing:2,color:G.gold,fontWeight:700 }}>{editSheet?"EDIT TRIP SHEET":"NEW TRIP SHEET"}</span>
            {hdr.truckNo&&<span style={{ fontSize:10,color:G.muted,marginLeft:8 }}>Truck #{hdr.truckNo}</span>}
          </div>
        </div>
        <Btn onClick={save} style={{ padding:"9px 18px", opacity:saving?0.6:1 }}>{saving?"SAVING…":"SAVE"}</Btn>
      </div>

      <div style={{ padding:"16px 14px 100px",maxWidth:700,margin:"0 auto" }}>
        <Card>
          <SectionTitle>TRUCK & DRIVER INFO</SectionTitle>
          <G2 cols={2}><Inp label="Truck Unit No." value={hdr.truckNo} onChange={e=>updH("truckNo",e.target.value)} placeholder="e.g. 32054"/><Inp label="Start Date" value={hdr.startDate} onChange={e=>updH("startDate",e.target.value)} placeholder="e.g. 4 May 2026"/></G2>
          <G2 cols={2}><Inp label="End Date" value={hdr.endDate} onChange={e=>updH("endDate",e.target.value)} placeholder="e.g. 12 May 2026"/><Inp label="Driver Name 1" value={hdr.driver1} onChange={e=>updH("driver1",e.target.value)}/></G2>
          <Inp label="Driver Name 2 (Co-Driver)" value={hdr.driver2} onChange={e=>updH("driver2",e.target.value)} placeholder="Optional"/>
        </Card>

        <Card>
          <SectionTitle>TRIP INFORMATION</SectionTitle>
          {trips.map((t,i)=>(
            <div key={t.id} style={{ background:G.card2,border:`1px solid ${G.border2}`,borderRadius:10,padding:14,marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <div style={{ width:26,height:26,borderRadius:"50%",background:G.gold,color:G.onGold,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12 }}>{i+1}</div>
                {trips.length>1&&<Btn variant="danger" style={{ padding:"4px 10px",fontSize:10 }} onClick={()=>setTrips(ts=>ts.filter(x=>x.id!==t.id))}>REMOVE</Btn>}
              </div>
              <G2 cols={2}><Inp label="Trip No." value={t.tripNo} onChange={e=>updT(t.id,"tripNo",e.target.value)} placeholder="e.g. 34320"/><Inp label="Trailer No." value={t.trailerNo} onChange={e=>updT(t.id,"trailerNo",e.target.value)} placeholder="e.g. DV1767"/></G2>
              <G2 cols={2}><Inp label="Pickup Date" value={t.pickupDate} onChange={e=>updT(t.id,"pickupDate",e.target.value)} placeholder="e.g. 4 May"/><Inp label="Drop Date" value={t.dropDate} onChange={e=>updT(t.id,"dropDate",e.target.value)} placeholder="e.g. 7 May"/></G2>
              <G2 cols={2}><Inp label="From" value={t.from} onChange={e=>updT(t.id,"from",e.target.value)} placeholder="e.g. Calgary, AB"/><Inp label="To" value={t.to} onChange={e=>updT(t.id,"to",e.target.value)} placeholder="e.g. Toronto, ON"/></G2>
              <Inp label="Notes (e.g. 36hr reset)" value={t.notes} onChange={e=>updT(t.id,"notes",e.target.value)} placeholder="Optional"/>
            </div>
          ))}
          <button style={{ background:"transparent",border:`1px dashed ${G.gold}`,color:G.gold,borderRadius:8,padding:12,width:"100%",fontSize:12,cursor:"pointer" }} onClick={()=>setTrips(ts=>[...ts,emptyTrip()])}>+ ADD TRIP LEG</button>
        </Card>

        <Card>
          <SectionTitle>EXPENSE SHEET</SectionTitle>
          {exps.map((e,i)=>(
            <div key={e.id} style={{ background:G.card2,border:`1px solid ${G.border2}`,borderRadius:10,padding:14,marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <div style={{ width:26,height:26,borderRadius:"50%",background:G.gold,color:G.onGold,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12 }}>{i+1}</div>
                {exps.length>1&&<Btn variant="danger" style={{ padding:"4px 10px",fontSize:10 }} onClick={()=>setExps(es=>es.filter(x=>x.id!==e.id))}>REMOVE</Btn>}
              </div>
              <G2 cols={2}>
                <Sel label="Category" value={e.category} onChange={ev=>updE(e.id,"category",ev.target.value)}>{["Fuel","Lumper","Toll","Parking","Repair","Food","Other"].map(c=><option key={c}>{c}</option>)}</Sel>
                <Inp label="Description" value={e.description} onChange={ev=>updE(e.id,"description",ev.target.value)} placeholder="Details..."/>
              </G2>
              <G2 cols={2}><Inp label="Receipt #" value={e.receiptNo} onChange={ev=>updE(e.id,"receiptNo",ev.target.value)} placeholder="e.g. R-001"/><Inp label="Amount" type="number" value={e.amount} onChange={ev=>updE(e.id,"amount",ev.target.value)} placeholder="0.00"/></G2>
              <div>
                <div style={{ fontSize:10,letterSpacing:2,color:G.muted,marginBottom:6,textTransform:"uppercase" }}>Currency</div>
                <div style={{ display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${G.border2}` }}>
                  {["CAD","USD"].map(c=><button key={c} onClick={()=>updE(e.id,"currency",c)} style={{ flex:1,padding:"11px",border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:e.currency===c?G.gold:G.card2,color:e.currency===c?G.onGold:G.muted }}>{c==="CAD"?"🍁 CAD":"🇺🇸 USD"}</button>)}
                </div>
              </div>
            </div>
          ))}
          <button style={{ background:"transparent",border:`1px dashed ${G.gold}`,color:G.gold,borderRadius:8,padding:12,width:"100%",fontSize:12,cursor:"pointer" }} onClick={()=>setExps(es=>[...es,emptyExp()])}>+ ADD EXPENSE</button>
        </Card>

        <Card>
          <SectionTitle>NOTES</SectionTitle>
          <textarea style={{ width:"100%",background:G.inset,border:`1px solid ${G.border2}`,borderRadius:8,padding:"12px 14px",color:G.text,fontSize:13,outline:"none",boxSizing:"border-box",minHeight:70,resize:"vertical",fontFamily:"inherit" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="General notes..."/>
        </Card>
      </div>

      <div style={{ position:"fixed",bottom:0,left:0,right:0,background:G.card,borderTop:`1px solid ${G.border}`,padding:"12px 16px",display:"flex",gap:12,zIndex:300,paddingBottom:"env(safe-area-inset-bottom)" }}>
        <Btn variant="ghost" style={{ flex:1,padding:13 }} onClick={()=>setPreview(true)}>👁 VIEW / PDF</Btn>
        <Btn style={{ flex:1,padding:13, opacity:saving?0.6:1 }} onClick={save}>{saving?"SAVING…":"SAVE SHEET"}</Btn>
      </div>
    </div>
  );
}
