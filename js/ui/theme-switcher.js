    /* ===== Metode tema (dipilih dari halaman Profil). Hanya tampilan; tidak menyentuh data/fungsi ===== */
    (function(){
      var KEY='drivertrack_ui_theme';
      var current='default';
      try{ var _t=localStorage.getItem(KEY); if(_t==='sales'||_t==='focus'||_t==='lime'||_t==='neon') current=_t; }catch(e){}

      /* pola arsir untuk grafik tema Sales */
      var cache={};
      window.__hatch=function(fg){fg=fg||'rgba(27,29,26,.38)';if(cache[fg])return cache[fg];
        var c=document.createElement('canvas');c.width=c.height=8;var x=c.getContext('2d');
        x.strokeStyle=fg;x.lineWidth=1.4;x.beginPath();x.moveTo(-1,9);x.lineTo(9,-1);x.moveTo(-1,1);x.lineTo(1,-1);x.moveTo(7,9);x.lineTo(9,7);x.stroke();
        return cache[fg]=x.createPattern(c,'repeat');};

      /* simpan default asli Chart.js supaya bisa dikembalikan */
      var orig=null;
      if(window.Chart){
        var d=Chart.defaults, l=d.plugins.legend.labels, t=d.plugins.tooltip;
        orig={font:d.font.family,color:d.color,grid:d.scale.grid.color,border:d.scale.border.display,
          usePointStyle:l.usePointStyle,pointStyle:l.pointStyle,boxWidth:l.boxWidth,
          tb:t.backgroundColor,tt:t.titleColor,tbc:t.bodyColor,tr:t.cornerRadius,tp:t.padding,td:t.displayColors,tc:t.caretSize};
      }
      function applyChart(name){
        var on = name==='sales'||name==='focus'||name==='lime'||name==='neon';
        if(!window.Chart||!orig) return;
        var d=Chart.defaults, l=d.plugins.legend.labels, t=d.plugins.tooltip;
        if(on){
          d.font.family = name==='focus' ? "'Plus Jakarta Sans',sans-serif" : "'Urbanist','Plus Jakarta Sans',sans-serif"; d.color='#7E807B';
          d.scale.grid.color='rgba(27,29,26,.05)'; d.scale.border.display=false;
          l.usePointStyle=true; l.pointStyle='circle'; l.boxWidth=8;
          t.backgroundColor='#1E211D'; t.titleColor = (name==='lime'||name==='neon') ? (name==='neon' ? '#99FF33' : '#A6FF1F') : '#DDFF00'; t.bodyColor='#fff';
          t.cornerRadius=16; t.padding=11; t.displayColors=false; t.caretSize=0;
        }else{
          d.font.family=orig.font; d.color=orig.color; d.scale.grid.color=orig.grid; d.scale.border.display=orig.border;
          l.usePointStyle=orig.usePointStyle; l.pointStyle=orig.pointStyle; l.boxWidth=orig.boxWidth;
          t.backgroundColor=orig.tb; t.titleColor=orig.tt; t.bodyColor=orig.tbc;
          t.cornerRadius=orig.tr; t.padding=orig.tp; t.displayColors=orig.td; t.caretSize=orig.tc;
        }
      }
      function applyCss(name){
        var on = name==='sales'||name==='lime', fe=document.getElementById('theme-focus'), le=document.getElementById('theme-lime'), ne=document.getElementById('theme-neon');
        if(fe) fe.media = name==='focus' ? 'all' : 'not all';
        if(le) le.media = name==='lime' ? 'all' : 'not all';
        if(ne) ne.media = name==='neon' ? 'all' : 'not all';
        ['theme-override','theme-override-2'].forEach(function(id){
          var el=document.getElementById(id); if(el) el.media = on ? 'all' : 'not all';
        });
        document.documentElement.setAttribute('data-ui-theme', name);
        var mt=document.getElementById('meta-theme-color'); if(mt) mt.setAttribute('content', name==='neon' ? '#F3F4F1' : name==='lime' ? '#EEFFD6' : (on ? '#E8E6EE' : (name==='focus' ? '#FFFFFF' : '#F4F5FB')));
      }
      function syncButtons(){
        document.querySelectorAll('[data-theme-opt]').forEach(function(b){
          b.classList.toggle('is-active', b.getAttribute('data-theme-opt')===current);
        });
      }
      window.__isSales=function(){return current==='sales'||current==='lime';};
      window.__isNeon=function(){return current==='neon';};
      window.__isLime=function(){return current==='lime';};
      window.__isFocus=function(){return current==='focus';};
      /* Tema Focus: petakan warna grafik bawaan ke palet biru/lime/lavender (tanpa mengubah fungsi grafik) */
      if(window.Chart&&Chart.register){
        var FM={'#10B981':'#3E5BFF','rgba(16,185,129,0.35)':'rgba(62,91,255,0.3)','#F43F5E':'#D2F44A','rgba(244,63,94,0.35)':'rgba(210,244,74,0.45)',
          '#6366F1':'#3E5BFF','#F97316':'#3E5BFF','#EA580C':'#D2F44A','#16A34A':'#B9B8F2','#059669':'#111318'};
        var FN={'#10B981':'#99FF33','rgba(16,185,129,0.35)':'rgba(153,255,51,0.4)','#F43F5E':'#15171A','rgba(244,63,94,0.35)':'rgba(21,23,26,0.35)','#6366F1':'#15171A','#F97316':'#99FF33','#EA580C':'#15171A','#16A34A':'#6FCF1B','#059669':'#15171A'};
        var mp=function(c){return Array.isArray(c)?c.map(mp):(((window.__isNeon&&window.__isNeon())?FN:FM)[c]||c);};
        Chart.register({id:'focusRecolor',beforeUpdate:function(ch){
          if(!window.__isFocus() && !(window.__isNeon&&window.__isNeon())) return;
          ch.data.datasets.forEach(function(ds){ if(ds.backgroundColor) ds.backgroundColor=mp(ds.backgroundColor); if(typeof ds.borderRadius==='number') ds.borderRadius=10; });
        }});
      }
      window.getUITheme=function(){return current;};
      window.syncThemeButtons=syncButtons;
      window.setUITheme=function(name){
        current = (name==='sales'||name==='focus'||name==='lime'||name==='neon') ? name : 'default';
        try{ localStorage.setItem(KEY,current); }catch(e){}
        applyCss(current); applyChart(current); syncButtons();
        /* gambar ulang grafik agar warna mengikuti tema (memakai fungsi render yang sudah ada) */
        try{ if(typeof renderAllViews==='function') renderAllViews(); }catch(e){ console.warn(e); }
        try{ if(typeof activeTab!=='undefined' && activeTab==='insights' && typeof renderInsightsView==='function') renderInsightsView(); }catch(e){ console.warn(e); }
        if(typeof showToast==='function'){ try{ showToast({sales:'Tema Sales aktif',focus:'Tema Focus aktif',lime:'Tema Lime Rider aktif',neon:'Tema Neon Charcoal aktif','default':'Tema Default aktif'}[current]); }catch(e){} }
      };

      /* terapkan tema tersimpan sedini mungkin (sebelum render pertama) */
      applyCss(current); applyChart(current);
      document.addEventListener('DOMContentLoaded', syncButtons);
    })();
    
