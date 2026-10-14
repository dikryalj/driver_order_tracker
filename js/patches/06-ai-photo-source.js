/* PATCH v4: sumber gambar AI (kamera vs galeri) */
(function(){
  'use strict';
  function mark(el){ aiPhotoMode = !!(el && el.dataset && el.dataset.aiPhoto); }
  function clearCam(el){ if(el && el.dataset && el.dataset.aiPhoto){ try{ el.value=''; }catch(e){} } }  // supaya foto yang sama bisa diambil lagi
  var _fs=window.handleFileSelect;
  window.handleFileSelect=function(e){ mark(e.target); var r=_fs.apply(this,arguments); clearCam(e.target); return r; };
  var _ef=window.handleExtraFileSelect;
  window.handleExtraFileSelect=function(idx,e){ mark(e.target); var r=_ef.apply(this,arguments); clearCam(e.target); return r; };
  var _ec=window.ecScan;
  window.ecScan=function(key,input){ mark(input); return _ec.apply(this,arguments); };
})();
