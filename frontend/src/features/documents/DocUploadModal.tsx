import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';

export function DocUploadModal({ docType, onUpload, onClose }: any) {
  const [expiry,   setExpiry]   = useState("");
  const [notes,    setNotes]    = useState("");
  const [preview,  setPreview]  = useState<any>(null);
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [dragging, setDragging] = useState(false);
  const [err,      setErr]      = useState("");
  const fileRef = useRef<any>(null);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErr('File too large. Max 2MB per document.');
      return;
    }
    const ok = ["application/pdf","image/jpeg","image/png","image/webp"];
    if (!ok.includes(file.type)) { setErr("Only PDF, JPG, PNG or WEBP accepted."); return; }
    setErr("");
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result;
      if (typeof result !== 'string') return;
      setPreview(result);
      setFileInfo({
        name: file.name,
        size: file.size,
        displaySize: `${(file.size / 1024).toFixed(1)} KB`,
        fileType: file.type,
        data: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!fileInfo) { setErr("Please select a file first."); return; }
    onUpload(docType.id, { ...fileInfo, expiry, notes });
  };

  return (
    <div style={{ position:"fixed",inset:0,background:G.overlay,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:G.card,border:`1px solid ${G.border}`,borderRadius:16,padding:24,width:"100%",maxWidth:460,maxHeight:"92vh",overflow:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:G.text }}>{docType.icon} {docType.label}</div>
            <div style={{ fontSize:11,color:G.muted,marginTop:2 }}>Select file from your device</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent",border:`1px solid ${G.border}`,color:G.muted,borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:16 }}>✕</button>
        </div>

        {err && <div style={{ background:G.errTint,border:`1px solid ${G.danger}44`,borderRadius:8,padding:"10px 14px",fontSize:12,color:G.errText,marginBottom:12 }}>{err}</div>}

        <div
          onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{ e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          style={{ border:`2px dashed ${dragging?G.gold:fileInfo?G.success:G.border2}`,borderRadius:12,padding:"20px 16px",textAlign:"center",marginBottom:14,background:dragging?`${G.gold}11`:fileInfo?`${G.success}08`:"#0a0a0a",minHeight:140,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8 }}
        >
          {fileInfo ? (
            <>
              {fileInfo.fileType.startsWith("image/")
                ? <img src={fileInfo.data} alt="preview" style={{ maxWidth:"100%",maxHeight:180,borderRadius:8,objectFit:"contain" }} />
                : <div style={{ fontSize:48 }}>📄</div>}
              <div style={{ fontSize:12,color:G.success,fontWeight:700 }}>✓ {fileInfo.name}</div>
              <div style={{ fontSize: 11, color: G.muted }}>
                {fileInfo.displaySize ||
                  `${(Number(fileInfo.size) / 1024).toFixed(1)} KB`}
              </div>
              <button onClick={()=>fileRef.current?.click()} style={{ background:"transparent",border:`1px solid ${G.muted}`,color:G.muted,borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer",marginTop:4 }}>Change file</button>
            </>
          ) : (
            <>
              <div style={{ fontSize:36 }}>📁</div>
              <div style={{ fontSize:13,color:G.muted }}>Drag & drop here, or</div>
              <button onClick={()=>fileRef.current?.click()} style={{ background:G.gold,color:G.onGold,border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:800,cursor:"pointer",letterSpacing:1 }}>
                📂 BROWSE FILES
              </button>
              <div style={{ fontSize: 10, color: G.muted, marginTop: 4 }}>
                PDF · JPG · PNG · WEBP · Max 2MB
              </div>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
          style={{ position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none" }}
          onChange={e=>{ const file = e.target.files?.[0]; if(file) handleFile(file); e.target.value=""; }}
        />

        <Inp label="Expiry Date (if applicable)" value={expiry} onChange={e=>setExpiry(e.target.value)} type="date" />
        <Inp label="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Renewed Mar 2026, verified original" />

        <div style={{ display:"flex",gap:10 }}>
          <Btn full onClick={submit} style={{ padding:14,opacity:fileInfo?1:0.5 }}>⬆️ UPLOAD DOCUMENT</Btn>
          <Btn variant="outline" onClick={onClose}>CANCEL</Btn>
        </div>
      </div>
    </div>
  );
}
