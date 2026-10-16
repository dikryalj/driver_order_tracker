// ============================================================
// DRIVERTRACK INTERACTIVE PRODUCT TOUR (DRIVER.JS)
// ============================================================

(function() {
    const TOUR_STORAGE_KEY = 'drivertrack_first_tour_done';
    const DETAIL_TOUR_KEY = 'drivertrack_detail_tour_done';
    const ORDERS_TOUR_KEY = 'drivertrack_orders_tour_done';
    const MAPS_RESTO_TOUR_KEY = 'drivertrack_maps_resto_tour_done';

    window.isTourActive = false;
    window.currentDriverInstance = null;

    function isDriverJsReady() {
        return !!(window.driver && window.driver.js && typeof window.driver.js.driver === 'function');
    }

    function cleanupActiveDriver() {
        if (window.currentDriverInstance) {
            try { window.currentDriverInstance.destroy(); } catch(e){}
            window.currentDriverInstance = null;
        }
        window.isTourActive = false;
    }

    // Scroll otomatis agar elemen yang disorot selalu berada di tengah safe area
    // (tidak tertutup bottom navigation bar atau header sticky)
    function scrollElementIntoSafeView(element) {
        if (!element) return;
        try {
            // Jangan scroll jika elemen berada di dalam fixed bottom nav
            if (element.closest && element.closest('nav.fixed')) return;

            const rect = element.getBoundingClientRect();
            const topHeader = document.querySelector('header') ? document.querySelector('header').offsetHeight : 60;
            const navBar = document.querySelector('nav.fixed.bottom-0');
            const bottomNavHeight = navBar ? navBar.offsetHeight + 28 : 88;

            const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
            const elAbsoluteTop = rect.top + currentScrollY;
            const elHeight = rect.height;

            // Safe viewable height between top header and bottom nav
            const safeViewHeight = window.innerHeight - topHeader - bottomNavHeight;

            // Target scroll agar elemen berada di tengah-tengah area pandang aman
            let targetScrollY = elAbsoluteTop - topHeader - Math.max(15, (safeViewHeight - elHeight) / 2);
            targetScrollY = Math.max(0, Math.round(targetScrollY));

            // Cek apakah elemen saat ini terhalang bottom nav atau header
            const isCutOffBottom = (rect.bottom > window.innerHeight - bottomNavHeight);
            const isCutOffTop = (rect.top < topHeader + 10);

            if (isCutOffBottom || isCutOffTop) {
                window.scrollTo({
                    top: targetScrollY,
                    behavior: 'smooth'
                });
            }
        } catch(e) {
            console.warn('[DriverTour] scrollElementIntoSafeView error:', e);
        }
    }

    function updateTourStatusBadge() {
        const badge = document.getElementById('tour-status-badge');
        if (!badge) return;
        const isDone = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
        if (isDone) {
            badge.className = 'text-[9.5px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 uppercase tracking-wider';
            badge.innerHTML = '<i class="fa-solid fa-check text-[9px] mr-0.5"></i> Selesai Dipelajari';
        } else {
            badge.className = 'text-[9.5px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 uppercase tracking-wider';
            badge.innerText = 'Siap Diputar';
        }
    }

    function maybeStartFirstTimeTour() {
        try {
            if (window.isTourActive) return;
            if (localStorage.getItem(TOUR_STORAGE_KEY) === 'true') return;
            // Jika modal onboarding sedang terbuka/aktif di layar, tunda agar tidak bertabrakan
            const onboardingScreen = document.getElementById('onboarding-screen');
            if (onboardingScreen && !onboardingScreen.classList.contains('hidden') && onboardingScreen.style.display !== 'none') {
                return;
            }
            if (!isDriverJsReady()) return;

            startAppTour();
        } catch (e) {
            console.warn('[DriverTour] maybeStartFirstTimeTour error:', e);
        }
    }

    function startAppTour() {
        try {
            if (!isDriverJsReady()) {
                if (typeof showToast === 'function') {
                    showToast('Fitur panduan memerlukan akses internet/CDN Driver.js.', 'amber');
                }
                return;
            }

            cleanupActiveDriver();
            window.isTourActive = true;

            // Pindahkan tab ke dashboard & scroll ke atas jika belum di dashboard
            if (typeof activeTab !== 'undefined' && activeTab !== 'dashboard' && typeof switchTab === 'function') {
                switchTab('dashboard');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(() => {
                const driverObj = window.driver.js.driver({
                    showProgress: true,
                    animate: true,
                    allowClose: true,
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                    stagePadding: 6,
                    stageRadius: 16,
                    nextBtnText: 'Lanjut →',
                    prevBtnText: '← Kembali',
                    doneBtnText: 'Selesai ✓',
                    progressText: 'Langkah {{current}} dari {{total}}',
                    onHighlightStarted: (element, step) => {
                        scrollElementIntoSafeView(element);
                        setTimeout(() => {
                            if (window.currentDriverInstance && typeof window.currentDriverInstance.refresh === 'function') {
                                window.currentDriverInstance.refresh();
                            }
                        }, 240);
                    },
                    onDestroyStarted: () => {
                        cleanupActiveDriver();
                    },
                    onDestroyed: () => {
                        cleanupActiveDriver();
                        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
                        updateTourStatusBadge();
                    },
                    steps: [
                        {
                            element: '.purple-card-gradient',
                            popover: {
                                title: '🎯 Performa & Target Harian',
                                description: 'Pantau jumlah orderan hari ini, progres target harianmu, rata-rata order, dan jam paling ramai (Peak Hour) di kartu utama ini.',
                                side: 'bottom',
                                align: 'center'
                            }
                        },
                        {
                            element: '.grid:has(#finance-gross)',
                            popover: {
                                title: '💰 Kalkulator Bersih & BBM Otomatis',
                                description: 'Pendapatan kotor, potongan estimasi bensin (BBM) berdasarkan jarak kilometer rute, dan pendapatan bersihmu dihitung otomatis di sini.',
                                side: 'bottom',
                                align: 'center'
                            }
                        },
                        {
                            element: 'nav button[onclick="switchTab(\'upload\')"]',
                            popover: {
                                title: '✨ Scan Struk & Resi dengan AI',
                                description: 'Dapat orderan baru? Ketuk tombol (+) ini untuk upload screenshot orderan atau foto label paket. AI akan membaca alamat & nominal secara otomatis!',
                                side: 'top',
                                align: 'center'
                            }
                        },
                        {
                            element: '#nav-btn-insights',
                            popover: {
                                title: '📊 Jadwal & Analisis Jam Gacor',
                                description: 'Cek rekap progres harian/mingguan, grafik perbandingan pendapatan vs BBM, serta daftar resto paling sering order di menu Insights.',
                                side: 'top',
                                align: 'center'
                            }
                        },
                        {
                            element: '#nav-btn-profile',
                            popover: {
                                title: '🛡️ Peta Limnas, Tema & Backup Data',
                                description: 'Atur tarif BBM/km, aktifkan pelacak perjalanan harian (Peta Limnas), ganti Tema Tampilan, dan Backup rutin datamu di menu Profile.',
                                side: 'top',
                                align: 'center'
                            }
                        }
                    ]
                });

                window.currentDriverInstance = driverObj;
                driverObj.drive();
            }, 250);
        } catch (e) {
            window.isTourActive = false;
            console.warn('[DriverTour] startAppTour error:', e);
        }
    }

    function maybeStartOrdersTour() {
        try {
            if (window.isTourActive) return;
            if (localStorage.getItem(ORDERS_TOUR_KEY) === 'true') return;
            if (!isDriverJsReady()) return;
            window.isTourActive = true;
            setTimeout(() => {
                startOrdersTour();
            }, 400);
        } catch (e) {
            window.isTourActive = false;
            console.warn('[DriverTour] maybeStartOrdersTour error:', e);
        }
    }

    function startOrdersTour() {
        try {
            if (!isDriverJsReady()) {
                if (typeof showToast === 'function') {
                    showToast('Fitur panduan memerlukan akses internet/CDN Driver.js.', 'amber');
                }
                return;
            }

            cleanupActiveDriver();
            window.isTourActive = true;

            if (typeof activeTab !== 'undefined' && activeTab !== 'orders' && typeof switchTab === 'function') {
                switchTab('orders');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(() => {
                const searchEl = document.querySelector('#search-input');
                const rangeFilterEl = document.querySelector('#orders-date-filters') || document.querySelector('#filter-orders-today')?.closest('.flex');
                const catFilterEl = document.querySelector('#orders-select-filters') || document.querySelector('#filter-category-select')?.closest('.flex');
                const firstCardEl = document.querySelector('#orders-container .nxc, #orders-container .card-shadow') || document.querySelector('#empty-orders-state');

                const steps = [];

                if (searchEl) {
                    steps.push({
                        element: '#search-input',
                        popover: {
                            title: '🔍 Pencarian Cepat',
                            description: 'Ketik nama resto, penerima, alamat pengiriman, atau no. pesanan/resi untuk menyaring riwayat orderan dengan instan.',
                            side: 'bottom',
                            align: 'center'
                        }
                    });
                }

                if (rangeFilterEl) {
                    steps.push({
                        element: rangeFilterEl,
                        popover: {
                            title: '📅 Filter Rentang Tanggal',
                            description: 'Pilih rekap periode orderan: Hari Ini, 7 Hari, 14 Hari, 30 Hari, atau Semua riwayat pesanan yang pernah tercatat.',
                            side: 'bottom',
                            align: 'center'
                        }
                    });
                }

                if (catFilterEl) {
                    steps.push({
                        element: catFilterEl,
                        popover: {
                            title: '🏷️ Filter Kategori & Pembayaran',
                            description: 'Saring daftar berdasarkan jenis orderan (Food, SPX, Instan, Gabungan), platform, serta tipe pembayaran tunai/non-tunai.',
                            side: 'bottom',
                            align: 'center'
                        }
                    });
                }

                if (firstCardEl) {
                    steps.push({
                        element: firstCardEl,
                        popover: {
                            title: '📦 Kartu Pesanan & Rute',
                            description: 'Setiap kartu pesanan menampilkan status, nominal, dan foto. Ketuk tombol "Detail" untuk membuka peta rute & check-in resto, atau "Edit" untuk merubah data.',
                            side: 'top',
                            align: 'center'
                        }
                    });
                }

                if (!steps.length) {
                    window.isTourActive = false;
                    return;
                }

                const driverObj = window.driver.js.driver({
                    showProgress: true,
                    animate: true,
                    allowClose: true,
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                    stagePadding: 6,
                    stageRadius: 16,
                    nextBtnText: 'Lanjut →',
                    prevBtnText: '← Kembali',
                    doneBtnText: 'Selesai ✓',
                    progressText: 'Langkah {{current}} dari {{total}}',
                    onHighlightStarted: (element, step) => {
                        scrollElementIntoSafeView(element);
                        setTimeout(() => {
                            if (window.currentDriverInstance && typeof window.currentDriverInstance.refresh === 'function') {
                                window.currentDriverInstance.refresh();
                            }
                        }, 240);
                    },
                    onDestroyStarted: () => {
                        cleanupActiveDriver();
                    },
                    onDestroyed: () => {
                        cleanupActiveDriver();
                        localStorage.setItem(ORDERS_TOUR_KEY, 'true');
                    },
                    steps: steps
                });

                window.currentDriverInstance = driverObj;
                driverObj.drive();
            }, 300);
        } catch (e) {
            window.isTourActive = false;
            console.warn('[DriverTour] startOrdersTour error:', e);
        }
    }

    function startUploadTour() {
        try {
            if (!isDriverJsReady()) {
                if (typeof showToast === 'function') {
                    showToast('Fitur panduan memerlukan akses internet/CDN Driver.js.', 'amber');
                }
                return;
            }

            cleanupActiveDriver();
            window.isTourActive = true;

            if (typeof activeTab !== 'undefined' && activeTab !== 'upload' && typeof switchTab === 'function') {
                switchTab('upload');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(() => {
                const driverObj = window.driver.js.driver({
                    showProgress: true,
                    animate: true,
                    allowClose: true,
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                    stagePadding: 6,
                    stageRadius: 16,
                    nextBtnText: 'Lanjut →',
                    prevBtnText: '← Kembali',
                    doneBtnText: 'Selesai ✓',
                    progressText: 'Langkah {{current}} dari {{total}}',
                    onHighlightStarted: (element, step) => {
                        scrollElementIntoSafeView(element);
                        setTimeout(() => {
                            if (window.currentDriverInstance && typeof window.currentDriverInstance.refresh === 'function') {
                                window.currentDriverInstance.refresh();
                            }
                        }, 240);
                    },
                    onDestroyStarted: () => {
                        cleanupActiveDriver();
                    },
                    onDestroyed: () => {
                        cleanupActiveDriver();
                    },
                    steps: [
                        {
                            element: '#dropzone',
                            popover: {
                                title: '🖼️ Upload dari Galeri',
                                description: 'Ketuk atau seret gambar screenshot orderan ke area ini untuk upload cepat dari galeri HP.',
                                side: 'bottom',
                                align: 'center'
                            }
                        },
                        {
                            element: '#camera-wrap-main',
                            popover: {
                                title: '📷 Foto Langsung / AI Fusion',
                                description: 'Gunakan kamera langsung untuk memfoto resi fisik atau layar HP lain dengan pemindaian AI otomatis.',
                                side: 'bottom',
                                align: 'center'
                            }
                        },
                        {
                            element: '#form-category',
                            popover: {
                                title: '🏷️ Kategori & Orderan Gabungan',
                                description: 'Pilih jenis pesanan (Food, SPX, atau Instan). Kamu juga bisa menggabungkan beberapa pesanan dalam satu rute pengantaran.',
                                side: 'top',
                                align: 'center'
                            }
                        }
                    ]
                });

                window.currentDriverInstance = driverObj;
                driverObj.drive();
            }, 250);
        } catch (e) {
            window.isTourActive = false;
            console.warn('[DriverTour] startUploadTour error:', e);
        }
    }

    // ============================================================
    // PANDUAN PETA RESTO DIINGAT (MAPS RESTO)
    // ============================================================
    function maybeStartMapsRestoTour() {
        try {
            if (window.isTourActive) return;
            if (localStorage.getItem(MAPS_RESTO_TOUR_KEY) === 'true') return;
            if (!isDriverJsReady()) return;
            setTimeout(() => {
                startMapsRestoTour();
            }, 450);
        } catch (e) {
            console.warn('[DriverTour] maybeStartMapsRestoTour error:', e);
        }
    }

    function startMapsRestoTour() {
        try {
            if (!isDriverJsReady()) {
                if (typeof showToast === 'function') {
                    showToast('Fitur panduan memerlukan akses internet/CDN Driver.js.', 'amber');
                }
                return;
            }

            cleanupActiveDriver();
            window.isTourActive = true;

            // Buka modal maps resto jika belum terbuka
            const modal = document.getElementById('modal-maps-resto');
            if (modal && modal.classList.contains('hidden')) {
                if (typeof nxOpenMapsResto === 'function') {
                    nxOpenMapsResto();
                } else {
                    modal.classList.remove('hidden');
                }
            }

            setTimeout(() => {
                const searchEl = document.querySelector('#maps-resto-search');
                const centerBtn = document.querySelector('button[onclick="nxCenterCurrentLocation()"]');
                const catTabs = document.querySelector('#modal-maps-resto .overflow-x-auto') || document.querySelector('#tab-resto-all');
                const mapContainer = document.querySelector('#all-restos-map');

                const steps = [];

                if (searchEl) {
                    steps.push({
                        element: '#maps-resto-search',
                        popover: {
                            title: '🔍 Cari Resto / Toko',
                            description: 'Ketik nama resto atau toko untuk menemukan titik koordinat yang pernah tercatat.',
                            side: 'bottom',
                            align: 'center'
                        }
                    });
                }

                if (centerBtn) {
                    steps.push({
                        element: centerBtn,
                        popover: {
                            title: '📍 Pusatkan Posisi Saya',
                            description: 'Ketuk tombol ini untuk memusatkan tampilan peta ke koordinat lokasimu saat ini.',
                            side: 'bottom',
                            align: 'center'
                        }
                    });
                }

                if (catTabs) {
                    steps.push({
                        element: catTabs,
                        popover: {
                            title: '🍲 Kategori Food vs SPX',
                            description: 'Pilah titik resto antara pesanan makanan (Food) dan toko paket (SPX).',
                            side: 'bottom',
                            align: 'center'
                        }
                    });
                }

                if (mapContainer) {
                    steps.push({
                        element: mapContainer,
                        popover: {
                            title: '🗺️ Peta Resto Terkumpul',
                            description: 'Titik resto tersimpan otomatis setiap kamu check-in di resto. Titik dikelompokkan (cluster) agar peta tidak lag saat zoom out.',
                            side: 'top',
                            align: 'center'
                        }
                    });
                }

                if (!steps.length) {
                    window.isTourActive = false;
                    return;
                }

                const driverObj = window.driver.js.driver({
                    showProgress: true,
                    animate: true,
                    allowClose: true,
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                    stagePadding: 6,
                    stageRadius: 16,
                    nextBtnText: 'Lanjut →',
                    prevBtnText: '← Kembali',
                    doneBtnText: 'Selesai ✓',
                    progressText: 'Langkah {{current}} dari {{total}}',
                    onHighlightStarted: (element, step) => {
                        scrollElementIntoSafeView(element);
                        setTimeout(() => {
                            if (window.currentDriverInstance && typeof window.currentDriverInstance.refresh === 'function') {
                                window.currentDriverInstance.refresh();
                            }
                        }, 240);
                    },
                    onDestroyStarted: () => {
                        cleanupActiveDriver();
                    },
                    onDestroyed: () => {
                        cleanupActiveDriver();
                        localStorage.setItem(MAPS_RESTO_TOUR_KEY, 'true');
                    },
                    steps: steps
                });

                window.currentDriverInstance = driverObj;
                driverObj.drive();
            }, 350);
        } catch (e) {
            window.isTourActive = false;
            console.warn('[DriverTour] startMapsRestoTour error:', e);
        }
    }

    function maybeStartOrderDetailTour(order) {
        try {
            if (window.isTourActive) return;
            if (localStorage.getItem(DETAIL_TOUR_KEY) === 'true') return;
            if (!isDriverJsReady()) return;

            window.isTourActive = true;

            setTimeout(() => {
                const targetStep1 = (order && order.isCombined)
                    ? '#detail-combined-points-list'
                    : '#resto-checkin-box';

                const el1 = document.querySelector(targetStep1);
                const el2 = document.querySelector('#detail-map-container');
                if (!el1 || !el2) {
                    window.isTourActive = false;
                    return;
                }

                cleanupActiveDriver();
                window.isTourActive = true;

                const driverObj = window.driver.js.driver({
                    showProgress: true,
                    animate: true,
                    allowClose: true,
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                    stagePadding: 6,
                    stageRadius: 16,
                    nextBtnText: 'Lanjut →',
                    prevBtnText: '← Kembali',
                    doneBtnText: 'Paham ✓',
                    progressText: 'Langkah {{current}} dari {{total}}',
                    onHighlightStarted: (element, step) => {
                        scrollElementIntoSafeView(element);
                        setTimeout(() => {
                            if (window.currentDriverInstance && typeof window.currentDriverInstance.refresh === 'function') {
                                window.currentDriverInstance.refresh();
                            }
                        }, 240);
                    },
                    onDestroyStarted: () => {
                        cleanupActiveDriver();
                    },
                    onDestroyed: () => {
                        cleanupActiveDriver();
                        localStorage.setItem(DETAIL_TOUR_KEY, 'true');
                    },
                    steps: [
                        {
                            element: targetStep1,
                            popover: {
                                title: '📍 Check-In Titik GPS',
                                description: 'Wajib ketuk tombol "Checkin Sampai Lokasi" saat tiba di Resto atau titik Penerima agar koordinat GPS tercatat akurat dan rute tersimpan.',
                                side: 'bottom',
                                align: 'center'
                            }
                        },
                        {
                            element: '#detail-map-container',
                            popover: {
                                title: '🗺️ Peta Rute & Hitung Jarak',
                                description: 'Peta rute jalan interaktif dan kalkulasi jarak (km) akan otomatis muncul dan diperbarui setelah check-in dilakukan.',
                                side: 'top',
                                align: 'center'
                            }
                        }
                    ]
                });

                window.currentDriverInstance = driverObj;
                driverObj.drive();
            }, 400);
        } catch (e) {
            window.isTourActive = false;
            console.warn('[DriverTour] maybeStartOrderDetailTour error:', e);
        }
    }

    function replayMainTour() {
        try {
            cleanupActiveDriver();
            localStorage.removeItem(DETAIL_TOUR_KEY);
            localStorage.removeItem(ORDERS_TOUR_KEY);
            localStorage.removeItem(MAPS_RESTO_TOUR_KEY);
            if (typeof showToast === 'function') {
                showToast('Memulai ulang panduan aplikasi...', 'indigo');
            }
            startAppTour();
        } catch (e) {
            console.warn('[DriverTour] replayMainTour error:', e);
        }
    }

    // Expose ke scope window
    window.TOUR_STORAGE_KEY = TOUR_STORAGE_KEY;
    window.DETAIL_TOUR_KEY = DETAIL_TOUR_KEY;
    window.ORDERS_TOUR_KEY = ORDERS_TOUR_KEY;
    window.MAPS_RESTO_TOUR_KEY = MAPS_RESTO_TOUR_KEY;
    window.startAppTour = startAppTour;
    window.startOrdersTour = startOrdersTour;
    window.maybeStartOrdersTour = maybeStartOrdersTour;
    window.startUploadTour = startUploadTour;
    window.startMapsRestoTour = startMapsRestoTour;
    window.maybeStartMapsRestoTour = maybeStartMapsRestoTour;
    window.maybeStartFirstTimeTour = maybeStartFirstTimeTour;
    window.maybeStartOrderDetailTour = maybeStartOrderDetailTour;
    window.replayMainTour = replayMainTour;
    window.updateTourStatusBadge = updateTourStatusBadge;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateTourStatusBadge);
    } else {
        updateTourStatusBadge();
    }
})();
