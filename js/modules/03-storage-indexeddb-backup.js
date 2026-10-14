        // ============================================================
        // PENYIMPANAN DATA PESANAN (IndexedDB + fallback localStorage)
        // Kenapa bukan localStorage saja: localStorage dibatasi ~5 MB, sedangkan
        // tiap screenshot (base64) bisa ratusan KB. Orderan gabungan (2+ pesanan)
        // cepat melewati batas itu, setItem melempar error, dan data baru
        // tidak tersimpan -> hilang setelah refresh. IndexedDB kapasitasnya
        // jauh lebih besar, dan kegagalan simpan sekarang selalu diberi tahu.
        // ============================================================
        const DB_NAME = 'drivertrack_db';
        const DB_STORE = 'kv';
        const ORDERS_KEY = 'orders';
        const LS_ORDERS_KEY = 'drivertrack_orders';
        let idbInstance = null;
        let idbAvailable = false;
        let saveQueue = Promise.resolve();
        let lastSaveErrorToastAt = 0;

        function openOrdersDB() {
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) return reject(new Error('IndexedDB tidak tersedia'));
                const req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
                req.onblocked = () => reject(new Error('IndexedDB terblokir'));
            });
        }
        function idbGet(key) {
            return new Promise((resolve, reject) => {
                const r = idbInstance.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
            });
        }
        function idbPut(key, value) {
            return new Promise((resolve, reject) => {
                const tx = idbInstance.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('Transaksi dibatalkan'));
            });
        }

        // Thumbnail orderan gabungan identik dengan screenshot sub-pesanan #1,
        // jadi tidak perlu disimpan dua kali (hemat ukuran).
        function packOrders(list) {
            return list.map(o => {
                if (o && o.isCombined && Array.isArray(o.subOrders) && o.subOrders[0] &&
                    o.screenshot && o.screenshot === o.subOrders[0].screenshot) {
                    const c = Object.assign({}, o);
                    delete c.screenshot;
                    c.__thumbFromSub = true;
                    return c;
                }
                return o;
            });
        }
        function unpackOrders(list) {
            list.forEach(o => {
                if (o && o.__thumbFromSub) {
                    o.screenshot = (o.subOrders && o.subOrders[0]) ? o.subOrders[0].screenshot : null;
                    delete o.__thumbFromSub;
                }
            });
            return list;
        }

        async function initStorage() {
            try {
                idbInstance = await openOrdersDB();
                idbAvailable = true;
            } catch (e) {
                console.warn('IndexedDB tidak bisa dipakai, pakai localStorage', e);
                idbAvailable = false;
            }

            // Minta browser agar data tidak dihapus otomatis saat ruang HP menipis.
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

            if (!idbAvailable) { loadFromLocalStorage(); return; }

            let stored = null;
            try { stored = await idbGet(ORDERS_KEY); } catch (e) { console.warn(e); }

            let lsList = null;
            try {
                const raw = localStorage.getItem(LS_ORDERS_KEY);
                if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) lsList = p; }
            } catch (e) {}

            if (Array.isArray(stored)) {
                ordersList = unpackOrders(stored);
                if (lsList && lsList.length) {
                    // data lama di localStorage yang belum ada di IndexedDB -> gabungkan
                    const ids = new Set(ordersList.map(o => o.id));
                    lsList.forEach(o => { if (o && !ids.has(o.id)) ordersList.push(o); });
                    ordersList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                }
            } else {
                ordersList = lsList || [];
            }

            // Migrasi: pastikan sudah tertulis di IndexedDB, baru hapus salinan localStorage
            if (lsList) {
                try {
                    await idbPut(ORDERS_KEY, packOrders(ordersList));
                    localStorage.removeItem(LS_ORDERS_KEY);
                } catch (e) { console.warn('Migrasi gagal, data lama tetap di localStorage', e); }
            }
        }

        function loadFromLocalStorage() {
            try {
                const saved = localStorage.getItem(LS_ORDERS_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    ordersList = Array.isArray(parsed) ? parsed : [];
                } else {
                    ordersList = [];
                }
            } catch (e) {
                ordersList = [];
            }
        }

        function reportSaveFailure(e) {
            console.error('Gagal menyimpan data pesanan', e);
            const now = Date.now();
            if (now - lastSaveErrorToastAt < 4000) return;
            lastSaveErrorToastAt = now;
            showToast('⚠️ Data GAGAL tersimpan (penyimpanan penuh). Segera Backup lalu kurangi/hapus pesanan lama!', 'rose');
        }

        // Nama fungsi dipertahankan agar semua pemanggil lama tetap jalan.
        function saveToLocalStorage() {
            if (idbAvailable) {
                // Antrian: tulisan selalu berurutan, dan tiap tulis memakai kondisi ordersList TERBARU.
                saveQueue = saveQueue
                    .then(() => idbPut(ORDERS_KEY, packOrders(ordersList)))
                    .catch(reportSaveFailure);
            } else {
                try {
                    localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(ordersList));
                } catch (e) {
                    reportSaveFailure(e);
                }
            }
        }

        // Kompres screenshot untuk DISIMPAN (lebih kecil dari versi yang dikirim ke AI).
        function makeStorageImage(rawImg) {
            const maxDim = 1000;
            let w = rawImg.width, h = rawImg.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(rawImg, 0, 0, w, h);
            return c.toDataURL('image/jpeg', 0.7);
        }

        // ============================================================
        // AUTO-BERSIH SCREENSHOT LAMA (> 60 hari) + INDIKATOR KAPASITAS
        // Yang dihapus hanya gambarnya (diganti placeholder kecil); data
        // pesanan, pendapatan & statistik tidak berubah.
        // ============================================================
        const SCREENSHOT_RETENTION_DAYS = 60;

        function hasRealScreenshot(src) {
            return !!src && !String(src).startsWith('data:image/svg+xml');
        }

        let _purgedPlaceholderCache = null;
        function makePurgedPlaceholder() {
            if (_purgedPlaceholderCache) return _purgedPlaceholderCache;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
                <rect width="400" height="300" fill="#f1f5f9"/>
                <text x="200" y="140" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="#64748b">Screenshot tidak tersedia</text>
                <text x="200" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#94a3b8">Dibersihkan otomatis / tidak ikut backup ringan</text>
            </svg>`;
            _purgedPlaceholderCache = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            return _purgedPlaceholderCache;
        }

        function getOrderTs(o) {
            const t = Number(o.timestamp);
            if (t && !isNaN(t)) return t;
            const d = new Date(o.timestamp).getTime();
            return isNaN(d) ? 0 : d;
        }

        function purgeOldScreenshots() {
            const cutoff = Date.now() - SCREENSHOT_RETENTION_DAYS * 86400000;
            let count = 0;
            ordersList.forEach(o => {
                const ts = getOrderTs(o);
                if (!ts || ts >= cutoff) return;
                if (hasRealScreenshot(o.screenshot)) { o.screenshot = makePurgedPlaceholder(); count++; }
                if (Array.isArray(o.subOrders)) {
                    o.subOrders.forEach(s => {
                        if (hasRealScreenshot(s.screenshot)) { s.screenshot = makePurgedPlaceholder(); count++; }
                    });
                }
            });
            if (count > 0) saveToLocalStorage();
            return count;
        }

        function formatBytes(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
            if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        }

        async function updateStorageIndicator() {
            const $ = id => document.getElementById(id);
            if (!$('storage-bar')) return;

            // Hitung isi data aplikasi sendiri (perkiraan, gambar base64 ~ 0,75 byte/karakter)
            let shots = 0, imgChars = 0;
            const countShot = s => { if (hasRealScreenshot(s)) { shots++; imgChars += String(s).length; } };
            ordersList.forEach(o => {
                if (Array.isArray(o.subOrders) && o.subOrders.length) o.subOrders.forEach(s => countShot(s.screenshot));
                else countShot(o.screenshot);
            });
            let textBytes = 0;
            try {
                textBytes = JSON.stringify(ordersList, (k, v) => (k === 'screenshot' ? undefined : v)).length;
            } catch (e) {}
            const appBytes = Math.round(imgChars * 0.75) + textBytes;

            $('storage-orders-count').innerText = ordersList.length;
            $('storage-shots-count').innerText = shots;
            $('storage-app-size').innerText = formatBytes(appBytes);

            let usage = appBytes, quota = 0;
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const est = await navigator.storage.estimate();
                    if (est.usage) usage = est.usage;
                    if (est.quota) quota = est.quota;
                }
            } catch (e) {}

            const bar = $('storage-bar'), badge = $('storage-status-badge'), text = $('storage-usage-text');
            if (quota > 0) {
                const pct = Math.min(100, (usage / quota) * 100);
                bar.style.width = Math.max(pct, usage > 0 ? 1.5 : 0) + '%';
                text.innerText = `Terpakai ${formatBytes(usage)} dari ${formatBytes(quota)} (${pct < 0.1 ? '<0,1' : pct.toFixed(1)}%)`;
                let level = ['bg-emerald-500', 'Aman', 'bg-emerald-50 text-emerald-600'];
                if (pct >= 90) level = ['bg-rose-500', 'Hampir penuh', 'bg-rose-50 text-rose-600'];
                else if (pct >= 80) level = ['bg-amber-500', 'Perlu dibersihkan', 'bg-amber-50 text-amber-600'];
                bar.className = `h-full ${level[0]} rounded-full transition-all duration-500`;
                badge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full ${level[2]}`;
                badge.innerText = level[1];
            } else {
                bar.style.width = '0%';
                text.innerText = `Data aplikasi ≈ ${formatBytes(appBytes)} (kapasitas browser tidak bisa dibaca)`;
                badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500';
                badge.innerText = 'Tidak diketahui';
            }
        }

        // ============================================================
        // BACKUP RINGAN (tanpa screenshot) — 7 / 14 / 30 hari terakhir
        // ============================================================
        const LIGHT_BACKUP_TIMESTAMP_KEY = 'drivertrack_last_light_backup';

        // ── Helper: Capacitor Filesystem + Share (Android) dengan fallback browser download ──
        async function _doNativeShareBackup(jsonStr, fileName, successMsg, shareTitle, shareText, dialogTitle) {
            const isNative = (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function')
                ? Capacitor.isNativePlatform()
                : (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

            if (isNative) {
                try {
                    const cap = (typeof Capacitor !== 'undefined' && Capacitor.Plugins)
                        ? Capacitor
                        : (window.Capacitor || {});
                    const Plugins = cap.Plugins || {};
                    const Filesystem = Plugins.Filesystem;
                    const Share = Plugins.Share;
                    const Directory = Plugins.Directory || { Cache: 'CACHE', Documents: 'DOCUMENTS' };
                    const Encoding = Plugins.Encoding || { UTF8: 'utf8' };

                    if (!Filesystem || !Share) {
                        throw new Error('Plugin Capacitor Filesystem atau Share tidak tersedia.');
                    }

                    // 1. Cek & Minta Izin Android
                    if (typeof Filesystem.checkPermissions === 'function') {
                        let perm = await Filesystem.checkPermissions();
                        if (perm && perm.publicStorage !== 'granted') {
                            if (typeof Filesystem.requestPermissions === 'function') {
                                perm = await Filesystem.requestPermissions();
                            }
                        }
                    }

                    // 2. Tulis File JSON ke Directory.Cache (untuk Share) dan Directory.Documents (untuk akses file user)
                    const targetDir = Directory.Cache || 'CACHE';
                    const targetEnc = Encoding.UTF8 || 'utf8';

                    await Filesystem.writeFile({
                        path: fileName,
                        data: jsonStr,
                        directory: targetDir,
                        encoding: targetEnc,
                        recursive: true
                    });

                    // Simpan salinan permanen ke Documents/DriverTrack/ agar terlihat di File Manager HP (bukan di /Android/data)
                    try {
                        await Filesystem.writeFile({
                            path: 'DriverTrack/' + fileName,
                            data: jsonStr,
                            directory: Directory.Documents || 'DOCUMENTS',
                            encoding: targetEnc,
                            recursive: true
                        });
                    } catch (docErr) {
                        console.warn('[Backup] Gagal salin ke Documents (abaikan):', docErr);
                    }

                    // 3. Dapatkan URI Asli File di Android
                    let fileUri = null;
                    if (typeof Filesystem.getUri === 'function') {
                        const uriRes = await Filesystem.getUri({
                            path: fileName,
                            directory: targetDir
                        });
                        fileUri = uriRes && uriRes.uri;
                    }

                    if (!fileUri) {
                        throw new Error('Gagal mendapatkan URI file dari Filesystem.');
                    }

                    // 4. Panggil Pop-up Share Native Android (WhatsApp, Drive, File, dll)
                    await Share.share({
                        title: shareTitle || 'Backup Data DriverTrack',
                        text: shareText || ('File backup data DriverTrack: ' + fileName),
                        url: fileUri,
                        dialogTitle: dialogTitle || 'Simpan ke Drive / Bagikan via WhatsApp'
                    });

                    showToast('Backup tersimpan di folder Documents/DriverTrack/ & siap dibagikan!', 'emerald');
                    return true;
                } catch (err) {
                    console.error('Error Backup:', err);
                    alert('Gagal Ekspor Backup: ' + (err.message || err));
                    if (typeof showToast === 'function') {
                        showToast('Gagal Ekspor Backup: ' + (err.message || err), 'rose');
                    }
                    throw err;
                }
            }

            // Fallback: Web Browser download
            try {
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1500);
                showToast(successMsg || 'Backup berhasil didownload di browser.', 'emerald');
                return true;
            } catch (err) {
                console.error('Error Download Backup Browser:', err);
                alert('Gagal Download Backup: ' + (err.message || err));
                throw err;
            }
        }
        window._doNativeShareBackup = _doNativeShareBackup;

        function exportLightData(days) {
            (async () => {
                try {
                    const cutoff = Date.now() - days * 86400000;
                    const subset = ordersList
                        .filter(o => getOrderTs(o) >= cutoff)
                        .map(o => {
                            const c = JSON.parse(JSON.stringify(Object.assign({}, o, { screenshot: null })));
                            c.screenshot = makePurgedPlaceholder();
                            if (Array.isArray(c.subOrders)) c.subOrders.forEach(s => { s.screenshot = makePurgedPlaceholder(); });
                            return c;
                        });

                    if (subset.length === 0) {
                        showToast(`Tidak ada pesanan dalam ${days} hari terakhir.`, 'amber');
                        return;
                    }

                    const now = new Date();
                    const payload = {
                        app: 'DriverTrack',
                        exportVersion: 2,
                        light: true,
                        rangeDays: days,
                        exportedAt: now.toISOString(),
                        profile: userProfile,
                        totalOrders: subset.length,
                        ordersList: subset
                    };
                    const limnasLight = (typeof collectLimnasBackup === 'function') ? collectLimnasBackup(days) : null;
                    if (limnasLight) payload.limnas = limnasLight;

                    const jsonStr = JSON.stringify(payload);
                    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const fileName = `drivertrack_backup_${dateStr}.json`;
                    const msg = `Backup ${days} hari: ${subset.length} pesanan${limnasLight ? ` + ${limnasLight.totalDays} hari Limnas` : ''} — siap dibagikan!`;

                    await _doNativeShareBackup(jsonStr, fileName, msg);
                    localStorage.setItem(LIGHT_BACKUP_TIMESTAMP_KEY, JSON.stringify({ at: now.toISOString(), days }));
                    updateLightBackupInfo();
                } catch (e) {
                    console.error(e);
                    showToast('Gagal membuat backup ringan.', 'rose');
                }
            })();
        }

        function updateLightBackupInfo() {
            const el = document.getElementById('last-light-backup-info');
            if (!el) return;
            try {
                const raw = localStorage.getItem(LIGHT_BACKUP_TIMESTAMP_KEY);
                if (!raw) { el.innerText = 'Belum pernah backup ringan.'; return; }
                const { at, days } = JSON.parse(raw);
                const f = new Date(at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                el.innerText = `Backup ringan terakhir: ${f} (${days} hari)`;
            } catch (e) { el.innerText = 'Belum pernah backup ringan.'; }
        }

        // Saat gabung (merge), jangan timpa screenshot asli dengan placeholder dari backup ringan.
        function mergeKeepScreenshots(incoming, existing) {
            if (!existing) return incoming;
            if (!hasRealScreenshot(incoming.screenshot) && hasRealScreenshot(existing.screenshot)) incoming.screenshot = existing.screenshot;
            if (Array.isArray(incoming.subOrders) && Array.isArray(existing.subOrders)) {
                incoming.subOrders.forEach((s, i) => {
                    const es = existing.subOrders[i];
                    if (es && !hasRealScreenshot(s.screenshot) && hasRealScreenshot(es.screenshot)) s.screenshot = es.screenshot;
                });
            }
            return incoming;
        }

        // ============================================================
        // 1.1 BACKUP & RESTORE MANUAL
        // Export/Import ordersList (termasuk restoCheckin/recipCheckin & profil)
        // sebagai file .json. Tidak merusak format lama.
        // ============================================================
        const BACKUP_TIMESTAMP_KEY = 'drivertrack_last_backup';
        let pendingImportOrders = null;
        let pendingImportProfile = null;
        let pendingImportLight = false;

        function exportData() {
            (async () => {
                try {
                    const payload = {
                        app: 'DriverTrack',
                        exportVersion: 2,
                        exportedAt: new Date().toISOString(),
                        profile: userProfile,
                        totalOrders: ordersList.length,
                        ordersList: ordersList
                    };
                    // Limnas (riwayat rute & km harian) ikut di backup pribadi
                    const limnasBackup = (typeof collectLimnasBackup === 'function') ? collectLimnasBackup() : null;
                    let jsonStr;
                    if (limnasBackup) {
                        jsonStr = JSON.stringify(Object.assign({}, payload, { limnas: '__LIMNAS__' }), null, 2);
                        const at = jsonStr.lastIndexOf('"__LIMNAS__"');
                        jsonStr = jsonStr.slice(0, at) + JSON.stringify(limnasBackup) + jsonStr.slice(at + '"__LIMNAS__"'.length);
                    } else {
                        jsonStr = JSON.stringify(payload, null, 2);
                    }

                    const now = new Date();
                    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const fileName = `drivertrack_backup_${dateStr}.json`;
                    const msg = `Backup berhasil: ${ordersList.length} pesanan${limnasBackup ? ` + ${limnasBackup.totalDays} hari Limnas` : ''} — siap dibagikan!`;

                    await _doNativeShareBackup(jsonStr, fileName, msg);
                    localStorage.setItem(BACKUP_TIMESTAMP_KEY, now.toISOString());
                    updateBackupWarningUI();
                } catch (e) {
                    console.error(e);
                    showToast('Gagal export data. Coba lagi.', 'rose');
                }
            })();
        }

        // ============================================================
        // SHARE BACKUP — Web Share API dengan fallback download
        // Menggunakan navigator.share({ files }) untuk berbagi file JSON
        // langsung ke WhatsApp, Google Drive, dll.
        // Fallback: download otomatis jika browser tidak mendukung file sharing.
        // ============================================================
        function shareBackupData() {
            (async () => {
                const btn = document.getElementById('btn-share-backup');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...';
                }
                try {
                    // ── 1. Susun payload JSON (sama seperti exportData, tanpa screenshot besar) ──
                    const payload = {
                        app: 'DriverTrack',
                        exportVersion: 2,
                        exportedAt: new Date().toISOString(),
                        profile: userProfile,
                        totalOrders: ordersList.length,
                        ordersList: ordersList
                    };
                    const limnasBackup = (typeof collectLimnasBackup === 'function') ? collectLimnasBackup() : null;
                    let jsonStr;
                    if (limnasBackup) {
                        jsonStr = JSON.stringify(Object.assign({}, payload, { limnas: '__LIMNAS__' }), null, 2);
                        const at = jsonStr.lastIndexOf('"__LIMNAS__"');
                        jsonStr = jsonStr.slice(0, at) + JSON.stringify(limnasBackup) + jsonStr.slice(at + '"__LIMNAS__"'.length);
                    } else {
                        jsonStr = JSON.stringify(payload, null, 2);
                    }

                    const now = new Date();
                    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const fileName = `drivertrack_backup_${dateStr}.json`;

                    // ── 2. Cek apakah di aplikasi Capacitor Native Android ──
                    const isNative = (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function')
                        ? Capacitor.isNativePlatform()
                        : (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

                    if (isNative) {
                        const msg = `Backup berhasil: ${ordersList.length} pesanan${limnasBackup ? ` + ${limnasBackup.totalDays} hari Limnas` : ''} — siap dibagikan!`;
                        await _doNativeShareBackup(jsonStr, fileName, msg, 'Backup DriverTrack', `File backup data pesanan DriverTrack (${ordersList.length} pesanan)`, 'Bagikan Backup via WhatsApp / Drive');
                        localStorage.setItem(BACKUP_TIMESTAMP_KEY, now.toISOString());
                        updateBackupWarningUI();
                        return;
                    }

                    // ── 3. Di Web Browser: Bungkus JSON menjadi File object ──
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const file = new File([blob], fileName, { type: 'application/json' });

                    // Cek apakah browser mendukung Web Share API dengan file
                    const canShareFiles = (
                        typeof navigator.share === 'function' &&
                        typeof navigator.canShare === 'function' &&
                        navigator.canShare({ files: [file] })
                    );

                    if (canShareFiles) {
                        // ── 4a. Gunakan Web Share API browser ──
                        await navigator.share({
                            files: [file],
                            title: 'Backup DriverTrack',
                            text: `File backup data pesanan DriverTrack — ${ordersList.length} pesanan${limnasBackup ? ` + ${limnasBackup.totalDays} hari Limnas` : ''}`
                        });
                        showToast('Backup berhasil dibagikan!', 'emerald');
                        localStorage.setItem(BACKUP_TIMESTAMP_KEY, now.toISOString());
                        updateBackupWarningUI();
                    } else {
                        // ── 4b. Fallback: download otomatis jika sharing tidak didukung ──
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 1500);
                        showToast('File diunduh (Sharing tidak didukung browser ini)', 'amber');
                        localStorage.setItem(BACKUP_TIMESTAMP_KEY, now.toISOString());
                        updateBackupWarningUI();
                    }
                } catch (e) {
                    // Abaikan error jika user membatalkan dialog share
                    if (e && e.name === 'AbortError') {
                        showToast('Share dibatalkan.', 'amber');
                    } else {
                        console.error('[ShareBackup] Error:', e);
                        showToast('Gagal share backup. Coba lagi.', 'rose');
                    }
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share Backup';
                    }
                }
            })();
        }

        function handleImportFile(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                let parsed;
                try {
                    parsed = JSON.parse(e.target.result);
                } catch (err) {
                    showToast("File bukan JSON valid.", "rose");
                    event.target.value = '';
                    return;
                }

                let candidateList = null;
                pendingImportLight = !!(parsed && !Array.isArray(parsed) && parsed.light);
                if (Array.isArray(parsed)) {
                    candidateList = parsed;
                    pendingImportProfile = null;
                } else if (parsed && Array.isArray(parsed.ordersList)) {
                    candidateList = parsed.ordersList;
                    pendingImportProfile = (parsed.profile && typeof parsed.profile === 'object') ? parsed.profile : null;
                }

                if (!candidateList) {
                    showToast("Struktur file tidak dikenali (bukan backup DriverTrack).", "rose");
                    event.target.value = '';
                    return;
                }

                // Validasi minimal: setiap item harus punya id, timestamp, category.
                const invalidCount = candidateList.filter(o => !o || !o.id || !o.timestamp || !o.category).length;
                if (candidateList.length === 0 || invalidCount === candidateList.length) {
                    showToast("File tidak berisi data pesanan yang valid.", "rose");
                    event.target.value = '';
                    return;
                }

                pendingImportOrders = candidateList;
                window.__pendingImportLimnas = (!Array.isArray(parsed) && parsed.limnas && typeof parseLimnasBackup === 'function') ? parseLimnasBackup(parsed.limnas) : null;
                document.getElementById('import-modal-desc').innerText =
                    `File valid, berisi ${candidateList.length} pesanan${invalidCount > 0 ? ` (${invalidCount} item terlewati karena tidak lengkap)` : ''}${pendingImportProfile ? ' & profil driver' : ''}.${pendingImportLight ? ' Ini backup ringan (tanpa screenshot) — disarankan pilih GABUNG agar screenshot yang ada tidak hilang.' : ''}`;
                if (window.__pendingImportLimnas) document.getElementById('import-modal-desc').innerText += describeLimnasBackup(window.__pendingImportLimnas) + ' ikut dipulihkan.';
                document.getElementById('import-modal').classList.remove('hidden');
                event.target.value = '';
            };
            reader.onerror = function() {
                showToast("Gagal membaca file.", "rose");
                event.target.value = '';
            };
            reader.readAsText(file);
        }

        function closeImportModal() {
            document.getElementById('import-modal').classList.add('hidden');
            pendingImportOrders = null;
            pendingImportProfile = null;
            window.__pendingImportLimnas = null;
        }

        function confirmImport(mode) {
            if (!pendingImportOrders) return;

            const validIncoming = pendingImportOrders.filter(o => o && o.id && o.timestamp && o.category);

            if (mode === 'overwrite') {
                ordersList = validIncoming;
            } else {
                // merge: item dengan id yang sama akan ditimpa oleh versi dari file import,
                // item baru ditambahkan. restoCheckin/recipCheckin ikut terbawa apa adanya.
                const existingById = {};
                ordersList.forEach(o => { existingById[o.id] = o; });
                validIncoming.forEach(o => { existingById[o.id] = mergeKeepScreenshots(o, existingById[o.id]); });
                ordersList = Object.values(existingById).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }

            if (pendingImportProfile && pendingImportProfile.name) {
                userProfile = {
                    name: String(pendingImportProfile.name || '').slice(0, 30),
                    photo: pendingImportProfile.photo || null,
                    driverTypes: Array.isArray(pendingImportProfile.driverTypes) ? pendingImportProfile.driverTypes : [],
                    otherType: pendingImportProfile.otherType || ''
                };
                saveUserProfile(userProfile);
            }

            // Limnas: hanya menulis kunci drivertrack_track_YYYY-MM-DD; hari lokal yang tidak ada di file tidak dihapus.
            let limnasMsg = '';
            if (window.__pendingImportLimnas && typeof restoreLimnasBackup === 'function') {
                const lr = restoreLimnasBackup(window.__pendingImportLimnas, mode);
                const done = lr.restored + lr.merged;
                if (done > 0) limnasMsg = ` Limnas: ${done} hari dipulihkan.`;
                if (lr.failed > 0) limnasMsg += ` (${lr.failed} hari gagal disimpan, penyimpanan penuh)`;
            }

            saveToLocalStorage();
            renderAllViews();
            updateStorageIndicator();
            closeImportModal();
            showToast(`Import berhasil (${mode === 'overwrite' ? 'timpa' : 'gabung'}): ${validIncoming.length} pesanan diproses.${limnasMsg}`, "emerald");
        }

        function updateBackupWarningUI() {
            const banner = document.getElementById('backup-warning-banner');
            const info = document.getElementById('last-backup-info');
            const lastBackupStr = localStorage.getItem(BACKUP_TIMESTAMP_KEY);

            if (!lastBackupStr) {
                banner.classList.remove('hidden');
                document.getElementById('backup-warning-title').innerText = 'Data belum pernah di-backup';
                document.getElementById('backup-warning-desc').innerText = 'Amankan data pesananmu dengan export ke file JSON.';
                info.innerText = 'Belum pernah backup.';
                return;
            }

            const lastBackup = new Date(lastBackupStr);
            const diffDays = Math.floor((Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24));
            const formatted = lastBackup.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            info.innerText = `Backup terakhir: ${formatted}`;

            if (diffDays > 7) {
                banner.classList.remove('hidden');
                document.getElementById('backup-warning-title').innerText = `Sudah ${diffDays} hari belum backup`;
                document.getElementById('backup-warning-desc').innerText = 'Data berisiko hilang. Export sekarang untuk amankan pesananmu.';
            } else {
                banner.classList.add('hidden');
            }
        }

        function switchTab(tab) {
            activeTab = tab;
            ['dashboard', 'orders', 'upload', 'insights', 'profile'].forEach(t => {
                const el = document.getElementById(`tab-${t}`);
                const btn = document.getElementById(`nav-btn-${t}`);
                if (t === tab) {
                    el.classList.remove('hidden');
                    if (btn) {
                        btn.className = "flex flex-col items-center gap-1 text-indigo-600 font-extrabold w-14 transition";
                    }
                } else {
                    el.classList.add('hidden');
                    if (btn) {
                        btn.className = "flex flex-col items-center gap-1 text-slate-400 font-medium hover:text-slate-600 w-14 transition";
                    }
                }
            });

            if (tab === 'insights') {
                renderInsightsView();
            }
            if (tab === 'profile') {
                updateBackupWarningUI();
                loadFuelRateIntoSettingInput();
                updateStorageIndicator();
                updateLightBackupInfo();
                if (window.syncThemeButtons) window.syncThemeButtons();
                if (window.syncNotifPrefs) window.syncNotifPrefs();
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function onCategoryChange() {
            const cat = document.getElementById('form-category').value;
            const fieldsContainer = document.getElementById('category-specific-fields');
            const labelPengirim = document.getElementById('label-pengirim-title');

            if (cat === 'Food') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-utensils"></i> Data Resto / Pengirim`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Code Orderan *</label>
                            <input type="text" id="form-codeorder" placeholder="Contoh: #782" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan *</label>
                            <input type="text" id="form-orderno" placeholder="325241133197056..." class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Total Menu / Rincian Barang *</label>
                        <input type="text" id="form-totalmenu" placeholder="Contoh: 1 x Bakmi Goreng (Total 1 menu)" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none">
                    </div>`;
            } else if (cat === 'SPX') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-box"></i> Data Pengirim SPX (Toko / Agen)`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kode Pesanan *</label>
                            <input type="text" id="form-codeorder" placeholder="#4N73" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label>
                            <input type="text" id="form-weight" placeholder="1.5 kg" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Besar Barang</label>
                            <input type="text" id="form-dimensions" placeholder="0x0x0 cm" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>`;
                const pf = document.getElementById('form-platform');
                if (pf) pf.value = 'SPX';
            } else if (cat === 'Instan') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-bolt"></i> Data Pengirim SPX Instan`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kategori Barang</label>
                            <input type="text" id="form-itemcategory" placeholder="Makanan / Paket" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label>
                            <input type="text" id="form-weight" placeholder="1.0 kg" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan Instan *</label>
                        <input type="text" id="form-orderno" placeholder="3248025614224384096" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                    </div>`;
            }
        }

        function updatePaymentMethodFromAmount() {
            const amount = parseFloat(document.getElementById('form-cashamount').value) || 0;
            const paymentSelect = document.getElementById('form-payment');
            if (amount > 0) {
                paymentSelect.value = 'Tunai';
            } else {
                paymentSelect.value = 'Non-Tunai';
            }
        }
