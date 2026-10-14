/* Tema Neon Charcoal: sinkron sapaan besar, pencarian & Maps Resto (hanya tampil di tema Neon) */
(function(){
  function nxSync(){
    var g=document.getElementById('header-greeting'), n=document.getElementById('header-driver-name');
    var G=document.getElementById('nx-greeting'), N=document.getElementById('nx-name');
    if(!g||!n||!G||!N) return;
    var gt=(g.textContent||'').replace(/\s*\u{1F44B}\s*$/u,'').trim()+',', nt=(n.textContent||'Driver').trim()+'! \u{1F44B}';
    if(G.textContent!==gt) G.textContent=gt;
    if(N.textContent!==nt) N.textContent=nt;
  }
  window.nxGoSearch=function(){
    var v=(document.getElementById('nx-search-input')||{}).value||'';
    var si=document.getElementById('search-input'); if(si) si.value=v;
    if(typeof switchTab==='function') switchTab('orders');
    if(typeof renderAllViews==='function') renderAllViews();
  };
  var _allRestosMap = null;
  var _allRestosLayer = null;
  var _cachedRestos = [];

  window.nxOpenMapsResto = function() {
    var modal = document.getElementById('modal-maps-resto');
    if (!modal) return;
    modal.classList.remove('hidden');

    var restosObj = (window.DriverTrackRestoDB && typeof window.DriverTrackRestoDB.getAll === 'function')
      ? window.DriverTrackRestoDB.getAll()
      : {};
    
    var keys = Object.keys(restosObj);
    _cachedRestos = keys.map(function(k) { return restosObj[k]; });

    var countLabel = document.getElementById('maps-resto-count-label');
    var emptyNotice = document.getElementById('maps-resto-empty-notice');
    if (countLabel) {
      countLabel.textContent = _cachedRestos.length + ' resto tersimpan di perangkat ini';
    }

    if (emptyNotice) {
      if (_cachedRestos.length === 0) {
        emptyNotice.classList.remove('hidden');
      } else {
        emptyNotice.classList.add('hidden');
      }
    }

    // Inisialisasi peta Leaflet jika belum ada
    setTimeout(function() {
      initAllRestosMap();
      renderRestoMarkers(_cachedRestos);
    }, 150);
  };

  function initAllRestosMap() {
    var mapEl = document.getElementById('all-restos-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (!_allRestosMap) {
      _allRestosMap = L.map('all-restos-map', {
        zoomControl: true,
        attributionControl: true
      }).setView([-7.558, 110.771], 13);

      if (typeof createBaseTileLayer === 'function') {
        createBaseTileLayer().addTo(_allRestosMap);
      } else {
        L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3']
        }).addTo(_allRestosMap);
      }
      _allRestosLayer = L.layerGroup().addTo(_allRestosMap);
    } else {
      _allRestosMap.invalidateSize();
    }
  }

  function renderRestoMarkers(restos) {
    if (!_allRestosMap || !_allRestosLayer) return;
    _allRestosLayer.clearLayers();

    var bounds = [];
    var restoIcon = L.divIcon({
      className: 'custom-resto-pin',
      html: '<div style="background:#f59e0b;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.3);border:2px solid #fff;"><i class="fa-solid fa-store" style="font-size:12px;"></i></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    restos.forEach(function(r) {
      if (!r || !r.lat || !r.lng) return;
      var lat = Number(r.lat), lng = Number(r.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.push([lat, lng]);
      var gmapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
      var popupContent = '<div style="min-width:180px;padding:2px;">' +
        '<p style="font-weight:800;font-size:13px;margin:0 0 4px 0;color:#0f172a;">' + (r.namaResto || 'Resto') + '</p>' +
        (r.alamatResto ? '<p style="font-size:11px;color:#64748b;margin:0 0 6px 0;line-height:1.3;">' + r.alamatResto + '</p>' : '') +
        (r.kategori ? '<span style="display:inline-block;background:#fef3c7;color:#b45309;font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:6px;margin-bottom:8px;">' + r.kategori + '</span><br>' : '') +
        '<a href="' + gmapsUrl + '" target="_blank" style="display:inline-flex;align-items:center;gap:4px;background:#4f46e5;color:#fff;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:8px;text-decoration:none;margin-top:4px;">' +
        '<i class="fa-solid fa-diamond-turn-right"></i> Buka Google Maps</a>' +
        '</div>';

      L.marker([lat, lng], { icon: restoIcon })
        .bindPopup(popupContent)
        .addTo(_allRestosLayer);
    });

    if (bounds.length > 0) {
      _allRestosMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }

  window.nxFilterMapsResto = function(query) {
    var q = String(query || '').toLowerCase().trim();
    if (!q) {
      renderRestoMarkers(_cachedRestos);
      return;
    }
    var filtered = _cachedRestos.filter(function(r) {
      var n = String(r.namaResto || '').toLowerCase();
      var a = String(r.alamatResto || '').toLowerCase();
      return n.indexOf(q) !== -1 || a.indexOf(q) !== -1;
    });
    renderRestoMarkers(filtered);
  };

  window.nxCloseMapsResto = function() {
    var modal = document.getElementById('modal-maps-resto');
    if (modal) modal.classList.add('hidden');
  };

  window.nxCenterCurrentLocation = function() {
    if (!_allRestosMap) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        _allRestosMap.setView([lat, lng], 16);
        var meIcon = L.divIcon({
          className: 'me-pin',
          html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,0.3);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        L.marker([lat, lng], { icon: meIcon }).addTo(_allRestosLayer).bindPopup('Posisi Saya Saat Ini').openPopup();
      }, function() {
        if (typeof showToast === 'function') showToast('Tidak dapat membaca posisi GPS saat ini.', 'amber');
      }, { enableHighAccuracy: true, timeout: 8000 });
    }
  };

  /* Kartu pesanan khusus tema Neon Charcoal (meniru kartu "Active delivery"). Data & aksi sama dengan kartu biasa. */
  window.createNeonOrderCardHTML=function(o){
    var esc=(typeof escapeHtml==='function')?escapeHtml:function(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
    var comb=!!o.isCombined, subs=o.subOrders||[];
    var real=function(c){return !!c && !c.provisional;};
    var anyCp=real(o.restoCheckin)||real(o.recipCheckin)||subs.some(function(s){return real(s.restoCheckin)||real(s.recipCheckin);});
    var done=comb?(subs.length>0&&subs.every(function(s){return !!s.recipCheckin;})):!!o.recipCheckin;
    var time=new Date(o.timestamp).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    var plat=(typeof effPlatform==='function')?effPlatform(o):(o.platform||'Lainnya');
    var PI={'ShopeeFood':['fa-bag-shopping','#EE4D2D'],'SPX':['fa-box','#EE4D2D'],'SPX Instan':['fa-bolt','#F59E0B'],'Grab':['fa-circle','#00B14F'],'Gojek':['fa-circle','#00AA13'],'Lainnya':['fa-mobile-screen','#6B7280']};
    var pi=PI[plat]||PI.Lainnya, logoBg, logoIc, name, platHtml;
    if(comb){
      logoBg='#15171A'; logoIc='fa-link" style="color:#99FF33';
      name=esc(o.restoName)+' \u2192 '+esc(o.recipName);
      platHtml='<i class="fa-solid fa-link" style="color:#15171A"></i> Gabungan \u2022 '+subs.length+' pesanan';
    } else {
      var cat=o.category;
      logoBg=(cat==='Instan')?'#15171A':'#EE4D2D';
      logoIc=(cat==='SPX'?'fa-box':(cat==='Instan'?'fa-bolt" style="color:#99FF33':'fa-utensils'));
      name=esc(o.restoName);
      platHtml='<i class="fa-solid '+pi[0]+'" style="color:'+pi[1]+'"></i> '+esc(plat);
    }
    var price=(o.orderIncome||0)>0?'Rp'+Number(o.orderIncome).toLocaleString('id-ID'):'-';
    var id=String(o.id).replace(/'/g,'');
    return '<div class="nxc" onclick="openOrderDetailModal(\''+id+'\')">'+
      '<div class="nxc-top"><span class="nxc-t">'+(done?'Delivery selesai':'Active delivery')+'</span><span class="nxc-badge'+(done?' done':'')+'">'+(done?'Selesai':'Active')+'</span></div>'+
      '<div class="nxc-mid"><button type="button" class="nxc-logo" style="background:'+logoBg+'" onclick="event.stopPropagation();openImageModal(\''+(o.screenshot||'')+'\')" aria-label="Lihat screenshot"><i class="fa-solid '+logoIc+'"></i></button>'+
      '<div class="nxc-info"><p class="nxc-name">'+name+'</p><p class="nxc-plat">'+platHtml+'<span class="nxc-time">'+time+'</span></p></div></div>'+
      '<div class="nxc-line"></div>'+
      '<div class="nxc-bot"><span class="nxc-cp'+(anyCp?'':' off')+'"><i class="fa-solid fa-circle-check"></i> '+(anyCp?'Checkpoint':'Belum checkpoint')+'</span><span class="nxc-price">'+price+'</span></div>'+
      '<div class="nxc-acts"><button type="button" class="nxc-ico" onclick="event.stopPropagation();openEditModal(\''+id+'\')" aria-label="Edit pesanan"><i class="fa-solid fa-pen-to-square"></i></button>'+
      '<button type="button" class="nxc-ico nxc-del" onclick="event.stopPropagation();deleteOrder(\''+id+'\')" aria-label="Hapus pesanan"><i class="fa-solid fa-trash"></i></button>'+
      '<button type="button" class="nxc-ico nxc-go" onclick="event.stopPropagation();openOrderDetailModal(\''+id+'\')"><i class="fa-solid fa-route"></i> Detail</button></div>'+
    '</div>';
  };
  function init(){
    nxSync();
    try{
      var mo=new MutationObserver(nxSync);
      ['header-greeting','header-driver-name'].forEach(function(id){ var el=document.getElementById(id); if(el) mo.observe(el,{childList:true,characterData:true,subtree:true}); });
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
