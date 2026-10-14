/* =====================================================================
   BACKUP LIMNAS (pelacak pergerakan) — ikut di Export/Import Data pribadi
   Data: localStorage 'drivertrack_track_YYYY-MM-DD' = { km, pts:[[ts,lat,lon],...] }
   Tidak dimasukkan ke file Database Resto (riwayat lokasi bersifat pribadi).
   ===================================================================== */
(function(){
  'use strict';
  var TP='drivertrack_track_', DAY_RE=/^\d{4}-\d{2}-\d{2}$/;
  var MAX_DAYS=400, MAX_PTS=3000, MAX_PTS_IN=20000, VERSION=1;

  function validPt(p){
    if(!Array.isArray(p) || p.length<3) return false;
    var t=Number(p[0]), la=Number(p[1]), lo=Number(p[2]);
    return isFinite(t) && t>1e11 && isFinite(la) && isFinite(lo) && Math.abs(la)<=90 && Math.abs(lo)<=180;
  }
  function km2(a,b,c,d){ var R=6371,t=Math.PI/180,dl=(c-a)*t,dn=(d-b)*t,
    h=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*t)*Math.cos(c*t)*Math.sin(dn/2)*Math.sin(dn/2);
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h))); }
  /* Hitung ulang jarak dengan aturan yang sama seperti perekam Limnas */
  function recomputeKm(pts){
    var km=0;
    for(var i=1;i<pts.length;i++){
      var a=pts[i-1], b=pts[i], dist=km2(a[1],a[2],b[1],b[2]), dt=(b[0]-a[0])/1000;
      if(dist<0.03) continue;
      if(dt>0 && dist/(dt/3600)>140) continue;
      if(dt<=900) km+=dist;
    }
    return +km.toFixed(3);
  }
  function thin(pts){ while(pts.length>MAX_PTS) pts=pts.filter(function(_,i){ return i%2===0; }); return pts; }
  function readDay(k){ try{ var d=JSON.parse(localStorage.getItem(TP+k)); return (d&&Array.isArray(d.pts))?d:null; }catch(e){ return null; } }

  /* maxDays: batasi hanya N hari terakhir (backup ringan); kosong = semua */
  window.collectLimnasBackup=function(maxDays){
    var days={}, n=0, cutoff=null;
    if(maxDays){ var c=new Date(); c.setHours(0,0,0,0); c.setDate(c.getDate()-maxDays); cutoff=c.getTime(); }
    try{
      for(var i=0;i<localStorage.length;i++){
        var key=localStorage.key(i); if(!key || key.indexOf(TP)!==0) continue;
        var k=key.slice(TP.length); if(!DAY_RE.test(k)) continue;           // abaikan 'drivertrack_track_final' dll.
        if(cutoff!==null && new Date(k+'T00:00:00').getTime()<cutoff) continue;
        var d=readDay(k); if(!d) continue;
        var pts=d.pts.filter(validPt).map(function(p){ return [Number(p[0]),Number(p[1]),Number(p[2])]; });
        if(!pts.length) continue;
        days[k]={km:+(Number(d.km)||0).toFixed(3), pts:pts}; n++;
      }
    }catch(e){ console.warn('Limnas backup:',e); }
    return n ? {version:VERSION, totalDays:n, days:days} : null;
  };

  /* Validasi & bersihkan data masuk. Mengembalikan {days, totalDays, totalPts} atau null */
  window.parseLimnasBackup=function(obj){
    if(!obj || typeof obj!=='object' || !obj.days || typeof obj.days!=='object') return null;
    if(Number(obj.version)>VERSION) return null;
    var out={}, n=0, tp=0;
    Object.keys(obj.days).slice(0,MAX_DAYS).forEach(function(k){
      if(!DAY_RE.test(k)) return;
      var d=obj.days[k]; if(!d || !Array.isArray(d.pts) || d.pts.length>MAX_PTS_IN) return;
      var pts=d.pts.filter(validPt).map(function(p){ return [Number(p[0]),+Number(p[1]).toFixed(5),+Number(p[2]).toFixed(5)]; })
                   .sort(function(a,b){ return a[0]-b[0]; });
      if(!pts.length) return;
      var km=Number(d.km); if(!isFinite(km) || km<0 || km>2000) km=recomputeKm(pts);
      out[k]={km:+km.toFixed(3), pts:pts}; n++; tp+=pts.length;
    });
    return n ? {days:out, totalDays:n, totalPts:tp} : null;
  };

  /* mode 'merge': gabung titik per hari (tanpa duplikat); 'overwrite': hari yang ada di file menggantikan hari lokal.
     Hari lokal yang TIDAK ada di file tidak pernah dihapus. */
  window.restoreLimnasBackup=function(parsed, mode){
    var res={restored:0, merged:0, kept:0, failed:0};
    if(!parsed || !parsed.days) return res;
    Object.keys(parsed.days).forEach(function(k){
      var inc=parsed.days[k], loc=readDay(k), final=inc;
      if(loc && loc.pts.length && mode!=='overwrite'){
        var seen={}, union=[];
        loc.pts.filter(validPt).concat(inc.pts).forEach(function(p){ var t=Number(p[0]); if(!seen[t]){ seen[t]=1; union.push([t,Number(p[1]),Number(p[2])]); } });
        union.sort(function(a,b){ return a[0]-b[0]; });
        if(union.length===inc.pts.length){ final=inc; res.restored++; }                       // file ⊇ lokal
        else if(union.length===loc.pts.filter(validPt).length){ res.kept++; return; }          // lokal ⊇ file → biarkan
        else { union=thin(union); final={km:recomputeKm(union), pts:union}; res.merged++; }
      } else res.restored++;
      try{ localStorage.setItem(TP+k, JSON.stringify({km:final.km, pts:thin(final.pts.slice())})); }
      catch(e){ res.failed++; }
    });
    return res;
  };

  window.describeLimnasBackup=function(parsed){
    return parsed ? ' & riwayat Limnas ('+parsed.totalDays+' hari)' : '';
  };
})();
