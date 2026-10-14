    /* ===== Platform otomatis per kategori, titik awal driver, Limnas ===== */
    (function(){
      [['onCategoryChange',function(){autoPlat('form-category','form-platform');}],
       ['onExtraCategoryChange',function(i){autoPlat('form-category-'+i,'form-platform-'+i);}],
       ['onEditCategoryChange',function(){autoPlat('edit-form-category','edit-form-platform');}],
       ['onEditCombinedCategoryChange',function(k){autoPlat('ec-category-'+k,'ec-platform-'+k);}]
      ].forEach(function(x){ var f=window[x[0]]; window[x[0]]=function(){var r=f.apply(this,arguments); x[1].apply(this,arguments); return r;}; });

      var PK='drivertrack_driver_prefs', TP='drivertrack_track_', $=function(i){return document.getElementById(i);};
      var ymd=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
      var rp=function(n){return 'Rp'+Math.round(n||0).toLocaleString('id-ID');};
      var gp=function(){try{return Object.assign({start:false,track:false},JSON.parse(localStorage.getItem(PK)||'{}'));}catch(e){return {start:false,track:false};}};
      var dayData=function(k){try{return JSON.parse(localStorage.getItem(TP+k))||{km:0,pts:[]};}catch(e){return {km:0,pts:[]};}};
      var km2=function(a,b,c,d){return parseFloat(calculateHaversineDistance(a,b,c,d))||0;};
      var watchId=null, rangeDays=7, lastDay=ymd(new Date());

      /* --- Est. BBM: tambah leg titik awal -> titik pertama --- */
      function startLegKm(o){
        if(!gp().start||!o.startCheckin) return 0;
        var first=null;
        if(o.isCombined){ ensureCombinedPoints(o); var p=(o.points||[])[0]; first=p?getPointCheckin(o,p):null; }
        else first=o.restoCheckin;
        return first?km2(o.startCheckin.lat,o.startCheckin.lon,first.lat,first.lon):0;
      }
      var _cof=computeOrderFuelCost;
      computeOrderFuelCost=function(o){
        var c=_cof(o);
        if(!o.isCombined&&o.manualFuelCost!==null&&o.manualFuelCost!==undefined&&!isNaN(o.manualFuelCost)) return c;
        return c+startLegKm(o)*getFuelRate();
      };

      /* --- Kotak titik awal di modal detail --- */
      function geo(ok,fail){
        window.DriverGPS.ensurePermission('Titik Awal Driver').then(function(granted){
          if(!granted){ fail('Izin lokasi tidak diberikan'); return; }
          window.DriverGPS.getCurrentPosition({enableHighAccuracy:true,timeout:10000,maximumAge:0})
            .then(ok)
            .catch(function(e){ console.warn('GPS error:', e); fail('Izin/sinyal GPS gagal'); });
        });
      }
      function nearestTrack(ts){ var d=dayData(ymd(new Date(ts))), best=null; d.pts.forEach(function(p){ if(p[0]<=ts&&ts-p[0]<=3600000) best=p; }); return best; }
      window.setStartCheckin=function(id,mode){
        var o=ordersList.find(function(x){return x.id===id;}); if(!o) return;
        var done=function(lat,lon,acc){ o.startCheckin={lat:lat,lon:lon,accuracy:acc||15,timestamp:Date.now()}; saveToLocalStorage(); renderAllViews(); renderStartBox(o); showToast('Titik awal driver tersimpan','emerald'); };
        if(mode==='track'){ var p=nearestTrack(getOrderTs(o)); if(p) done(p[1],p[2],20); else showToast('Belum ada data lacak sebelum order ini','amber'); return; }
        if(mode==='clear'){ delete o.startCheckin; saveToLocalStorage(); renderAllViews(); renderStartBox(o); return; }
        geo(function(pos){done(pos.coords.latitude,pos.coords.longitude,pos.coords.accuracy);},function(m){showToast(m,'rose');});
      };
      function renderStartBox(o){
        var box=$('start-checkin-box'); if(!box) return;
        if(!gp().start){ box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        var leg=startLegKm(o), has=!!o.startCheckin;
        box.innerHTML='<p class="font-extrabold text-indigo-900 text-[11px] mb-1.5"><i class="fa-solid fa-flag-checkered mr-1"></i> Titik Awal Driver</p>'+
          (has?'<p class="text-[10px] text-slate-600 mb-1.5">Tersimpan · jarak awal → pesanan pertama '+(leg?leg.toFixed(2)+' km (+'+rp(leg*getFuelRate())+' BBM)':'belum bisa dihitung (checkin resto dulu)')+'</p>':'<p class="text-[10px] text-slate-500 mb-1.5">Belum dicatat. Catat lokasi driver sebelum menuju resto.</p>')+
          '<div class="flex gap-1.5"><button type="button" onclick="setStartCheckin(\''+o.id+'\',\'gps\')" class="flex-1 bg-indigo-600 text-white text-[10px] font-bold py-1.5 rounded-lg">'+(has?'Ulangi GPS':'Checkin GPS sekarang')+'</button>'+
          '<button type="button" onclick="setStartCheckin(\''+o.id+'\',\'track\')" class="flex-1 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 rounded-lg">Pakai posisi terlacak</button>'+
          (has?'<button type="button" onclick="setStartCheckin(\''+o.id+'\',\'clear\')" class="px-2 bg-slate-100 text-slate-500 text-[10px] rounded-lg"><i class="fa-solid fa-trash"></i></button>':'')+'</div>';
      }
      function ensureStartBox(anchorId,o){
        var box=$('start-checkin-box');
        if(!box){ var a=$(anchorId); var host=a&&(a.closest('.rounded-2xl,.rounded-3xl')||a.parentElement); if(!host||!host.parentElement) return; box=document.createElement('div'); box.id='start-checkin-box'; box.className='bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 my-2'; host.parentElement.insertBefore(box,host); }
        renderStartBox(o);
      }
      var _od=openOrderDetailModal; openOrderDetailModal=function(id){ _od.apply(this,arguments); var o=ordersList.find(function(x){return x.id===id;}); if(o&&!o.isCombined) ensureStartBox('resto-checkin-box',o); else if(o) ensureStartBox('detail-combined-checkin-progress',o); };

      /* --- Limnas: pelacak pergerakan --- */
      function record(pos){
        var c=pos.coords, t=pos.timestamp||Date.now(), k=ymd(new Date(t)); if(c.accuracy>60) return;
        var d=dayData(k), last=d.pts[d.pts.length-1];
        if(last){ var dist=km2(last[1],last[2],c.latitude,c.longitude), dt=(t-last[0])/1000;
          if(dist<0.03) return;
          if(dt>0&&dist/(dt/3600)>140) return;
          if(dt<=900) d.km+=dist; }
        d.pts.push([t,+c.latitude.toFixed(5),+c.longitude.toFixed(5)]);
        if(d.pts.length>3000) d.pts=d.pts.filter(function(_,i){return i%2===0;});
        d.km=+d.km.toFixed(3);
        try{localStorage.setItem(TP+k,JSON.stringify(d));}catch(e){}
        renderTrackCard(); statusText();
      }
      async function startTrack(){
        if(watchId!==null) return;
        var perm = await window.DriverGPS.checkPermission();
        if(perm !== 'granted') {
          statusText();
          return;
        }
        watchId = await window.DriverGPS.watchPosition(
          record,
          function(){ statusText('Izin lokasi ditolak/tidak tersedia'); },
          {enableHighAccuracy:true,maximumAge:5000,timeout:30000}
        );
        statusText();
      }
      async function stopTrack(){
        if(watchId!==null){
          await window.DriverGPS.clearWatch(watchId);
          watchId=null;
        }
      }
      // Browser menghentikan GPS saat halaman tersembunyi; begitu aplikasi dibuka lagi, daftarkan ulang agar titik langsung terekam.
      document.addEventListener('visibilitychange',function(){ if(!document.hidden && gp().track){ stopTrack(); startTrack(); } });
      function statusText(m){
        var el=$('dp-status'); if(!el) return;
        var d=dayData(ymd(new Date()));
        if(m) {
          el.innerText = m;
        } else if(gp().track) {
          if(watchId!==null) {
            el.innerHTML = '<span class="text-emerald-700 font-bold">● Limnas aktif</span> · hari ini '+d.km.toFixed(2)+' km · '+rp(d.km*getFuelRate());
          } else {
            el.innerHTML = '<span class="text-amber-700 font-bold">⚠️ Limnas menunggu izin lokasi</span> <span class="text-[9px] underline ml-1 text-indigo-600 font-bold">Klik untuk izinkan</span>';
          }
        } else {
          el.innerText = 'Limnas nonaktif';
        }
      }
      window.onToggleDriverPref = async function(type, el) {
        if(el.checked) {
          el.checked = false;
          var title = type === 'track' ? 'Limnas (Pelacak Pergerakan)' : 'Check Point Titik Awal Driver';
          var granted = await window.DriverGPS.ensurePermission(title);
          if(granted) {
            el.checked = true;
            window.saveDriverPrefs();
            if(type === 'track') {
              startTrack();
              showToast('✓ Limnas aktif merekam rute', 'emerald');
            } else {
              showToast('✓ Check point titik awal aktif', 'emerald');
            }
          } else {
            el.checked = false;
            window.saveDriverPrefs();
          }
        } else {
          window.saveDriverPrefs();
        }
      };
      window.checkOrPromptGPSStatus = async function() {
        if(!gp().track && !gp().start) {
          showToast('Aktifkan Check point atau Limnas untuk memulai', 'indigo');
          return;
        }
        var granted = await window.DriverGPS.ensurePermission('Akses Lokasi Driver');
        if(granted) {
          if(gp().track && watchId === null) startTrack();
          statusText();
          showToast('✓ Izin lokasi aktif', 'emerald');
        }
      };
      window.saveDriverPrefs=function(){
        var p={start:$('dp-start')?$('dp-start').checked:false,track:$('dp-track')?$('dp-track').checked:false};
        localStorage.setItem(PK,JSON.stringify(p));
        if(p.track) startTrack(); else stopTrack();
        statusText(); renderTrackCard(); renderAllViews();
        if(currentDetailOrder&&$('start-checkin-box')) renderStartBox(currentDetailOrder);
      };

      /* --- Kartu rekap Est. BBM di Home --- */
      function renderTrackCard(){
        var anchor=$('finance-km-info'); if(!anchor) return;
        var card=$('track-card'), p=gp(), hasAny=false;
        if(!card){ var host=anchor.closest('.card-shadow')||anchor.parentElement; card=document.createElement('div'); card.id='track-card'; card.className='bg-white rounded-3xl p-5 card-shadow border border-slate-100 space-y-3 mt-4'; host.insertAdjacentElement('afterend',card); }
        var rate=getFuelRate(), rows=[], tk=0, today=ymd(new Date()), now=new Date();
        for(var i=0;i<rangeDays;i++){ var d=new Date(now); d.setDate(d.getDate()-i); var k=ymd(d), dd=dayData(k); if(dd.km>0) hasAny=true; rows.push({k:k,d:d,km:dd.km,live:k===today}); if(k!==today) tk+=dd.km; }
        card.classList.toggle('hidden',!p.track&&!hasAny);
        var fin=rows.filter(function(r){return !r.live;}), tf=tk*rate;
        card.innerHTML='<div class="flex items-center justify-between"><p class="text-xs font-extrabold text-slate-900 flex items-center gap-2"><i class="fa-solid fa-gas-pump text-rose-500"></i> Est. BBM Pergerakan Driver (Limnas)</p><div class="flex gap-1">'+[7,14,30].map(function(n){return '<button type="button" onclick="setTrackRange('+n+')" class="text-[10px] font-bold px-2 py-1 rounded-lg '+(n===rangeDays?'bg-indigo-600 text-white':'bg-slate-100 text-slate-500')+'">'+n+'H</button>';}).join('')+'</div></div>'+
          '<div class="grid grid-cols-2 gap-2 text-center"><div class="bg-slate-50 rounded-2xl p-2.5"><span class="text-[10px] text-slate-400 font-semibold block">Total jarak (selesai)</span><span class="text-sm font-extrabold text-slate-800">'+tk.toFixed(1)+' km</span></div><div class="bg-rose-50 rounded-2xl p-2.5"><span class="text-[10px] text-rose-500 font-semibold block">Est. BBM</span><span class="text-sm font-extrabold text-rose-700">'+rp(tf)+'</span></div></div>'+
          '<div class="space-y-1 max-h-48 overflow-y-auto">'+rows.map(function(r){return '<div class="flex items-center justify-between text-[11px] bg-slate-50 rounded-xl px-3 py-1.5"><span class="font-semibold text-slate-600">'+(r.live?'Hari ini <span class="text-amber-500">· berjalan, final 00.00</span>':r.d.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short'}))+'</span><span class="font-extrabold text-slate-800">'+r.km.toFixed(1)+' km · '+rp(r.km*rate)+'</span></div>';}).join('')+'</div>'+
          '<p class="text-[9.5px] text-slate-400 leading-snug">Dicatat dari GPS saat aplikasi terbuka. Dihitung terpisah dari Est. BBM per order (tidak dijumlahkan agar tidak dobel).</p>';
      }
      window.setTrackRange=function(n){rangeDays=n; renderTrackCard();};

      /* --- Pergantian hari 00.00: rekap kemarin --- */
      function midnightCheck(){
        var t=ymd(new Date()); if(t===lastDay) return; var y=lastDay; lastDay=t; finalize(y); renderTrackCard(); renderAllViews();
      }
      function finalize(k){
        var FK='drivertrack_track_final'; if(localStorage.getItem(FK)===k) return; localStorage.setItem(FK,k);
        var d=dayData(k); if(d.km>0&&window.pushNotifExt) window.pushNotifExt({type:'summary',title:'Rekap BBM pergerakan '+k,body:d.km.toFixed(1)+' km · Est. BBM '+rp(d.km*getFuelRate())});
      }
      document.addEventListener('DOMContentLoaded',function(){
        var p=gp(); if($('dp-start')) $('dp-start').checked=p.start; if($('dp-track')) $('dp-track').checked=p.track;
        var y=new Date(); y.setDate(y.getDate()-1); finalize(ymd(y));
        if(p.track) {
          window.DriverGPS.checkPermission().then(function(perm){
            if(perm === 'granted') startTrack();
            else statusText();
          });
        } else {
          statusText();
        }
        setTimeout(renderTrackCard,800);
      });
      setInterval(midnightCheck,30000);
    })();
    
