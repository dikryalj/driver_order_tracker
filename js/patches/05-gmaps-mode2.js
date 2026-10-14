/* =====================================================================
   PATCH v3 — OPSI 2: POSISI OTOMATIS VIA GOOGLE MAPS (+ Check Point tetap ada)
   - Mode 1 (tanpa key): perilaku lama, hanya Check Point GPS.
   - Mode 2 (key valid): posisi resto & penerima diisi otomatis dari Google
     sebagai "perkiraan" (restoCheckin/recipCheckin dengan provisional:true).
     Checkin GPS asli SELALU menimpa dan tidak pernah ditimpa balik oleh Google.
   - API key hanya di localStorage; tidak masuk kode, tidak masuk backup.
   ===================================================================== */
(function(){
  'use strict';
  var $ = function(i){ return document.getElementById(i); };
  var KEY_RE = /^AIza[0-9A-Za-z_\-]{35}$/;
  var AUTO_DAYS = 2;                 // pesanan hari ini + 2 hari sebelumnya diisi otomatis (hemat kuota); detail pesanan lama diisi saat dibuka
  var state = { status: 'none' };    // none | saved | checking | ok | denied | error
  var tried = {}, running = false, timer = null, libsP = null;

  var key  = function(){ return (typeof getGoogleMapsKey==='function') ? getGoogleMapsKey() : ''; };
  var mask = function(k){ return k ? k.slice(0,4)+'••••••••'+k.slice(-4) : ''; };
  var toast = function(m,c){ if(typeof showToast==='function') showToast(m,c||'emerald'); };
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r,ms); }); };
  var tmo = function(p,ms){ return Promise.race([p,new Promise(function(r){ setTimeout(function(){ r(null); },ms); })]); };
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

  /* ---------- tampilan kartu Profil ---------- */
  function ui(){
    var k=key(), st=state.status;
    var tx=$('gm-status-text'), dot=$('gm-dot'); if(!tx) return;
    var T={
      none:    ['bg-slate-300','Mode 1 aktif: hanya Check Point GPS. Belum ada API key.'],
      saved:   ['bg-amber-400','Key tersimpan ('+mask(k)+'). Ketuk Uji Koneksi untuk memastikan terhubung.'],
      checking:['bg-amber-400','Menguji koneksi Google Maps...'],
      ok:      ['bg-emerald-500','Mode 2 aktif: terhubung ('+mask(k)+'). Posisi terisi otomatis, Check Point tetap bisa membenarkan.'],
      denied:  ['bg-rose-500','Key ditolak Google. Periksa key, Geocoding API aktif, billing aktif, dan batas referrer. Sementara memakai Check Point.'],
      error:   ['bg-rose-500','Gagal memuat Google Maps (periksa internet). Sementara memakai Check Point.']
    }[k?st:'none'];
    dot.className='w-2 h-2 rounded-full flex-shrink-0 '+T[0]; tx.innerText=T[1];
    var g2 = !!k && st!=='denied';
    var on='rounded-2xl border p-2.5 border-indigo-400 bg-indigo-50', off='rounded-2xl border p-2.5 border-slate-200 bg-white opacity-70';
    $('gm-mode-cp').className = g2 ? off : on;
    $('gm-mode-g').className  = g2 ? on : off;
    memCount();
    $('gm-test-btn').classList.toggle('hidden',!k);
    $('gm-clear-btn').classList.toggle('hidden',!k);
  }
  window.toggleGmapsKeyVisibility=function(){
    var i=$('gm-key-input'), e=$('gm-eye'); if(!i) return;
    i.type = i.type==='password' ? 'text' : 'password';
    if(e) e.className = 'fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash');
  };

  /* ---------- Google: muat library & geocoding ---------- */
  function libs(){
    if(libsP) return libsP;
    libsP=(async function(){
      if(!(window.google && google.maps)) return false;
      try{
        if(google.maps.importLibrary){ await google.maps.importLibrary('places'); await google.maps.importLibrary('geocoding'); }
      }catch(e){}
      return true;
    })();
    return libsP;
  }
  function gcode(address){
    return new Promise(function(res){
      var done=false, fin=function(v){ if(!done){ done=true; res(v); } };
      setTimeout(function(){ fin({status:'TIMEOUT'}); },9000);
      try{
        var B=SOLO_RAYA_BOUNDS;
        var bounds=new google.maps.LatLngBounds({lat:B.minLat,lng:B.minLon},{lat:B.maxLat,lng:B.maxLon});
        var p=new google.maps.Geocoder().geocode({address:address,region:'id',bounds:bounds},function(results,status){
          if(status==='OK' && results && results[0]){ var l=results[0].geometry.location; fin({status:'OK',lat:l.lat(),lon:l.lng()}); }
          else fin({status:status||'ERROR'});
        });
        if(p && p.catch) p.catch(function(e){ fin({status:(e&&(e.code||e.status))||'ERROR'}); });
      }catch(e){ fin({status:'ERROR'}); }
    });
  }
  var inSolo=function(p){ return !!p && isWithinSoloRaya(p.lat,p.lon); };

  // Urutan: Places (baru) -> Places (lama) -> Geocoder. Hasil di luar Solo Raya ditolak.
  async function resolve(query){
    if(!query || query.length<3) return null;
    if(!(await loadGoogleMapsApi())) { state.status='error'; ui(); return null; }
    await libs();
    if(googleMapsAuthFailed){ state.status='denied'; ui(); return null; }
    var B=SOLO_RAYA_BOUNDS, p;
    try{
      var P=google.maps.places && google.maps.places.Place;
      if(P && P.searchByText){
        var r=await tmo(P.searchByText({textQuery:query,fields:['location'],region:'id',maxResultCount:1,
          locationBias:{north:B.maxLat,south:B.minLat,east:B.maxLon,west:B.minLon}}),9000);
        var pl=r && r.places && r.places[0];
        if(pl && pl.location){ p={lat:pl.location.lat(),lon:pl.location.lng(),via:'places'}; if(inSolo(p)) return p; }
      }
    }catch(e){}
    try{
      var q2=await tmo(findPlaceWithGoogle(query),9000);
      if(inSolo(q2)) return {lat:q2.lat,lon:q2.lon,via:'places'};
    }catch(e){}
    var g=await gcode(query);
    if(g.status==='REQUEST_DENIED' || googleMapsAuthFailed){ state.status='denied'; ui(); return null; }
    if(g.status==='OK' && inSolo(g)) return {lat:g.lat,lon:g.lon,via:'geocode'};
    return null;
  }

  /* ---------- uji koneksi ---------- */
  async function test(){
    if(!key()){ state.status='none'; ui(); return false; }
    state.status='checking'; ui();
    if(!(await loadGoogleMapsApi())){ state.status='error'; ui(); return false; }
    await libs();
    if(googleMapsAuthFailed){ state.status='denied'; ui(); return false; }
    var r=await gcode('Keraton Surakarta Hadiningrat');
    if(googleMapsAuthFailed || r.status==='REQUEST_DENIED'){ state.status='denied'; ui(); return false; }
    if(r.status==='OK'){ state.status='ok'; ui(); schedule(); return true; }
    state.status='error'; ui(); return false;
  }
  document.addEventListener('gmaps-auth-failure',function(){ state.status='denied'; ui(); });
  window.testGmapsKey=function(){ tried={}; test().then(function(ok){ toast(ok?'Terhubung ke Google Maps.':'Koneksi gagal. Lihat status di kartu.',ok?'emerald':'rose'); }); };

  /* ---------- simpan / hapus key ---------- */
  function purgeProvisional(){
    var n=0;
    (ordersList||[]).forEach(function(o){ hostsOf(o).forEach(function(h){ ['restoCheckin','recipCheckin'].forEach(function(f){ if(h[f]&&h[f].provisional&&h[f].source!=='memory'){ h[f]=null; n++; } }); }); });
    return n;
  }
  window.saveGmapsKey=function(){
    var inp=$('gm-key-input'), v=((inp&&inp.value)||'').trim();
    if(!KEY_RE.test(v)){ toast('Format API key tidak valid (diawali AIza, 39 karakter).','rose'); return; }
    var old=key(), loaded=!!(window.google && google.maps);
    try{ localStorage.setItem(GMAPS_KEY_STORAGE,v); }catch(e){ toast('Gagal menyimpan key di perangkat ini.','rose'); return; }
    inp.value=''; inp.type='password'; var eye=$('gm-eye'); if(eye) eye.className='fa-solid fa-eye';
    state.status='saved'; tried={}; ui();
    if(loaded && old && old!==v){ toast('Key diganti. Memuat ulang halaman...','amber'); setTimeout(function(){ try{ location.reload(); }catch(e){} },900); return; }
    test().then(function(ok){ toast(ok?'Terhubung ke Google Maps. Mode 2 aktif.':'Key tersimpan, tapi koneksi belum berhasil. Lihat status.',ok?'emerald':'amber'); });
  };
  window.clearGmapsKey=function(){
    if(!confirm('Hapus API key Google Maps dari perangkat ini? Posisi perkiraan dari Google ikut dihapus. Check Point GPS tidak berubah.')) return;
    var loaded=!!(window.google && google.maps);
    try{ localStorage.removeItem(GMAPS_KEY_STORAGE); }catch(e){}
    purgeProvisional(); saveToLocalStorage(); renderAllViews(); refreshDetail();
    state.status='none'; tried={}; ui();
    toast('Key dihapus. Kembali ke Mode 1 (Check Point).','amber');
    if(loaded) setTimeout(function(){ try{ location.reload(); }catch(e){} },900);   // lepas script Google & key dari memori
  };

  /* ---------- target posisi per pesanan ---------- */
  function hostsOf(o){ return o.isCombined ? (o.subOrders||[]) : [o]; }
  function cleanAddr(a){ a=String(a==null?'':a).replace(/Catatan Pemesan:[\s\S]*/gi,'').replace(/\s+/g,' ').trim(); return a==='-'?'':a; }
  function queryFor(h,role){
    if(role==='resto'){
      var n=cleanAddr(h.restoName), a=cleanAddr(h.restoAddr);
      return (n&&a) ? n+', '+a : (a||n);
    }
    return cleanAddr(h.recipAddr);       // nama penerima (orang) tidak membantu pencarian
  }
  function targets(o){
    var out=[];
    hostsOf(o).forEach(function(h,i){
      ['resto','recip'].forEach(function(role){
        var q=queryFor(h,role);
        out.push({h:h,field:role==='resto'?'restoCheckin':'recipCheckin',q:q,tk:o.id+'|'+i+'|'+role+'|'+q});
      });
    });
    return out;
  }
  function need(t){
    if(!t.q) return false;
    var c=t.h[t.field];
    if(c && !c.provisional) return false;                  // Checkin GPS asli tidak pernah ditimpa
    if(c && c.source==='memory') return false;             // titik resto tersimpan lebih dipercaya daripada tebakan Google
    if(c && c.provisional && c.q===t.q) return false;      // sudah ada & alamat sama
    return !tried[t.tk];
  }
  /* ---------- INGATAN RESTO ----------
     Resto yang pernah di-Checkin GPS (asli) diingat dari data pesanan sebelumnya.
     Pesanan baru dari resto yang sama langsung dapat titik itu; Check Point resto
     tetap bisa dilakukan untuk membenarkan, dan koreksi terbaru jadi acuan berikutnya. */
  function normName(n){
    n=String(n==null?'':n).toLowerCase();
    try{ n=n.normalize('NFKD').replace(/[\u0300-\u036f]/g,''); }catch(e){}
    n=n.replace(/[^a-z0-9]+/g,' ').trim();
    return n.length>=3 ? n : '';
  }
  function memIndex(){
    var idx={};
    (ordersList||[]).forEach(function(o){ hostsOf(o).forEach(function(h){
      var c=h.restoCheckin; if(!c || c.provisional || !isFinite(c.lat) || !isFinite(c.lon)) return;
      var k=normName(h.restoName); if(!k) return;
      var ts=c.timestamp||0;
      if(!idx[k] || ts>idx[k].ts) idx[k]={lat:c.lat,lon:c.lon,ts:ts,k:k};
    }); });
    /* Database Resto (hasil Import dari driver lain). Checkin GPS asli di pesanan tetap menang
       kecuali entri database lebih baru. Hanya DIBACA di sini; pesanan tidak diubah. */
    try{
      var db=(window.DriverTrackRestoDB && window.DriverTrackRestoDB.index()) || {};
      Object.keys(db).forEach(function(k){
        var e=db[k]; if(!e || !isFinite(e.lat) || !isFinite(e.lng)) return;
        if(!idx[k] || e.ts>idx[k].ts) idx[k]={lat:e.lat,lon:e.lng,ts:e.ts,k:k};
      });
    }catch(e){}
    return idx;
  }
  function memCount(){
    var el=$('gm-mem-count'); if(!el || typeof ordersList==='undefined') return;
    el.innerText=Object.keys(memIndex()).length+' resto tersimpan.';
  }
  function memPass(orders){
    var idx=memIndex(), changed=false;
    orders.forEach(function(o){ hostsOf(o).forEach(function(h){
      var c=h.restoCheckin; if(c && !c.provisional) return;        // Checkin GPS asli di pesanan ini selalu menang
      var k=normName(h.restoName), m=k?idx[k]:null;
      if(m){
        if(c && c.source==='memory' && c.k===m.k && c.lat===m.lat && c.lon===m.lon) return;
        h.restoCheckin={lat:m.lat,lon:m.lon,accuracy:20,timestamp:Date.now(),source:'memory',provisional:true,k:m.k,fromTs:m.ts};
        changed=true;
      } else if(c && c.source==='memory' && c.k!==k){ h.restoCheckin=null; changed=true; }   // nama resto diganti
    }); });
    return changed;
  }

  async function process(orders,max){
    var changed=memPass(orders), left=0;                       // 1) ingatan resto (tanpa API, tanpa key)
    if(key() && state.status!=='denied' && state.status!=='checking'){   // 2) Google untuk titik yang masih kosong
      var jobs=[];
      orders.forEach(function(o){ targets(o).forEach(function(t){ if(need(t)) jobs.push(t); }); });
      var batch=jobs.slice(0,max||16); left=jobs.length-batch.length;
      for(var i=0;i<batch.length;i++){
        var t=batch[i], cur=t.h[t.field];
        var r=await resolve(t.q);
        if(state.status==='denied') break;
        tried[t.tk]=1;
        if(r){
          var now=t.h[t.field];
          if(now && (!now.provisional || now.source==='memory')) continue;   // GPS asli / titik resto tersimpan yang masuk selagi menunggu
          t.h[t.field]={lat:r.lat,lon:r.lon,accuracy:50,timestamp:Date.now(),source:'google',provisional:true,q:t.q,via:r.via};
          changed=true;
          if(state.status!=='ok'){ state.status='ok'; ui(); }
        } else if(cur && cur.provisional){ t.h[t.field]=null; changed=true; }
        await sleep(200);
      }
    }
    if(changed){ saveToLocalStorage(); renderAllViews(); refreshDetail(); }
    memCount();
    return left;
  }
  function startOfDay(){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
  async function run(){
    if(running || typeof ordersList==='undefined') return;
    running=true; var left=0;
    try{
      var cutoff=startOfDay()-AUTO_DAYS*86400000;
      left=await process(ordersList.filter(function(o){ return getOrderTs(o)>=cutoff; }));
    }catch(e){ console.warn('Auto posisi Google gagal:',e&&e.message); }
    finally{ running=false; }
    if(left>0) schedule();
  }
  function schedule(){ clearTimeout(timer); timer=setTimeout(run,600); }

  /* ---------- hook: simpan data & buka detail ---------- */
  var _save=window.saveToLocalStorage;
  window.saveToLocalStorage=function(){ var r=_save.apply(this,arguments); schedule(); return r; };

  var _open=window.openOrderDetailModal;
  window.openOrderDetailModal=function(id){
    var r=_open.apply(this,arguments);
    var o=ordersList.find(function(x){ return x.id===id; });
    if(o) setTimeout(function(){ process([o],8); },50);   // pesanan lama pun diisi saat dibuka
    return r;
  };
  function refreshDetail(){
    var o=(typeof currentDetailOrder!=='undefined') ? currentDetailOrder : null; if(!o) return;
    var live=ordersList.find(function(x){ return x.id===o.id; }); if(!live) return;
    if(live.isCombined){ renderCombinedPointsList(live); initCombinedOrderMap(live); }
    else { renderCheckinBox(live.id,'resto'); renderCheckinBox(live.id,'recip'); initOrderMap(live); }
  }

  /* ---------- tampilan: posisi Google = "perkiraan", bukan checkin ---------- */
  var gLink=function(c){ return 'https://www.google.com/maps?q='+c.lat+','+c.lon; };
  function provInfo(c){
    if(c.source==='memory'){
      var dt=c.fromTs?new Date(c.fromTs).toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'';
      return {icon:'fa-solid fa-bookmark',title:'Titik resto tersimpan',short:'titik resto dari checkin sebelumnya',
        sub:'Dari Checkin GPS sebelumnya'+(dt?' ('+dt+')':'')+'. Meleset? Checkin ulang untuk membenarkan.'};
    }
    return {icon:'fa-brands fa-google',title:'Posisi Google (perkiraan)',short:'posisi Google (perkiraan)',sub:'Meleset? Checkin GPS di lokasi untuk membenarkan.'};
  }
  var _rcb=window.renderCheckinBox;
  window.renderCheckinBox=function(orderId,role){
    _rcb.apply(this,arguments);
    var o=ordersList.find(function(x){ return x.id===orderId; }); if(!o) return;
    var c=role==='resto'?o.restoCheckin:o.recipCheckin; if(!c||!c.provisional) return;
    var box=$(role==='resto'?'resto-checkin-box':'recip-checkin-box'); if(!box) return;
    var col=role==='resto'?'amber':'emerald', pi=provInfo(c);
    box.innerHTML='<div class="space-y-1.5 bg-white rounded-xl border border-dashed border-'+col+'-300 p-2">'+
      '<div class="flex items-center justify-between gap-2"><div class="min-w-0">'+
      '<p class="font-bold text-'+col+'-700 text-[10px]"><i class="'+pi.icon+' mr-1"></i>'+pi.title+'</p>'+
      '<p class="text-slate-400 text-[10px]">'+esc(pi.sub)+'</p></div>'+
      '<a href="'+gLink(c)+'" target="_blank" class="flex-shrink-0 bg-'+col+'-600 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg"><i class="fa-solid fa-map-location-dot"></i> Maps</a></div>'+
      '<button type="button" onclick="doCheckin(\''+esc(orderId)+'\',\''+role+'\')" class="w-full bg-'+col+'-600 hover:bg-'+col+'-700 text-white font-bold py-2 rounded-xl text-[10px] transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-location-crosshairs"></i> Checkin GPS untuk Membenarkan</button></div>';
  };
  var _rcl=window.renderCombinedPointsList;
  window.renderCombinedPointsList=function(order){
    _rcl.apply(this,arguments);
    var listEl=$('detail-combined-points-list'); if(!listEl||!order||!order.points) return;
    var real=0, goo=0, mem=0;
    order.points.forEach(function(pt,i){
      var c=getPointCheckin(order,pt); if(!c) return;
      if(!c.provisional){ real++; return; }
      if(c.source==='memory') mem++; else goo++;
      var pi=provInfo(c), row=listEl.children[i]; if(!row) return;
      var title=row.querySelector('.fa-location-crosshairs'); title=title&&title.parentElement;
      if(title) title.innerHTML='<i class="'+pi.icon+' mr-1"></i>'+pi.title;
      var sub=title&&title.nextElementSibling; if(sub) sub.innerText=pi.sub;
      var btn=row.querySelector('button[title="Checkin Ulang"]'); if(btn){ btn.title='Checkin GPS untuk membenarkan'; btn.className=btn.className.replace('bg-slate-100 hover:bg-slate-200 text-slate-500','bg-indigo-600 hover:bg-indigo-700 text-white'); }
    });
    var pe=$('detail-combined-checkin-progress');
    if(pe) pe.innerText=real+'/'+order.points.length+' titik sudah checkin GPS'+(mem?' · '+mem+' titik resto tersimpan':'')+(goo?' · '+goo+' posisi Google (perkiraan)':'');
  };
  function tagBadge(o){
    var b=$('detail-calculated-distance'); if(!b||!o) return;
    var shorts={};
    hostsOf(o).forEach(function(h){ ['restoCheckin','recipCheckin'].forEach(function(f){ if(h[f]&&h[f].provisional) shorts[provInfo(h[f]).short]=1; }); });
    var keys=Object.keys(shorts); if(!keys.length || b.innerHTML.indexOf('gm-tag')>=0) return;
    b.innerHTML+=' <span class="gm-tag">· '+keys.join(' + ')+'</span>';
  }
  var _iom=window.initOrderMap;
  window.initOrderMap=async function(o){ var r=await _iom.apply(this,arguments); tagBadge(o); return r; };
  var _icm=window.initCombinedOrderMap;
  window.initCombinedOrderMap=async function(o){ var r=await _icm.apply(this,arguments); tagBadge(o); return r; };

  /* ---------- backup/ekspor: tanpa key, tanpa data posisi Google ---------- */
  function stripProvisional(){
    var saved=[];
    (ordersList||[]).forEach(function(o){ hostsOf(o).forEach(function(h){ ['restoCheckin','recipCheckin'].forEach(function(f){
      if(h[f]&&h[f].provisional){ saved.push([h,f,h[f]]); h[f]=null; } }); }); });
    return function(){ saved.forEach(function(s){ s[0][s[1]]=s[2]; }); };
  }
  ['exportData','exportLightData'].forEach(function(name){
    var orig=window[name]; if(typeof orig!=='function') return;
    window[name]=function(){ var restore=stripProvisional(); try{ return orig.apply(this,arguments); } finally{ restore(); } };
  });

  /* ---------- init ---------- */
  var _sw=window.switchTab;
  window.switchTab=function(tab){ var r=_sw.apply(this,arguments); if(tab==='profile') ui(); return r; };
  state.status = key() ? 'saved' : 'none';
  ui();
  setTimeout(schedule,2500);
})();
