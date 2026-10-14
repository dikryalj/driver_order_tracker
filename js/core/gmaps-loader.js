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

        // Peta dasar modern & terupdate (Google Maps Roadmap Tiles dengan fallback OSM).
        // Google Maps menyediakan peta jalan, gang, dan POI paling akurat & terbaru di Indonesia.
        function createBaseTileLayer() {
            const googleTiles = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['0', '1', '2', '3'],
                attribution: '&copy; Google Maps'
            });
            let errors = 0, switched = false;
            googleTiles.on('tileload', function () { errors = 0; });
            googleTiles.on('tileerror', function () {
                if (switched || !googleTiles._map) return;
                if (++errors < 6) return;
                switched = true;
                const map = googleTiles._map;
                map.removeLayer(googleTiles);
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                }).addTo(map);
            });
            return googleTiles;
        }
    
