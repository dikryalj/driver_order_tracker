    /* ===== Sistem notifikasi: penyimpanan penuh, pesanan baru, rangkuman pendapatan harian ===== */
    (function(){
      var NK='drivertrack_notifs', PK='drivertrack_notif_prefs', SK='drivertrack_storage_alert', LK='drivertrack_summary_last', TK='drivertrack_target_notified';
      var $=function(id){return document.getElementById(id);};
      var rp=function(n){return 'Rp'+Math.round(n||0).toLocaleString('id-ID');};
      var esc=function(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
      var ymd=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
      var lsGet=function(k,def){try{var v=localStorage.getItem(k);return v==null?def:JSON.parse(v);}catch(e){return def;}};
      var lsSet=function(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
      var prefs=function(){var p=lsGet(PK,{}); return {order:p.order!==false,summaryTime:p.summaryTime||'21:00',sys:!!p.sys};};
      var TYPES={order:['fa-receipt','bg-emerald-50 text-emerald-600'],storage:['fa-hard-drive','bg-rose-50 text-rose-600'],summary:['fa-sack-dollar','bg-indigo-50 text-indigo-600']};
      var known=null, lastStorageCheck=0, lastFailPopup=0;

      /* ---------- riwayat ---------- */
      function list(){return lsGet(NK,[]);}
      function updateDot(){var d=$('notif-dot'); if(d) d.classList.toggle('hidden',!list().some(function(n){return !n.read;}));}
      function timeAgo(ts){var m=Math.round((Date.now()-ts)/60000); if(m<1)return 'baru saja'; if(m<60)return m+' mnt lalu'; var d=new Date(ts); return (new Date().toDateString()===d.toDateString()?'':d.toLocaleDateString('id-ID',{day:'numeric',month:'short'})+' ')+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});}
      function pushNotif(n,opt){
        if(n.type==='order'&&!prefs().order) return;
        n.id=Date.now()+'-'+Math.random().toString(36).slice(2,6); n.ts=Date.now(); n.read=false;
        var a=list(); a.unshift(n); lsSet(NK,a.slice(0,50)); updateDot();
        if(opt&&opt.silent) return;
        var p=prefs();
        showPopup(n);
        if(p.sys&&document.hidden&&window.Notification&&Notification.permission==='granted'){try{new Notification(n.title,{body:n.body});}catch(e){}}
      }
      function showPopup(n){
        var box=$('notif-popups'); if(!box) return;
        var t=TYPES[n.type]||TYPES.order, el=document.createElement('div');
        el.className='nt-pop pointer-events-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex items-start gap-3 cursor-pointer';
        el.innerHTML='<span class="w-9 h-9 rounded-full '+t[1]+' flex items-center justify-center flex-shrink-0"><i class="fa-solid '+t[0]+' text-sm"></i></span>'+
          '<div class="flex-1 min-w-0"><p class="text-xs font-extrabold text-slate-900">'+esc(n.title)+'</p><p class="text-[11px] text-slate-500 mt-0.5 leading-snug">'+esc(n.body)+'</p></div>'+
          '<button type="button" class="text-slate-400 text-xs p-1" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>';
        var kill=function(){el.classList.add('nt-out'); setTimeout(function(){el.remove();},300);};
        el.onclick=function(e){ if(e.target.closest('button')){kill();return;} kill(); openPanel(); };
        box.appendChild(el); setTimeout(kill,6500);
        while(box.children.length>3) box.firstChild.remove();
      }
      function renderList(){
        var a=refreshOrderNotifs(), el=$('notif-list'); if(!el) return;
        if(!a.length){el.innerHTML='<div class="text-center py-10 text-xs text-slate-400"><i class="fa-regular fa-bell-slash text-2xl block mb-2"></i>Belum ada notifikasi</div>';return;}
        el.innerHTML=a.map(function(n){var t=TYPES[n.type]||TYPES.order;
          return '<button type="button" data-nid="'+n.id+'" class="w-full text-left flex items-start gap-3 p-3 rounded-2xl '+(n.read?'bg-slate-50':'bg-indigo-50')+' active:scale-[.98] transition">'+
          '<span class="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 '+t[1].split(' ')[1]+'"><i class="fa-solid '+t[0]+' text-sm"></i></span>'+
          '<span class="flex-1 min-w-0"><span class="block text-xs font-extrabold text-slate-900">'+esc(n.title)+'</span><span class="block text-[11px] text-slate-500 mt-0.5 leading-snug">'+esc(n.body)+'</span><span class="block text-[10px] text-slate-400 mt-1">'+timeAgo(n.ts)+'</span></span></button>';}).join('');
        el.querySelectorAll('[data-nid]').forEach(function(b){b.onclick=function(){
          var n=list().filter(function(x){return x.id===b.getAttribute('data-nid');})[0]; if(!n) return; closePanel();
          if(n.type==='summary'&&n.date) openSummary(new Date(n.date+'T12:00:00'),{title:n.title});
          else if(n.type==='storage'){ if(typeof switchTab==='function') switchTab('profile'); }
          else if(typeof switchTab==='function') switchTab('orders');
        };});
      }
      function nameOf(o){return o.isCombined?(o.subOrders||[]).map(function(x){return x.restoName||'-';}).join(' + '):((o.restoName&&o.restoName!=='-')?o.restoName:(o.platform||'Pesanan'));}
      function orderBody(o){
        var d=new Date(getOrderTs(o)), isT=d.toDateString()===new Date().toDateString(), day=dayOrders(d), f=computeFinancialSummary(day);
        var lbl=isT?'Hari ini':d.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
        return nameOf(o)+' · '+rp(o.orderIncome)+' · '+lbl+' '+countOrderUnits(day)+' order, kotor '+rp(f.grossIncome);
      }
      function refreshOrderNotifs(){
        var a=list().filter(function(n){return n.type!=='order'||!n.orderId||ordersList.some(function(o){return o.id===n.orderId;});});
        a.forEach(function(n){ if(n.type==='order'&&n.orderId){ var o=ordersList.filter(function(x){return x.id===n.orderId;})[0]; if(o) n.body=orderBody(o); } });
        lsSet(NK,a); return a;
      }
      function openPanel(){renderList(); $('notif-panel').classList.remove('hidden'); var a=list(); a.forEach(function(n){n.read=true;}); lsSet(NK,a); updateDot();}
      function closePanel(){$('notif-panel').classList.add('hidden');}
      function modal(html){$('notif-modal-body').innerHTML=html; $('notif-modal').classList.remove('hidden');}
      window.pushNotifExt=pushNotif; window.openNotifPanel=openPanel; window.closeNotifPanel=closePanel;
      window.closeNotifModal=function(){$('notif-modal').classList.add('hidden');};
      window.clearNotifs=function(){lsSet(NK,[]); updateDot(); renderList();};

      /* ---------- penyimpanan penuh ---------- */
      function storageModal(o){
        var pct=o.pct, full=o.fail||pct>=90, col=full?'rose':(pct>=80?'amber':'emerald');
        var title=o.fail?'Penyimpanan penuh, data gagal tersimpan':(full?'Penyimpanan hampir penuh':(pct>=80?'Penyimpanan perlu dibersihkan':'Penyimpanan masih aman'));
        var msg=o.fail?'Perubahan terakhir belum tersimpan. Backup data sekarang, lalu hapus pesanan atau screenshot lama.':(pct>=80?'Backup data lalu kurangi pesanan atau screenshot lama agar data baru tetap bisa tersimpan.':'Ruang penyimpanan browser masih cukup.');
        var used=o.usage!=null&&typeof formatBytes==='function'?formatBytes(o.usage)+' dari '+formatBytes(o.quota):'';
        modal('<div class="p-5 space-y-4"><div class="flex items-start gap-3"><span class="w-11 h-11 rounded-2xl bg-'+col+'-50 text-'+col+'-600 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-hard-drive"></i></span>'+
          '<div><h3 class="font-extrabold text-slate-900 text-sm">'+title+'</h3><p class="text-[11px] text-slate-500 mt-1 leading-relaxed">'+msg+'</p></div></div>'+
          (pct!=null?'<div class="space-y-1.5"><div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-'+col+'-500 rounded-full" style="width:'+Math.min(100,Math.max(pct,1.5))+'%"></div></div><p class="text-[11px] font-semibold text-slate-600">Terpakai '+pct.toFixed(1)+'%'+(used?' ('+used+')':'')+'</p></div>':'')+
          '<div class="grid grid-cols-2 gap-2"><button type="button" onclick="closeNotifModal();exportData()" class="bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl active:scale-95 transition"><i class="fa-solid fa-download mr-1"></i> Backup sekarang</button>'+
          '<button type="button" onclick="closeNotifModal();switchTab(\'profile\')" class="bg-slate-100 text-slate-700 text-xs font-bold py-2.5 rounded-xl active:scale-95 transition">Buka Profil</button></div>'+
          '<button type="button" onclick="closeNotifModal()" class="w-full text-[11px] font-bold text-slate-400 py-1">Tutup</button></div>');
      }
      window.checkStorageAlert=async function(force){
        try{
          if(!navigator.storage||!navigator.storage.estimate){ if(force&&typeof showToast==='function') showToast('Kapasitas browser tidak bisa dibaca di perangkat ini.','amber'); return; }
          var e=await navigator.storage.estimate(); if(!e.quota) return;
          var pct=e.usage/e.quota*100, level=pct>=90?2:(pct>=80?1:0);
          if(force){storageModal({pct:pct,usage:e.usage,quota:e.quota}); return;}
          if(!level) return;
          var st=lsGet(SK,{level:0,at:0});
          if(st.level>=level&&Date.now()-st.at<86400000) return;
          lsSet(SK,{level:level,at:Date.now()});
          pushNotif({type:'storage',title:level===2?'Penyimpanan hampir penuh':'Penyimpanan perlu dibersihkan',body:'Terpakai '+pct.toFixed(1)+'%. Backup data lalu bersihkan pesanan atau screenshot lama.'},{silent:true});
          storageModal({pct:pct,usage:e.usage,quota:e.quota});
        }catch(err){console.warn(err);}
      };
      function scheduleCheck(){ if(Date.now()-lastStorageCheck<20000) return; lastStorageCheck=Date.now(); setTimeout(function(){window.checkStorageAlert(false);},1200); }

      /* ---------- rangkuman pendapatan ---------- */
      function dayOrders(d){var k=d.toDateString(); return ordersList.filter(function(o){return new Date(getOrderTs(o)).toDateString()===k;});}
      window.openSummary=function(d,opt){
        var os=dayOrders(d), f=computeFinancialSummary(os), units=countOrderUnits(os), pb=computePlatformBreakdown(os), cash=0, hrs={}, peak=null;
        os.forEach(function(o){cash+=(o.cashAmount||0); var h=new Date(getOrderTs(o)).getHours(); hrs[h]=(hrs[h]||0)+1;});
        Object.keys(hrs).forEach(function(h){if(peak===null||hrs[h]>hrs[peak]) peak=h;});
        var isToday=d.toDateString()===new Date().toDateString(), target=(typeof insightsDailyTarget!=='undefined'?insightsDailyTarget:10)||10, pct=Math.min(100,Math.round(units/target*100));
        var label=d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
        var row=function(a,b){return '<div class="flex items-center justify-between text-xs"><span class="text-slate-500 font-medium">'+a+'</span><span class="font-extrabold text-slate-900">'+b+'</span></div>';};
        var plat=Object.keys(pb).map(function(p){return row(esc(p)+' <span class="text-slate-400">· '+pb[p].orders+' order</span>',rp(pb[p].income));}).join('');
        var km=f.kmKnownCount>0?(f.totalKm||0).toFixed(1)+' km':'belum dipetakan';
        var body=os.length?
          '<div class="grid grid-cols-3 gap-2 text-center"><div class="bg-emerald-50 rounded-2xl p-2.5"><span class="text-[9.5px] text-emerald-600 font-semibold block">Kotor</span><span class="text-xs font-extrabold text-emerald-700 block mt-0.5">'+rp(f.grossIncome)+'</span></div>'+
          '<div class="bg-rose-50 rounded-2xl p-2.5"><span class="text-[9.5px] text-rose-600 font-semibold block">Est. BBM</span><span class="text-xs font-extrabold text-rose-700 block mt-0.5">'+rp(f.estFuelCost)+'</span></div>'+
          '<div class="bg-indigo-50 rounded-2xl p-2.5"><span class="text-[9.5px] text-indigo-600 font-semibold block">Bersih</span><span class="text-xs font-extrabold text-indigo-700 block mt-0.5">'+rp(f.netIncome)+'</span></div></div>'+
          '<div class="space-y-2 bg-slate-50 rounded-2xl p-3">'+row('Total order',units+' order')+row('Rata-rata per order',rp(units?f.grossIncome/units:0))+row('Tunai diterima',rp(cash))+row('Jarak tempuh',km)+(peak!==null?row('Jam tersibuk',String(peak).padStart(2,'0')+':00'):'')+'</div>'+
          '<div class="space-y-2"><p class="text-[11px] font-extrabold text-slate-900">Per platform</p>'+plat+'</div>'+
          (isToday?'<div class="space-y-1"><div class="flex justify-between text-[11px] font-bold text-slate-600"><span>Target harian</span><span>'+units+'/'+target+' ('+pct+'%)</span></div><div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:'+pct+'%"></div></div></div>':''):
          '<p class="text-xs text-slate-400 text-center py-6">Belum ada pesanan pada hari ini.</p>';
        modal('<div class="p-5 space-y-4"><div class="flex items-start gap-3"><span class="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-sack-dollar"></i></span><div><h3 class="font-extrabold text-slate-900 text-sm">'+esc((opt&&opt.title)||'Rangkuman pendapatan')+'</h3><p class="text-[11px] text-slate-400 mt-0.5">'+label+'</p></div></div>'+body+
          '<div class="grid grid-cols-2 gap-2"><button type="button" onclick="closeNotifModal();switchTab(\'orders\')" class="bg-slate-100 text-slate-700 text-xs font-bold py-2.5 rounded-xl active:scale-95 transition">Lihat pesanan</button><button type="button" onclick="closeNotifModal()" class="bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl active:scale-95 transition">Tutup</button></div></div>');
        return {os:os,f:f,units:units};
      };
      function autoSummary(d,title){
        var os=dayOrders(d); if(!os.length) return false;
        var f=computeFinancialSummary(os), u=countOrderUnits(os);
        pushNotif({type:'summary',date:ymd(d),title:title,body:u+' order · Kotor '+rp(f.grossIncome)+' · Bersih '+rp(f.netIncome)},{silent:true});
        window.openSummary(d,{title:title}); return true;
      }
      function tickSummary(){
        try{
          var now=new Date(), p=prefs();
          var timeStr = p.summaryTime || '21:00';
          var hm = timeStr.split(':');
          var targetH = parseInt(hm[0], 10);
          var targetM = parseInt(hm[1], 10);
          if (isNaN(targetH)) targetH = 21;
          if (isNaN(targetM)) targetM = 0;

          var at = new Date(now);
          at.setHours(targetH, targetM, 0, 0);

          var todayStr = ymd(now);
          var lastRun = lsGet(LK, '');

          // Jika sekarang sudah mencapai atau melewati jam target hari ini
          if (now >= at && lastRun !== todayStr) {
            var ordersToday = dayOrders(now);
            if (ordersToday && ordersToday.length > 0) {
              lsSet(LK, todayStr);
              autoSummary(now, 'Rangkuman pendapatan hari ini (' + timeStr + ')');
            }
          }
        }catch(e){console.warn('[Notif] Error tickSummary:', e);}
      }
      function catchUp(){
        try{
          var y=new Date(); y.setDate(y.getDate()-1); var last=lsGet(LK,'');
          if(last<ymd(y)&&dayOrders(y).length){ lsSet(LK,ymd(y)); autoSummary(y,'Rangkuman pendapatan kemarin'); }
        }catch(e){console.warn(e);}
      }
      function checkTarget(){
        try{
          var t=(typeof insightsDailyTarget!=='undefined'?insightsDailyTarget:10)||10, now=new Date();
          if(getTodayOrderUnitCount()>=t&&lsGet(TK,'')!==ymd(now)){ lsSet(TK,ymd(now)); autoSummary(now,'Target harian tercapai 🎉'); }
        }catch(e){console.warn(e);}
      }

      /* ---------- pesanan baru ---------- */
      function notifyNew(o,more){
        var d=new Date(getOrderTs(o));
        pushNotif({type:'order',orderId:o.id,date:ymd(d),title:more?'Pesanan ditambahkan ke orderan':'Pesanan baru ditambahkan',body:orderBody(o)});
      }
      function unitMap(){var m={}; ordersList.forEach(function(o){m[o.id]=getOrderUnitCount(o);}); return m;}
      function seed(){ if(known===null) known=unitMap(); }
      function onSaved(){
        if(known===null) return;
        var cur=unitMap(), added=[];
        ordersList.forEach(function(o){ var p=known[o.id]; if(p===undefined||cur[o.id]>p) added.push({o:o,more:p!==undefined}); });
        known=cur;
        if(added.length&&added.length<=3){ added.forEach(function(x){notifyNew(x.o,x.more);}); if(added.some(function(x){return new Date(getOrderTs(x.o)).toDateString()===new Date().toDateString();})) checkTarget(); }
        scheduleCheck();
      }
      var _save=saveToLocalStorage; saveToLocalStorage=function(){var r=_save.apply(this,arguments); try{onSaved();}catch(e){console.warn(e);} return r;};
      var _fail=reportSaveFailure; reportSaveFailure=function(e){ _fail(e); if(Date.now()-lastFailPopup>60000){lastFailPopup=Date.now(); pushNotif({type:'storage',title:'Penyimpanan penuh, data gagal tersimpan',body:'Backup data lalu hapus pesanan atau screenshot lama.'},{silent:true}); storageModal({fail:true,pct:null});} };
      var _init=initStorage; initStorage=async function(){var r=await _init.apply(this,arguments); seed(); setTimeout(function(){catchUp();tickSummary();window.checkStorageAlert(false);},1500); return r;};
      setTimeout(seed,2000);
      setTimeout(tickSummary,3000);
      setInterval(tickSummary,30000);
      setInterval(function(){window.checkStorageAlert(false);},300000);
      document.addEventListener('visibilitychange',function(){ if(!document.hidden) tickSummary(); });

      /* ---------- pengaturan ---------- */
      function syncPrefs(){
        var p=prefs();
        if($('np-order')) $('np-order').checked=p.order;
        if($('np-time')) $('np-time').value=p.summaryTime;
      }
      window.saveNotifPrefs=function(){
        var p=prefs();
        if($('np-order')) p.order=$('np-order').checked;
        if($('np-time')) p.summaryTime=$('np-time').value||'21:00';
        lsSet(PK,p);
        syncPrefs();
        tickSummary();
        if(typeof showToast==='function') showToast('Pengaturan notifikasi disimpan (' + p.summaryTime + ')','emerald');
      };
      window.enableSystemNotif=function(){
        if(!window.Notification){ if(typeof showToast==='function') showToast('Browser ini tidak mendukung notifikasi sistem.','amber'); return; }
        Notification.requestPermission().then(function(r){var p=prefs(); p.sys=(r==='granted'); lsSet(PK,p); syncPrefs(); if(typeof showToast==='function') showToast(r==='granted'?'Notifikasi browser aktif':'Izin notifikasi ditolak',r==='granted'?'emerald':'amber');});
      };
      document.addEventListener('DOMContentLoaded',function(){syncPrefs(); updateDot();});
      window.syncNotifPrefs=syncPrefs;
    })();
    
