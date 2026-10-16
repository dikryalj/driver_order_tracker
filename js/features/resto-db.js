/* =====================================================================
   DATABASE LOKASI RESTO/TOKO — Backup & Restore (berbagi antar driver)
   - Store sendiri: localStorage 'drivertrack_database_resto' (terpisah dari pesanan).
   - Export: HANYA nama, alamat, koordinat, kategori (+ waktu pembaruan). Tanpa pesanan.
   - Import: HANYA menulis ke store resto. Tidak menyentuh ordersList / saveToLocalStorage.
   - Titik dari store dipakai "ingatan resto" (memIndex) untuk pesanan baru.
   ===================================================================== */
(function(){
  'use strict';
  var STORE_KEY='drivertrack_database_resto', META_KEY='drivertrack_database_resto_meta';
  var FORMAT='drivertrack-database-resto', VERSION=1, FILENAME='drivertrack_database_resto.json';
  var MAX_BYTES=5*1024*1024, MAX_ITEMS=20000, NEAR_METERS=15;

  var $=function(i){ return document.getElementById(i); };
  var toast=function(m,c){ if(typeof showToast==='function') showToast(m,c||'emerald'); };

  /* Kunci nama: HARUS sama dengan normName() di "ingatan resto" agar cocok */
  function normKey(n){
    n=String(n==null?'':n).toLowerCase();
    try{ n=n.normalize('NFKD').replace(/[\u0300-\u036f]/g,''); }catch(e){}
    n=n.replace(/[^a-z0-9]+/g,' ').trim();
    return n.length>=3 ? n : '';
  }
  function cleanText(v,max){ return String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
  function cleanAddr(v){ var a=String(v==null?'':v).replace(/Catatan Pemesan:[\s\S]*/gi,''); a=cleanText(a,400); return a==='-'?'':a; }
  function r6(x){ return Math.round(x*1e6)/1e6; }
  function validCoord(lat,lng){
    return isFinite(lat) && isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180 && !(Math.abs(lat)<0.0001 && Math.abs(lng)<0.0001);
  }
  function catOf(v){
    v=String(v==null?'':v).toLowerCase();
    if(/food|makan/.test(v)) return 'Food';
    if(/spx|express|reguler|regular/.test(v)) return 'Express';
    if(/instan|instant|sameday/.test(v)) return 'Instant';
    return '';
  }
  function meters(aLat,aLng,bLat,bLng){
    var R=6371000, t=Math.PI/180, dLa=(bLat-aLat)*t, dLo=(bLng-aLng)*t;
    var h=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(aLat*t)*Math.cos(bLat*t)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }

  /* ---------- store lokal ---------- */
  function loadStore(){
    try{ var o=JSON.parse(localStorage.getItem(STORE_KEY)||'{}'); return (o && typeof o==='object' && !Array.isArray(o)) ? o : {}; }
    catch(e){ return {}; }
  }
  function saveStore(o){ try{ localStorage.setItem(STORE_KEY,JSON.stringify(o)); return true; }catch(e){ return false; } }
  function loadMeta(){ try{ return JSON.parse(localStorage.getItem(META_KEY)||'{}')||{}; }catch(e){ return {}; } }
  function saveMeta(m){ try{ localStorage.setItem(META_KEY,JSON.stringify(m)); }catch(e){} }

  /* Titik resto dari Checkin GPS ASLI di pesanan (dibaca saja, hanya field resto). Titik perkiraan (Google/ingatan) tidak dibagikan. */
  function fromOrders(){
    var out={};
    if(typeof ordersList==='undefined' || !ordersList) return out;
    ordersList.forEach(function(o){
      if(!o) return;
      // Jangan masukkan pesanan Instan karena pengirimnya perorangan/rumah tangga, bukan resto/toko
      if(o.category==='Instan' || o.platform==='SPX Instan') return;
      (o.isCombined ? (o.subOrders||[]) : [o]).forEach(function(h){
        if(!h) return;
        if(h.category==='Instan' || h.platform==='SPX Instan') return;
        var c=h.restoCheckin; if(!c || c.provisional) return;
        var lat=Number(c.lat), lng=Number(c.lon!=null?c.lon:c.lng);
        if(!validCoord(lat,lng)) return;
        var k=normKey(h.restoName); if(!k) return;
        var cat=catOf(h.category||o.category);
        if(cat==='Instant') return; // Lewati Instan
        var ts=Number(c.timestamp)||0, prev=out[k];
        var rec={namaResto:cleanText(h.restoName,200), alamatResto:cleanAddr(h.restoAddr), lat:r6(lat), lng:r6(lng), kategori:cat, ts:ts};
        if(!prev){ out[k]=rec; }
        else if(ts>prev.ts){ if(!rec.alamatResto) rec.alamatResto=prev.alamatResto; if(!rec.kategori) rec.kategori=prev.kategori; out[k]=rec; }
        else { if(!prev.alamatResto) prev.alamatResto=rec.alamatResto; if(!prev.kategori) prev.kategori=rec.kategori; }
      });
    });
    return out;
  }
  /* Database lokal efektif = store (hasil import) + titik GPS asli dari pesanan; yang terbaru menang */
  function getAll(){
    var all={}, st=loadStore(), od=fromOrders();
    Object.keys(st).forEach(function(k){
      var e=st[k]; if(!e || !validCoord(Number(e.lat),Number(e.lng))) return;
      var cat = catOf(e.kategori);
      if(cat==='Instant') return; // Instan bukan resto/toko
      all[k]={namaResto:cleanText(e.namaResto,200), alamatResto:cleanText(e.alamatResto,400), lat:Number(e.lat), lng:Number(e.lng), kategori:cat||'Food', ts:Number(e.ts)||0};
    });
    Object.keys(od).forEach(function(k){
      var e=od[k], cur=all[k];
      if(e.kategori==='Instant') return; // Lewati Instan
      if(!cur){ all[k]=e; return; }
      if(e.ts>cur.ts){ if(!e.alamatResto) e.alamatResto=cur.alamatResto; if(!e.kategori) e.kategori=cur.kategori; all[k]=e; }
      else { if(!cur.alamatResto) cur.alamatResto=e.alamatResto; if(!cur.kategori) cur.kategori=e.kategori; }
    });

    // Deduplikasi jika ada titik ganda pada koordinat/nama yang sama
    var list = Object.keys(all).map(function(k){ return all[k]; });
    var deduped = [];
    list.forEach(function(item){
      var lat = Number(item.lat), lng = Number(item.lng);
      if(!validCoord(lat, lng)) return;
      var k1 = normKey(item.namaResto);

      var dup = deduped.find(function(ex){
        var dist = meters(lat, lng, Number(ex.lat), Number(ex.lng));
        var k2 = normKey(ex.namaResto);

        // 1. Titik koordinat sangat dekat (<= 30 meter) dan nama sama/mirip
        if (dist <= 30) {
          if (!k1 || !k2 || k1 === k2 || k1.indexOf(k2) !== -1 || k2.indexOf(k1) !== -1) return true;
        }
        // 2. Nama sama persis dan jarak radius area (<= 250 meter)
        if (k1 && k2 && k1 === k2 && dist <= 250) return true;
        // 3. Nama mirip dan jarak <= 120 meter
        if (k1 && k2 && (k1.indexOf(k2) !== -1 || k2.indexOf(k1) !== -1) && dist <= 120) return true;
        // 4. Koordinat identik sampai 4 desimal (~11m)
        if (Math.abs(lat - Number(ex.lat)) < 0.00015 && Math.abs(lng - Number(ex.lng)) < 0.00015) return true;

        return false;
      });

      if (!dup) {
        deduped.push(item);
      } else {
        if ((item.ts || 0) >= (dup.ts || 0)) {
          dup.lat = item.lat;
          dup.lng = item.lng;
          dup.ts = item.ts;
        }
        if (item.alamatResto && !dup.alamatResto) dup.alamatResto = item.alamatResto;
        if (item.namaResto && item.namaResto.length > (dup.namaResto || '').length) dup.namaResto = item.namaResto;
        if (item.kategori && !dup.kategori) dup.kategori = item.kategori;
      }
    });

    var finalObj = {};
    deduped.forEach(function(r, idx){
      var baseKey = normKey(r.namaResto) || ('r_' + idx);
      var key = baseKey;
      if (finalObj[key]) {
        key = baseKey + '_' + idx;
      }
      finalObj[key] = r;
    });
    return finalObj;
  }

  function updateInfo(){
    var el=$('resto-db-info'); if(!el) return;
    var n=Object.keys(getAll()).length, m=loadMeta(), parts=[n+' resto tersimpan di perangkat ini.'];
    var f=function(iso){ try{ return new Date(iso).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };
    if(m.lastImport) parts.push('Import terakhir: '+f(m.lastImport)+' (+'+(m.added||0)+' baru, '+(m.updated||0)+' diperbarui).');
    if(m.lastExport) parts.push('Export terakhir: '+f(m.lastExport)+'.');
    el.textContent=parts.join(' ');
  }

  /* ---------- EXPORT ---------- */
  async function backupDataResto(){
    var all=getAll(), keys=Object.keys(all);
    if(!keys.length){ toast('Belum ada data resto dengan titik GPS untuk di-export. Lakukan Check Point di resto terlebih dahulu.','amber'); return; }
    var list=keys.map(function(k){ return all[k]; }).sort(function(a,b){ return a.namaResto.localeCompare(b.namaResto,'id'); })
      .map(function(r){
        return {
          namaResto:r.namaResto,
          alamatResto:r.alamatResto||'',
          koordinat:{lat:r6(r.lat), lng:r6(r.lng)},
          kategori:r.kategori||'',
          diperbarui:r.ts>1e11 ? new Date(r.ts).toISOString() : null
        };
      });
    var payload={format:FORMAT, version:VERSION, app:'GacorLens', exportedAt:new Date().toISOString(), total:list.length, restos:list};
    var jsonStr=JSON.stringify(payload,null,2);
    var successMsg='Backup berhasil: '+list.length+' titik Resto/Toko disimpan ke '+FILENAME+' — siap dibagikan!';

    var isNative = (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function')
      ? Capacitor.isNativePlatform()
      : (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

    if(isNative){
      try {
        var cap = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor : (window.Capacitor || {});
        var Plugins = cap.Plugins || {};
        var Filesystem = Plugins.Filesystem;
        var Share = Plugins.Share;
        var Directory = Plugins.Directory || { Cache: 'CACHE', Documents: 'DOCUMENTS' };
        var Encoding = Plugins.Encoding || { UTF8: 'utf8' };

        if(!Filesystem || !Share){
          throw new Error('Plugin Capacitor Filesystem atau Share tidak tersedia.');
        }

        // 1. Cek & Minta Izin Android
        if(typeof Filesystem.checkPermissions === 'function'){
          var perm = await Filesystem.checkPermissions();
          if(perm && perm.publicStorage !== 'granted'){
            if(typeof Filesystem.requestPermissions === 'function'){
              perm = await Filesystem.requestPermissions();
            }
          }
        }

        // 2. Tulis File JSON ke Directory.Cache (atau Documents)
        var targetDir = Directory.Cache || 'CACHE';
        var targetEnc = Encoding.UTF8 || 'utf8';
        await Filesystem.writeFile({
          path: FILENAME,
          data: jsonStr,
          directory: targetDir,
          encoding: targetEnc,
          recursive: true
        });

        // Simpan juga salinan permanen ke Documents/GacorLens/ agar terlihat di File Manager HP
        try {
          await Filesystem.writeFile({
            path: 'GacorLens/' + FILENAME,
            data: jsonStr,
            directory: Directory.Documents || 'DOCUMENTS',
            encoding: targetEnc,
            recursive: true
          });
        } catch(docErr) {
          console.warn('[RestoDB] Gagal salin ke Documents (abaikan):', docErr);
        }

        // 3. Dapatkan URI Asli File di Android
        var fileUri = null;
        if(typeof Filesystem.getUri === 'function'){
          var uriRes = await Filesystem.getUri({
            path: FILENAME,
            directory: targetDir
          });
          fileUri = uriRes && uriRes.uri;
        }

        if(!fileUri){
          throw new Error('Gagal mendapatkan URI file dari Filesystem.');
        }

        // 4. Panggil Pop-up Share Native Android
        await Share.share({
          title: 'Backup Database Resto GacorLens',
          text: 'File database resto GacorLens: ' + FILENAME,
          url: fileUri,
          dialogTitle: 'Simpan ke Drive / Bagikan via WhatsApp'
        });

        var m=loadMeta(); m.lastExport=new Date().toISOString(); saveMeta(m); updateInfo();
        toast('Backup tersimpan di folder Documents/GacorLens/ & siap dibagikan!','emerald');
      } catch(err){
        console.error('Error Backup Resto:', err);
        alert('Gagal Ekspor Backup: ' + (err.message || err));
        if(typeof toast === 'function'){
          toast('Gagal Ekspor Backup: ' + (err.message || err), 'rose');
        }
      }
    } else {
      _fallbackDownloadResto(jsonStr, successMsg);
    }
  }
  async function _fallbackDownloadResto(jsonStr, msg){
    try{
      var blob=new Blob([jsonStr],{type:'application/json'});
      var file=new File([blob], FILENAME, {type:'application/json'});
      if(typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })){
        try {
          await navigator.share({
            files: [file],
            title: 'Database Resto GacorLens',
            text: 'File database lokasi resto GacorLens'
          });
          var m=loadMeta(); m.lastExport=new Date().toISOString(); saveMeta(m); updateInfo();
          toast('Database resto berhasil dibagikan!','emerald');
          return;
        } catch (shareErr) {
          if (shareErr && shareErr.name === 'AbortError') {
            toast('Share dibatalkan.', 'amber');
            return;
          }
        }
      }
      var url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download=FILENAME; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); },1500);
      var m=loadMeta(); m.lastExport=new Date().toISOString(); saveMeta(m); updateInfo();
      toast(msg,'emerald');
    }catch(e){ console.error(e); toast('Gagal export database resto. Coba lagi.','rose'); }
  }

  /* ---------- VALIDASI FILE ---------- */
  function parseRestoFile(parsed){
    var items;
    if(Array.isArray(parsed)){ items=parsed; }
    else if(parsed && typeof parsed==='object'){
      if(parsed.format && parsed.format!==FORMAT) return {error:'File ini bukan database resto GacorLens.'};
      if(Array.isArray(parsed.restos)){ items=parsed.restos; }
      else if(parsed.ordersList || parsed.orders) return {error:'Ini file backup PESANAN, bukan database resto. Gunakan tombol Import Data di kartu Backup & Restore Data.'};
      else return {error:'Struktur file tidak dikenali (daftar "restos" tidak ditemukan).'};
      if(Number(parsed.version)>VERSION) return {error:'File dibuat dengan versi yang lebih baru. Perbarui aplikasi lalu coba lagi.'};
    } else return {error:'Struktur file tidak dikenali.'};
    if(items.length>MAX_ITEMS) return {error:'File terlalu besar (maksimal '+MAX_ITEMS+' resto).'};
    var map={}, skipped=0;
    items.forEach(function(it){
      if(!it || typeof it!=='object'){ skipped++; return; }
      var nama=cleanText(it.namaResto,200), k=normKey(nama);
      var kc=it.koordinat||{}, lat=Number(kc.lat), lng=Number(kc.lng!=null?kc.lng:kc.lon);
      if(!k || !validCoord(lat,lng)){ skipped++; return; }
      var t=it.diperbarui ? Date.parse(it.diperbarui) : NaN;
      var rec={namaResto:nama, alamatResto:cleanAddr(it.alamatResto), lat:r6(lat), lng:r6(lng), kategori:catOf(it.kategori), ts:isFinite(t)?t:1};
      var prev=map[k];
      if(!prev || rec.ts>=prev.ts){ if(prev){ if(!rec.alamatResto) rec.alamatResto=prev.alamatResto; if(!rec.kategori) rec.kategori=prev.kategori; } map[k]=rec; }
    });
    var list=Object.keys(map).map(function(k){ map[k].k=k; return map[k]; });
    if(!list.length) return {error:'Tidak ada data resto yang valid di file ini.'};
    return {list:list, skipped:skipped};
  }

  /* ---------- MERGE (tanpa duplikat) ---------- */
  function mergeInto(list){
    var local=getAll(), store=loadStore(), added=0, updated=0, same=0;
    var localKeys=Object.keys(local);
    list.forEach(function(r){
      var key=r.k;
      if(!local[key]){
        /* Nama beda tapi titik hampir identik DAN nama saling memuat → anggap resto yang sama.
           (Koordinat saja tidak cukup: banyak resto bisa berdekatan di food court / mal.) */
        for(var i=0;i<localKeys.length;i++){
          var lk=localKeys[i], L=local[lk];
          if(Math.abs(L.lat-r.lat)>0.0003 || Math.abs(L.lng-r.lng)>0.0003) continue;
          if((lk.indexOf(r.k)>=0 || r.k.indexOf(lk)>=0) && meters(L.lat,L.lng,r.lat,r.lng)<=NEAR_METERS){ key=lk; break; }
        }
      }
      var cur=local[key];
      if(!cur){
        store[key]={namaResto:r.namaResto, alamatResto:r.alamatResto, lat:r.lat, lng:r.lng, kategori:r.kategori, ts:r.ts};
        local[key]=store[key]; localKeys.push(key); added++;
        return;
      }
      if(r.ts>cur.ts){                               // data masuk lebih baru → perbarui koordinat/alamat
        var rec={namaResto:cur.namaResto, alamatResto:r.alamatResto||cur.alamatResto, lat:r.lat, lng:r.lng, kategori:r.kategori||cur.kategori, ts:r.ts};
        store[key]=rec; local[key]=rec; updated++;
      } else {                                        // data lokal sama/lebih baru → pertahankan, isi alamat/kategori yang kosong
        var st=store[key];
        if(st){
          var ch=false;
          if(!st.alamatResto && r.alamatResto){ st.alamatResto=r.alamatResto; ch=true; }
          if(!st.kategori && r.kategori){ st.kategori=r.kategori; ch=true; }
          if(ch) updated++; else same++;
        } else same++;
      }
    });
    return {store:store, added:added, updated:updated, same:same};
  }

  /* ---------- IMPORT ---------- */
  function restoreDataResto(event){
    var input=event && event.target, file=input && input.files && input.files[0];
    if(!file) return;
    var reset=function(){ try{ input.value=''; }catch(e){} };
    if(file.size>MAX_BYTES){ toast('File terlalu besar (maksimal 5 MB).','rose'); reset(); return; }
    if(!/\.json$/i.test(file.name||'') && !/json/i.test(file.type||'')){ toast('Pilih file database resto berformat .json.','rose'); reset(); return; }
    var reader=new FileReader();
    reader.onerror=function(){ toast('Gagal membaca file.','rose'); reset(); };
    reader.onload=function(e){
      try{
        var parsed;
        try{ parsed=JSON.parse(e.target.result); }catch(err){ toast('File bukan JSON yang valid.','rose'); return; }
        var res=parseRestoFile(parsed);
        if(res.error){ toast(res.error,'rose'); return; }
        var mg=mergeInto(res.list);
        if(mg.added>0 || mg.updated>0){
          if(!saveStore(mg.store)){ toast('Gagal menyimpan database resto (penyimpanan penuh). Tidak ada data yang diubah.','rose'); return; }
          var m=loadMeta(); m.lastImport=new Date().toISOString(); m.added=mg.added; m.updated=mg.updated; saveMeta(m);
        }
        updateInfo();
        var tail=res.skipped>0 ? ' ('+res.skipped+' entri tidak valid dilewati)' : '';
        if(mg.added>0){
          toast('Berhasil menambahkan '+mg.added+' titik lokasi Resto/Toko baru!'+(mg.updated>0?' '+mg.updated+' titik diperbarui.':'')+' Siap digunakan untuk navigasi/checkpoint.'+tail,'emerald');
        } else if(mg.updated>0){
          toast('Tidak ada resto baru, '+mg.updated+' titik lokasi diperbarui.'+tail,'emerald');
        } else {
          toast('Tidak ada perubahan: semua resto di file sudah ada di perangkat ini.'+tail,'amber');
        }
      }catch(err){
        console.error(err); toast('Gagal memproses file database resto.','rose');
      } finally { reset(); }
    };
    reader.readAsText(file);
  }

  /* Dibaca oleh "ingatan resto" (hanya store import; titik dari pesanan sudah dipindai sendiri di sana) */
  window.DriverTrackRestoDB={
    index:function(){
      var st=loadStore(), out={};
      Object.keys(st).forEach(function(k){
        var e=st[k], lat=Number(e&&e.lat), lng=Number(e&&e.lng);
        if(validCoord(lat,lng)) out[k]={lat:lat,lng:lng,ts:Number(e.ts)||0};
      });
      return out;
    },
    count:function(){ return Object.keys(getAll()).length; },
    getAll: getAll
  };
  window.GacorLensRestoDB = window.DriverTrackRestoDB;
  window.backupDataResto=backupDataResto;
  window.restoreDataResto=restoreDataResto;

  /* Jumlah resto ikut diperbarui saat membuka tab Profil */
  var _st=window.switchTab;
  if(typeof _st==='function'){
    window.switchTab=function(t){ var r=_st.apply(this,arguments); if(t==='profile') setTimeout(updateInfo,60); return r; };
  }
  document.addEventListener('DOMContentLoaded',function(){ updateInfo(); setTimeout(updateInfo,1500); });
})();
