        // ============================================================
        // ORDERAN GABUNGAN — MODAL DETAIL, TITIK, CHECKIN & PETA
        // Semua fungsi di bawah ini HANYA dipakai untuk order.isCombined:true.
        // Order tunggal tetap memakai renderCheckinBox/doCheckin/initOrderMap
        // yang lama, tidak tersentuh sama sekali.
        // ============================================================
        function openCombinedOrderDetailModal(order) {
            ensureCombinedPoints(order);

            document.getElementById('detail-single-point-container').classList.add('hidden');
            document.getElementById('detail-combined-points-container').classList.remove('hidden');

            document.getElementById('detail-modal-category-badge').innerText = 'Gabungan';
            document.getElementById('detail-modal-title').innerText = `Gabungan • ${order.subOrders.length} Pesanan`;

            const catBox = document.getElementById('detail-category-box');
            const catCounts = {};
            order.subOrders.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });
            const catIconsMap = { Food: '🍲', SPX: '📦', Instan: '⚡' };
            catBox.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-extrabold text-indigo-700"><i class="fa-solid fa-link mr-1"></i> Orderan Gabungan</span>
                    <span class="bg-indigo-100 text-indigo-800 font-mono font-bold px-2 py-0.5 rounded">${order.subOrders.length} pesanan</span>
                </div>
                <p class="text-slate-700">${Object.entries(catCounts).map(([k, v]) => `${catIconsMap[k] || '📦'} ${escapeHtml(k)} x${v}`).join(' &bull; ')}</p>`;

            document.getElementById('detail-combined-summary-text').innerText =
                `${order.subOrders.length} pesanan • Total ongkir Rp${(order.orderIncome || 0).toLocaleString('id-ID')} • Total tunai Rp${(order.cashAmount || 0).toLocaleString('id-ID')}`;

            document.getElementById('detail-time').innerText = new Date(order.timestamp).toLocaleString('id-ID');
            document.getElementById('detail-id').innerText = order.id;

            document.getElementById('detail-platform-badge').innerText = '🔗 Multi-Platform';
            document.getElementById('detail-income-val').innerText = `Rp${(order.orderIncome || 0).toLocaleString('id-ID')}`;
            const fuelCost = computeOrderFuelCost(order);
            document.getElementById('detail-fuelcost-val').innerText = `Rp${Math.round(fuelCost).toLocaleString('id-ID')}`;
            document.getElementById('detail-netincome-val').innerText = `Rp${Math.round((order.orderIncome || 0) - fuelCost).toLocaleString('id-ID')}`;
            renderCombinedSubFinancials(order);

            // Tampilkan screenshot per pesanan (sesuai urutan #1, #2, #3, ...)
            // jika tersedia; kalau tidak ada sama sekali, tampilkan 1 thumbnail gabungan.
            const hasAnySubShot = (order.subOrders || []).some(s => s.screenshot);
            const shotSingle = document.getElementById('detail-screenshot-container');
            const shotMulti = document.getElementById('detail-screenshot-multi-container');
            if (hasAnySubShot) {
                shotSingle.classList.add('hidden');
                shotMulti.classList.remove('hidden');
                const listEl = document.getElementById('detail-screenshot-multi-list');
                listEl.innerHTML = order.subOrders.map((s, i) => {
                    const src = s.screenshot || createSVGPlaceholder(s.restoName || `Pesanan #${i + 1}`, s.category, s.payment);
                    return `
                        <div class="relative">
                            <img src="${src}" alt="Screenshot #${i + 1}" onclick="openImageModal('${src}')" class="w-full h-20 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90 transition">
                            <span class="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">${i + 1}</span>
                        </div>`;
                }).join('');
            } else {
                shotSingle.classList.remove('hidden');
                shotMulti.classList.add('hidden');
                document.getElementById('detail-screenshot-img').src = order.screenshot;
            }
            document.getElementById('order-detail-modal').classList.remove('hidden');

            renderCombinedPointsList(order);

            setTimeout(() => { initCombinedOrderMap(order); }, 150);
        }

        function renderCombinedPointsList(order) {
            ensureCombinedPoints(order);
            const listEl = document.getElementById('detail-combined-points-list');
            if (!listEl) return;

            let checkedCount = 0;
            const html = order.points.map((point, i) => {
                const sub = order.subOrders[point.subIndex];
                if (!sub) return '';
                const checkin = getPointCheckin(order, point);
                if (checkin) checkedCount++;
                const isPickup = point.role === 'resto';
                const colorClass = isPickup ? 'rose' : 'emerald';
                const label = getPointLabel(order, point);
                const addr = getPointAddress(order, point);
                const codeInfo = `${sub.category} • Kode/No: ${getSubOrderCode(sub)}`;

                const canMoveUp = i > 0;
                const canMoveDown = i < order.points.length - 1;

                let checkinHTML;
                if (checkin) {
                    const waktu = new Date(checkin.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
                    checkinHTML = `
                        <div class="flex items-center justify-between gap-2 bg-white rounded-xl border border-${colorClass}-200 p-2 mt-1.5">
                            <div class="min-w-0">
                                <p class="font-bold text-${colorClass}-700 text-[10px]"><i class="fa-solid fa-location-crosshairs mr-1"></i>Checkin GPS Tersimpan</p>
                                <p class="text-slate-400 text-[10px] truncate">${waktu} &bull; akurasi ~${Math.round(checkin.accuracy || 0)}m</p>
                            </div>
                            <div class="flex items-center gap-1 flex-shrink-0">
                                <a href="${buildGoogleMapsLink(checkin.lat, checkin.lon)}" target="_blank" class="bg-${colorClass}-600 hover:bg-${colorClass}-700 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg transition">
                                    <i class="fa-solid fa-map-location-dot"></i> Maps
                                </a>
                                <button type="button" onclick="doCheckinCombined('${order.id}', ${i})" class="bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-1.5 rounded-lg transition" title="Checkin Ulang">
                                    <i class="fa-solid fa-rotate"></i>
                                </button>
                            </div>
                        </div>`;
                } else {
                    checkinHTML = `
                        <button type="button" onclick="doCheckinCombined('${order.id}', ${i})" class="w-full bg-${colorClass}-600 hover:bg-${colorClass}-700 text-white font-bold py-2 rounded-xl text-[10px] transition flex items-center justify-center gap-1.5 mt-1.5">
                            <i class="fa-solid fa-location-crosshairs"></i> Checkin Sampai Lokasi
                        </button>`;
                }

                return `
                    <div class="bg-${colorClass}-50/70 border border-${colorClass}-200 p-3 rounded-2xl space-y-1">
                        <div class="flex items-center justify-between gap-2">
                            <span class="font-extrabold text-${colorClass}-900 text-xs flex items-center gap-1.5 min-w-0">
                                <span class="w-5 h-5 rounded-full bg-${colorClass}-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">${i + 1}</span>
                                <span class="truncate">${escapeHtml(label)}</span>
                            </span>
                            <div class="flex items-center gap-1 flex-shrink-0">
                                <button type="button" onclick="moveCombinedPoint('${order.id}', ${i}, -1)" ${canMoveUp ? '' : 'disabled'} class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${canMoveUp ? 'text-slate-500 hover:bg-white' : 'text-slate-300 cursor-not-allowed'}" title="Naikkan Urutan">
                                    <i class="fa-solid fa-chevron-up"></i>
                                </button>
                                <button type="button" onclick="moveCombinedPoint('${order.id}', ${i}, 1)" ${canMoveDown ? '' : 'disabled'} class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${canMoveDown ? 'text-slate-500 hover:bg-white' : 'text-slate-300 cursor-not-allowed'}" title="Turunkan Urutan">
                                    <i class="fa-solid fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                        <p class="text-slate-600 text-[11px] leading-relaxed">${escapeHtml(addr)}</p>
                        <p class="text-slate-400 text-[10px]">${escapeHtml(codeInfo)}${(!isPickup && sub.notes && sub.notes !== '-') ? ' • Catatan: ' + escapeHtml(sub.notes) : ''}</p>
                        ${checkinHTML}
                    </div>`;
            }).join('');

            listEl.innerHTML = html;
            const progressEl = document.getElementById('detail-combined-checkin-progress');
            if (progressEl) progressEl.innerText = `${checkedCount}/${order.points.length} titik sudah checkin`;

            const badgeEl = document.getElementById('detail-combined-order-badge');
            if (badgeEl) {
                badgeEl.innerHTML = combinedPatternBadgeHTML(order.points);
            }
        }

        // Tampilkan breakdown Pendapatan/Est. BBM/Bersih per sub-pesanan di modal
        // detail, hasil split otomatis berdasarkan jarak Ambil->Antar masing-masing
        // (lihat computeCombinedSubOrderFinancials()).
        function renderCombinedSubFinancials(order) {
            const listEl = document.getElementById('detail-combined-subfinancial-list');
            if (!listEl) return;
            const perSub = computeCombinedSubOrderFinancials(order);
            listEl.innerHTML = perSub.map(p => {
                const sub = order.subOrders[p.subIndex];
                if (!sub) return '';
                const distText = p.distanceKm !== null ? `${p.distanceKm.toFixed(2)} km` : 'Belum checkin';
                return `
                    <div class="bg-white rounded-xl border border-violet-100 p-2 text-[10px] space-y-0.5">
                        <p class="font-extrabold text-slate-700 truncate">#${p.subIndex + 1} ${escapeHtml(sub.recipName || '-')}</p>
                        <p class="text-slate-500 leading-relaxed">
                            Pendapatan: <b class="text-emerald-600">Rp${Math.round(p.incomeShare).toLocaleString('id-ID')}</b>
                            &bull; Est. BBM: <b class="text-rose-600">Rp${Math.round(p.fuelCost).toLocaleString('id-ID')}</b>
                            &bull; Bersih: <b class="text-indigo-600">Rp${Math.round(p.netIncome).toLocaleString('id-ID')}</b>
                            &bull; Jarak: <b class="text-slate-600">${distText}</b>
                        </p>
                    </div>`;
            }).join('');
        }

        function doCheckinCombined(orderId, pointIndex) {
            const order = ordersList.find(o => o.id === orderId);
            if (!order || !order.isCombined) return;
            ensureCombinedPoints(order);
            const point = order.points[pointIndex];
            if (!point) return;
            const sub = order.subOrders[point.subIndex];
            if (!sub) return;

            const applyCheckin = (lat, lon, accuracy) => {
                const checkinData = { lat: parseFloat(lat), lon: parseFloat(lon), accuracy: accuracy || 10, timestamp: Date.now() };
                if (point.role === 'resto') sub.restoCheckin = checkinData;
                else sub.recipCheckin = checkinData;

                saveToLocalStorage();
                renderCombinedPointsList(order);
                showToast(`Checkin titik #${pointIndex + 1} berhasil dicatat.`, 'emerald');
                initCombinedOrderMap(order);
            };

            const fallbackAddr = point.role === 'resto' ? (sub.restoAddr || sub.restoName) : (sub.recipAddr || sub.recipName);

            window.DriverGPS.ensurePermission(`Check-in Titik #${pointIndex + 1} (${point.role === 'resto' ? 'Resto' : 'Penerima'})`).then(async (granted) => {
                if (!granted) {
                    const fallback = getFallbackCoordinates(fallbackAddr, point.role === 'resto');
                    const useFallback = confirm(`Izin lokasi GPS belum diaktifkan.\n\nApakah Anda ingin menggunakan koordinat area pesanan (${fallback.lat.toFixed(4)}, ${fallback.lon.toFixed(4)}) untuk simulasi checkin sekarang?`);
                    if (useFallback) applyCheckin(fallback.lat, fallback.lon, 25);
                    return;
                }

                try {
                    const position = await window.DriverGPS.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
                    applyCheckin(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
                } catch (error) {
                    console.warn("GPS Checkin error:", error);
                    let msg = 'Gagal mengambil sinyal GPS.';
                    const fallback = getFallbackCoordinates(fallbackAddr, point.role === 'resto');
                    const useFallback = confirm(`${msg}\n\nApakah Anda ingin menggunakan koordinat area pesanan (${fallback.lat.toFixed(4)}, ${fallback.lon.toFixed(4)}) untuk simulasi checkin sekarang?`);
                    if (useFallback) applyCheckin(fallback.lat, fallback.lon, 25);
                    else showToast(msg, 'rose');
                }
            });
        }

        // Ganti urutan titik order gabungan yang lagi dibuka di modal Detail
        // langsung ke salah satu template ('grouped' = Ambil Semua Dulu,
        // 'interleaved' = Ambil-Antar bergantian), 1-tap tanpa geser manual.
        function applyCombinedPointsTemplate(pattern) {
            const order = currentDetailOrder;
            if (!order || !order.isCombined) return;
            const n = (order.subOrders || []).length;
            order.points = pattern === 'interleaved' ? buildInterleavedPoints(n) : buildGroupedPoints(n);
            saveToLocalStorage();
            renderCombinedPointsList(order);
            initCombinedOrderMap(order);
            showToast(pattern === 'interleaved' ? 'Urutan diganti ke Interleaved.' : 'Urutan diganti ke Ambil Semua Dulu.', 'indigo');
        }

        function moveCombinedPoint(orderId, pointIndex, direction) {
            const order = ordersList.find(o => o.id === orderId);
            if (!order || !order.isCombined) return;
            ensureCombinedPoints(order);

            const targetIndex = pointIndex + direction;
            if (targetIndex < 0 || targetIndex >= order.points.length) return;

            const newPoints = order.points.slice();
            const tmp = newPoints[pointIndex];
            newPoints[pointIndex] = newPoints[targetIndex];
            newPoints[targetIndex] = tmp;

            // Aturan: titik ambil sebuah subOrder tidak boleh berada setelah titik antarnya sendiri.
            for (let i = 0; i < newPoints.length; i++) {
                const p = newPoints[i];
                if (p.role !== 'resto') continue;
                const recipIdx = newPoints.findIndex(q => q.subIndex === p.subIndex && q.role === 'recip');
                if (recipIdx !== -1 && recipIdx < i) {
                    showToast('Titik ambil tidak boleh berada setelah titik antar pesanan yang sama.', 'rose');
                    return;
                }
            }

            order.points = newPoints;
            saveToLocalStorage();
            renderCombinedPointsList(order);
            initCombinedOrderMap(order);
        }

        async function initCombinedOrderMap(order) {
            ensureCombinedPoints(order);
            currentDetailOrder = order;
            const distanceBadge = document.getElementById('detail-calculated-distance');
            const placeholderEl = document.getElementById('map-checkin-placeholder');
            const modeSelector = document.getElementById('map-mode-selector');
            const btnNavRoute = document.getElementById('btn-gmap-route');

            if (leafletMapInstance) { leafletMapInstance.remove(); leafletMapInstance = null; }
            if (modeSelector) modeSelector.classList.add('hidden');

            const checkedPoints = order.points
                .map((p, i) => ({ p, i, checkin: getPointCheckin(order, p) }))
                .filter(x => x.checkin);

            if (checkedPoints.length === 0) {
                if (placeholderEl) placeholderEl.classList.remove('hidden');
                if (distanceBadge) {
                    distanceBadge.className = 'bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                    distanceBadge.innerHTML = `<i class="fa-solid fa-location-crosshairs mr-1"></i> Menunggu Checkin GPS (0/${order.points.length})`;
                }
                updateNavButtonsCombined(order);
                return;
            }

            if (placeholderEl) placeholderEl.classList.add('hidden');

            leafletMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: true }).setView([checkedPoints[0].checkin.lat, checkedPoints[0].checkin.lon], 14);
            createBaseTileLayer().addTo(leafletMapInstance);
            leafletMapInstance.on('click', () => { if (isTouchDevice()) return; openGmapsDirectCombined(); });

            const markers = [];
            checkedPoints.forEach(({ p, i, checkin }) => {
                const isPickup = p.role === 'resto';
                const icon = L.divIcon({
                    className: isPickup ? 'custom-pin-red' : 'custom-pin-green',
                    html: `<div class="relative flex flex-col items-center">
                            <div class="w-8 h-9 bg-gradient-to-b ${isPickup ? 'from-rose-500 to-rose-600' : 'from-emerald-500 to-emerald-600'} rounded-t-full rounded-b-xl border-2 border-white shadow-xl flex items-center justify-center text-white font-extrabold text-sm tracking-tighter">${i + 1}</div>
                            <div class="w-2.5 h-2.5 ${isPickup ? 'bg-rose-600' : 'bg-emerald-600'} transform rotate-45 -mt-1.5 border-r border-b border-white"></div>
                           </div>`,
                    iconSize: [32, 42], iconAnchor: [16, 42]
                });
                const label = getPointLabel(order, p);
                const addr = getPointAddress(order, p);
                const marker = L.marker([checkin.lat, checkin.lon], { icon }).addTo(leafletMapInstance)
                    .bindPopup(`<div class="space-y-1"><b>${i + 1}. ${escapeHtml(label)}</b><div class="text-[11px] text-slate-600">${escapeHtml(addr)}</div></div>`);
                markers.push(marker);
            });
            if (markers[0]) markers[0].openPopup();

            const latlngs = checkedPoints.map(x => [x.checkin.lat, x.checkin.lon]);

            // Fallback jarak haversine (garis lurus antar titik checkin berurutan),
            // dipakai kalau OSRM gagal/tidak bisa diakses.
            let totalKmFallback = 0;
            for (let k = 1; k < checkedPoints.length; k++) {
                totalKmFallback += parseFloat(calculateHaversineDistance(
                    checkedPoints[k - 1].checkin.lat, checkedPoints[k - 1].checkin.lon,
                    checkedPoints[k].checkin.lat, checkedPoints[k].checkin.lon
                ));
            }

            // Coba ambil rute yang benar-benar mengikuti jalan lewat OSRM (sama
            // seperti order tunggal di initOrderMap()), supaya jarak & garis peta
            // akurat, bukan garis lurus tembus bangunan/sungai. Kalau gagal
            // (offline/limit API), fallback ke garis lurus putus-putus seperti semula.
            let routedSuccessfully = false;
            if (latlngs.length >= 2) {
                try {
                    const osrmRes = await RoadRouter.compat(checkedPoints.map(x => [x.checkin.lat, x.checkin.lon]));

                    if (osrmRes.ok) {
                        const osrmData = await osrmRes.json();
                        if (osrmData.routes && osrmData.routes.length > 0) {
                            const route = osrmData.routes[0];
                            const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

                            const mapPolylineCombined = L.polyline(routeCoords, {
                                color: (window.__isNeon && window.__isNeon()) ? '#22C55E' : ((window.__isSales && window.__isSales()) ? '#1E211D' : '#6366F1'), weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
                            }).addTo(leafletMapInstance);
                            leafletMapInstance.fitBounds(mapPolylineCombined.getBounds(), { padding: [35, 35] });

                            const distKm = (route.distance / 1000);
                            const durMin = Math.ceil(route.duration / 60);

                            order.distanceKm = parseFloat(distKm.toFixed(2));
                            order.routeDurationMin = durMin;
                            saveToLocalStorage();
                            renderAllViews();
                            refreshDetailFinancialFields(order);

                            if (distanceBadge) {
                                distanceBadge.className = 'bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                                distanceBadge.innerHTML = `<i class="fa-solid fa-route mr-1"></i> Rute GPS (1 perjalanan): ${order.distanceKm} km (${durMin} min) &bull; ${checkedPoints.length}/${order.points.length}`;
                            }
                            routedSuccessfully = true;
                        }
                    }
                } catch (err) {
                    console.warn("OSRM Route API (gabungan) fallback:", err);
                }
            }

            if (!routedSuccessfully) {
                // Tidak ada garis lurus: peta fokus ke titik, rute jalan dicoba ulang otomatis.
                if (latlngs.length >= 2) leafletMapInstance.fitBounds(L.latLngBounds(latlngs), { padding: [35, 35] });
                else leafletMapInstance.setView(latlngs[0], 16);
                if (distanceBadge) {
                    distanceBadge.className = 'bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                    distanceBadge.innerHTML = `<i class="fa-solid fa-rotate mr-1"></i> Memuat rute jalan... (otomatis diulang)`;
                }
                if (!window.__routeRetryC) window.__routeRetryC = 0;
                if (window.__routeRetryC < 5) { window.__routeRetryC++; setTimeout(() => { try { if (typeof currentDetailOrder !== 'undefined' && currentDetailOrder && currentDetailOrder.id === order.id && document.getElementById('detail-map')) initCombinedOrderMap(order); } catch (e) {} }, 8000 * window.__routeRetryC); }
            } else { window.__routeRetryC = 0; }

            updateNavButtonsCombined(order);

            setTimeout(() => { if (leafletMapInstance) leafletMapInstance.invalidateSize(); }, 200);
        }

        // Bangun daftar link Google Maps sesuai urutan titik (koordinat checkin bila
        // ada, jika belum pakai alamat teks). Dipecah jadi beberapa link kalau jumlah
        // titik melebihi batas wajar URL Google Maps (~10 titik per link).
        function buildGmapsUrlListCombined(order) {
            ensureCombinedPoints(order);
            const stops = order.points.map(p => {
                const checkin = getPointCheckin(order, p);
                if (checkin) return `${checkin.lat},${checkin.lon}`;
                const addr = getPointAddress(order, p);
                return addr ? addr : null;
            }).filter(Boolean);

            if (stops.length === 0) return [];
            if (stops.length === 1) {
                return [`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`];
            }

            const MAX_PER_LINK = 10;
            const links = [];
            let i = 0;
            while (i < stops.length - 1) {
                const chunk = stops.slice(i, i + MAX_PER_LINK);
                const origin = chunk[0];
                const destination = chunk[chunk.length - 1];
                const waypoints = chunk.slice(1, -1);
                let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
                if (waypoints.length > 0) url += `&waypoints=${waypoints.map(w => encodeURIComponent(w)).join('|')}`;
                links.push(url);
                i += MAX_PER_LINK - 1;
            }
            return links;
        }

        function openGmapsDirectCombined() {
            const order = currentDetailOrder;
            if (!order || !order.isCombined) return;
            const links = buildGmapsUrlListCombined(order);
            if (links.length === 0) {
                showToast('Belum ada alamat/titik yang bisa dinavigasikan.', 'rose');
                return;
            }
            if (links.length > 1) {
                showToast(`Rute dipecah jadi ${links.length} link Google Maps (titik terlalu banyak).`, 'amber');
            }
            links.forEach(url => window.open(url, '_blank', 'noopener'));
        }

        function updateNavButtonsCombined(order) {
            const btnNavRoute = document.getElementById('btn-gmap-route');
            const btnNavResto = document.getElementById('btn-gmap-resto');
            const btnNavRecip = document.getElementById('btn-gmap-recip');
            if (btnNavRoute) {
                btnNavRoute.href = '#';
                btnNavRoute.innerHTML = `<i class="fa-solid fa-diamond-turn-right text-amber-300 mr-1"></i> Navigasi Google Maps`;
                btnNavRoute.onclick = (e) => { e.preventDefault(); openGmapsDirectCombined(); };
            }
            // Tombol navigasi individual resto/penerima disembunyikan untuk gabungan (banyak titik).
            if (btnNavResto) btnNavResto.style.display = 'none';
            if (btnNavRecip) btnNavRecip.style.display = 'none';
        }

        function getFallbackCoordinates(addressStr, isResto = true) {
            const clean = (addressStr || '').toLowerCase();
            for (const key of Object.keys(AREA_COORDINATES_DB)) {
                if (clean.includes(key)) {
                    const base = AREA_COORDINATES_DB[key];
                    const seed = ((addressStr.length * (isResto ? 7 : 13)) % 100) / 4000;
                    const seed2 = ((addressStr.length * (isResto ? 11 : 19)) % 100) / 4000;
                    return { lat: base[0] + seed, lon: base[1] + seed2 };
                }
            }
            const offsetLat = isResto ? -0.005 : 0.007;
            const offsetLon = isResto ? -0.006 : 0.005;
            return { lat: -7.5583 + offsetLat, lon: 110.7710 + offsetLon };
        }

        // Cari via Google Places (Find Place from Text) — paling akurat untuk nama toko/usaha
        // kecil (mis. "Toko Dalmanto", "CV. Javatrans Logistic") karena mencocokkan ke listing
        // bisnis asli, bukan cuma menebak dari susunan teks alamat seperti Nominatim.
        function findPlaceWithGoogle(query) {
            return new Promise((resolve) => {
                if (!window.google || !window.google.maps || !window.google.maps.places) {
                    resolve(null);
                    return;
                }
                const { minLat, maxLat, minLon, maxLon } = SOLO_RAYA_BOUNDS;
                const bounds = new google.maps.LatLngBounds(
                    { lat: minLat, lng: minLon },
                    { lat: maxLat, lng: maxLon }
                );
                const service = new google.maps.places.PlacesService(document.createElement('div'));
                service.findPlaceFromQuery({
                    query,
                    fields: ['geometry'],
                    locationBias: bounds
                }, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
                        const loc = results[0].geometry.location;
                        resolve({ lat: loc.lat(), lon: loc.lng() });
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        // Cari via Google Geocoding — untuk alamat jalan/RT-RW biasa (bukan nama usaha).
        function geocodeWithGoogle(addressStr) {
            return new Promise((resolve) => {
                if (!window.google || !window.google.maps) {
                    resolve(null);
                    return;
                }
                const { minLat, maxLat, minLon, maxLon } = SOLO_RAYA_BOUNDS;
                const bounds = new google.maps.LatLngBounds(
                    { lat: minLat, lng: minLon },
                    { lat: maxLat, lng: maxLon }
                );
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: addressStr, region: 'id', bounds }, (results, status) => {
                    if (status === 'OK' && results && results[0]) {
                        const loc = results[0].geometry.location;
                        resolve({ lat: loc.lat(), lon: loc.lng() });
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        async function geocodeAddress(addressStr, isResto = true) {
            if (!addressStr || addressStr.trim() === '-' || addressStr.length < 3) {
                return getFallbackCoordinates(addressStr, isResto);
            }

            const knownCoords = getKnownPlaceCoords(addressStr);
            if (knownCoords) {
                return knownCoords;
            }

            // Coba Google dulu (kalau API key sudah diisi) sebelum jatuh ke Nominatim.
            const googleReady = await loadGoogleMapsApi();
            if (googleReady) {
                try {
                    const placeResult = await findPlaceWithGoogle(addressStr);
                    if (placeResult && isWithinSoloRaya(placeResult.lat, placeResult.lon)) {
                        return placeResult;
                    }
                    const geocodeResult = await geocodeWithGoogle(addressStr);
                    if (geocodeResult && isWithinSoloRaya(geocodeResult.lat, geocodeResult.lon)) {
                        return geocodeResult;
                    }
                } catch (e) {
                    console.warn('Google Maps geocoding gagal, lanjut ke Nominatim:', e);
                }
            }

            // Bersihkan alamat: buang catatan pemesan, teks dalam kurung, dan nama toko/pondok di awal.
            // PENTING: jangan potong ke 3 bagian pertama seperti versi lama — itu justru
            // membuang kecamatan/kabupaten (mis. "Kartasura", "Kab. Sukoharjo") yang paling
            // menentukan akurasi titik di Nominatim/OSM.
            let cleaned = addressStr
                .replace(/Catatan Pemesan:[\s\S]*/gi, '')
                .replace(/\([^)]*\)/g, '')
                .replace(/^Toko [^,]+,\s*/i, '')
                .replace(/^Pondok [^,]+,\s*/i, '')
                .trim();

            let parts = cleaned
                .split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0 && !p.toLowerCase().includes('rumah') && !p.toLowerCase().includes('pagar'));

            if (!cleaned.toLowerCase().includes('indonesia')) {
                parts.push('Indonesia');
            }

            // Susun beberapa varian query, dari paling detail ke paling umum.
            // Alamat detail Indonesia (No. rumah, RT/RW) seringkali TIDAK ada di data OSM,
            // jadi kalau versi paling lengkap gagal, kita mundur selangkah demi selangkah
            // ke tingkat jalan -> kelurahan/dusun -> kecamatan/kabupaten, bukan langsung
            // lompat ke titik acak seperti sebelumnya.
            const candidates = [];
            candidates.push(parts.join(', ')); // versi lengkap

            const noHouseNoRtRw = parts.filter(p =>
                !/^no\.?\s*\d+/i.test(p) && !/^rt\.?\s*\d+\s*\/?\s*rw\.?\s*\d+/i.test(p)
            );
            if (noHouseNoRtRw.length !== parts.length) {
                candidates.push(noHouseNoRtRw.join(', '));
            }

            if (parts.length > 5) {
                candidates.push(parts.slice(-5).join(', ')); // jalan + kelurahan + kec + kab + provinsi
            }
            if (parts.length > 3) {
                candidates.push(parts.slice(-3).join(', ')); // kecamatan + kabupaten + provinsi
            }

            // viewbox+bounded=1 memaksa Nominatim hanya mencari di dalam Solo Raya, jadi nama jalan
            // umum (mis. "Jalan Diponegoro") tidak akan nyasar ke kota lain di luar area operasi driver.
            const { minLat, maxLat, minLon, maxLon } = SOLO_RAYA_BOUNDS;
            const viewboxParam = `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1`;

            for (const query of [...new Set(candidates)]) {
                if (!query || query.length < 3) continue;
                try {
                    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=id&limit=1&q=${encodeURIComponent(query)}${viewboxParam}`;
                    const response = await fetch(url, { headers: { 'Accept-Language': 'id' } });
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.length > 0) {
                            const lat = parseFloat(data[0].lat);
                            const lon = parseFloat(data[0].lon);
                            // Jaga-jaga ganda: meski sudah dibatasi viewbox, tetap validasi manual.
                            if (isWithinSoloRaya(lat, lon)) {
                                return { lat, lon };
                            }
                            console.warn("Geocode di luar Solo Raya, dilewati:", query, lat, lon);
                        }
                    }
                } catch (e) {
                    console.warn("Geocode error, mencoba varian query berikutnya:", e);
                }
            }

            return getFallbackCoordinates(addressStr, isResto);
        }

        // ============================================================
        // CHECK-IN LOKASI GPS
        // Driver menekan tombol saat benar-benar sudah sampai di lokasi
        // resto/penerima. Titik GPS asli ini disimpan per-order (jadi
        // order berbeda tidak akan pernah tabrakan/tertukar), dan
        // dipakai sebagai sumber koordinat paling akurat untuk peta &
        // link Google Maps — menggantikan hasil tebakan alamat.
        // ============================================================

        function buildGoogleMapsLink(lat, lon) {
            return `https://www.google.com/maps?q=${lat},${lon}`;
        }

        function renderCheckinBox(orderId, role) {
            const order = ordersList.find(o => o.id === orderId);
            if (!order) return;

            const boxEl = document.getElementById(role === 'resto' ? 'resto-checkin-box' : 'recip-checkin-box');
            if (!boxEl) return;

            const checkin = role === 'resto' ? order.restoCheckin : order.recipCheckin;
            const colorClass = role === 'resto' ? 'amber' : 'emerald';
            const label = role === 'resto' ? 'Resto/Pengirim' : 'Penerima';

            if (checkin) {
                const waktu = new Date(checkin.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
                boxEl.innerHTML = `
                    <div class="flex items-center justify-between gap-2 bg-white rounded-xl border border-${colorClass}-200 p-2">
                        <div class="min-w-0">
                            <p class="font-bold text-${colorClass}-700 text-[10px]"><i class="fa-solid fa-location-crosshairs mr-1"></i>Checkin GPS Tersimpan</p>
                            <p class="text-slate-400 text-[10px] truncate">${waktu} &bull; akurasi ~${Math.round(checkin.accuracy || 0)}m</p>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <a href="${buildGoogleMapsLink(checkin.lat, checkin.lon)}" target="_blank" class="bg-${colorClass}-600 hover:bg-${colorClass}-700 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg transition">
                                <i class="fa-solid fa-map-location-dot"></i> Maps
                            </a>
                            <button type="button" onclick="doCheckin('${order.id}', '${role}')" class="bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-1.5 rounded-lg transition" title="Checkin Ulang">
                                <i class="fa-solid fa-rotate"></i>
                            </button>
                        </div>
                    </div>`;
            } else {
                boxEl.innerHTML = `
                    <button type="button" onclick="doCheckin('${order.id}', '${role}')" class="w-full bg-${colorClass}-600 hover:bg-${colorClass}-700 text-white font-bold py-2 rounded-xl text-[10px] transition flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-location-crosshairs"></i> Checkin Sampai Lokasi ${label}
                    </button>`;
            }
        }

        function doCheckin(orderId, role) {
            const order = ordersList.find(o => o.id === orderId);
            if (!order) return;

            const boxEl = document.getElementById(role === 'resto' ? 'resto-checkin-box' : 'recip-checkin-box');
            if (boxEl) {
                boxEl.innerHTML = `<div class="text-center text-[10px] text-slate-400 py-2"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengambil lokasi GPS...</div>`;
            }

            const applyCheckin = (lat, lon, accuracy) => {
                const checkinData = {
                    lat: parseFloat(lat),
                    lon: parseFloat(lon),
                    accuracy: accuracy || 10,
                    timestamp: Date.now()
                };

                if (role === 'resto') {
                    order.restoCheckin = checkinData;
                } else {
                    order.recipCheckin = checkinData;
                }

                saveToLocalStorage();
                renderCheckinBox(orderId, role);
                showToast(`Checkin ${role === 'resto' ? 'resto/pengirim' : 'penerima'} berhasil dicatat.`, 'emerald');

                // Update peta di modal agar langsung menampilkan titik GPS ini!
                initOrderMap(order);
            };

            const fallbackAddr = role === 'resto' ? (order.restoAddr || order.restoName) : (order.recipAddr || order.recipName);

            window.DriverGPS.ensurePermission(`Check-in ${role === 'resto' ? 'Resto / Pengirim' : 'Penerima'}`).then(async (granted) => {
                if (!granted) {
                    const fallback = getFallbackCoordinates(fallbackAddr, role === 'resto');
                    const useFallback = confirm(`Izin lokasi GPS belum diaktifkan.\n\nApakah Anda ingin menggunakan koordinat area pesanan (${fallback.lat.toFixed(4)}, ${fallback.lon.toFixed(4)}) untuk simulasi checkin sekarang?`);
                    if (useFallback) {
                        applyCheckin(fallback.lat, fallback.lon, 25);
                    } else {
                        renderCheckinBox(orderId, role);
                    }
                    return;
                }

                try {
                    const position = await window.DriverGPS.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
                    applyCheckin(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
                } catch (error) {
                    console.warn("GPS Checkin error:", error);
                    let msg = 'Gagal mengambil sinyal GPS.';
                    const fallback = getFallbackCoordinates(fallbackAddr, role === 'resto');
                    const useFallback = confirm(`${msg}\n\nApakah Anda ingin menggunakan koordinat area pesanan (${fallback.lat.toFixed(4)}, ${fallback.lon.toFixed(4)}) untuk simulasi checkin sekarang?`);
                    if (useFallback) {
                        applyCheckin(fallback.lat, fallback.lon, 25);
                    } else {
                        showToast(msg, 'rose');
                        renderCheckinBox(orderId, role);
                    }
                }
            });
        }

        function scrollToCheckinSection() {
            const box = document.getElementById('resto-checkin-box');
            if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        let currentDetailOrder = null;
        let currentMapRouteMode = 'full';

        // ============================================================
        // HELPER GOOGLE MAPS NAVIGATION
        // Dibangun murni dari alamat yang diketik user (restoAddr / recipAddr,
        // fallback restoName / recipName) dengan encodeURIComponent.
        // Tidak memakai hasil geocoding/koordinat tebakan agar titik tidak meleset.
        // ============================================================
        function buildGmapsUrl(order, mode = 'full') {
            if (!order) return null;
            const resto = (order.restoAddr || order.restoName || '').trim();
            const recip = (order.recipAddr || order.recipName || '').trim();

            if (mode === 'resto') {
                if (!resto) return null;
                return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resto)}`;
            } else if (mode === 'recip') {
                if (!recip) return null;
                return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(recip)}`;
            } else { // 'full' (Rute Semua)
                if (!resto && !recip) return null;
                if (resto && recip) {
                    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(resto)}&destination=${encodeURIComponent(recip)}&travelmode=driving`;
                }
                if (recip) {
                    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(recip)}&travelmode=driving`;
                }
                return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resto)}`;
            }
        }

        // Perangkat sentuh (HP/tablet): peta tidak boleh langsung membuka Google Maps
        // karena mudah tersentuh tidak sengaja saat scroll/geser. Navigasi hanya lewat tombol.
        function isTouchDevice() {
            try {
                if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
            } catch (e) {}
            return (navigator.maxTouchPoints || 0) > 0 && window.innerWidth <= 820;
        }

        function openGmapsDirect(mode) {
            const targetOrder = currentDetailOrder;
            if (!targetOrder) return;
            const activeMode = mode || currentMapRouteMode || 'full';
            const url = buildGmapsUrl(targetOrder, activeMode);
            if (!url) {
                showToast("Alamat belum diisi", "rose");
                return;
            }
            window.open(url, '_blank', 'noopener');
        }

        function updateNavButtons(order, activeMode) {
            const btnNavRoute = document.getElementById('btn-gmap-route');
            const btnNavResto = document.getElementById('btn-gmap-resto');
            const btnNavRecip = document.getElementById('btn-gmap-recip');

            const m = activeMode || currentMapRouteMode || 'full';
            const routeUrl = buildGmapsUrl(order, m);
            const restoUrl = buildGmapsUrl(order, 'resto');
            const recipUrl = buildGmapsUrl(order, 'recip');

            if (btnNavRoute) {
                btnNavRoute.href = routeUrl || '#';
                btnNavRoute.onclick = (e) => {
                    e.preventDefault();
                    openGmapsDirect(currentMapRouteMode || 'full');
                };
            }
            if (btnNavResto) {
                btnNavResto.href = restoUrl || '#';
                btnNavResto.onclick = (e) => {
                    e.preventDefault();
                    openGmapsDirect('resto');
                };
            }
            if (btnNavRecip) {
                btnNavRecip.href = recipUrl || '#';
                btnNavRecip.onclick = (e) => {
                    e.preventDefault();
                    openGmapsDirect('recip');
                };
            }
        }

        async function initOrderMap(order) {
            currentDetailOrder = order;
            const restoAddr = order.restoAddr || order.restoName || 'Resto / Pengirim';
            const recipAddr = order.recipAddr || order.recipName || 'Tujuan / Penerima';
            const distanceBadge = document.getElementById('detail-calculated-distance');
            const placeholderEl = document.getElementById('map-checkin-placeholder');
            const modeSelector = document.getElementById('map-mode-selector');
            const btnNavRoute = document.getElementById('btn-gmap-route');

            if (leafletMapInstance) {
                leafletMapInstance.remove();
                leafletMapInstance = null;
            }
            mapRestoMarker = null;
            mapRecipMarker = null;
            mapPolyline = null;
            mapRestoCoords = null;
            mapRecipCoords = null;

            const hasResto = !!(order.restoCheckin && order.restoCheckin.lat && order.restoCheckin.lon);
            const hasRecip = !!(order.recipCheckin && order.recipCheckin.lat && order.recipCheckin.lon);

            // ============================================================
            // KONDISI 1: Belum ada Checkin sama sekali (0/2)
            // Map tracking dinonaktifkan agar tidak ada titik salah alamat
            // ============================================================
            if (!hasResto && !hasRecip) {
                if (placeholderEl) placeholderEl.classList.remove('hidden');
                if (modeSelector) modeSelector.classList.add('hidden');

                if (distanceBadge) {
                    distanceBadge.className = 'bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                    distanceBadge.innerHTML = '<i class="fa-solid fa-location-crosshairs mr-1"></i> Menunggu Checkin GPS (0/2)';
                }

                currentMapRouteMode = 'full';
                updateNavButtons(order, 'full');
                if (btnNavRoute) {
                    btnNavRoute.innerHTML = `<i class="fa-solid fa-diamond-turn-right text-amber-300 mr-1"></i> Navigasi Google Maps`;
                }
                return;
            }

            // ============================================================
            // KONDISI 2: Sudah ada Checkin (1 kali atau 2 kali)
            // Sembunyikan placeholder, tampilkan Leaflet map dan selector
            // ============================================================
            if (placeholderEl) placeholderEl.classList.add('hidden');
            if (modeSelector) modeSelector.classList.remove('hidden');

            const redIcon = L.divIcon({
                className: 'custom-pin-red',
                html: `<div class="relative flex flex-col items-center">
                        <div class="w-8 h-9 bg-gradient-to-b from-rose-500 to-rose-600 rounded-t-full rounded-b-xl border-2 border-white shadow-xl flex items-center justify-center text-white font-extrabold text-sm tracking-tighter">1</div>
                        <div class="w-2.5 h-2.5 bg-rose-600 transform rotate-45 -mt-1.5 border-r border-b border-white"></div>
                       </div>`,
                iconSize: [32, 42],
                iconAnchor: [16, 42]
            });

            const greenIcon = L.divIcon({
                className: 'custom-pin-green',
                html: `<div class="relative flex flex-col items-center">
                        <div class="w-8 h-9 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-t-full rounded-b-xl border-2 border-white shadow-xl flex items-center justify-center text-white font-extrabold text-sm tracking-tighter">2</div>
                        <div class="w-2.5 h-2.5 bg-emerald-600 transform rotate-45 -mt-1.5 border-r border-b border-white"></div>
                       </div>`,
                iconSize: [32, 42],
                iconAnchor: [16, 42]
            });

            // ============================================================
            // KASUS 2A: HANYA Checkin Sampai Lokasi Resto/Pengirim (1 Checkin)
            // Memunculkan map dan menampilkan 1 titik map Resto yang sudah dicheckin
            // ============================================================
            if (hasResto && !hasRecip) {
                mapRestoCoords = { lat: order.restoCheckin.lat, lon: order.restoCheckin.lon };

                leafletMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: true }).setView([mapRestoCoords.lat, mapRestoCoords.lon], 16);
                createBaseTileLayer().addTo(leafletMapInstance);

                // Leaflet click membuka Google Maps sesuai mode
                leafletMapInstance.on('click', () => { if (isTouchDevice()) return; openGmapsDirect(currentMapRouteMode || 'resto'); });

                mapRestoMarker = L.marker([mapRestoCoords.lat, mapRestoCoords.lon], { icon: redIcon }).addTo(leafletMapInstance)
                    .bindPopup(`<div class="space-y-1"><b>1. ${order.restoName || 'Resto / Pengirim'}</b><div class="text-[11px] text-slate-600">${restoAddr}</div><span class="inline-block bg-rose-50 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded border border-rose-200">📍 Titik GPS Resto Checkin (1/2)</span></div>`).openPopup();

                if (distanceBadge) {
                    distanceBadge.className = 'bg-rose-600 text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                    distanceBadge.innerHTML = '<i class="fa-solid fa-store mr-1"></i> Titik Resto Terverifikasi (Checkin 1/2)';
                }

                currentMapRouteMode = 'resto';
                updateNavButtons(order, 'resto');
                if (btnNavRoute) {
                    btnNavRoute.innerHTML = `<i class="fa-solid fa-store text-amber-300 mr-1"></i> Navigasi Ke Resto (#1)`;
                }

                updateMapModeButtons(true, false, 'resto');

                setTimeout(() => { if (leafletMapInstance) leafletMapInstance.invalidateSize(); }, 150);
                setTimeout(() => { if (leafletMapInstance) leafletMapInstance.invalidateSize(); }, 350);
                return;
            }

            // ============================================================
            // KASUS 2B: HANYA Checkin Sampai Lokasi Penerima (1 Checkin)
            // Memunculkan map dan menampilkan 1 titik map Penerima yang sudah dicheckin
            // ============================================================
            if (!hasResto && hasRecip) {
                mapRecipCoords = { lat: order.recipCheckin.lat, lon: order.recipCheckin.lon };

                leafletMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: true }).setView([mapRecipCoords.lat, mapRecipCoords.lon], 16);
                createBaseTileLayer().addTo(leafletMapInstance);

                // Leaflet click membuka Google Maps sesuai mode
                leafletMapInstance.on('click', () => { if (isTouchDevice()) return; openGmapsDirect(currentMapRouteMode || 'recip'); });

                mapRecipMarker = L.marker([mapRecipCoords.lat, mapRecipCoords.lon], { icon: greenIcon }).addTo(leafletMapInstance)
                    .bindPopup(`<div class="space-y-1"><b>2. ${order.recipName || 'Tujuan / Penerima'}</b><div class="text-[11px] text-slate-600">${recipAddr}</div><span class="inline-block bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-200">📍 Titik GPS Penerima Checkin (1/2)</span></div>`).openPopup();

                if (distanceBadge) {
                    distanceBadge.className = 'bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                    distanceBadge.innerHTML = '<i class="fa-solid fa-location-dot mr-1"></i> Titik Penerima Terverifikasi (Checkin 1/2)';
                }

                currentMapRouteMode = 'recip';
                updateNavButtons(order, 'recip');
                if (btnNavRoute) {
                    btnNavRoute.innerHTML = `<i class="fa-solid fa-location-dot text-amber-300 mr-1"></i> Navigasi Ke Penerima (#2)`;
                }

                updateMapModeButtons(false, true, 'recip');

                setTimeout(() => { if (leafletMapInstance) leafletMapInstance.invalidateSize(); }, 150);
                setTimeout(() => { if (leafletMapInstance) leafletMapInstance.invalidateSize(); }, 350);
                return;
            }

            // ============================================================
            // KASUS 2C: SUDAH CHECKIN 2 KALI (Resto DAN Penerima)
            // Memunculkan map dengan kedua titik dan garis rute tracking lengkap
            // ============================================================
            mapRestoCoords = { lat: order.restoCheckin.lat, lon: order.restoCheckin.lon };
            mapRecipCoords = { lat: order.recipCheckin.lat, lon: order.recipCheckin.lon };

            leafletMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: true }).setView([-7.558, 110.771], 13);
            createBaseTileLayer().addTo(leafletMapInstance);

            // Leaflet click membuka Google Maps sesuai mode
            leafletMapInstance.on('click', () => { if (isTouchDevice()) return; openGmapsDirect(currentMapRouteMode || 'full'); });

            const lat1 = mapRestoCoords.lat;
            const lon1 = mapRestoCoords.lon;
            const lat2 = mapRecipCoords.lat;
            const lon2 = mapRecipCoords.lon;

            currentMapRouteMode = 'full';
            updateNavButtons(order, 'full');
            if (btnNavRoute) {
                btnNavRoute.innerHTML = `<i class="fa-solid fa-diamond-turn-right text-amber-300 mr-1"></i> Navigasi Google Maps`;
            }

            mapRestoMarker = L.marker([lat1, lon1], { icon: redIcon }).addTo(leafletMapInstance)
                .bindPopup(`<div class="space-y-1"><b>1. ${order.restoName || 'Resto / Pengirim'}</b><div class="text-[11px] text-slate-600">${restoAddr}</div><span class="inline-block bg-rose-50 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded border border-rose-200">📍 Titik GPS Checkin Resto</span></div>`);
            mapRecipMarker = L.marker([lat2, lon2], { icon: greenIcon }).addTo(leafletMapInstance)
                .bindPopup(`<div class="space-y-1"><b>2. ${order.recipName || 'Tujuan / Penerima'}</b><div class="text-[11px] text-slate-600">${recipAddr}</div><span class="inline-block bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-200">📍 Titik GPS Checkin Penerima</span></div>`);

            updateMapModeButtons(true, true, 'full');

            try {
                const osrmRes = await RoadRouter.compat([[lat1, lon1], [lat2, lon2]]);
                
                if (osrmRes.ok) {
                    const osrmData = await osrmRes.json();
                    if (osrmData.routes && osrmData.routes.length > 0) {
                        const route = osrmData.routes[0];
                        const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        
                        mapPolyline = L.polyline(routeCoords, {
                            color: '#10B981',
                            weight: 6,
                            opacity: 0.9,
                            lineCap: 'round',
                            lineJoin: 'round'
                        }).addTo(leafletMapInstance);

                        const distKm = (route.distance / 1000).toFixed(1);
                        const durMin = Math.ceil(route.duration / 60);

                        if (distanceBadge) {
                            distanceBadge.className = 'bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                            distanceBadge.innerHTML = `<i class="fa-solid fa-route mr-1"></i> Rute GPS: ${distKm} km (${durMin} min) (2/2)`;
                        }
                        leafletMapInstance.fitBounds(mapPolyline.getBounds(), { padding: [35, 35] });

                        order.distanceKm = parseFloat(distKm);
                        order.routeDurationMin = durMin;
                        saveToLocalStorage();
                        renderAllViews();
                        refreshDetailFinancialFields(order);

                        setTimeout(() => {
                            if (leafletMapInstance) leafletMapInstance.invalidateSize();
                        }, 200);

                        setMapRouteMode('full');
                        return;
                    }
                }
            } catch (err) {
                console.warn("OSRM Route API fallback:", err);
            }

            // Tidak ada garis lurus: tampilkan kedua titik saja, rute jalan dicoba ulang otomatis.
            if (distanceBadge) {
                distanceBadge.className = 'bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow-sm';
                distanceBadge.innerHTML = `<i class="fa-solid fa-rotate mr-1"></i> Memuat rute jalan... (otomatis diulang)`;
            }
            leafletMapInstance.fitBounds(L.latLngBounds([[lat1, lon1], [lat2, lon2]]), { padding: [35, 35] });
            if (!window.__routeRetryS) window.__routeRetryS = 0;
            if (window.__routeRetryS < 5) { window.__routeRetryS++; setTimeout(() => { try { if (typeof currentDetailOrder !== 'undefined' && currentDetailOrder && currentDetailOrder.id === order.id && document.getElementById('detail-map')) initOrderMap(order); } catch (e) {} }, 8000 * window.__routeRetryS); }
            setTimeout(() => {
                if (leafletMapInstance) leafletMapInstance.invalidateSize();
            }, 200);

            setMapRouteMode('full');
        }

        function updateMapModeButtons(hasResto, hasRecip, activeMode) {
            const btnResto = document.getElementById('btn-mode-resto');
            const btnRecip = document.getElementById('btn-mode-recip');
            const btnFull = document.getElementById('btn-mode-full');

            if (!btnResto || !btnRecip || !btnFull) return;

            // Tombol Resto
            if (hasResto) {
                btnResto.disabled = false;
                btnResto.title = 'Fokus Titik Resto';
                btnResto.className = activeMode === 'resto'
                    ? 'py-1.5 px-2 rounded-lg bg-rose-600 text-white transition flex items-center justify-center gap-1 shadow-sm font-bold'
                    : 'py-1.5 px-2 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition flex items-center justify-center gap-1 font-bold';
            } else {
                btnResto.disabled = true;
                btnResto.title = 'Resto belum dicheckin';
                btnResto.className = 'py-1.5 px-2 rounded-lg text-slate-300 bg-slate-50 cursor-not-allowed transition flex items-center justify-center gap-1 font-normal';
            }

            // Tombol Penerima
            if (hasRecip) {
                btnRecip.disabled = false;
                btnRecip.title = 'Fokus Titik Penerima';
                btnRecip.className = activeMode === 'recip'
                    ? 'py-1.5 px-2 rounded-lg bg-emerald-600 text-white transition flex items-center justify-center gap-1 shadow-sm font-bold'
                    : 'py-1.5 px-2 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition flex items-center justify-center gap-1 font-bold';
            } else {
                btnRecip.disabled = true;
                btnRecip.title = 'Penerima belum dicheckin';
                btnRecip.className = 'py-1.5 px-2 rounded-lg text-slate-300 bg-slate-50 cursor-not-allowed transition flex items-center justify-center gap-1 font-normal';
            }

            // Tombol Rute Lengkap (perlu kedua titik)
            if (hasResto && hasRecip) {
                btnFull.disabled = false;
                btnFull.title = 'Lihat Rute Lengkap';
                btnFull.className = activeMode === 'full'
                    ? 'py-1.5 px-2 rounded-lg bg-indigo-600 text-white transition flex items-center justify-center gap-1 shadow-sm font-bold'
                    : 'py-1.5 px-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition flex items-center justify-center gap-1 font-bold';
            } else {
                btnFull.disabled = true;
                btnFull.title = 'Perlu 2 checkin untuk melihat rute';
                btnFull.className = 'py-1.5 px-2 rounded-lg text-slate-300 bg-slate-50 cursor-not-allowed transition flex items-center justify-center gap-1 font-normal';
            }
        }

        function setMapRouteMode(mode) {
            currentMapRouteMode = mode;
            if (currentDetailOrder) {
                updateNavButtons(currentDetailOrder, mode);
            }

            if (!leafletMapInstance) return;

            const hasResto = !!mapRestoCoords;
            const hasRecip = !!mapRecipCoords;
            const btnNavMain = document.getElementById('btn-gmap-route');

            if (mode === 'resto' && mapRestoCoords) {
                updateMapModeButtons(hasResto, hasRecip, 'resto');
                leafletMapInstance.setView([mapRestoCoords.lat, mapRestoCoords.lon], 16);
                if (mapRestoMarker) mapRestoMarker.openPopup();
                if (btnNavMain) {
                    btnNavMain.innerHTML = `<i class="fa-solid fa-store text-amber-300 mr-1"></i> Navigasi Ke Resto (#1)`;
                }
            } else if (mode === 'recip' && mapRecipCoords) {
                updateMapModeButtons(hasResto, hasRecip, 'recip');
                leafletMapInstance.setView([mapRecipCoords.lat, mapRecipCoords.lon], 16);
                if (mapRecipMarker) mapRecipMarker.openPopup();
                if (btnNavMain) {
                    btnNavMain.innerHTML = `<i class="fa-solid fa-location-dot text-amber-300 mr-1"></i> Navigasi Ke Penerima (#2)`;
                }
            } else if (mode === 'full') {
                if (mapRestoCoords && mapRecipCoords) {
                    updateMapModeButtons(hasResto, hasRecip, 'full');
                    if (mapPolyline) {
                        leafletMapInstance.fitBounds(mapPolyline.getBounds(), { padding: [35, 35] });
                    }
                    if (btnNavMain) {
                        btnNavMain.innerHTML = `<i class="fa-solid fa-diamond-turn-right text-amber-300 mr-1"></i> Navigasi Google Maps`;
                    }
                } else if (mapRestoCoords) {
                    setMapRouteMode('resto');
                } else if (mapRecipCoords) {
                    setMapRouteMode('recip');
                }
            }

            setTimeout(() => {
                if (leafletMapInstance) leafletMapInstance.invalidateSize();
            }, 100);
        }
