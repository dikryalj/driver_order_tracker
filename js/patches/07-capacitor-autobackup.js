/* =====================================================================
   PATCH 07 — AUTO-BACKUP & RESTORE KE NATIVE FILESYSTEM (Capacitor)
   Mengatasi risiko data hilang akibat Clear Storage di WebView Android.

   Cara kerja:
   1. Setiap saveToLocalStorage() dipanggil → mirror JSON ringan (tanpa
      screenshot base64) ke Documents/DriverTrack/auto_backup.json
      via @capacitor/filesystem.
   2. Setiap initStorage() selesai dengan ordersList kosong → cek file
      backup tersebut; jika ada, tawarkan restore ke user.

   Aman: tidak mengubah struktur ordersList, tidak menyentuh IndexedDB,
   tidak berpengaruh di browser biasa (hanya aktif saat Capacitor native).
   ===================================================================== */
(function () {
    'use strict';

    var BACKUP_DIR  = 'GacorLens';
    var LEGACY_DIR  = 'DriverTrack';
    var BACKUP_FILE = 'auto_backup.json';
    var BACKUP_PATH = BACKUP_DIR + '/' + BACKUP_FILE;
    var LEGACY_PATH = LEGACY_DIR + '/' + BACKUP_FILE;
    var PROFILE_KEY = 'drivertrack_profile';
    var _lastBackupAt = 0;
    var THROTTLE_MS  = 15000; // Jangan tulis lebih dari 1x per 15 detik

    /* ---------- Helper cek apakah kita berjalan di Capacitor native ---------- */
    function isCapacitorNative() {
        var cap = window.Capacitor;
        if (!cap) return false;
        var isNat = (typeof cap.isNativePlatform === 'function') ? cap.isNativePlatform() : !!cap.isNative;
        return !!(isNat && cap.Plugins && cap.Plugins.Filesystem);
    }

    /* ---------- Strip screenshot dari salinan backup ---------- */
    function stripScreenshots(orders) {
        if (!Array.isArray(orders)) return [];
        return orders.map(function (o) {
            if (!o) return o;
            var clone = Object.assign({}, o);
            // Hapus screenshot di root order
            if (clone.screenshot && String(clone.screenshot).startsWith('data:')) {
                delete clone.screenshot;
            }
            // Hapus screenshot di setiap subOrder (order gabungan)
            if (Array.isArray(clone.subOrders)) {
                clone.subOrders = clone.subOrders.map(function (s) {
                    if (!s) return s;
                    var sc = Object.assign({}, s);
                    if (sc.screenshot && String(sc.screenshot).startsWith('data:')) {
                        delete sc.screenshot;
                    }
                    return sc;
                });
            }
            return clone;
        });
    }

    /* ---------- Tulis file backup ke Filesystem ---------- */
    async function writeBackup() {
        if (!isCapacitorNative()) return;
        var now = Date.now();
        if (now - _lastBackupAt < THROTTLE_MS) return; // throttle
        _lastBackupAt = now;

        try {
            var fs = window.Capacitor.Plugins.Filesystem;
            var payload = {
                v: 1,
                ts: now,
                orders: stripScreenshots(window.ordersList || []),
                profile: (function () {
                    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; }
                }())
            };

            // Pastikan direktori ada (buat kalau belum ada)
            try {
                await fs.mkdir({
                    path: BACKUP_DIR,
                    directory: 'DOCUMENTS',
                    recursive: true
                });
            } catch (mkErr) {
                // Abaikan error "already exists"
            }

            await fs.writeFile({
                path: BACKUP_PATH,
                data: JSON.stringify(payload),
                directory: 'DOCUMENTS',
                encoding: 'utf8'
            });
            console.log('[AutoBackup] Backup ringan berhasil ditulis ke', BACKUP_PATH);
        } catch (err) {
            console.warn('[AutoBackup] Gagal menulis backup:', err && err.message);
        }
    }

    /* ---------- Patch saveToLocalStorage() ---------- */
    function patchSaveToLocalStorage() {
        // saveToLocalStorage didefinisikan di scope IIFE modul 03, tetapi
        // di-expose ke window oleh modul 07 / 08 / dll. via globalThis.
        // Kita intercept dengan meng-override di globalThis setelah semua modul selesai dimuat.
        var _origSave = window.saveToLocalStorage;
        if (typeof _origSave !== 'function') {
            console.warn('[AutoBackup] saveToLocalStorage belum tersedia, retry 1s...');
            setTimeout(patchSaveToLocalStorage, 1000);
            return;
        }

        window.saveToLocalStorage = function () {
            _origSave.apply(this, arguments);
            // Fire-and-forget: tidak menghalangi simpan utama
            writeBackup().catch(function () {});
        };
        console.log('[AutoBackup] saveToLocalStorage berhasil di-patch.');
    }

    /* ---------- Coba restore dari backup jika ordersList kosong ---------- */
    async function tryRestoreIfEmpty() {
        if (!isCapacitorNative()) return;
        // Tunggu sampai ordersList ada dan benar-benar kosong
        var orders = window.ordersList;
        if (!Array.isArray(orders) || orders.length > 0) return;

        try {
            var fs = window.Capacitor.Plugins.Filesystem;
            var result = null;
            try {
                result = await fs.readFile({
                    path: BACKUP_PATH,
                    directory: 'DOCUMENTS',
                    encoding: 'utf8'
                });
            } catch (readErr) {
                // Fallback ke folder lama DriverTrack
                try {
                    result = await fs.readFile({
                        path: LEGACY_PATH,
                        directory: 'DOCUMENTS',
                        encoding: 'utf8'
                    });
                } catch (legacyErr) {}
            }

            if (!result || !result.data) return;
            var payload = JSON.parse(result.data);
            if (!payload || !Array.isArray(payload.orders) || payload.orders.length === 0) return;

            var ts = payload.ts ? new Date(payload.ts).toLocaleString('id-ID') : '-';
            var msg = '⚠️ Data pesanan di aplikasi tampak kosong.\n\n'
                + 'Ditemukan backup otomatis: ' + payload.orders.length + ' pesanan\n'
                + 'Waktu backup: ' + ts + '\n\n'
                + 'Pulihkan data sekarang?';

            if (!confirm(msg)) return;

            // Pulihkan orders
            window.ordersList = payload.orders;

            // Pulihkan profil jika ada
            if (payload.profile) {
                try {
                    localStorage.setItem(PROFILE_KEY, JSON.stringify(payload.profile));
                } catch (e) {}
            }

            // Simpan ke penyimpanan utama (IndexedDB / localStorage)
            if (typeof window.saveToLocalStorage === 'function') {
                window.saveToLocalStorage();
            }

            // Re-render tampilan
            if (typeof window.renderAllViews === 'function') window.renderAllViews();
            if (typeof window.loadUserProfile  === 'function') window.loadUserProfile();
            if (typeof showToast === 'function') {
                showToast('✅ ' + payload.orders.length + ' pesanan berhasil dipulihkan dari backup.', 'emerald');
            }
            console.log('[AutoBackup] Restore berhasil:', payload.orders.length, 'pesanan');
        } catch (err) {
            // File tidak ada atau error lain → diam saja
            if (err && err.message && !err.message.includes('File does not exist')) {
                console.warn('[AutoBackup] tryRestoreIfEmpty error:', err.message);
            }
        }
    }

    /* ---------- Inisialisasi setelah semua modul selesai dimuat ---------- */
    function init() {
        patchSaveToLocalStorage();

        // Cek restore setelah initStorage() selesai (diberi jeda 2 detik untuk
        // memastikan seluruh modul async sudah menyelesaikan pemuatan data)
        setTimeout(function () {
            tryRestoreIfEmpty().catch(function () {});
        }, 2000);
    }

    // Jalankan setelah DOM + semua defer scripts siap
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 500);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(init, 500);
        });
    }
}());
