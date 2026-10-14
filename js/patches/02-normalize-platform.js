    /* Normalisasi platform data lama & hasil impor: Food->ShopeeFood, SPX->SPX, Instan->SPX Instan */
    (function(){
      function fix(x){ var e=effPlatform(x); if(x.platform!==e){x.platform=e; return 1;} return 0; }
      function normalize(){
        var n=0;
        ordersList.forEach(function(o){ if(o.isCombined){ (o.subOrders||[]).forEach(function(sb){n+=fix(sb);}); } else n+=fix(o); });
        if(n){ try{saveToLocalStorage();}catch(e){} try{renderAllViews();}catch(e){} }
      }
      var i0=initStorage; initStorage=async function(){ var r=await i0.apply(this,arguments); normalize(); return r; };
      var c0=confirmImport; confirmImport=function(){ var r=c0.apply(this,arguments); setTimeout(normalize,300); return r; };
    })();
    
