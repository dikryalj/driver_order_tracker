        // Global App State & Map Variables
        let ordersList = [];
        let activeTab = 'dashboard';
        let activeFilterDays = 7; // 7, 30, 'all'
        let activeCategory = 'ALL'; // ALL, Food, SPX, Instan
        let uploadedImageDataUrl = null;

        // Map State Variables
        let leafletMapInstance = null;
        let mapRestoCoords = null;
        let mapRecipCoords = null;
        let mapRestoMarker = null;
        let mapRecipMarker = null;
        let mapPolyline = null;

        // Charts
        let chartHoursInstance = null;
        let chartRestosInstance = null;
        let chartPlatformInstance = null;
        let chartComparisonInstance = null;

        // Profile
        const PROFILE_STORAGE_KEY = 'drivertrack_profile';
        let userProfile = { name: '', photo: null, driverTypes: [], otherType: '' };
        let editProfileSelectedTypes = [];
        let editProfileTempPhoto = null; // base64 atau null

        // Area Coordinates Database (Solo Raya & Central Java Districts)
        const AREA_COORDINATES_DB = {
            'kartasura': [-7.5583, 110.7412],
            'wirogunan': [-7.5542, 110.7485],
            'kertonatan': [-7.5610, 110.7320],
            'baturan': [-7.5531, 110.7850],
            'laweyan': [-7.5590, 110.7920],
            'colomadu': [-7.5320, 110.7550],
            'ngasem': [-7.5380, 110.7510],
            'mojosongo': [-7.5412, 110.8350],
            'jebres': [-7.5580, 110.8420],
            'pabelan': [-7.5560, 110.7680],
            'ngabeyan': [-7.5630, 110.7390],
            'surakarta': [-7.5666, 110.8166],
            'solo': [-7.5666, 110.8166],
            'sukoharjo': [-7.6800, 110.8300],
            'klaten': [-7.6150, 110.7020],
            'wonosari': [-7.6200, 110.7100],
            'karanganyar': [-7.5978, 110.9525],
            'boyolali': [-7.5333, 110.5961],
            'grogol': [-7.6000, 110.8160],
            'solo baru': [-7.6050, 110.8190],
            'gentan': [-7.5750, 110.7880]
        };

        // Kotak batas wilayah Solo Raya (Solo, Sukoharjo, Karanganyar, Boyolali, Klaten, Wonogiri).
        // Semua hasil Nominatim WAJIB berada di dalam kotak ini — kalau tidak, hasilnya ditolak.
        // Ini mencegah kasus seperti "Jalan Diponegoro" yang tertukar dengan jalan bernama sama
        // di kota lain (mis. Tegal/Pemalang) sehingga pin melompat jauh dari Solo Raya.
        const SOLO_RAYA_BOUNDS = { minLat: -7.90, maxLat: -7.35, minLon: 110.50, maxLon: 111.05 };

        function isWithinSoloRaya(lat, lon) {
            return lat >= SOLO_RAYA_BOUNDS.minLat && lat <= SOLO_RAYA_BOUNDS.maxLat &&
                   lon >= SOLO_RAYA_BOUNDS.minLon && lon <= SOLO_RAYA_BOUNDS.maxLon;
        }

        // Titik akurat yang sudah diverifikasi manual lewat Google Maps (nama tempat -> [lat, lon]).
        // Dicek PALING PERTAMA sebelum geocoding online, karena Nominatim/OSM seringkali salah
        // menebak toko/warung kecil (data OSM di gang-gang kecil Solo Raya masih minim).
        // Tambahkan entri baru di sini kapan pun titik sebuah tempat ternyata meleset —
        // kuncinya cukup kata unik dari nama tempat itu, huruf kecil semua, tidak perlu alamat lengkap.
        const KNOWN_PLACES_DB = {
            'dalmanto': [-7.5492439, 110.7133932] // Toko Dalmanto / Toko Bu Dalmanto, Jl. Kranggan, Wirogunan
        };

        function getKnownPlaceCoords(addressStr) {
            const clean = (addressStr || '').toLowerCase();
            for (const key of Object.keys(KNOWN_PLACES_DB)) {
                if (clean.includes(key)) {
                    const [lat, lon] = KNOWN_PLACES_DB[key];
                    return { lat, lon };
                }
            }
            return null;
        }

        function updatePreload(percent, text) {
            const bar = document.getElementById('preload-progress-bar');
            const pct = document.getElementById('preload-percent');
            const stat = document.getElementById('preload-status-text');
            if (bar) bar.style.width = `${percent}%`;
            if (pct) pct.innerText = `${percent}%`;
            if (stat && text) {
                stat.innerHTML = percent < 100 
                    ? `<i class="fa-solid fa-circle-notch fa-spin preload-accent-color text-xs flex-shrink-0"></i> <span class="truncate">${text}</span>`
                    : `<i class="fa-solid fa-circle-check preload-accent-color text-xs flex-shrink-0"></i> <span class="truncate">${text}</span>`;
            }
        }

        function dismissPreload() {
            const screen = document.getElementById('app-preload-screen');
            if (!screen || screen.dataset.dismissed) return;
            screen.dataset.dismissed = 'true';
            updatePreload(100, 'Siap mengaspal! 🚀');
            setTimeout(() => {
                screen.classList.add('opacity-0', 'pointer-events-none', '-translate-y-4');
                setTimeout(() => {
                    screen.style.display = 'none';
                    if (typeof checkAndTriggerOnboarding === 'function') {
                        checkAndTriggerOnboarding();
                    }
                }, 700);
            }, 350);
        }

        window.onload = async function() {
            updatePreload(25, 'Memuat data profil driver...');
            loadUserProfile();
            
            updatePreload(50, 'Menyiapkan database lokal...');
            await initStorage();
            
            updatePreload(75, 'Memeriksa screenshot & performa...');
            const purged = purgeOldScreenshots();
            if (purged > 0) setTimeout(() => showToast(`🧹 ${purged} screenshot lama (>${SCREENSHOT_RETENTION_DAYS} hari) dibersihkan. Data pesanan tetap aman.`, 'indigo'), 600);
            initInsightsDate();
            onCategoryChange();
            
            updatePreload(90, 'Menyusun ringkasan pesanan...');
            renderAllViews();
            updateBackupWarningUI();
            updateLightBackupInfo();
            updateStorageIndicator();
            loadFuelRateIntoSettingInput();
            updateGrokKeyUI();
            
            updatePreload(100, 'Siap mengaspal! 🚀');
            dismissPreload();
        };

        // Fallback pengaman agar preload pasti tertutup setelah maksimal 2.5 detik
        setTimeout(() => dismissPreload(), 2500);

        // Data CONTOH murni fiktif untuk fitur "Muat data contoh" di Settings.
        // Semua nama/alamat di bawah ini SENGAJA dibuat generik (bukan nama
        // orang/alamat asli) supaya kalau file ini di-inspect/dibedah siapa pun,
        // langsung jelas ini cuma placeholder demo — bukan data pelanggan nyata.
        // Data asli yang diinput user TIDAK PERNAH ditulis ke file ini; semua
        // tersimpan di localStorage browser masing-masing user, terpisah total
        // dari source code ini.
        function getInitialMockOrders() {
            return [
                {
                    id: 'ord-contoh-101',
                    category: 'Food',
                    platform: 'ShopeeFood',
                    orderIncome: 11000,
                    manualFuelCost: null,
                    restoName: 'Contoh Warung Makan A',
                    restoAddr: 'Jalan Contoh Raya No. 1, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    recipName: 'Pelanggan Contoh 1',
                    recipAddr: 'Jalan Contoh Dua No. 2, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    notes: 'Contoh catatan: rumah cat hijau, dekat gapura',
                    codeOrder: '#CONTOH1',
                    totalMenu: '1 x Menu Contoh (Rp22.000) - Total 1 menu',
                    orderNo: '0000000000000000001',
                    cashAmount: 0,
                    payment: 'Non-Tunai',
                    orderTime: '2026-09-08T21:04',
                    timestamp: new Date('2026-09-08T21:04').getTime(),
                    screenshot: createSVGPlaceholder('Contoh Warung Makan A', '#CONTOH1', 'Food (Non-Tunai)')
                },
                {
                    id: 'ord-contoh-102',
                    category: 'SPX',
                    platform: 'SPX',
                    orderIncome: 12000,
                    manualFuelCost: null,
                    restoName: 'Contoh Toko Online B',
                    restoAddr: 'Jalan Contoh Tiga No. 3, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    recipName: 'Pelanggan Contoh 2',
                    recipAddr: 'Jalan Contoh Empat No. 4, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    notes: 'Contoh catatan: titip satpam',
                    codeOrder: '#CONTOH2',
                    weight: '1.5 kg',
                    dimensions: '0x0x0 cm',
                    cashAmount: 0,
                    payment: 'Non-Tunai',
                    orderTime: '2026-09-21T13:11',
                    timestamp: new Date('2026-09-21T13:11').getTime(),
                    screenshot: createSVGPlaceholder('Contoh Toko Online B', '#CONTOH2', 'SPX (Non-Tunai)')
                },
                {
                    id: 'ord-contoh-103',
                    category: 'SPX',
                    platform: 'SPX',
                    orderIncome: 18500,
                    manualFuelCost: null,
                    restoName: 'Contoh Toko Online C',
                    restoAddr: 'Jalan Contoh Lima No. 5, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    recipName: 'Pelanggan Contoh 3',
                    recipAddr: 'Jalan Contoh Enam No. 6, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    notes: 'Contoh catatan: paket ditaruh teras',
                    codeOrder: '#CONTOH3',
                    weight: '190 g',
                    dimensions: '0x0x0 cm',
                    cashAmount: 124976,
                    payment: 'Tunai',
                    orderTime: '2026-09-07T14:29',
                    timestamp: new Date('2026-09-07T14:29').getTime(),
                    screenshot: createSVGPlaceholder('Contoh Paket C', '#CONTOH3', 'SPX (Tunai Rp124.976)')
                },
                {
                    id: 'ord-contoh-104',
                    category: 'Instan',
                    platform: 'Gojek',
                    orderIncome: 9500,
                    manualFuelCost: null,
                    restoName: 'Contoh Warung Makan D',
                    restoAddr: 'Jalan Contoh Tujuh No. 7, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    recipName: 'Pelanggan Contoh 4',
                    recipAddr: 'Jalan Contoh Delapan No. 8, Kecamatan Contoh, Kota Contoh, Provinsi Contoh',
                    notes: 'Contoh catatan: titip pos satpam',
                    orderNo: '0000000000000000002',
                    itemCategory: 'Makanan',
                    weight: '1.0 kg',
                    cashAmount: 0,
                    payment: 'Non-Tunai',
                    orderTime: '2026-09-06T18:58',
                    timestamp: new Date('2026-09-06T18:58').getTime(),
                    screenshot: createSVGPlaceholder('Contoh Warung Makan D', '0000000000000000002', 'Instan (Non-Tunai)')
                }
            ];
        }

        function createSVGPlaceholder(title, code, type) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700" viewBox="0 0 400 700">
                <rect width="400" height="700" fill="#1e1b4b"/>
                <rect x="20" y="20" width="360" height="660" rx="20" fill="#ffffff"/>
                <text x="40" y="70" font-family="Arial" font-size="20" font-weight="bold" fill="#4f46e5">DETAIL PESANAN DRIVER</text>
                <line x1="40" y1="90" x2="360" y2="90" stroke="#e2e8f0" stroke-width="2"/>
                <text x="40" y="130" font-family="Arial" font-size="28" font-weight="bold" fill="#0f172a">${code}</text>
                <rect x="40" y="150" width="120" height="30" rx="8" fill="#e0e7ff"/>
                <text x="50" y="170" font-family="Arial" font-size="12" font-weight="bold" fill="#4338ca">${type}</text>
                <text x="40" y="220" font-family="Arial" font-size="14" font-weight="bold" fill="#64748b">NAMA RESTO / PENGIRIM:</text>
                <text x="40" y="245" font-family="Arial" font-size="16" font-weight="bold" fill="#0f172a">${title}</text>
                <rect x="40" y="300" width="320" height="200" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
                <text x="60" y="340" font-family="Arial" font-size="14" font-weight="bold" fill="#10b981">✓ BUKTI TERSIMPAN DALAM SISTEM</text>
                <text x="60" y="380" font-family="Arial" font-size="12" fill="#64748b">DriverTrack Auto OCR Engine</text>
            </svg>`;
            return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        }
