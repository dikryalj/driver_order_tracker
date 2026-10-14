        const GMAPS_KEY_STORAGE = 'drivertrack_gmaps_key';
        function getGoogleMapsKey() {
            try { return (localStorage.getItem(GMAPS_KEY_STORAGE) || '').trim(); } catch (e) { return ''; }
        }

        let googleMapsLoadPromise = null;
        let googleMapsAuthFailed = false;
        // Dipanggil otomatis oleh Google Maps JS API jika key ditolak.
        window.gm_authFailure = function () {
            googleMapsAuthFailed = true;
            try { document.dispatchEvent(new CustomEvent('gmaps-auth-failure')); } catch (e) {}
        };

        function loadGoogleMapsApi() {
            const key = getGoogleMapsKey();
            if (!key) return Promise.resolve(false);
            if (googleMapsLoadPromise) return googleMapsLoadPromise;

            googleMapsLoadPromise = new Promise((resolve) => {
                if (window.google && window.google.maps) { resolve(true); return; }
                const script = document.createElement('script');
                script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&loading=async&v=weekly';
                script.async = true;
                script.onload = () => resolve(true);
                script.onerror = () => {
                    googleMapsLoadPromise = null;
                    console.warn('Gagal memuat Google Maps API, memakai Check Point GPS.');
                    resolve(false);
                };
                document.head.appendChild(script);
            });
            return googleMapsLoadPromise;
        }

        // Peta dasar TANPA API key. OpenStreetMap memblokir permintaan tanpa Referer (mis. file:///) dengan
        // tile "Access blocked" (HTTP 403 tapi tetap berupa gambar, jadi tidak terdeteksi sebagai error).
        // Karena itu Esri dipakai sebagai peta utama; bila tile gagal 6x berturut-turut, pindah ke OpenStreetMap.
        function createBaseTileLayer() {
            const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: 'Tiles &copy; Esri'
            });
            let errors = 0, switched = false;
            esri.on('tileload', function () { errors = 0; });
            esri.on('tileerror', function () {
                if (switched || !esri._map) return;
                if (++errors < 6) return;
                switched = true;
                const map = esri._map;
                map.removeLayer(esri);
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                }).addTo(map);
            });
            return esri;
        }
    
