/* =====================================================================
   PATCH v2
   (1) Peta Limnas di Profil          (2) Accordion Pesanan (form tambah & edit gabungan)
   (3) Tab Orders: default "Hari Ini", riwayat lewat 7 / 14 / 30 Hari
   ===================================================================== */

/* ===================== ROAD ROUTER (bersama: Limnas + Order) =====================
   Aturan: TIDAK PERNAH menggambar garis lurus / tembus bangunan.
   1) Cari rute jalan lewat OSRM (server utama -> server cadangan, retry).
   2) Minta beberapa alternatif, pilih jalur TERDEKAT (jarak terpendek).
   3) Titik di luar jalan otomatis di-snap ke jalan terdekat; geometri mengikuti peta (OSM).
   4) Jika semua server gagal: kembalikan null -> pemanggil menunggu & mencoba lagi (bukan garis lurus).
================================================================================= */
window.RoadRouter=(function(){
  var SERVERS=['https://router.project-osrm.org','https://routing.openstreetmap.de/routed-car'];
  var CK='drivertrack_roadcache_v2', MAXC=120, mem=null;
  function load(){ if(mem) return mem; try{ mem=JSON.parse(localStorage.getItem(CK)||'{}')||{}; }catch(e){ mem={}; } return mem; }
  function save(){
    var ks=Object.keys(mem||{}); if(ks.length>MAXC){ ks.sort(function(a,b){return mem[a].t-mem[b].t;}).slice(0,ks.length-MAXC).forEach(function(k){delete mem[k];}); }
    try{ localStorage.setItem(CK,JSON.stringify(mem)); }catch(e){ try{ mem={}; localStorage.removeItem(CK); }catch(_){} }
  }
  var key=function(pts){ return pts.map(function(p){return (+p[0]).toFixed(4)+','+(+p[1]).toFixed(4);}).join('>'); };
  function decode(str){
    var i=0,lat=0,lng=0,out=[],b,sh,r;
    while(i<str.length){
      sh=0;r=0; do{b=str.charCodeAt(i++)-63; r|=(b&31)<<sh; sh+=5;}while(b>=32); lat+=(r&1)?~(r>>1):(r>>1);
      sh=0;r=0; do{b=str.charCodeAt(i++)-63; r|=(b&31)<<sh; sh+=5;}while(b>=32); lng+=(r&1)?~(r>>1):(r>>1);
      out.push([lat/1e5,lng/1e5]);
    }
    return out;
  }
  var sleep=function(ms){ return new Promise(function(r){setTimeout(r,ms);}); };
  async function getJson(url,ms){
    var ctl=(typeof AbortController!=='undefined')?new AbortController():null, to=setTimeout(function(){ if(ctl) ctl.abort(); },ms||7000);
    try{ var res=await fetch(url,ctl?{signal:ctl.signal}:{}); return await res.json(); }
    catch(e){ return null; } finally{ clearTimeout(to); }
  }
  // kedua server ditanya BERSAMAAN, pakai jawaban pertama yang 'Ok' (timeout 7 dtk, 1x ulang)
  async function osrm(path,qs){
    for(var round=0;round<2;round++){
      var r=await new Promise(function(resolve){
        var left=SERVERS.length, done=false;
        SERVERS.forEach(function(sv){
          getJson(sv+path+qs,7000).then(function(j){
            if(done) return;
            if(j&&j.code==='Ok'){ done=true; resolve(j); }
            else if(--left===0){ done=true; resolve(null); }
          });
        });
      });
      if(r) return r;
      if(round===0) await sleep(500);
    }
    return null;
  }
  function nearest(routes){ return routes.reduce(function(b,r){ return (!b||r.distance<b.distance)?r:b; },null); }

  // pts: [[lat,lon],[lat,lon]] -> {coords:[[lat,lon]...], km, min, cached} | null
  async function route(pts){
    var c=load(), k=key(pts), hit=c[k];
    if(hit) return {coords:decode(hit.p),km:hit.k,min:hit.m,cached:true};
    var cs=pts.map(function(p){return p[1]+','+p[0];}).join(';');
    var j=await osrm('/route/v1/driving/'+cs,'?overview=full&geometries=polyline&steps=false&alternatives='+(pts.length===2?'3':'false'));
    if(!j||!j.routes||!j.routes.length) return null;
    var r=nearest(j.routes); if(!r||!(r.distance>=0)) return null;
    c[k]={p:r.geometry,k:r.distance/1000,m:r.duration/60,t:Date.now()}; save();
    return {coords:decode(r.geometry),km:r.distance/1000,min:r.duration/60,cached:false};
  }
  function cached(pts){ var h=load()[key(pts)]; return h?{coords:decode(h.p),km:h.k,min:h.m}:null; }

  // rute beberapa titik berurutan: tiap leg dicari jalur terdekatnya
  async function routeLegs(pts){
    var coords=[],km=0,min=0;
    for(var i=1;i<pts.length;i++){
      if(Math.abs(pts[i-1][0]-pts[i][0])<1e-6&&Math.abs(pts[i-1][1]-pts[i][1])<1e-6) continue;
      var r=await route([pts[i-1],pts[i]]); if(!r) return null;
      coords=coords.concat(coords.length?r.coords.slice(1):r.coords); km+=r.km; min+=r.min;
    }
    return coords.length?{coords:coords,km:km,min:min}:null;
  }
  // adaptor supaya kode order lama (format respons OSRM) tidak perlu diubah
  async function compat(pts){
    var r=await routeLegs(pts);
    return {ok:!!r, json:async function(){ return r?{routes:[{geometry:{coordinates:r.coords.map(function(c){return [c[1],c[0]];})},distance:r.km*1000,duration:r.min*60}]}:{routes:[]}; }};
  }

  // Map-matching: jejak GPS rapat ditempelkan ke jalan. Hasil: array bagian-polyline (tidak pernah disambung garis lurus)
  var CH=80;
  function matchKey(chunk){ return 'm|'+key([chunk[0],chunk[chunk.length-1]])+'|'+chunk.length; }
  function matchCached(pts){
    var c=load(), out=[];
    for(var s=0;s<pts.length-1;s+=CH-1){
      var ch=pts.slice(s,s+CH); if(ch.length<2) break;
      var h=c[matchKey(ch)]; if(!h) return null;
      h.p.split('|').forEach(function(p){ if(p) out.push(decode(p)); });
    }
    return out;
  }
  function rawLen(a){ var d=0; for(var i=1;i<a.length;i++){ d+=Math.hypot((a[i][0]-a[i-1][0])*111.2,(a[i][1]-a[i-1][1])*111.2*Math.cos(a[i][0]*Math.PI/180)); } return d; }
  async function match(pts){
    var c=load(), ok=true;
    for(var s=0;s<pts.length-1;s+=CH-1){
      var ch=pts.slice(s,s+CH); if(ch.length<2) break;
      var k=matchKey(ch); if(c[k]) continue;
      var cs=ch.map(function(p){return p[1]+','+p[0];}).join(';'), rad=ch.map(function(){return 30;}).join(';');
      var j=await osrm('/match/v1/driving/'+cs,'?overview=full&geometries=polyline&gaps=ignore&tidy=true&radiuses='+rad);
      if(!j||!j.matchings||!j.matchings.length){ ok=false; continue; }
      var parts=j.matchings.map(function(m){return m.geometry;}), len=0;
      j.matchings.forEach(function(m){ len+=m.distance/1000; });
      var rl=rawLen(ch);
      if(rl>0 && len>rl*2.2+0.3){ ok=false; continue; }           // hasil match tidak masuk akal -> pakai jejak GPS asli
      c[k]={p:parts.join('|'),t:Date.now()};
    }
    save(); return ok;
  }
  return {route:route,routeLegs:routeLegs,cached:cached,compat:compat,match:match,matchCached:matchCached,decode:decode};
})();

(function(){
  'use strict';
  var $ = function(i){ return document.getElementById(i); };
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var ymd = function(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var rp  = function(n){ return 'Rp'+Math.round(n||0).toLocaleString('id-ID'); };
  var hhmm = function(ts){ return new Date(ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); };
  var isSales = function(){ return !!(window.__isSales && window.__isSales()); };
  var isTouch = function(){ return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); };

  /* ================================================================
     (1) PETA LIMNAS
     Data dibaca dari localStorage 'drivertrack_track_YYYY-MM-DD'
     = { km, pts:[[timestamp, lat, lon], ...] } (ditulis oleh Limnas).
     ================================================================ */
  var TP='drivertrack_track_', PK='drivertrack_driver_prefs';
  var lmMap=null, lmLayer=null, lmDay=ymd(new Date()), lmExpanded=false, lmTimer=null, lmFitKey='';

  function lmData(k){ try{ var d=JSON.parse(localStorage.getItem(TP+k)); return (d&&d.pts)?d:{km:0,pts:[]}; }catch(e){ return {km:0,pts:[]}; } }
  function lmTrackOn(){ try{ return !!JSON.parse(localStorage.getItem(PK)||'{}').track; }catch(e){ return false; } }
  function lmVisible(){ var t=$('tab-profile'); return !!t && !t.classList.contains('hidden'); }

  function lmChips(){
    var el=$('lm-days'); if(!el) return;
    var now=new Date(), html='';
    for(var i=0;i<7;i++){
      var d=new Date(now); d.setDate(d.getDate()-i);
      var k=ymd(d), has=lmData(k).pts.length>0, act=(k===lmDay);
      var label=i===0?'Hari ini':(i===1?'Kemarin':d.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short'}));
      html+='<button type="button" data-lm-day="'+k+'" class="flex-shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-xl '+
            (act?'bg-indigo-600 text-white':'bg-slate-100 text-slate-500')+(has||act?'':' opacity-60')+'">'+label+(has&&!act?' •':'')+'</button>';
    }
    el.innerHTML=html;
  }

  function lmEnsureMap(){
    if(lmMap) return lmMap;
    if(typeof L==='undefined' || !$('lm-map')) return null;
    lmMap=L.map('lm-map',{zoomControl:false,attributionControl:true,dragging:!isTouch(),tap:false}).setView([-7.558,110.771],13);
    createBaseTileLayer().addTo(lmMap);
    L.control.zoom({position:'bottomright'}).addTo(lmMap);
    lmLayer=L.layerGroup().addTo(lmMap);
    return lmMap;
  }

  function lmLive(){
    var b=$('lm-live'); if(!b) return;
    var st=$('dp-status'), on=lmTrackOn() && lmDay===ymd(new Date()) && st && /^Limnas aktif/.test(st.innerText||'');
    b.style.display=on?'inline-block':'none';
  }

  /* roadKm: jarak via jalan OSRM (opsional). Bila valid (tidak > 3x GPS), dipakai untuk BBM. */
  function lmStats(d,pts,roadKm){
    var rate=(typeof getFuelRate==='function')?getFuelRate():600, km=d.km||0;
    var bbmKm=km;
    if(typeof roadKm==='number' && isFinite(roadKm) && roadKm>0){
      if(km<=0 || roadKm<=km*3) bbmKm=roadKm;
    }
    if($('lm-km'))   $('lm-km').innerText=km.toFixed(2)+' km';
    if($('lm-fuel')) $('lm-fuel').innerText=rp(bbmKm*rate)+(bbmKm!==km?' ≈via jalan':'');
    if($('lm-time')) $('lm-time').innerText=pts.length?(hhmm(pts[0][0])+' – '+hhmm(pts[pts.length-1][0])):'–';
  }

  /* ---- Rapikan jalur: ruas dengan titik jarang digambar lewat jalan (OSRM) ---- */
  var SNAP_KEY='drivertrack_lm_snap', CACHE_KEY='drivertrack_roadcache_v1', lmSnapTok=0, lmSnapFailed={}, roadCache=null;
  var lmSnapOn=function(){ return true; };   // selalu mengikuti jalan: tidak ada garis lurus
  function hav(a,b){
    var R=6371,t=Math.PI/180,dLa=(b[1]-a[1])*t,dLo=(b[2]-a[2])*t;
    var x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[1]*t)*Math.cos(b[1]*t)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return 2*R*Math.asin(Math.sqrt(x));
  }
  var ll2=function(p){ return [p[1],p[2]]; };
  function decodePoly(str){
    var idx=0,lat=0,lng=0,out=[],b,shift,res;
    while(idx<str.length){
      shift=0;res=0; do{ b=str.charCodeAt(idx++)-63; res|=(b&31)<<shift; shift+=5; }while(b>=32); lat+=(res&1)?~(res>>1):(res>>1);
      shift=0;res=0; do{ b=str.charCodeAt(idx++)-63; res|=(b&31)<<shift; shift+=5; }while(b>=32); lng+=(res&1)?~(res>>1):(res>>1);
      out.push([lat/1e5,lng/1e5]);
    }
    return out;
  }
  var edgeKey=function(a,b){ return a[1].toFixed(4)+','+a[2].toFixed(4)+'>'+b[1].toFixed(4)+','+b[2].toFixed(4); };
  function loadCache(){ if(roadCache) return roadCache; try{ roadCache=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}; }catch(e){ roadCache={}; } return roadCache; }
  function snapCacheGet(a,b){ var e=loadCache()[edgeKey(a,b)]; return e?{latlngs:decodePoly(e.p),km:e.k}:null; }
  function snapCachePut(a,b,r){
    var c=loadCache(); c[edgeKey(a,b)]={p:r.poly,k:r.km,t:Date.now()};
    var ks=Object.keys(c); if(ks.length>80){ ks.sort(function(x,y){ return c[x].t-c[y].t; }).slice(0,ks.length-80).forEach(function(k){ delete c[k]; }); }
    try{ localStorage.setItem(CACHE_KEY,JSON.stringify(c)); }catch(e){}
  }
  /* Antrean persisten: gambar ulang karena titik GPS baru TIDAK lagi membatalkan / mengulang pekerjaan.
     Rute jalan (penting) jalan paralel 4x dan didahulukan; map-matching (kosmetik) 1x dan belakangan. */
  var lmRetry=0, lmRetryTimer=null, lmBusy={}, lmFailT={}, lmQr=[], lmQm=[], lmActR=0, lmActM=0, lmRedrawT=null;
  function setSnapStatus(t){ var el=$('lm-snap-status'); if(el) el.innerText=t||''; }
  var lmJobId=function(j){ return j.k==='route'?('r'+edgeKey(j.a,j.b)):('m'+j.ll[0][0].toFixed(4)+','+j.ll[0][1].toFixed(4)+'#'+j.ll.length); };
  function lmPump(){
    while(lmActR<4 && lmQr.length) lmRun(lmQr.shift());
    while(lmActM<1 && lmActR===0 && lmQm.length) lmRun(lmQm.shift());
    var left=lmQr.length+lmActR;
    if(left>0) setSnapStatus('Menyesuaikan rute ke jalan ('+left+' ruas tersisa)...');
  }
  async function lmRun(j){
    j.k==='route'?lmActR++:lmActM++;
    var ok=false;
    try{ ok=(j.k==='route')?!!(await RoadRouter.route([ll2(j.a),ll2(j.b)])):await RoadRouter.match(j.ll); }catch(e){}
    j.k==='route'?lmActR--:lmActM--;
    delete lmBusy[j.id];
    if(!ok){ lmFailT[j.id]=Date.now(); lmRetry=1; clearTimeout(lmRetryTimer); lmRetryTimer=setTimeout(function(){ lmDraw(false); },20000); }
    clearTimeout(lmRedrawT); lmRedrawT=setTimeout(function(){ lmDraw(false); lmPump(); },250);
    lmPump();
  }
  function lmSnapRun(jobs){
    var routes=0, matches=0;
    jobs.forEach(function(j){
      j.id=lmJobId(j);
      if(lmBusy[j.id]) return;
      if(lmFailT[j.id] && Date.now()-lmFailT[j.id]<20000) return;      // baru gagal: tunggu dulu, jangan spam server
      if(j.k==='match' && (lmQm.length>=10)) return;
      lmBusy[j.id]=1; (j.k==='route'?lmQr:lmQm).push(j);
    });
    lmPump();
  }
  window.addEventListener('online',function(){ lmFailT={}; lmRetry=0; if($('lm-map')) lmDraw(false); });

  function lmDraw(refit){
    if(!$('lm-map')) return;
    var tok=++lmSnapTok; setSnapStatus(''); if($('lm-km-road')) $('lm-km-road').innerText='';
    lmChips(); lmLive();
    var d=lmData(lmDay), pts=d.pts||[], empty=$('lm-empty'), today=(lmDay===ymd(new Date()));
    lmStats(d,pts); // roadKm akan diupdate setelah OSRM selesai
    function showEmpty(msg){ empty.innerHTML='<span class="inline-block bg-white/90 rounded-xl px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm">'+esc(msg)+'</span>'; empty.style.display='flex'; }
    if(typeof L==='undefined'){ showEmpty('Peta belum bisa dimuat. Periksa koneksi internet.'); return; }
    var map=lmEnsureMap(); if(!map) return;
    map.invalidateSize();
    lmLayer.clearLayers();
    if(!pts.length){
      showEmpty(lmTrackOn()
        ? (today?'Belum ada titik tercatat hari ini. Rute akan muncul di sini begitu kamu berpindah tempat.':'Tidak ada rute tercatat di tanggal ini.')
        : 'Limnas nonaktif. Aktifkan Limnas di atas untuk mulai merekam rute.');
      return;
    }
    empty.style.display='none';

    var GAP=15*60*1000, SPARSE_KM=0.4, i, solid=[[pts[0]]], conns=[], denseKm=0;
    for(i=1;i<pts.length;i++){
      var pa=pts[i-1], pb=pts[i], dt=pb[0]-pa[0], dk=hav(pa,pb);
      if(dk<0.05){ solid[solid.length-1].push(pb); continue; }                                 // diam / jitter: tidak perlu rute
      if(dt>GAP||dk>=SPARSE_KM){ conns.push({a:pa,b:pb,t:dt>GAP?'gap':'sparse',dk:dk}); solid.push([pb]); }   // aplikasi ditinggal: isi lewat JALAN
      else { solid[solid.length-1].push(pb); denseKm+=dk; }
    }
    var col=(window.__isNeon&&window.__isNeon())?'#22C55E':(isSales()?'#1E211D':'#6366F1'), all=[], jobs=[], roadKm=denseKm, nOk=0, nWait=0;
    // 1) jejak GPS rapat -> ditempel ke jalan (map matching). Sebelum selesai, tampil jejak GPS asli (bukan perkiraan).
    solid.forEach(function(sg){
      var ll=sg.map(ll2); all=all.concat(ll);
      if(ll.length<2){ L.circleMarker(ll[0],{radius:4,color:col,weight:2,fillColor:'#fff',fillOpacity:1}).addTo(lmLayer); return; }
      var parts=RoadRouter.matchCached(ll);
      if(parts&&parts.length) parts.forEach(function(p){ L.polyline(p,{color:col,weight:5,opacity:.88,lineCap:'round',lineJoin:'round'}).addTo(lmLayer); });
      else { L.polyline(ll,{color:col,weight:5,opacity:.88,lineCap:'round',lineJoin:'round'}).addTo(lmLayer); jobs.push({k:'match',ll:ll}); }
    });
    // 2) ruas jarang / jeda: rute jalan TERDEKAT (alternatif terpendek). Belum ada -> tidak digambar (tidak ada garis lurus).
    conns.forEach(function(c){
      var hit=RoadRouter.cached([ll2(c.a),ll2(c.b)]);
      if(hit){
        L.polyline(hit.coords,{color:col,weight:4,opacity:.7,dashArray:'10,8',lineCap:'round',lineJoin:'round'}).addTo(lmLayer);
        all=all.concat(hit.coords); roadKm+=hit.km; nOk++;
      } else { nWait++; jobs.push({k:'route',a:c.a,b:c.b}); }
    });
    if(conns.length){
      if(nWait===0 && $('lm-km-road')){
        $('lm-km-road').innerText='± '+roadKm.toFixed(1)+' km via jalan';
        // Update BBM menggunakan roadKm (lebih akurat dari GPS linear)
        lmStats(d,pts,roadKm);
      }
      if(jobs.length) setSnapStatus(lmRetry>0?'Server rute sibuk/offline, mencoba lagi otomatis...':'Menyesuaikan rute ke jalan (0/'+jobs.length+')...');
      else setSnapStatus(nOk+' ruas diisi mengikuti jalan terdekat karena aplikasi sempat ditinggal.');
    }
    if(jobs.length) lmSnapRun(jobs);
    var first=pts[0], last=pts[pts.length-1];
    L.circleMarker([first[1],first[2]],{radius:8,color:'#fff',weight:3,fillColor:'#10b981',fillOpacity:1}).bindTooltip('Mulai '+hhmm(first[0])).addTo(lmLayer);
    L.circleMarker([last[1],last[2]],{radius:8,color:'#fff',weight:3,fillColor:'#f43f5e',fillOpacity:1}).bindTooltip((today?'Posisi terakhir ':'Selesai ')+hhmm(last[0])).addTo(lmLayer);

    if(refit || lmFitKey!==lmDay){
      lmFitKey=lmDay;
      var b=L.latLngBounds(all);
      if(all.length<2 || b.getNorthEast().equals(b.getSouthWest())) map.setView(all[all.length-1],16);
      else map.fitBounds(b,{padding:[28,28],maxZoom:17});
    }
  }

  function lmToggleExpand(){
    lmExpanded=!lmExpanded;
    var el=$('lm-map'), ic=$('lm-expand-ic'), hint=$('lm-hint');
    el.style.height=lmExpanded?'65vh':'15rem';
    if(ic) ic.className='fa-solid '+(lmExpanded?'fa-compress':'fa-expand');
    if(lmMap && isTouch()){ if(lmExpanded) lmMap.dragging.enable(); else lmMap.dragging.disable(); }
    if(hint) hint.style.display=(isTouch()&&!lmExpanded)?'block':'none';
    setTimeout(function(){ lmDraw(true); },60);
  }

  document.addEventListener('click',function(e){
    var chip=e.target.closest&&e.target.closest('[data-lm-day]');
    if(chip){ lmDay=chip.getAttribute('data-lm-day'); lmDraw(true); return; }
    if(e.target.closest&&e.target.closest('#lm-expand')) lmToggleExpand();
  });

  (function lmBind(){
    var st=$('dp-status');
    if(st && window.MutationObserver){
      new MutationObserver(function(){
        if(!lmVisible()) return;
        clearTimeout(lmTimer);
        lmTimer=setTimeout(function(){ lmDraw(false); },700);   // update live, tanpa mengganggu posisi geser/zoom
      }).observe(st,{childList:true,characterData:true,subtree:true});
    }
    var tr=$('dp-track');
    if(tr) tr.addEventListener('change',function(){ setTimeout(function(){ lmDraw(false); },200); });
    var hint=$('lm-hint'); if(hint) hint.style.display=isTouch()?'block':'none';
    var sn=$('lm-snap-toggle'); if(sn){ sn.checked=lmSnapOn(); sn.addEventListener('change',function(){ try{ localStorage.setItem(SNAP_KEY,sn.checked?'1':'0'); }catch(e){} lmDraw(false); }); }
  })();

  /* ================================================================
     (2) ACCORDION PESANAN
     Hanya SATU pesanan yang terbuka; pesanan lain ringkas jadi satu baris.
     Tidak merender ulang apa pun -> isian tidak hilang.
     ================================================================ */
  var CSS=document.createElement('style');
  CSS.textContent='#lm-days{scrollbar-width:none}#lm-days::-webkit-scrollbar{display:none}.ac-collapsed{display:none!important}.ac-chev{transition:transform .2s}html body div:has(>#filter-orders-7d){overflow-x:auto;flex-wrap:nowrap}';
  document.head.appendChild(CSS);

  var CAT_ICON={Food:'🍲',SPX:'📦',Instan:'⚡'};
  function val(id){ var e=$(id); return e?String(e.value||'').trim():''; }

  function sumHTML(ids,title){
    var cat=val(ids.cat), plat=val(ids.plat), r=val(ids.resto), t=val(ids.recip);
    var l1=(title?('<span class="text-indigo-600">'+title+'</span> · '):'')+(CAT_ICON[cat]||'📦')+' '+esc(cat||'-')+(plat?' · '+esc(plat):'');
    var l2=(r&&t)?esc(r)+' → '+esc(t):'<span class="text-amber-600 font-bold">⚠ Resto/pengirim &amp; penerima belum diisi</span>';
    return '<div class="min-w-0"><p class="text-[11px] font-extrabold text-slate-700 truncate">'+l1+'</p><p class="text-[10px] text-slate-500 truncate">'+l2+'</p></div>'+
           '<span class="flex-shrink-0 text-[10px] font-bold text-indigo-600 px-2.5 py-1 rounded-lg bg-indigo-50">Ubah</span>';
  }
  var SUM_CLASS='items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 cursor-pointer';

  function blockIds(block){
    var m;
    if((m=/^extra-order-block-(\d+)$/.exec(block.id))) return {cat:'form-category-'+m[1],plat:'form-platform-'+m[1],resto:'form-restoname-'+m[1],recip:'form-recipname-'+m[1]};
    if((m=/^edit-combined-block-(.+)$/.exec(block.id))) return {cat:'ec-category-'+m[1],plat:'ec-platform-'+m[1],resto:'ec-restoname-'+m[1],recip:'ec-recipname-'+m[1]};
    return null;
  }

  function decorate(block){
    var head=block.firstElementChild; if(!head || head.hasAttribute('data-ac-head')) return;
    head.setAttribute('data-ac-head','');
    head.classList.add('cursor-pointer');
    var sum=document.createElement('div');
    sum.setAttribute('data-ac-sum',''); sum.className=SUM_CLASS; sum.style.display='none';
    head.insertAdjacentElement('afterend',sum);
  }
  function blockBody(block){
    return [].slice.call(block.children).filter(function(n,i){ return i>0 && !n.hasAttribute('data-ac-sum'); });
  }
  function isCollapsed(block){ return block.getAttribute('data-ac-collapsed')==='1'; }
  function ensureChev(block){
    var head=block.firstElementChild;
    if(head && head.firstElementChild && !head.querySelector('.ac-chev'))
      head.firstElementChild.insertAdjacentHTML('afterbegin','<i class="fa-solid fa-chevron-down ac-chev text-[10px] mr-1.5"></i>');
  }
  function setBlock(block,c){
    decorate(block); ensureChev(block);
    var sum=block.querySelector(':scope > [data-ac-sum]');
    blockBody(block).forEach(function(n){ n.classList.toggle('ac-collapsed',c); });
    if(c){ var ids=blockIds(block); if(ids) sum.innerHTML=sumHTML(ids,''); sum.style.display='flex'; }
    else sum.style.display='none';
    block.setAttribute('data-ac-collapsed',c?'1':'');
    var ch=block.querySelector('.ac-chev'); if(ch) ch.style.transform=c?'rotate(-90deg)':'';
  }

  /* ---- Form tambah: Pesanan #1 = dropzone + isi form utama ---- */
  var mainCollapsed=false;
  function mainNodes(){
    var form=$('order-form'), ex=$('extra-orders-container'); if(!form||!ex) return [];
    var kids=[].slice.call(form.children), stop=kids.indexOf(ex);
    var inForm=kids.slice(0,stop<0?kids.length:stop).filter(function(n){ return n.id!=='ac-main-sum'; });
    return [$('dropzone'),$('camera-wrap-main'),$('image-preview-container'),$('ocr-loading')].filter(Boolean).concat(inForm);
  }
  function setMain(c){
    var form=$('order-form'); if(!form) return;
    var sum=$('ac-main-sum');
    if(!sum){
      sum=document.createElement('div'); sum.id='ac-main-sum'; sum.setAttribute('data-ac-sum',''); sum.className=SUM_CLASS; sum.style.display='none';
      form.insertBefore(sum,form.firstChild);
    }
    mainNodes().forEach(function(n){ n.classList.toggle('ac-collapsed',c); });
    if(c){ sum.innerHTML=sumHTML({cat:'form-category',plat:'form-platform',resto:'form-restoname',recip:'form-recipname'},'Pesanan #1'); sum.style.display='flex'; }
    else sum.style.display='none';
    mainCollapsed=c;
  }
  function addBlocks(){ var c=$('extra-orders-container'); return c?[].slice.call(c.children):[]; }
  function focusAdd(target){            // target: 'main' | elemen block
    setMain(target!=='main');
    addBlocks().forEach(function(b){ setBlock(b,b!==target); });
  }
  function focusEdit(target){
    var c=$('edit-combined-suborders-container'); if(!c) return;
    [].slice.call(c.children).forEach(function(b){ setBlock(b,b!==target); });
  }

  /* klik header / ringkasan */
  document.addEventListener('click',function(e){
    var t=e.target; if(!t.closest) return;
    var sum=t.closest('[data-ac-sum]'), head=t.closest('[data-ac-head]');
    if(!sum && !head) return;
    if(!sum && t.closest('button')) return;            // tombol Hapus tetap berfungsi
    if(sum && sum.id==='ac-main-sum'){ focusAdd('main'); return; }
    var block=(sum||head).parentElement; if(!block) return;
    var inEdit=!!block.closest('#edit-combined-suborders-container');
    if(isCollapsed(block)){ (inEdit?focusEdit:focusAdd)(block); }
    else if(head){ setBlock(block,true); }
  }, true);   // capture: kartu modal memakai stopPropagation(), jadi klik tidak akan sampai ke fase bubble

  /* wrapper: tambah/hapus pesanan di form tambah */
  var _addExtra=window.addExtraOrder;
  if(typeof _addExtra==='function') window.addExtraOrder=function(){
    var r=_addExtra.apply(this,arguments);
    var list=addBlocks(), nb=list[list.length-1];
    if(nb){ decorate(nb); focusAdd(nb); setTimeout(function(){ nb.scrollIntoView({behavior:'smooth',block:'start'}); },50); }
    return r;
  };
  var _rmExtra=window.removeExtraOrder;
  if(typeof _rmExtra==='function') window.removeExtraOrder=function(){
    var r=_rmExtra.apply(this,arguments);
    addBlocks().forEach(function(b){ setBlock(b,isCollapsed(b)); });   // renumber menimpa label -> pasang ulang ikon
    var list=addBlocks(), anyOpen=!mainCollapsed || list.some(function(b){ return !isCollapsed(b); });
    if(!anyOpen) focusAdd(list.length?list[list.length-1]:'main');
    if(!list.length) setMain(false);
    return r;
  };
  var _resetExtra=window.resetExtraOrders;
  if(typeof _resetExtra==='function') window.resetExtraOrders=function(){
    var r=_resetExtra.apply(this,arguments); setMain(false); return r;
  };

  /* validasi bawaan browser: kalau ada field wajib kosong di pesanan yang sedang diringkas, buka pesanan itu */
  document.addEventListener('invalid',function(e){
    var t=e.target; if(!t||!t.closest) return;
    var blk=t.closest('#extra-orders-container > div');
    if(blk){ if(isCollapsed(blk)) setBlock(blk,false); return; }
    if(t.closest('#order-form') && mainCollapsed) setMain(false);
  },true);

  /* ---- Modal Edit Gabungan ---- */
  var ecOpenKey=null;
  function ecModalOpen(){ var m=$('edit-combined-modal'); return !!m && !m.classList.contains('hidden'); }

  /* Salin isian DOM -> state sebelum render ulang (supaya ketikan yang belum disimpan tidak hilang) */
  function ecSync(){
    if(!ecModalOpen() || typeof editCombinedState==='undefined' || !editCombinedState) return;
    editCombinedState.subOrders.forEach(function(sub){
      var k=sub._key, g=function(n){ return $('ec-'+n+'-'+k); };
      if(!g('category') || !g('restoname')) return;       // blok belum ada di DOM
      sub.category=g('category').value;
      sub.platform=g('platform').value;
      var mf=g('fuelcost-manual').value, mfn=parseFloat(mf);
      sub.manualFuelCost=(mf!=='' && !isNaN(mfn))?mfn:null;
      sub.restoName=g('restoname').value; sub.restoAddr=g('restoaddr').value;
      sub.recipName=g('recipname').value; sub.recipAddr=g('recipaddr').value;
      sub.notes=g('notes').value||'-';
      var cash=parseFloat(g('cashamount').value)||0;
      sub.cashAmount=cash; sub.payment=cash>0?'Tunai':'Non-Tunai';
      [['codeorder','codeOrder'],['totalmenu','totalMenu'],['orderno','orderNo'],['weight','weight'],['dimensions','dimensions'],['itemcategory','itemCategory']]
        .forEach(function(p){ var el=g(p[0]); if(el) sub[p[1]]=el.value; });
    });
  }

  var _renderEC=window.renderEditCombinedSubOrders;
  if(typeof _renderEC==='function') window.renderEditCombinedSubOrders=function(){
    var r=_renderEC.apply(this,arguments);
    var c=$('edit-combined-suborders-container'); if(!c) return r;
    var blocks=[].slice.call(c.children), open=null;
    blocks.forEach(function(b){ if(b.id==='edit-combined-block-'+ecOpenKey) open=b; });
    if(!open) open=blocks[0];
    blocks.forEach(function(b){ decorate(b); setBlock(b,b!==open); });
    return r;
  };
  var _openEC=window.openEditCombinedModal;
  if(typeof _openEC==='function') window.openEditCombinedModal=function(){
    ecOpenKey=null; return _openEC.apply(this,arguments);
  };
  var _addEC=window.addEditCombinedSubOrder;
  if(typeof _addEC==='function') window.addEditCombinedSubOrder=function(){
    ecSync();
    ecOpenKey='k'+editCombinedKeyCounter;                  // key pesanan baru yang akan dibuat
    var r=_addEC.apply(this,arguments);
    var nb=$('edit-combined-block-'+ecOpenKey);
    if(nb) setTimeout(function(){ nb.scrollIntoView({behavior:'smooth',block:'start'}); },50);
    return r;
  };
  var _rmEC=window.removeEditCombinedSubOrder;
  if(typeof _rmEC==='function') window.removeEditCombinedSubOrder=function(key){
    ecSync();
    if(ecOpenKey===key) ecOpenKey=null;
    return _rmEC.apply(this,arguments);
  };
  var _saveEC=window.saveEditCombinedForm;
  if(typeof _saveEC==='function') window.saveEditCombinedForm=function(){
    if(typeof editCombinedState!=='undefined' && editCombinedState){
      for(var i=0;i<editCombinedState.subOrders.length;i++){
        var k=editCombinedState.subOrders[i]._key;
        if(!val('ec-restoname-'+k) || !val('ec-recipname-'+k)){
          var blk=$('edit-combined-block-'+k);
          if(blk){ setBlock(blk,false); setTimeout(function(){ blk.scrollIntoView({behavior:'smooth',block:'start'}); },50); }
          if(typeof showToast==='function') showToast('Lengkapi Nama Resto/Pengirim dan Penerima di Pesanan #'+(i+1)+'.','rose');
          return;
        }
      }
    }
    return _saveEC.apply(this,arguments);
  };

  /* ================================================================
     (3) TAB ORDERS: HARI INI + RIWAYAT 7/14/30 HARI
     State terpisah dari activeFilterDays (dipakai Dashboard), jadi
     statistik Home/Insights tidak berubah.
     Riwayat 7/14/30 = KEMARIN ke belakang (tidak termasuk hari ini).
     ================================================================ */
  var ordersRange='today', lastDayKey=ymd(new Date());
  var RANGE_IDS={today:'filter-orders-today',7:'filter-orders-7d',14:'filter-orders-14d',30:'filter-orders-30d',all:'filter-orders-all'};
  var ACTIVE='flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-md transition';
  var IDLE='flex-1 py-2 text-xs font-medium rounded-xl text-slate-500 hover:text-slate-900 transition';

  function startOfToday(){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
  function inRange(ts){
    var s=startOfToday();
    if(ordersRange==='today') return ts>=s;
    if(ordersRange==='all') return true;
    return ts<s && ts>=s-ordersRange*86400000;
  }
  function rangeLabel(){
    return ordersRange==='today'?'Hari Ini':(ordersRange==='all'?'Semua Periode':'Riwayat '+ordersRange+' Hari (sebelum hari ini)');
  }
  function baseList(){
    var save=activeFilterDays; activeFilterDays='all';
    try{ return getFilteredOrders(); } finally{ activeFilterDays=save; }
  }
  function dayHeader(ts,items){
    var d=new Date(ts), ds=new Date(ts); ds.setHours(0,0,0,0);
    var diff=Math.round((startOfToday()-ds.getTime())/86400000);
    var short=d.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
    var label=diff===0?'Hari ini · '+short:(diff===1?'Kemarin · '+short:d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'short'}));
    var units=0, inc=0;
    items.forEach(function(o){ units+=(typeof getOrderUnitCount==='function'?getOrderUnitCount(o):1); inc+=(o.orderIncome||0); });
    return '<div class="flex items-center justify-between px-1 pt-2"><p class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">'+esc(label)+'</p>'+
           '<p class="text-[10px] font-bold text-slate-400">'+units+' order'+(inc>0?' · +'+rp(inc):'')+'</p></div>';
  }

  function updateRangeUI(){
    Object.keys(RANGE_IDS).forEach(function(k){
      var b=$(RANGE_IDS[k]); if(b) b.className=(String(k)===String(ordersRange))?ACTIVE:IDLE;
    });
    var hint=$('orders-range-hint');
    if(hint) hint.innerText=ordersRange==='today'
      ? 'Hanya orderan hari ini. Orderan kemarin dan sebelumnya ada di Riwayat 7 / 14 / 30 Hari.'
      : (ordersRange==='all'?'Menampilkan seluruh orderan, dikelompokkan per hari.':'Riwayat: kemarin sampai '+ordersRange+' hari ke belakang, dikelompokkan per hari.');
  }
  window.setOrdersRange=function(n){
    ordersRange=n; updateRangeUI(); window.renderOrdersList();
  };

  var _renderOrders=window.renderOrdersList;
  window.renderOrdersList=function(){
    var list=baseList().filter(function(o){ return inRange(o.timestamp); }).sort(function(a,b){ return b.timestamp-a.timestamp; });
    _renderOrders.call(this,list);
    var cont=$('orders-container'), titleEl=$('empty-orders-title'), descEl=$('empty-orders-desc'), widen=$('empty-orders-widen-btn');
    if(!list.length){
      if(ordersList.length>0){
        if(ordersRange==='today'){
          if(titleEl) titleEl.innerText='Belum Ada Orderan Hari Ini';
          if(descEl)  descEl.innerText='Orderan yang kamu catat hari ini akan muncul di sini. Orderan sebelumnya bisa dilihat lewat Riwayat 7 / 14 / 30 Hari.';
          if(widen){ widen.classList.remove('hidden'); widen.setAttribute('onclick','setOrdersRange(7)'); widen.innerHTML='<i class="fa-solid fa-clock-rotate-left mr-1"></i> Lihat Riwayat 7 Hari'; }
        } else {
          if(titleEl) titleEl.innerText='Tidak Ada Pesanan di Filter Ini';
          if(descEl)  descEl.innerText='Tidak ada pesanan pada rentang "'+rangeLabel()+'" (atau pada kategori/pembayaran/platform/pencarian yang dipilih).';
          if(widen){ widen.setAttribute('onclick',"setOrdersRange('all')"); widen.innerHTML='<i class="fa-solid fa-calendar-days mr-1"></i> Tampilkan Semua Periode'; widen.classList.toggle('hidden',ordersRange==='all'); }
        }
      }
      return;
    }
    if(ordersRange!=='today' && cont){            // riwayat: kelompokkan per hari
      var html='', curKey='', bucket=[];
      var flush=function(){ if(bucket.length){ html+=dayHeader(bucket[0].timestamp,bucket)+bucket.map(function(o){ return createOrderCardHTML(o); }).join(''); bucket=[]; } };
      list.forEach(function(o){ var k=ymd(new Date(o.timestamp)); if(k!==curKey){ flush(); curKey=k; } bucket.push(o); });
      flush();
      cont.innerHTML=html;
    }
  };

  /* ganti hari (lewat tengah malam) saat app dibuka lagi / berjalan lama */
  function dayRolloverCheck(){
    var k=ymd(new Date()); if(k===lastDayKey) return;
    lastDayKey=k; lmDay=k; window.renderOrdersList(); if(lmVisible()) lmDraw(true);
  }
  setInterval(dayRolloverCheck,60000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) dayRolloverCheck(); });

  /* ---- hook switchTab ---- */
  var _switch=window.switchTab;
  window.switchTab=function(tab){
    var r=_switch.apply(this,arguments);
    if(tab==='profile'){
      lmDay=ymd(new Date());
      setTimeout(function(){ lmEnsureMap(); lmDraw(true); },150);
    }
    if(tab==='orders'){ dayRolloverCheck(); }
    return r;
  };

  updateRangeUI();
  try{ window.renderOrdersList(); }catch(e){}
})();
