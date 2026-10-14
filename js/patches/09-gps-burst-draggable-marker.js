/* =====================================================================
   PATCH 09 — GPS BURST SAMPLING + DRAGGABLE MARKER PIN KOREKSI MANUAL
   
   Bagian A: getAccuratePosition() — Burst Sampling GPS
   - Menggunakan watchPosition selama maks 4500ms
   - Mengembalikan titik dengan coords.accuracy terkecil (paling akurat)
   - Berhenti lebih cepat jika sudah mendapat akurasi <= 20 meter

   Bagian B: Draggable Marker di Peta Leaflet
   - Marker titik checkin dapat digeser secara manual oleh driver
   - Setelah dilepas (dragend), koordinat baru disimpan ke order
   - Jarak dihitung ulang otomatis jika sudah ada 2 titik
   ===================================================================== */
(function () {
    'use strict';

    /* =================================================================
       BAGIAN A: Tambah getAccuratePosition() ke window.DriverGPS
       ================================================================= */
    function addGetAccuratePosition() {
        if (!window.DriverGPS) {
            setTimeout(addGetAccuratePosition, 500);
            return;
        }

        if (typeof window.DriverGPS.getAccuratePosition === 'function') return; // Sudah ada

        window.DriverGPS.getAccuratePosition = async function (maxWaitMs, targetAccuracy) {
            maxWaitMs      = maxWaitMs      || 4500;
            targetAccuracy = targetAccuracy || 20;

            return new Promise(function (resolve, reject) {
                var bestPosition = null;
                var watchObj     = null;
                var timer        = null;

                function finish() {
                    if (timer)    { clearTimeout(timer); timer = null; }
                    if (watchObj) { window.DriverGPS.clearWatch(watchObj); watchObj = null; }
                    if (bestPosition) {
                        resolve(bestPosition);
                    } else {
                        reject(new Error('GPS burst: tidak mendapat sinyal dalam ' + maxWaitMs + 'ms'));
                    }
                }

                function onPosition(pos) {
                    var acc = pos && pos.coords && pos.coords.accuracy;
                    if (!bestPosition || (typeof acc === 'number' && acc < bestPosition.coords.accuracy)) {
                        bestPosition = pos;
                    }
                    // Berhenti lebih awal jika sudah cukup akurat
                    if (typeof acc === 'number' && acc <= targetAccuracy) {
                        console.log('[GPS Burst] Target akurasi tercapai:', acc.toFixed(1), 'm');
                        finish();
                    }
                }

                function onError(err) {
                    console.warn('[GPS Burst] watchPosition error:', err && err.message);
                    // Jangan langsung reject — mungkin ada posisi sebelumnya yang masih valid
                }

                // Mulai burst watch
                window.DriverGPS.watchPosition(
                    onPosition,
                    onError,
                    { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs + 1000 }
                ).then(function (wObj) {
                    watchObj = wObj;
                });

                // Timer batas waktu maksimal
                timer = setTimeout(function () {
                    console.log('[GPS Burst] Batas waktu tercapai (' + maxWaitMs + 'ms), akurasi terbaik:', bestPosition ? bestPosition.coords.accuracy.toFixed(1) + 'm' : '-');
                    finish();
                }, maxWaitMs);
            });
        };

        console.log('[GPS Patch] getAccuratePosition() berhasil ditambahkan ke window.DriverGPS.');
    }

    /* =================================================================
       BAGIAN B: Patch pemanggilan getCurrentPosition di checkin
       — Ganti getCurrentPosition → getAccuratePosition di kedua tempat
       ================================================================= */
    function patchCheckinCalls() {
        // Kita tidak bisa mengedit fungsi yang ada di closure modul lain secara langsung.
        // Strategi: Override window.DriverGPS.getCurrentPosition agar memanggil
        // getAccuratePosition, sehingga semua kode yang sudah memanggil getCurrentPosition
        // otomatis mendapat manfaat burst sampling tanpa ubah kode lain.

        if (!window.DriverGPS || typeof window.DriverGPS.getCurrentPosition !== 'function') {
            setTimeout(patchCheckinCalls, 500);
            return;
        }

        var _origGetCurrentPosition = window.DriverGPS.getCurrentPosition.bind(window.DriverGPS);

        window.DriverGPS.getCurrentPosition = async function (options) {
            // Gunakan burst sampling jika Capacitor native atau browser mendukung geolocation
            if (typeof window.DriverGPS.getAccuratePosition === 'function') {
                try {
                    return await window.DriverGPS.getAccuratePosition(4500, 20);
                } catch (burstErr) {
                    console.warn('[GPS Patch] Burst sampling gagal, fallback ke getCurrentPosition biasa:', burstErr.message);
                    return _origGetCurrentPosition(options);
                }
            }
            return _origGetCurrentPosition(options);
        };

        console.log('[GPS Patch] getCurrentPosition di-override ke getAccuratePosition (burst sampling).');
    }

    /* =================================================================
       BAGIAN C: Draggable Marker di Peta Leaflet (patch L.marker)
       Intercept L.marker agar marker yang dibuat dengan koordinat checkin
       bisa secara opsional diaktifkan draggable.
       ================================================================= */

    // Helper: hitung jarak haversine (km)
    function haversineKm(lat1, lon1, lat2, lon2) {
        var R  = 6371;
        var t  = Math.PI / 180;
        var dL = (lat2 - lat1) * t;
        var dO = (lon2 - lon1) * t;
        var a  = Math.sin(dL / 2) * Math.sin(dL / 2)
               + Math.cos(lat1 * t) * Math.cos(lat2 * t)
               * Math.sin(dO / 2) * Math.sin(dO / 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    // Fungsi yang dipanggil saat drag selesai — update data order dan UI
    function onCheckinMarkerDragEnd(markerObj, order, role, isCombined, pointIndex) {
        var latlng = markerObj.getLatLng();
        var newLat = parseFloat(latlng.lat.toFixed(7));
        var newLon = parseFloat(latlng.lng.toFixed(7));

        if (isCombined) {
            // Order gabungan: update checkin di titik yang sesuai
            if (!order.checkins) order.checkins = {};
            var key = (role === 'resto' ? 'r' : 'd') + pointIndex;
            order.checkins[key] = {
                lat: newLat,
                lon: newLon,
                accuracy: 5,       // Anggap akurasi sempurna karena dipilih manual
                timestamp: Date.now(),
                manualPin: true    // Flag: titik ini digeser manual
            };
        } else {
            // Order tunggal
            if (role === 'resto') {
                order.restoCheckin = { lat: newLat, lon: newLon, accuracy: 5, timestamp: Date.now(), manualPin: true };
            } else {
                order.recipCheckin = { lat: newLat, lon: newLon, accuracy: 5, timestamp: Date.now(), manualPin: true };
            }
        }

        if (typeof window.saveToLocalStorage === 'function') window.saveToLocalStorage();

        // Hitung ulang jarak jika ada 2 titik
        var d1 = order.restoCheckin, d2 = order.recipCheckin;
        if (!isCombined && d1 && d2) {
            var km = haversineKm(d1.lat, d1.lon, d2.lat, d2.lon);
            order.distanceKm = parseFloat(km.toFixed(2));
            if (typeof window.saveToLocalStorage === 'function') window.saveToLocalStorage();
            if (typeof window.renderAllViews === 'function') window.renderAllViews();
            var badge = document.getElementById('detail-calculated-distance');
            if (badge) {
                badge.className = 'bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                badge.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right mr-1"></i> ' + km.toFixed(2) + ' km (pin manual)';
            }
        }

        if (typeof showToast === 'function') {
            showToast('📍 Pin digeser manual: (' + newLat.toFixed(5) + ', ' + newLon.toFixed(5) + '). Tersimpan.', 'indigo');
        }
    }

    // Expose fungsi helper agar bisa dipanggil dari peta
    window._makeDraggableCheckinMarker = function (latlng, leafletIcon, order, role, isCombined, pointIndex) {
        if (!window.L) return null;
        var marker = window.L.marker(latlng, {
            icon: leafletIcon,
            draggable: true,
            autoPan: true
        });
        marker.on('dragend', function () {
            onCheckinMarkerDragEnd(marker, order, role, isCombined, pointIndex);
        });
        // Popup hint geser pin
        var hint = '<div class="text-[10px] text-indigo-600 mt-1"><i class="fa-solid fa-arrows-up-down-left-right mr-1"></i>Geser pin untuk koreksi posisi</div>';
        if (marker.getPopup) {
            setTimeout(function () {
                var popup = marker.getPopup();
                if (popup) {
                    var content = popup.getContent();
                    marker.setPopupContent(content + hint);
                }
            }, 100);
        }
        return marker;
    };

    /* ---------- Patch initOrderMap: ganti L.marker resto+recip jadi draggable ---------- */
    function patchLeafletMarkers() {
        if (!window.L) { setTimeout(patchLeafletMarkers, 500); return; }

        var _origLMarker = window.L.marker.bind(window.L);

        // Kita hanya patch marker yang dibuat saat checkin (redIcon / greenIcon)
        // caranya: expose flag window._makingCheckinMarker = {order, role} sebelum memanggil L.marker
        // lalu reset setelahnya. Ini zero-invasive terhadap kode lain.
        window.L.marker = function (latlng, options) {
            options = options || {};

            // Cek apakah sedang dalam konteks pembuatan checkin marker
            if (window._checkinMarkerCtx) {
                options.draggable = true;
                options.autoPan   = true;
            }
            return _origLMarker(latlng, options);
        };

        console.log('[GPS Patch] L.marker di-patch, draggable siap.');
    }

    /* ---------- Expose helper ke modul lain untuk mengaktifkan konteks ---------- */
    window.beginCheckinMarker = function (order, role, isCombined, pointIdx) {
        window._checkinMarkerCtx = { order: order, role: role, isCombined: !!isCombined, pointIndex: pointIdx || 0 };
    };
    window.endCheckinMarker = function (marker, order, role, isCombined, pointIdx) {
        window._checkinMarkerCtx = null;
        if (marker) {
            marker.on('dragend', function () {
                onCheckinMarkerDragEnd(marker, order, role, !!isCombined, pointIdx || 0);
                // Tambahkan hint setelah popup terbuat
                setTimeout(function () {
                    try {
                        var popup = marker.getPopup();
                        if (popup) {
                            var c = popup.getContent();
                            if (c && c.indexOf('fa-arrows') === -1) {
                                marker.setPopupContent(c + '<div class="text-[10px] text-indigo-600 mt-1 pt-1 border-t border-slate-100"><i class="fa-solid fa-arrows-up-down-left-right mr-1"></i>Geser pin untuk koreksi posisi</div>');
                            }
                        }
                    } catch (e) {}
                }, 100);
            });
        }
    };

    /* ---------- Init ---------- */
    function init() {
        addGetAccuratePosition();
        setTimeout(patchCheckinCalls,  800);
        setTimeout(patchLeafletMarkers, 600);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 300);
    } else {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
    }
}());
