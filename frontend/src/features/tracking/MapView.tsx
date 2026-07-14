import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';

export function MapView({ load, users, loads, tick }: any) {
  const canvasRef = useRef<any>(null);
  const driver = users.find(u=>u.id===load.driverId);
  useEffect(()=>{
    const cv=canvasRef.current; if(!cv)return;
    const ctx=cv.getContext("2d");
    const W=cv.width, H=cv.height;
    ctx.fillStyle="#0a0e18"; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="#141c2e"; ctx.lineWidth=1;
    for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.strokeStyle="#1a2a40"; ctx.lineWidth=7;
    ctx.beginPath();ctx.moveTo(0,H*.45);ctx.bezierCurveTo(W*.3,H*.4,W*.6,H*.55,W,H*.5);ctx.stroke();
    ctx.strokeStyle="#121e30"; ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(0,H*.7);ctx.bezierCurveTo(W*.4,H*.65,W*.7,H*.35,W,H*.3);ctx.stroke();
    loads.filter(l=>l.status==="in_transit"&&l.id!==load.id).forEach(l=>{
      const x=((l.lng+115)/25)*W, y=(1-(l.lat-45)/20)*H;
      ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=G.goldDim+"88";ctx.fill();
    });
    const x=Math.max(30,Math.min(W-30,((load.lng+115)/25)*W));
    const y=Math.max(30,Math.min(H-30,(1-(load.lat-45)/20)*H));
    ctx.beginPath();ctx.arc(x,y,18+(tick%3)*6,0,Math.PI*2);ctx.strokeStyle=G.success+"44";ctx.lineWidth=2;ctx.stroke();
    ctx.setLineDash([5,4]);ctx.strokeStyle=G.gold+"33";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(40,H-30);ctx.lineTo(x,y);ctx.lineTo(W-40,30);ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fillStyle=G.gold;ctx.fill();
    ctx.fillStyle="#000";ctx.font="bold 13px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("🚛",x,y);
    ctx.fillStyle="#000c";ctx.fillRect(x+16,y-14,118,28);
    ctx.fillStyle=G.gold;ctx.font="bold 10px monospace";ctx.textAlign="left";ctx.textBaseline="middle";
    ctx.fillText(load.truckNo||load.id,x+20,y-5);
    ctx.fillStyle="#aaa";ctx.font="9px monospace";ctx.fillText(`${load.speed||0} km/h · ${load.heading||"E"}`,x+20,y+8);
    ctx.beginPath();ctx.arc(40,H-30,7,0,Math.PI*2);ctx.fillStyle=G.info;ctx.fill();
    ctx.fillStyle="#fff";ctx.font="9px monospace";ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText("ORIGIN",52,H-30);
    ctx.beginPath();ctx.arc(W-40,30,7,0,Math.PI*2);ctx.fillStyle=G.success;ctx.fill();
    ctx.fillText("DEST",W-100,30);
  },[load,tick]);

  return(
    <div style={{ background:G.card2 }}>
      <div style={{ padding:"12px 16px",borderBottom:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <span style={{ fontWeight:800,color:G.gold,fontSize:13 }}>{load.id}</span>
          <span style={{ fontSize:11,color:G.muted,marginLeft:10 }}>{driver?.name||"Unknown"}</span>
        </div>
        <div style={{ fontSize:11,color:G.muted,display:"flex",gap:10 }}>
          <span>🚛 {load.truckNo||"—"}</span>
          {load.status==="in_transit"&&<span style={{ color:G.success }}>● LIVE</span>}
        </div>
      </div>
      <canvas ref={canvasRef} width={520} height={300} style={{ display:"block",width:"100%",height:"auto" }}/>
      <div style={{ display:"flex",flexWrap:"wrap" }}>
        {[["FROM",load.origin],["TO",load.destination],["SPEED",load.status==="in_transit"?`${load.speed} km/h`:"—"],["UPDATED",load.lastUpdate||"—"]].map(([k,v])=>(
          <div key={k} style={{ flex:"1 1 50%",padding:"10px 12px",borderRight:`1px solid ${G.border}`,borderTop:`1px solid ${G.border}` }}>
            <div style={{ fontSize:9,color:G.muted,letterSpacing:2 }}>{k}</div>
            <div style={{ fontSize:11,fontWeight:600,marginTop:2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
