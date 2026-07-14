import { useState, useRef, useEffect, Fragment } from 'react';
import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';

export function AdminSheetsTab({ sheets, users, company, onViewPdf }: any) {
  const sorted = [...sheets].sort((a,b) => (b.createdAt||"") >= (a.createdAt||"") ? 1 : -1);

  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:3, color:G.muted, marginBottom:14 }}>
        ALL TRIP SHEETS ({sheets.length})
      </div>
      {sheets.length === 0
        ? <Card style={{ textAlign:"center", padding:50 }}>
            <div style={{ fontSize:36 }}>📋</div>
            <div style={{ color:G.muted, marginTop:10 }}>No sheets submitted yet by drivers.</div>
          </Card>
        : sorted.map(s => {
            const d   = users.find(u => u.id === s.driverId);
            const cad = (s.expenses||[]).filter(e => e.currency==="CAD").reduce((a,e) => a+(parseFloat(e.amount)||0), 0);
            const usd = (s.expenses||[]).filter(e => e.currency==="USD").reduce((a,e) => a+(parseFloat(e.amount)||0), 0);
            return (
              <Card key={s.id}>
                <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>Truck #{s.header?.truckNo||"—"}</div>
                    <div style={{ fontSize:12, color:G.gold, marginTop:3 }}>👤 {d?.name||"Unknown Driver"}</div>
                    <div style={{ fontSize:11, color:G.muted, marginTop:2 }}>{s.header?.startDate} → {s.header?.endDate}</div>
                    <div style={{ fontSize:11, color:G.muted }}>{s.trips?.length||0} leg(s) · {s.expenses?.length||0} expense(s)</div>
                    {(cad>0||usd>0) && (
                      <div style={{ fontSize:11, color:G.success, marginTop:3 }}>
                        {cad>0?`CAD ${cad.toFixed(2)}`:""}
                        {cad>0&&usd>0?" · ":""}
                        {usd>0?`USD ${usd.toFixed(2)}`:""}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                    <div style={{ fontSize:10, color:G.gold }}>{s.createdAt}</div>
                    <button
                      onClick={() => onViewPdf(s)}
                      style={{ background:G.gold, color:G.onGold, border:"none", borderRadius:7, padding:"8px 16px", fontSize:11, cursor:"pointer", fontWeight:800, letterSpacing:1, fontFamily:"monospace" }}
                    >
                      👁 VIEW PDF
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
      }
    </div>
  );
}
