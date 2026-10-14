/* =====================================================================
   PATCH 08 — OPTIMASI MEMORI OCR TESSERACT UNTUK HP RAM RENDAH
   Target: perangkat dengan navigator.deviceMemory <= 2 GB

   Cara kerja:
   1. Fungsi preprocessForTesseractLite() meng-override perilaku
      preProcessImageForTesseract() yang sudah ada, khusus untuk
      perangkat RAM rendah:
        - Resize sisi panjang maksimal ke 1000px (hemat ~60% memori vs 2600px)
        - CSS-filter grayscale+contrast via OffscreenCanvas / canvas filter
        - Kompresi JPEG 0.75 (vs 0.92 sebelumnya)
   2. Deteksi navigator.deviceMemory <= 2 GB → tampilkan toast 1x
      "Mode Hemat Memori OCR Aktif" dan gunakan preprocess ringan.
   3. Pada perangkat > 2 GB → tetap pakai preProcessImageForTesseract()
      versi penuh (tidak ada perubahan perilaku).
   ===================================================================== */
(function () {
    'use strict';

    var _shownLowRamToast = false;

    /* ---------- Deteksi RAM ---------- */
    function isLowRamDevice() {
        var mem = navigator.deviceMemory; // undefined di Firefox, ada di Chrome/Android
        return (typeof mem === 'number') && mem <= 2;
    }

    /* ---------- Pre-processing ringan khusus HP RAM rendah ---------- */
    function preprocessForTesseractLite(base64DataUrl) {
        return new Promise(function (resolve) {
            try {
                var img = new Image();
                img.onload = function () {
                    try {
                        var origW = img.naturalWidth  || img.width;
                        var origH = img.naturalHeight || img.height;
                        var MAX_PX = 1000; // Jauh lebih hemat RAM vs 2600px versi penuh

                        // Hitung dimensi baru dengan batas sisi panjang 1000px
                        var w = origW, h = origH;
                        var longSide = Math.max(w, h);
                        if (longSide > MAX_PX) {
                            var s = MAX_PX / longSide;
                            w = Math.round(w * s);
                            h = Math.round(h * s);
                        }

                        var canvas = document.createElement('canvas');
                        canvas.width  = w;
                        canvas.height = h;
                        var ctx = canvas.getContext('2d');

                        // Terapkan grayscale + contrast via CSS filter (GPU-accelerated)
                        // Jauh lebih hemat CPU daripada iterasi pixel per pixel
                        ctx.filter = 'grayscale(100%) contrast(140%)';
                        ctx.drawImage(img, 0, 0, w, h);

                        // Kompresi JPEG 0.75 → lebih hemat RAM saat Tesseract decode
                        var resultDataUrl = canvas.toDataURL('image/jpeg', 0.75);

                        // Bebaskan canvas RAM segera
                        canvas.width = canvas.height = 0;
                        resolve(resultDataUrl);
                    } catch (err) {
                        console.warn('[OCR-LitePreprocess] Canvas error, fallback:', err);
                        resolve(base64DataUrl);
                    }
                };
                img.onerror = function () { resolve(base64DataUrl); };
                img.src = base64DataUrl;
            } catch (e) {
                resolve(base64DataUrl);
            }
        });
    }

    /* ---------- Patch jalankanTesseract untuk low-RAM device ---------- */
    function patchTesseractForLowRam() {
        var origJalankan = window.jalankanTesseract;
        if (typeof origJalankan !== 'function') {
            // Belum tersedia, retry
            setTimeout(patchTesseractForLowRam, 800);
            return;
        }

        if (!isLowRamDevice()) {
            console.log('[OCR-LitePreprocess] RAM cukup (' + (navigator.deviceMemory || '?') + ' GB), preprocess standar tetap dipakai.');
            return; // Tidak perlu patch, biarkan preprocess penuh berjalan
        }

        // Override preProcessImageForTesseract secara global
        // agar _eksekusiTesseractInternal yang sudah memanggil fungsi ini
        // secara otomatis menggunakan versi lite tanpa perlu ubah kode lain.
        var origPreProcess = window.preProcessImageForTesseract;
        window.preProcessImageForTesseract = function (base64DataUrl) {
            // Tampilkan toast 1x per sesi
            if (!_shownLowRamToast && typeof showToast === 'function') {
                _shownLowRamToast = true;
                showToast('📱 Mode Hemat Memori OCR aktif (RAM perangkat ≤ 2 GB).', 'amber');
            }
            return preprocessForTesseractLite(base64DataUrl);
        };

        console.log('[OCR-LitePreprocess] Patch aktif — preProcessImageForTesseract diganti ke versi lite (RAM: ' + (navigator.deviceMemory || '?') + ' GB).');
    }

    /* ---------- Init ---------- */
    function init() {
        patchTesseractForLowRam();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 400);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(init, 400);
        });
    }
}());
