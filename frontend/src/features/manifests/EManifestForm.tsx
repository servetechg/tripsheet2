import { useState, useRef, useEffect, Fragment, useMemo } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2, Icons } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { EM_STATUS, CA_PORTS, US_PORTS } from '@/features/manifests/constants';
import { companiesApi, driversApi } from '@/lib/api';
import {
  availabilityAllowsDispatch,
  lifecycleAllowsDispatch,
} from '@/lib/driverLifecycle';
import { driverRecordIdOf } from '@/lib/driverIds';

export function EManifestForm({ type, company, carrier, drivers, trucks, trailers, loads, genCRN, genCCN, editData, onSave, onBack, apiEnabled }: any) {
  const isACI = type === "ACI";
  const PORTS_FALLBACK = isACI ? CA_PORTS : US_PORTS;
  const carrierCode = isACI ? (carrier.cbsaCarrierCode||"XXXX") : (carrier.scacCode||"XXXX");

  const emptyShipment = () => ({
    id: uid(),
    type: isACI ? "PARS" : "PAPS",
    ccn: genCCN(carrierCode),
    shipperName:"", shipperAddress:"", shipperCity:"", shipperCountry: isACI?"US":"CA",
    consigneeName:"", consigneeAddress:"", consigneeCity:"", consigneeCountry: isACI?"CA":"US",
    commodityId:"", commodityDesc:"", pieces:"", weight:"", weightUnit:"KG",
    countryOfOrigin:"US",
  });

  const [commodities, setCommodities] = useState<any[]>([]);
  const [ports, setPorts] = useState<Array<{ code: string; name: string; id?: string; ace?: boolean; aci?: boolean; paps?: boolean; pars?: boolean }>>([]);
  const [portCaps, setPortCaps] = useState<{ paps?: boolean; pars?: boolean }>({
    paps: !isACI,
    pars: isACI,
  });
  const [f, setF] = useState({
    crn:         editData?.crn         || genCRN(carrierCode, type),
    portCode:    editData?.portCode    || (isACI ? "0407" : "3505"),
    eta:         editData?.eta         || "",
    etaTime:     editData?.etaTime     || "",
    driverId:    editData?.driverId    || "",
    truckId:     editData?.truckId     || "",
    trailerId:   editData?.trailerId   || "",
    sealNo:      editData?.sealNo      || "",
    coDriverId:  editData?.coDriverId  || "",
    // Driver details (can override from profile)
    driverDOB:   editData?.driverDOB   || "",
    driverCitizenship: editData?.driverCitizenship || "CA",
    driverPassport:    editData?.driverPassport    || "",
    driverFAST:        editData?.driverFAST        || "",
    shipments:   editData?.shipments   || [emptyShipment()],
    notes:       editData?.notes       || "",
    tripLoadId:  editData?.tripLoadId  || "",
  });

  useEffect(() => {
    if (!company?.id) {
      setPorts(PORTS_FALLBACK);
      return;
    }
    void companiesApi
      .commodities(company.id, true)
      .then(setCommodities)
      .catch(() => setCommodities([]));
    void companiesApi
      .portsOfEntry(company.id, {
        selectableOnly: true,
        country: isACI ? 'CA' : 'US',
      })
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          setPorts(list);
          const match =
            list.find((p: any) => p.code === f.portCode) || list[0];
          if (match) {
            setPortCaps({ paps: Boolean(match.paps), pars: Boolean(match.pars) });
          }
        } else {
          setPorts(PORTS_FALLBACK);
        }
      })
      .catch(() => setPorts(PORTS_FALLBACK));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, isACI]);

  const upd = (k,v) => setF(x=>({...x,[k]:v}));
  const updShip = (id,k,v) => setF(x=>({...x, shipments: x.shipments.map(s=>s.id===id?{...s,[k]:v}:s)}));
  const addShip = () => setF(x=>({...x, shipments:[...x.shipments, emptyShipment()]}));
  const removeShip = (id) => setF(x=>({...x, shipments:x.shipments.filter(s=>s.id!==id)}));

  const onPortChange = async (code: string) => {
    upd('portCode', code);
    const local = ports.find((p) => p.code === code);
    if (local?.id && company?.id) {
      try {
        const c = await companiesApi.portCustoms(company.id, local.id);
        setPortCaps({ paps: Boolean(c.customsPaps), pars: Boolean(c.customsPars) });
        return;
      } catch {
        /* fall through */
      }
    }
    setPortCaps({
      paps: Boolean(local?.paps ?? !isACI),
      pars: Boolean(local?.pars ?? isACI),
    });
  };

  const pickCommodity = (shipId: string, commodityId: string) => {
    const c = commodities.find((x: any) => x.id === commodityId);
    setF((x) => ({
      ...x,
      shipments: x.shipments.map((s: any) =>
        s.id === shipId
          ? {
              ...s,
              commodityId,
              commodityDesc: c?.name || s.commodityDesc,
            }
          : s,
      ),
    }));
  };

  const selectedTruck   = trucks.find(t=>t.id===f.truckId);
  const selectedTrailer = trailers.find(t=>t.id===f.trailerId);
  const selectedDriver  = drivers.find(d=>d.id===f.driverId);

  const [formErr, setFormErr] = useState("");
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [borderCheck, setBorderCheck] = useState<{ eligible: boolean; missing: string[]; warnings: string[] } | null>(null);

  const eligibleDrivers = useMemo(() => {
    const base = showAllDrivers
      ? drivers
      : drivers.filter((d: any) => {
          const lifecycle = d.lifecycleStatus || (d.active === false ? 'suspended' : 'active');
          const avail = d.availabilityStatus || 'available';
          return lifecycleAllowsDispatch(lifecycle) && availabilityAllowsDispatch(avail);
        });
    return base;
  }, [drivers, showAllDrivers]);

  useEffect(() => {
    if (!apiEnabled || !f.driverId) {
      setBorderCheck(null);
      return;
    }
    const driver = drivers.find((d: any) => d.id === f.driverId);
    const recordId = driver ? driverRecordIdOf(driver) : f.driverId;
    let cancelled = false;
    driversApi
      .borderEligible(recordId)
      .then((res) => {
        if (!cancelled) setBorderCheck(res);
      })
      .catch(() => {
        if (!cancelled) setBorderCheck(null);
      });
    return () => {
      cancelled = true;
    };
  }, [apiEnabled, f.driverId, drivers]);

  const save = async (status="draft") => {
    if (status==="submitted") {
      if (blank(f.driverId)) { setFormErr("Please select a driver."); return; }
      if (blank(f.truckId))  { setFormErr("Please select a truck."); return; }
      if (blank(f.eta))      { setFormErr("ETA date is required before submitting."); return; }
      if (f.shipments.some(s=>blank(s.ccn)||blank(s.shipperName)||blank(s.consigneeName))) { setFormErr("All shipments must have CCN, shipper and consignee."); return; }
      if (apiEnabled && f.driverId) {
        const driver = drivers.find((d: any) => d.id === f.driverId);
        const recordId = driver ? driverRecordIdOf(driver) : f.driverId;
        try {
          const check = borderCheck || (await driversApi.borderEligible(recordId));
          if (!check.eligible) {
            setFormErr(
              `Driver is not border-eligible: ${check.missing.join(', ') || 'missing credentials'}`,
            );
            return;
          }
        } catch (e: any) {
          setFormErr(e?.message || 'Border eligibility check failed');
          return;
        }
      }
    }
    setFormErr("");
    onSave({
      id: editData?.id || uid(),
      type, status,
      companyId: company.id,
      createdAt: editData?.createdAt || new Date().toLocaleDateString("en-CA"),
      ...f,
      truckNo:   selectedTruck?.unitNo   || "",
      trailerNo: selectedTrailer?.unitNo || "",
      driverName:selectedDriver?.name    || "",
      portName:  ports.find(p=>p.code===f.portCode)?.name || f.portCode,
    });
  };

  const SHIP_TYPES_ACI = [
    ...(portCaps.pars ? ['PARS'] : []),
    'In-Bond',
    'CSA',
    'Courier LVS',
    'Postal',
    'Emergency Repair',
    'Empty',
  ];
  const SHIP_TYPES_ACE = [
    ...(portCaps.paps ? ['PAPS'] : []),
    'In-Bond',
    'IT (Immediate Transport)',
    'T&E',
    'IE',
    'Empty',
  ];
  const PORTS = ports.length ? ports : PORTS_FALLBACK;

  return (
    <div style={{ ...pagePlain() }}>
      {/* Top bar */}
      <div style={{ position:"sticky", top:0, zIndex:200, background:G.card, borderBottom:`2px solid ${isACI?G.info:G.purple}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Btn variant="outline" onClick={onBack} style={{ padding:"7px 14px", fontSize:11 }}>← BACK</Btn>
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: isACI ? G.info : G.purple,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {Icons.emanifest({
                size: 16,
                color: isACI ? G.info : G.purple,
              })}
              {isACI ? 'ACI eManifest' : 'ACE eManifest'}
            </span>
            <span style={{ fontSize:10, color:G.muted, marginLeft:8 }}>{isACI?"Canada-bound (CBSA)":"US-bound (CBP)"}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="outline" onClick={()=>save("draft")} style={{ fontSize:11, padding:"8px 14px" }}>SAVE DRAFT</Btn>
          <Btn onClick={()=>void save("submitted")} style={{ fontSize:11, padding:"8px 18px", background: isACI?G.info:G.purple }}>SUBMIT →</Btn>
        </div>
      </div>

      <div style={{ padding:"16px 14px 100px", maxWidth:800, margin:"0 auto" }}>

        {/* Carrier code banner */}
        <div style={{ background: isACI?"#0a1a2a":"#1a0a2a", border:`1px solid ${isACI?G.info+"44":"#8b5cf644"}`, borderRadius:10, padding:"10px 16px", marginBottom:16, display:"flex", gap:20, flexWrap:"wrap" }}>
          <div><span style={{ fontSize:9, color:G.muted, letterSpacing:2 }}>{isACI?"CBSA CARRIER CODE":"SCAC CODE"}</span><div style={{ fontSize:16, fontWeight:900, color: isACI?G.info:G.purple }}>{carrierCode}</div></div>
          <div><span style={{ fontSize:9, color:G.muted, letterSpacing:2 }}>DIRECTION</span><div style={{ fontSize:13, fontWeight:700, color:G.text }}>{isACI?"USA → Canada":"Canada → USA"}</div></div>
          <div><span style={{ fontSize:9, color:G.muted, letterSpacing:2 }}>PRE-ARRIVAL</span><div style={{ fontSize:13, fontWeight:700, color:G.gold }}>{carrier.fastLane?"30 min":"1 hour"} before border</div></div>
        </div>

        {/* Link to existing load */}
        {loads.length > 0 && (
          <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:10, padding:14, marginBottom:14 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:G.muted, marginBottom:8 }}>LINK TO DISPATCH LOAD (auto-fills fields)</div>
            <Sel value={f.tripLoadId} onChange={e=>{
              const l = loads.find(x=>x.id===e.target.value);
              if (l) {
                const tr = trucks.find(t=>t.id===l.truckId);
                const tr2 = trailers.find(t=>t.id===l.trailerId);
                upd("tripLoadId",l.id);
                setF(x=>({...x, tripLoadId:l.id, driverId:l.driverId||"", truckId:l.truckId||"", trailerId:l.trailerId||""}));
              } else { upd("tripLoadId",""); }
            }}>
              <option value="">— Select load to auto-fill —</option>
              {loads.map(l=><option key={l.id} value={l.id}>{l.id} · {l.origin} → {l.destination} ({l.status})</option>)}
            </Sel>
          </div>
        )}

        {/* Section 1: Trip / Conveyance */}
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:16, marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:3, color: isACI?G.info:G.purple, marginBottom:14, fontWeight:700 }}>1 · TRIP & CONVEYANCE</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <Inp label="Conveyance Reference No. (CRN)" value={f.crn} onChange={e=>upd("crn",e.target.value)} placeholder={carrierCode+"XXXXX"} />
              <div style={{ fontSize:9, color:G.muted, marginTop:-8, marginBottom:8 }}>Starts with carrier code · Unique per crossing</div>
            </div>
            <Sel label={isACI?"Port of Entry (Canada)":"Port of Entry (USA)"} value={f.portCode} onChange={e=>void onPortChange(e.target.value)}>
              {PORTS.map(p=><option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
            </Sel>
            <div style={{ fontSize: 11, color: G.muted, marginTop: 6 }}>
              Customs options from master:{' '}
              {isACI
                ? portCaps.pars
                  ? 'ACI · PARS available'
                  : 'ACI (PARS not flagged at this port)'
                : portCaps.paps
                  ? 'ACE · PAPS available'
                  : 'ACE (PAPS not flagged at this port)'}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Inp label="ETA Date" value={f.eta} onChange={e=>upd("eta",e.target.value)} placeholder="e.g. 2026-06-15" type="date" />
            <Inp label="ETA Time (local)" value={f.etaTime} onChange={e=>upd("etaTime",e.target.value)} placeholder="e.g. 14:30" type="time" />
          </div>
          {/* Truck select */}
          <Sel label="Truck (Conveyance)" value={f.truckId} onChange={e=>upd("truckId",e.target.value)}>
            <option value="">— Select truck —</option>
            {trucks.map(t=><option key={t.id} value={t.id}>#{t.unitNo} · {t.year} {t.make} {t.model} · Plate: {t.plate}</option>)}
          </Sel>
          {selectedTruck && (
            <div style={{ background:G.inset, borderRadius:8, padding:"10px 14px", marginTop:-8, marginBottom:12, display:"flex", gap:16, flexWrap:"wrap", fontSize:11, color:G.muted }}>
              <span>VIN: {selectedTruck.vin||"—"}</span>
              <span>Plate: {selectedTruck.plate||"—"}</span>
              <span>DOT: {carrier.dotNumber||"—"}</span>
            </div>
          )}
          {/* Trailer select */}
          <Sel label="Trailer (Equipment)" value={f.trailerId} onChange={e=>upd("trailerId",e.target.value)}>
            <option value="">— Select trailer —</option>
            {trailers.map(t=><option key={t.id} value={t.id}>#{t.unitNo} · {t.make} {t.model} · Plate: {t.plate}</option>)}
          </Sel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Inp label="Seal No. (if sealed)" value={f.sealNo} onChange={e=>upd("sealNo",e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {/* Section 2: Crew */}
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:16, marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:3, color: isACI?G.info:G.purple, marginBottom:14, fontWeight:700 }}>2 · CREW MEMBERS</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 10, color: G.muted }}>
              Showing {eligibleDrivers.length} of {drivers.length} drivers (active + available + border-ready)
            </div>
            <label style={{ fontSize: 10, color: G.muted, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showAllDrivers}
                onChange={(e) => setShowAllDrivers(e.target.checked)}
              />
              Show all drivers
            </label>
          </div>
          <Sel label="Driver *" value={f.driverId} onChange={e=>{
            const id = e.target.value;
            upd("driverId", id);
            const d = drivers.find((x: any) => x.id === id);
            if (d) {
              setF((x) => ({
                ...x,
                driverId: id,
                driverDOB: d.dob || x.driverDOB,
                driverCitizenship: d.citizenship || x.driverCitizenship,
                driverPassport: d.passportNo || x.driverPassport,
                driverFAST: d.fastCard || x.driverFAST,
              }));
            }
          }}>
            <option value="">— Select driver —</option>
            {eligibleDrivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </Sel>
          {borderCheck && f.driverId && (
            <div
              style={{
                marginTop: 8,
                marginBottom: 8,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 11,
                background: borderCheck.eligible ? G.successTint : G.errTint,
                color: borderCheck.eligible ? G.success : G.errText,
                border: `1px solid ${borderCheck.eligible ? G.success + '44' : G.danger + '44'}`,
              }}
            >
              {borderCheck.eligible
                ? `Border eligible${borderCheck.warnings?.length ? ` · ${borderCheck.warnings.join('; ')}` : ''}`
                : `Not border-eligible: ${borderCheck.missing.join(', ')}`}
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <Inp label="Date of Birth" value={f.driverDOB} onChange={e=>upd("driverDOB",e.target.value)} placeholder="YYYY-MM-DD" type="date" />
            <Sel label="Citizenship" value={f.driverCitizenship} onChange={e=>upd("driverCitizenship",e.target.value)}>
              {["CA","US","IN","MX","Other"].map(c=><option key={c}>{c}</option>)}
            </Sel>
            <Inp label="Passport / PR / FAST Card #" value={f.driverPassport} onChange={e=>upd("driverPassport",e.target.value)} placeholder="Doc number" />
          </div>
          <Sel label="Co-Driver (optional)" value={f.coDriverId} onChange={e=>upd("coDriverId",e.target.value)}>
            <option value="">— None —</option>
            {eligibleDrivers.filter(d=>d.id!==f.driverId).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </Sel>
        </div>

        {/* Section 3: Shipments */}
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:16, marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:3, color: isACI?G.info:G.purple, marginBottom:14, fontWeight:700 }}>3 · SHIPMENTS / CARGO ({f.shipments.length})</div>
          {f.shipments.map((s,i)=>(
            <div key={s.id} style={{ background:G.card2, border:`1px solid ${G.border2}`, borderRadius:10, padding:14, marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:26, height:26, borderRadius:"50%", background: isACI?G.info:G.purple, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:12 }}>{i+1}</div>
                  <Sel label="" value={s.type} onChange={e=>updShip(s.id,"type",e.target.value)} style={{ marginBottom:0, minWidth:140 }}>
                    {(isACI?SHIP_TYPES_ACI:SHIP_TYPES_ACE).map(t=><option key={t}>{t}</option>)}
                  </Sel>
                </div>
                {f.shipments.length>1 && <Btn variant="danger" onClick={()=>removeShip(s.id)} style={{ padding:"5px 12px", fontSize:10 }}>REMOVE</Btn>}
              </div>
              {/* CCN/PARS/PAPS */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <Inp label={isACI?"CCN / PARS Number *":"PAPS Number *"} value={s.ccn} onChange={e=>updShip(s.id,"ccn",e.target.value)} placeholder={`${carrierCode}XXXX`} />
                  <div style={{ fontSize:9, color:G.muted, marginTop:-8, marginBottom:8 }}>Must start with carrier code · Unique per shipment</div>
                </div>
                <div>
                  <Sel
                    label="Commodity (master)"
                    value={s.commodityId || ''}
                    onChange={(e: any) => pickCommodity(s.id, e.target.value)}
                  >
                    <option value="">— Or type description —</option>
                    {commodities.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.hazmat ? ' · HAZMAT' : ''}
                      </option>
                    ))}
                  </Sel>
                  <Inp label="Commodity Description *" value={s.commodityDesc} onChange={e=>updShip(s.id,"commodityDesc",e.target.value)} placeholder="e.g. Auto parts, dry goods" />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                <Inp label="No. of Pieces" value={s.pieces} onChange={e=>updShip(s.id,"pieces",e.target.value)} placeholder="e.g. 24" type="number" />
                <Inp label="Weight" value={s.weight} onChange={e=>updShip(s.id,"weight",e.target.value)} placeholder="e.g. 1500" type="number" />
                <Sel label="Weight Unit" value={s.weightUnit} onChange={e=>updShip(s.id,"weightUnit",e.target.value)}>
                  <option>KG</option><option>LB</option>
                </Sel>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
                <Sel label="Country of Origin of Goods" value={s.countryOfOrigin} onChange={e=>updShip(s.id,"countryOfOrigin",e.target.value)}>
                  {["US","CA","MX","CN","IN","DE","JP","KR","Other"].map(c=><option key={c}>{c}</option>)}
                </Sel>
              </div>
              {/* Shipper */}
              <div style={{ fontSize:9, letterSpacing:2, color:G.muted, marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>SHIPPER (ORIGIN)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Inp label="Shipper Name *" value={s.shipperName} onChange={e=>updShip(s.id,"shipperName",e.target.value)} placeholder="Company name" />
                <Inp label="Shipper Address" value={s.shipperAddress} onChange={e=>updShip(s.id,"shipperAddress",e.target.value)} placeholder="Street address" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Inp label="Shipper City / State" value={s.shipperCity} onChange={e=>updShip(s.id,"shipperCity",e.target.value)} placeholder="e.g. Detroit, MI" />
                <Sel label="Shipper Country" value={s.shipperCountry} onChange={e=>updShip(s.id,"shipperCountry",e.target.value)}>
                  <option value="US">United States</option><option value="CA">Canada</option><option value="MX">Mexico</option>
                </Sel>
              </div>
              {/* Consignee */}
              <div style={{ fontSize:9, letterSpacing:2, color:G.muted, marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>CONSIGNEE (DESTINATION)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Inp label="Consignee Name *" value={s.consigneeName} onChange={e=>updShip(s.id,"consigneeName",e.target.value)} placeholder="Company name" />
                <Inp label="Consignee Address" value={s.consigneeAddress} onChange={e=>updShip(s.id,"consigneeAddress",e.target.value)} placeholder="Street address" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Inp label="Consignee City / Province" value={s.consigneeCity} onChange={e=>updShip(s.id,"consigneeCity",e.target.value)} placeholder={isACI?"e.g. Calgary, AB":"e.g. Detroit, MI"} />
                <Sel label="Consignee Country" value={s.consigneeCountry} onChange={e=>updShip(s.id,"consigneeCountry",e.target.value)}>
                  <option value="CA">Canada</option><option value="US">United States</option><option value="MX">Mexico</option>
                </Sel>
              </div>
            </div>
          ))}
          <button onClick={addShip} style={{ background:"transparent", border:`1px dashed ${isACI?G.info:G.purple}`, color: isACI?G.info:G.purple, borderRadius:8, padding:12, width:"100%", fontSize:12, cursor:"pointer", marginBottom:4 }}>
            + ADD SHIPMENT
          </button>
        </div>

        {/* Notes */}
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:16, marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:3, color:G.muted, marginBottom:10, fontWeight:700 }}>NOTES / SPECIAL INSTRUCTIONS</div>
          <textarea style={{ width:"100%", background:G.inset, border:`1px solid ${G.border2}`, borderRadius:8, padding:"12px 14px", color:G.text, fontSize:13, outline:"none", boxSizing:"border-box", minHeight:70, resize:"vertical", fontFamily:"inherit" }} value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="e.g. FAST lane, partial shipment, special instructions..." />
        </div>

        {/* Compliance reminder */}
        {formErr && <div style={{ background:G.errTint, border:`1px solid ${G.danger}44`, borderRadius:10, padding:"12px 16px", marginBottom:12, fontSize:12, color:G.errText, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>{Icons.alert({ size: 16, color: G.errText })}{formErr}</div>}
        <div style={{ background:G.successTint, border:`1px solid ${G.success}33`, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:11, color:G.muted, lineHeight:1.7 }}>
          <div style={{ color:G.success, fontWeight:700, marginBottom:4, display:'inline-flex', alignItems:'center', gap:6 }}>{Icons.completed({ size: 14, color: G.success })}COMPLIANCE CHECKLIST</div>
          <div>• Submit at least <strong style={{ color:G.gold }}>1 hour</strong> before arriving at border {carrier.fastLane?"(30 min — FAST eligible)":""}</div>
          <div>• CRN must start with your carrier code: <strong style={{ color: isACI?G.info:G.purple }}>{carrierCode}</strong></div>
          <div>• Each shipment needs a unique {isACI?"CCN/PARS":"PAPS"} number — never reuse</div>
          <div>• {isACI?"PARS sticker must match barcoded CCN on paperwork":"PAPS sticker required on commercial invoice"}</div>
          <div>• Driver must present printed lead sheet with barcode at border</div>
        </div>
      </div>
    </div>
  );
}
