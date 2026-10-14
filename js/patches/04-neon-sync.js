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
  window.nxOpenMapsResto=function(){ window.open('https://www.google.com/maps/search/restoran+terdekat','_blank','noopener'); };

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
