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
  var _currentCategory = 'all';
  var _currentSearchQuery = '';

  function isInstantResto(r) {
    if (!r) return true;
    var c = String(r.kategori || '').toLowerCase();
    return c === 'instant' || c === 'instan' || /instant|instan/i.test(c);
  }

  function getRestoCat(r) {
    var c = String((r && r.kategori) || '').toLowerCase();
    if (/spx|express|reguler|regular|toko|paket/i.test(c)) return 'Express';
    return 'Food';
  }

  function calcDistMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function normRestoName(name) {
    var s = String(name || '').toLowerCase();
    try { s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch(e) {}
    s = s.replace(/[^a-z0-9]+/g, ' ').trim();
    return s;
  }

  /* Filter deduplikasi: Jika titik resto dobel di titik yang sama dan nama resto sama/mirip, jadikan 1 titik saja */
  function deduplicateRestoList(list) {
    if (!Array.isArray(list)) return [];
    var deduped = [];
    list.forEach(function(item) {
      if (!item || !item.lat || !item.lng) return;
      var lat = Number(item.lat), lng = Number(item.lng);
      if (isNaN(lat) || isNaN(lng) || (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)) return;

      var n1 = normRestoName(item.namaResto);
      var dupIdx = -1;

      for (var i = 0; i < deduped.length; i++) {
        var ex = deduped[i];
        var exLat = Number(ex.lat), exLng = Number(ex.lng);
        var n2 = normRestoName(ex.namaResto);
        var dist = calcDistMeters(lat, lng, exLat, exLng);

        // KASUS 1: Titik koordinat sama persis atau sangat dekat (<= 30 meter)
        // Jika nama sama, mirip, atau salah satu kosong -> PASTI duplikat titik resto yang sama
        if (dist <= 30) {
          if (!n1 || !n2 || n1 === n2 || n1.indexOf(n2) !== -1 || n2.indexOf(n1) !== -1) {
            dupIdx = i;
            break;
          }
        }

        // KASUS 2: Nama resto sama persis dan jarak dalam area yang sama (<= 250 meter)
        if (n1 && n2 && n1 === n2 && dist <= 250) {
          dupIdx = i;
          break;
        }

        // KASUS 3: Nama resto mirip (salah satu mengandung nama lain) dan jarak <= 120 meter
        if (n1 && n2 && (n1.indexOf(n2) !== -1 || n2.indexOf(n1) !== -1) && dist <= 120) {
          dupIdx = i;
          break;
        }

        // KASUS 4: Koordinat identik sampai 4 desimal (~11m)
        if (Math.abs(lat - exLat) < 0.00015 && Math.abs(lng - exLng) < 0.00015) {
          dupIdx = i;
          break;
        }
      }

      if (dupIdx === -1) {
        deduped.push(item);
      } else {
        // Ambil data yang lebih lengkap / timestamp terbaru
        var cur = deduped[dupIdx];
        var curTs = Number(cur.ts) || 0;
        var itemTs = Number(item.ts) || 0;
        if (itemTs >= curTs) {
          cur.lat = item.lat;
          cur.lng = item.lng;
          cur.ts = itemTs;
        }
        if ((!cur.alamatResto || cur.alamatResto === '-') && item.alamatResto) {
          cur.alamatResto = item.alamatResto;
        }
        if (item.namaResto && item.namaResto.length > (cur.namaResto || '').length) {
          cur.namaResto = item.namaResto;
        }
        if (!cur.kategori && item.kategori) {
          cur.kategori = item.kategori;
        }
      }
    });

    return deduped;
  }

  window.nxOpenMapsResto = function() {
    var modal = document.getElementById('modal-maps-resto');
    if (!modal) return;
    modal.classList.remove('hidden');

    var restosObj = (window.DriverTrackRestoDB && typeof window.DriverTrackRestoDB.getAll === 'function')
      ? window.DriverTrackRestoDB.getAll()
      : {};
    
    var keys = Object.keys(restosObj);
    // KECUALIKAN Instan: karena instan adalah pengirim perorangan/rumah pribadi, bukan resto/toko
    var rawList = keys.map(function(k) { return restosObj[k]; }).filter(function(r) {
      return !isInstantResto(r);
    });

    // DEDUPLIKASI: hanya tampilkan 1 titik jika nama & titik resto sama
    _cachedRestos = deduplicateRestoList(rawList);

    _currentCategory = 'all';
    _currentSearchQuery = '';
    var searchInput = document.getElementById('maps-resto-search');
    if (searchInput) searchInput.value = '';

    updateCategoryBadges();
    updateTabButtonStyles();

    // Inisialisasi peta Leaflet jika belum ada
    setTimeout(function() {
      initAllRestosMap();
      applyRestoFilters();
    }, 150);
  };

  function updateCategoryBadges() {
    var foodCount = 0, spxCount = 0;
    _cachedRestos.forEach(function(r) {
      if (getRestoCat(r) === 'Express') spxCount++;
      else foodCount++;
    });

    var bAll = document.getElementById('badge-count-all');
    var bFood = document.getElementById('badge-count-food');
    var bSpx = document.getElementById('badge-count-spx');
    var countLabel = document.getElementById('maps-resto-count-label');

    if (bAll) bAll.textContent = '(' + _cachedRestos.length + ')';
    if (bFood) bFood.textContent = '(' + foodCount + ')';
    if (bSpx) bSpx.textContent = '(' + spxCount + ')';
    if (countLabel) {
      countLabel.textContent = _cachedRestos.length + ' lokasi tersimpan (' + foodCount + ' Food, ' + spxCount + ' SPX)';
    }
  }

  function updateTabButtonStyles() {
    var tAll = document.getElementById('tab-resto-all');
    var tFood = document.getElementById('tab-resto-food');
    var tSpx = document.getElementById('tab-resto-spx');

    var activeCls = 'px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-white shadow-sm transition active:scale-95 flex items-center gap-1 flex-shrink-0';
    var inactiveCls = 'px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-sm transition active:scale-95 flex items-center gap-1 flex-shrink-0';

    if (tAll) tAll.className = (_currentCategory === 'all') ? activeCls : inactiveCls;
    if (tFood) tFood.className = (_currentCategory === 'Food') ? activeCls : inactiveCls;
    if (tSpx) tSpx.className = (_currentCategory === 'Express') ? activeCls : inactiveCls;
  }

  window.nxSetCategoryFilter = function(cat) {
    _currentCategory = cat || 'all';
    updateTabButtonStyles();
    applyRestoFilters();
  };

  function applyRestoFilters() {
    var q = String(_currentSearchQuery || '').toLowerCase().trim();
    var filtered = _cachedRestos.filter(function(r) {
      if (isInstantResto(r)) return false; // Pastikan Instan selalu dikecualikan

      var rCat = getRestoCat(r);
      if (_currentCategory === 'Food' && rCat !== 'Food') return false;
      if (_currentCategory === 'Express' && rCat !== 'Express') return false;

      if (q) {
        var n = String(r.namaResto || '').toLowerCase();
        var a = String(r.alamatResto || '').toLowerCase();
        if (n.indexOf(q) === -1 && a.indexOf(q) === -1) return false;
      }
      return true;
    });

    var emptyNotice = document.getElementById('maps-resto-empty-notice');
    if (emptyNotice) {
      if (filtered.length === 0) emptyNotice.classList.remove('hidden');
      else emptyNotice.classList.add('hidden');
    }

    _activeRestoList = deduplicateRestoList(filtered);

    var bounds = [];
    _activeRestoList.forEach(function(r) {
      if (!r || !r.lat || !r.lng || isInstantResto(r)) return;
      var lat = Number(r.lat), lng = Number(r.lng);
      if (!isNaN(lat) && !isNaN(lng)) bounds.push([lat, lng]);
    });

    if (bounds.length > 0 && _allRestosMap) {
      _allRestosMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    renderRestoMarkersLOD();
  }

  var _activeRestoList = [];
  var _restoCanvasRenderer = null;

  function initAllRestosMap() {
    var mapEl = document.getElementById('all-restos-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (!_allRestosMap) {
      _allRestosMap = L.map('all-restos-map', {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true
      }).setView([-7.558, 110.771], 13);

      try {
        _restoCanvasRenderer = L.canvas({ padding: 0.5 });
      } catch (e) {
        _restoCanvasRenderer = null;
      }

      if (typeof createBaseTileLayer === 'function') {
        createBaseTileLayer().addTo(_allRestosMap);
      } else {
        L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3']
        }).addTo(_allRestosMap);
      }
      _allRestosLayer = L.layerGroup().addTo(_allRestosMap);

      // Level of Detail dinamis saat zoom berubah (ala Google Maps agar tidak lag & bersih)
      _allRestosMap.on('zoomend', function() {
        renderRestoMarkersLOD();
      });
    } else {
      _allRestosMap.invalidateSize();
    }
  }

  function renderRestoMarkersLOD() {
    if (!_allRestosMap || !_allRestosLayer) return;
    _allRestosLayer.clearLayers();

    var list = _activeRestoList;
    if (!list || list.length === 0) return;

    var zoom = _allRestosMap.getZoom();

    // LOD Grid System ala Google Maps:
    // Zoom out jauh (<= 12): Tampilkan titik (dot) dan beberapa ikon representatif per grid area.
    // Zoom in dekat (>= 15): Tampilkan semua sebagai ikon pin lengkap.
    var cellSize = 0;
    if (zoom <= 10) cellSize = 95;
    else if (zoom === 11) cellSize = 75;
    else if (zoom === 12) cellSize = 60;
    else if (zoom === 13) cellSize = 45;
    else if (zoom === 14) cellSize = 30;
    else cellSize = 0; // Zoom >= 15: Semua ikon terbuka

    // Ikon Pin Khusus Food (Restoran/Kuliner) - Warna Oranye
    var foodIcon = L.divIcon({
      className: 'resto-pin-food',
      html: '<div style="background:#f97316;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(249,115,22,0.45);border:2.5px solid #fff;"><i class="fa-solid fa-utensils" style="font-size:12px;"></i></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    // Ikon Pin Khusus SPX (Toko/Paket) - Warna Merah/Oranye khas SPX
    var spxIcon = L.divIcon({
      className: 'resto-pin-spx',
      html: '<div style="background:#ee4d2d;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(238,77,45,0.45);border:2.5px solid #fff;"><i class="fa-solid fa-box" style="font-size:12px;"></i></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    var gridOccupied = {};
    var dotMarkers = [];
    var iconMarkers = [];

    list.forEach(function(r) {
      if (!r || !r.lat || !r.lng || isInstantResto(r)) return;
      var lat = Number(r.lat), lng = Number(r.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      var isLeader = false;
      if (cellSize === 0) {
        isLeader = true;
      } else {
        var pt = _allRestosMap.project([lat, lng], zoom);
        var cellKey = Math.floor(pt.x / cellSize) + '_' + Math.floor(pt.y / cellSize);
        if (!gridOccupied[cellKey]) {
          gridOccupied[cellKey] = true;
          isLeader = true;
        }
      }

      var rCat = getRestoCat(r);
      var badgeHtml = (rCat === 'Express')
        ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;margin-bottom:6px;"><i class="fa-solid fa-box"></i> SPX (Toko)</span>'
        : '<span style="display:inline-flex;align-items:center;gap:4px;background:#ffedd5;color:#c2410c;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;margin-bottom:6px;"><i class="fa-solid fa-utensils"></i> Food (Restoran)</span>';

      var gmapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
      var popupContent = '<div style="min-width:190px;padding:2px;">' +
        '<p style="font-weight:800;font-size:13px;margin:0 0 4px 0;color:#0f172a;">' + (r.namaResto || 'Lokasi') + '</p>' +
        (r.alamatResto ? '<p style="font-size:11px;color:#64748b;margin:0 0 6px 0;line-height:1.35;">' + r.alamatResto + '</p>' : '') +
        badgeHtml + '<br>' +
        '<a href="' + gmapsUrl + '" target="_blank" style="display:inline-flex;align-items:center;gap:4px;background:#4f46e5;color:#fff;font-size:11px;font-weight:700;padding:6px 12px;border-radius:8px;text-decoration:none;margin-top:4px;">' +
        '<i class="fa-solid fa-diamond-turn-right"></i> Buka Google Maps</a>' +
        '</div>';

      if (isLeader) {
        var icon = (rCat === 'Express') ? spxIcon : foodIcon;
        var marker = L.marker([lat, lng], { icon: icon }).bindPopup(popupContent);
        iconMarkers.push(marker);
      } else {
        // Titik lingkaran kecil khas Google Maps (Gambar 2): ringan dan bebas lag
        var dotColor = (rCat === 'Express') ? '#ee4d2d' : '#f97316';
        var dotOpt = {
          radius: 4,
          fillColor: dotColor,
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.9
        };
        if (_restoCanvasRenderer) dotOpt.renderer = _restoCanvasRenderer;

        var dotMarker = L.circleMarker([lat, lng], dotOpt).bindPopup(popupContent);
        dotMarkers.push(dotMarker);
      }
    });

    // Render titik terlebih dahulu, lalu ikon di atasnya agar tidak tertutup
    dotMarkers.forEach(function(m) { m.addTo(_allRestosLayer); });
    iconMarkers.forEach(function(m) { m.addTo(_allRestosLayer); });
  }

  window.nxFilterMapsResto = function(query) {
    _currentSearchQuery = String(query || '');
    applyRestoFilters();
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
