        // ============================================================
        // 2.1 & 2.2 — KALKULATOR PENDAPATAN BERSIH & BREAKDOWN PLATFORM
        // Tidak mengubah struktur order lama; orderIncome/platform/
        // manualFuelCost/distanceKm adalah field tambahan yang opsional.
        // ============================================================
        const FUEL_RATE_KEY = 'drivertrack_fuel_rate';
        const DEFAULT_FUEL_RATE = 600; // Rp per km, estimasi realistis motor (Rp600/km)

        function getFuelRate() {
            const saved = localStorage.getItem(FUEL_RATE_KEY);
            const val = parseFloat(saved);
            return (saved !== null && !isNaN(val) && val >= 0) ? val : DEFAULT_FUEL_RATE;
        }

        function saveFuelRateSetting() {
            const input = document.getElementById('setting-fuel-rate');
            const val = parseFloat(input.value);
            if (isNaN(val) || val < 0) {
                showToast("Masukkan angka tarif BBM yang valid.", "rose");
                return;
            }
            localStorage.setItem(FUEL_RATE_KEY, String(val));
            showToast("Tarif BBM per km berhasil disimpan.", "emerald");
            renderAllViews();
        }

        function loadFuelRateIntoSettingInput() {
            const input = document.getElementById('setting-fuel-rate');
            if (input) input.value = getFuelRate();
        }

        // Jarak Ambil->Antar untuk SATU sub-pesanan tertentu di order gabungan
        // (bukan seluruh rute). Beda dengan order.distanceKm yang dihitung dari
        // polyline rute lengkap di initCombinedOrderMap() — fungsi ini cuma
        // haversine antara checkin GPS resto & recip milik sub-pesanan tsb.
        // null = belum bisa dihitung (salah satu/kedua titik belum checkin GPS).
        function computeSubOrderDistanceKm(order, subIndex) {
            if (!order.isCombined) return 0;
            const pickupPoint = (order.points || []).find(p => p.subIndex === subIndex && p.role === 'resto');
            const dropoffPoint = (order.points || []).find(p => p.subIndex === subIndex && p.role === 'recip');
            if (!pickupPoint || !dropoffPoint) return 0;

            const pickupCheckin = getPointCheckin(order, pickupPoint);
            const dropoffCheckin = getPointCheckin(order, dropoffPoint);
            if (!pickupCheckin || !dropoffCheckin) return null;

            return parseFloat(calculateHaversineDistance(
                pickupCheckin.lat, pickupCheckin.lon,
                dropoffCheckin.lat, dropoffCheckin.lon
            ));
        }

        // Membagi order.orderIncome (total gabungan) & Est. BBM ke tiap sub-pesanan
        // secara proporsional terhadap jarak Ambil->Antar masing-masing. Sub-pesanan
        // yang belum checkin (distanceKm null) sementara di-exclude dari pembagian
        // proporsional dan dapat fallback bagi rata, sampai driver mulai checkin.
        // Return: array sepanjang subOrders, { subIndex, distanceKm, incomeShare, fuelCost, netIncome }.
        function computeCombinedSubOrderFinancials(order) {
            if (!order.isCombined) return [];
            ensureCombinedPoints(order);
            const fuelRate = getFuelRate();
            const n = (order.subOrders || []).length;
            if (n === 0) return [];

            const perSub = order.subOrders.map((sub, i) => {
                const dist = computeSubOrderDistanceKm(order, i); // number | null
                const manualFuel = (sub.manualFuelCost !== null && sub.manualFuelCost !== undefined && !isNaN(sub.manualFuelCost))
                    ? sub.manualFuelCost : null;
                return { subIndex: i, distanceKm: dist, manualFuel };
            });

            const knownDistances = perSub.filter(p => p.distanceKm !== null);
            const totalKnownKm = knownDistances.reduce((s, p) => s + p.distanceKm, 0);

            const totalIncome = order.orderIncome || 0;

            // BBM gabungan dihitung dari jarak RUTE satu perjalanan (order.distanceKm, termasuk
            // perpindahan antar resto), sama dengan "Total km" di Home. Sebelumnya hanya
            // jumlah garis lurus resto->penerima per pesanan sehingga BBM terlalu kecil.
            const routeKm = order.distanceKm > 0 ? order.distanceKm : null;
            const freeSubs = perSub.filter(q => q.manualFuel === null);
            const freeKnownKm = freeSubs.reduce((a, q) => a + (q.distanceKm || 0), 0);
            const routePool = routeKm !== null && n > 0 ? routeKm * fuelRate * (freeSubs.length / n) : null;
            const routeShare = q => {
                if (routePool === null) return null;
                return freeKnownKm > 0 ? routePool * ((q.distanceKm || 0) / freeKnownKm) : routePool / freeSubs.length;
            };

            return perSub.map(p => {
                let incomeShare;
                if (p.distanceKm === null) {
                    // Belum checkin -> belum bisa dapat porsi berbasis jarak.
                    incomeShare = totalKnownKm > 0 ? 0 : totalIncome / n;
                } else if (totalKnownKm > 0) {
                    incomeShare = totalIncome * (p.distanceKm / totalKnownKm);
                } else {
                    // Belum ada satupun jarak diketahui -> bagi rata sementara.
                    incomeShare = totalIncome / n;
                }

                const rs = p.manualFuel !== null ? null : routeShare(p);
                const fuelCost = p.manualFuel !== null
                    ? p.manualFuel
                    : (rs !== null ? rs : (p.distanceKm !== null ? p.distanceKm * fuelRate : 0));

                return {
                    subIndex: p.subIndex,
                    distanceKm: p.distanceKm,
                    incomeShare,
                    fuelCost,
                    netIncome: incomeShare - fuelCost
                };
            });
        }

        // Estimasi biaya BBM untuk satu order: prioritaskan input manual driver,
        // kalau kosong hitung otomatis dari jarak rute (distanceKm) x tarif Rp/km.
        // Order yang belum pernah dibuka petanya (distanceKm belum ada) dihitung 0
        // dan tidak dianggap error — akan otomatis terisi begitu peta pernah dibuka.
        // Untuk order gabungan, hitungnya beda: jumlah Est. BBM per sub-pesanan
        // (berbasis jarak Ambil->Antar masing-masing), bukan dari rute total.
        function computeOrderFuelCost(order) {
            if (order.isCombined) {
                const perSub = computeCombinedSubOrderFinancials(order);
                return perSub.reduce((s, p) => s + p.fuelCost, 0);
            }
            if (order.manualFuelCost !== null && order.manualFuelCost !== undefined && !isNaN(order.manualFuelCost)) {
                return order.manualFuelCost;
            }
            if (order.distanceKm) {
                return order.distanceKm * getFuelRate();
            }
            return 0;
        }

        function computeFinancialSummary(orders) {
            let grossIncome = 0, estFuelCost = 0, totalKm = 0, kmKnownCount = 0;
            orders.forEach(o => {
                grossIncome += (o.orderIncome || 0);
                estFuelCost += computeOrderFuelCost(o);
                if (o.distanceKm) { totalKm += o.distanceKm; kmKnownCount++; }
            });
            return {
                grossIncome,
                estFuelCost,
                netIncome: grossIncome - estFuelCost,
                totalKm,
                kmKnownCount,
                totalOrders: orders.length
            };
        }

        function computePlatformBreakdown(orders) {
            const map = {};
            const add = (p, inc) => {
                if (!map[p]) map[p] = { orders: 0, income: 0 };
                map[p].orders++; map[p].income += (inc || 0);
            };
            orders.forEach(o => {
                if (o.isCombined) {
                    // Pendapatan gabungan disimpan sebagai SATU total (sub-pesanan = 0),
                    // jadi pakai porsi hasil pembagian per jarak agar SPX tidak tampil Rp0.
                    let shares = [];
                    try { shares = computeCombinedSubOrderFinancials(o); } catch (e) {}
                    (o.subOrders || []).forEach((s, i) => add(effPlatform(s), (shares[i] && shares[i].incomeShare) || s.orderIncome || 0));
                    return;
                }
                add(effPlatform(o), o.orderIncome);
            });
            return map;
        }

        // Label teks untuk rentang tanggal aktif (dipakai di Dashboard & Orders
        // supaya konsisten, dan supaya Orders bisa kasih info jelas kenapa
        // daftarnya kosong/terbatas).
        function getActiveFilterPeriodLabel() {
            if (activeFilterDays === 'today' || activeFilterDays === 1) return 'Hari Ini';
            return activeFilterDays === 7 ? '7 Hari Terakhir' : (activeFilterDays === 30 ? '30 Hari Terakhir' : 'Semua Periode');
        }

        function renderFinancialSummaryUI(filtered) {
            const summary = computeFinancialSummary(filtered);
            document.getElementById('finance-gross').innerText = `Rp${Math.round(summary.grossIncome).toLocaleString('id-ID')}`;
            document.getElementById('finance-fuel').innerText = `Rp${Math.round(summary.estFuelCost).toLocaleString('id-ID')}`;
            document.getElementById('finance-net').innerText = `Rp${Math.round(summary.netIncome).toLocaleString('id-ID')}`;

            const periodLabel = getActiveFilterPeriodLabel();
            document.getElementById('finance-period-label').innerText = periodLabel;

            const kmInfoEl = document.getElementById('finance-km-info');
            if (summary.kmKnownCount === 0) {
                kmInfoEl.innerText = 'Buka detail peta tiap order agar jarak & estimasi BBM terhitung otomatis.';
            } else {
                kmInfoEl.innerText = `Total ${summary.totalKm.toFixed(1)} km dari ${summary.kmKnownCount}/${summary.totalOrders} order yang sudah dipetakan.`;
            }
        }

        // Foto asli vs placeholder: createSVGPlaceholder() selalu menghasilkan
        // data URI berawalan 'data:image/svg+xml', sementara foto asli hasil
        // upload user selalu 'data:image/<jpeg|png|...>' dari FileReader.
        // Dipakai supaya "Screenshots" cuma menghitung foto yang BENERAN
        // tersimpan, bukan placeholder otomatis.
        function isRealScreenshot(src) {
            return !!src && !src.startsWith('data:image/svg+xml');
        }

        // Menghitung total foto asli di semua order dalam daftar, termasuk
        // tiap sub-pesanan di order gabungan (yang masing-masing punya
        // screenshot sendiri) — bukan sekadar jumlah kartu order.
        function countRealScreenshots(orders) {
            let count = 0;
            orders.forEach(o => {
                if (o.isCombined) {
                    (o.subOrders || []).forEach(s => {
                        if (isRealScreenshot(s.screenshot)) count++;
                    });
                } else if (isRealScreenshot(o.screenshot)) {
                    count++;
                }
            });
            return count;
        }

        // Jumlah unit order HARI INI (kalender lokal, mulai 00:00), diambil dari
        // SELURUH ordersList — bukan cuma yang lolos filter tab 7/30/Semua Hari.
        function getTodayOrderUnitCount() {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const cutoff = startOfToday.getTime();
            return countOrderUnits(ordersList.filter(o => o.timestamp >= cutoff));
        }

        // Pembagi rata-rata order/hari: pakai rentang HARI AKTUAL dari order
        // tertua di data terfilter sampai sekarang, dibatasi maksimal panjang
        // tab filter yang dipilih.
        function computeDaysSpan(filteredOrders, filterDays) {
            if (filteredOrders.length === 0) return 1;
            if (filterDays === 'today' || filterDays === 1) return 1;
            const earliest = Math.min(...filteredOrders.map(o => o.timestamp));
            const daysSinceEarliest = Math.max(1, Math.ceil((Date.now() - earliest) / 86400000));
            if (filterDays === 'all') return daysSinceEarliest;
            return Math.min(filterDays, daysSinceEarliest);
        }

        function renderAllViews() {
            const filtered = getFilteredOrders();
            
            // Hero Stats
            const unitCount = countOrderUnits(filtered);
            document.getElementById('hero-total-orders').innerText = `${unitCount} Orders`;
            document.getElementById('home-count-badge').innerText = filtered.length;
            
            const baseDailyTarget = insightsDailyTarget || 10;
            const daysCount = computeDaysSpan(filtered, activeFilterDays);
            
            let targetLabel = '';
            let targetCount = baseDailyTarget;
            let currentAchieved = 0;

            if (activeFilterDays === 'today' || activeFilterDays === 1) {
                targetCount = baseDailyTarget;
                targetLabel = `Target Harian (${baseDailyTarget} Order)`;
                currentAchieved = getTodayOrderUnitCount();
            } else if (activeFilterDays === 7) {
                targetCount = baseDailyTarget * 7;
                targetLabel = `Target 7 Hari (${targetCount} Order)`;
                currentAchieved = unitCount;
            } else if (activeFilterDays === 30) {
                targetCount = baseDailyTarget * 30;
                targetLabel = `Target 30 Hari (${targetCount} Order)`;
                currentAchieved = unitCount;
            } else { // 'all'
                targetCount = Math.max(baseDailyTarget, baseDailyTarget * daysCount);
                targetLabel = `Target Semua (${targetCount} Order)`;
                currentAchieved = unitCount;
            }

            const targetLabelEl = document.getElementById('hero-target-label');
            if (targetLabelEl) {
                targetLabelEl.innerText = targetLabel;
            }

            const progress = targetCount > 0 ? Math.min(100, Math.round((currentAchieved / targetCount) * 100)) : 0;
            document.getElementById('hero-progress-text').innerText = `${currentAchieved}/${targetCount} (${progress}%)`;
            document.getElementById('hero-progress-bar').style.width = `${progress}%`;

            document.getElementById('kpi-avg-daily').innerText = (unitCount / daysCount).toFixed(1);
            document.getElementById('kpi-screenshot-count').innerText = countRealScreenshots(filtered);

            // Compute Peak Hour
            const hoursCount = {};
            filtered.forEach(o => {
                const hour = new Date(o.timestamp).getHours();
                hoursCount[hour] = (hoursCount[hour] || 0) + 1;
            });
            let maxHour = '-', maxVal = 0;
            for (const h in hoursCount) {
                if (hoursCount[h] > maxVal) {
                    maxVal = hoursCount[h];
                    maxHour = `${String(h).padStart(2, '0')}:00`;
                }
            }
            document.getElementById('kpi-peak-hour').innerText = maxHour;

            renderFinancialSummaryUI(filtered);
            renderDailyDriverMessage();
            renderHomeOrders(filtered.slice(0, 3));
            renderOrdersList(filtered);
            if (activeTab === 'insights') {
                renderInsightsView();
            }
        }

        function renderHomeOrders(orders) {
            const container = document.getElementById('home-recent-orders');
            if (orders.length === 0) {
                container.innerHTML = `
                    <div class="bg-white p-6 rounded-3xl text-center border border-slate-100 space-y-2.5 shadow-sm">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-sm">
                            <i class="fa-solid fa-receipt"></i>
                        </div>
                        <p class="text-xs text-slate-400 font-medium">Belum ada pesanan terbaru.</p>
                        <button type="button" onclick="switchTab('upload')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-sm active:scale-95">
                            <i class="fa-solid fa-plus text-[10px]"></i> Tambah pesanan pertama
                        </button>
                    </div>`;
                return;
            }
            container.innerHTML = orders.map(o => createOrderCardHTML(o)).join('');
        }

        function renderOrdersList(orders = getFilteredOrders()) {
            const container = document.getElementById('orders-container');
            const emptyState = document.getElementById('empty-orders-state');
            const titleEl = document.getElementById('empty-orders-title');
            const descEl = document.getElementById('empty-orders-desc');
            const widenBtn = document.getElementById('empty-orders-widen-btn');

            if (orders.length === 0) {
                container.innerHTML = '';
                emptyState.classList.remove('hidden');

                if (ordersList.length === 0) {
                    // Benar-benar belum pernah ada pesanan sama sekali.
                    if (titleEl) titleEl.innerText = 'Belum Ada Pesanan';
                    if (descEl) descEl.innerText = 'Upload screenshot detail pesanan driver untuk mulai mencatat secara otomatis.';
                    if (widenBtn) widenBtn.classList.add('hidden');
                } else {
                    // Ada pesanan di data, tapi gak ada yang cocok filter
                    // saat ini (kemungkinan besar rentang tanggal). Kasih
                    // info jelas + tombol buat langsung perluas rentang,
                    // supaya user gak bingung kayak lihat "kosong" padahal
                    // datanya ada, cuma ketutup filter.
                    const periodLabel = getActiveFilterPeriodLabel();
                    if (titleEl) titleEl.innerText = 'Tidak Ada Pesanan di Filter Ini';
                    if (descEl) descEl.innerText = `Kamu punya ${ordersList.length} pesanan tersimpan, tapi tidak ada yang cocok dengan filter saat ini (rentang: ${periodLabel}, atau kategori/pembayaran/platform/pencarian yang dipilih).`;
                    if (widenBtn) widenBtn.classList.toggle('hidden', activeFilterDays === 'all');
                }
                return;
            }
            emptyState.classList.add('hidden');
            container.innerHTML = orders.map(o => createOrderCardHTML(o)).join('');
        }

        function createOrderCardHTML(o) {
            if (window.__isNeon && window.__isNeon() && typeof createNeonOrderCardHTML === 'function') return createNeonOrderCardHTML(o);
            if (o.isCombined) return createCombinedOrderCardHTML(o);
            const isCash = o.cashAmount > 0;
            const payBadge = isCash 
                ? `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md font-extrabold text-[10px]">💵 Tunai (Rp${o.cashAmount.toLocaleString('id-ID')})</span>`
                : `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-bold text-[10px]">💳 Non-Tunai (Rp0)</span>`;

            let catIcon = 'fa-utensils text-amber-500';
            let catBadge = 'bg-amber-50 text-amber-700 border-amber-200';
            if (o.category === 'SPX') { catIcon = 'fa-box text-orange-500'; catBadge = 'bg-orange-50 text-orange-700 border-orange-200'; }
            if (o.category === 'Instan') { catIcon = 'fa-bolt text-emerald-500'; catBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }

            let subInfo = '';
            if (o.category === 'Food') {
                subInfo = `<div class="text-[10px] text-slate-500">Code: <strong class="text-indigo-600">${o.codeOrder || '-'}</strong> • ${o.totalMenu || ''}</div>`;
            } else if (o.category === 'SPX') {
                subInfo = `<div class="text-[10px] text-slate-500">Kode: <strong class="text-orange-600">${o.codeOrder || '-'}</strong> • Berat: ${o.weight || '-'} • Dimensi: ${o.dimensions || '-'}</div>`;
            } else {
                subInfo = `<div class="text-[10px] text-slate-500">Kat: <strong>${o.itemCategory || 'Barang'}</strong> • Berat: ${o.weight || '-'}</div>`;
            }

            const formattedTime = new Date(o.timestamp).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

            const platformLabels = { 'SPX Instan': '⚡ SPX Instan', SPX: '📦 SPX', ShopeeFood: '🛍️ ShopeeFood', Grab: '🟢 Grab', Gojek: '🟩 Gojek', Lainnya: '📱 Lainnya' };
            const platformBadge = `<span class="bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-md font-bold text-[10px]">${platformLabels[effPlatform(o)] || platformLabels.Lainnya}</span>`;
            const incomeBadge = (o.orderIncome || 0) > 0
                ? `<span class="text-[10px] font-extrabold text-emerald-600">+Rp${o.orderIncome.toLocaleString('id-ID')}</span>`
                : '';

            return `
            <div class="bg-white rounded-3xl p-4 card-shadow border border-slate-100 space-y-3 relative transition hover:border-indigo-200">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-bold px-2.5 py-1 rounded-xl border ${catBadge} flex items-center gap-1">
                            <i class="fa-solid ${catIcon}"></i> ${o.category}
                        </span>
                        ${platformBadge}
                        <span class="text-[10px] text-slate-400 font-semibold">${formattedTime}</span>
                    </div>
                    ${payBadge}
                </div>

                <div class="flex items-start gap-3">
                    <img src="${o.screenshot}" alt="Screenshot" onclick="openImageModal('${o.screenshot}')" class="w-16 h-20 object-cover rounded-2xl border border-slate-200 cursor-pointer hover:opacity-90 transition flex-shrink-0 shadow-sm">
                    <div class="flex-1 space-y-1 overflow-hidden">
                        <h4 class="font-bold text-slate-900 text-xs truncate">${o.restoName}</h4>
                        <p class="text-[11px] text-slate-500 line-clamp-1"><i class="fa-solid fa-location-dot text-rose-500 mr-1"></i> ${o.recipName} (${o.recipAddr})</p>
                        ${subInfo}
                    </div>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <span class="text-[10px] text-slate-400 font-mono truncate">ID: ${o.id}</span>
                        ${incomeBadge}
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button onclick="openEditModal('${o.id}')" class="text-xs font-extrabold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1" title="Edit Pesanan">
                            <i class="fa-solid fa-pen-to-square text-amber-500"></i> Edit
                        </button>
                        <button onclick="deleteOrder('${o.id}')" class="text-xs font-extrabold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1" title="Hapus Pesanan">
                            <i class="fa-solid fa-trash text-rose-500"></i>
                        </button>
                        <button onclick="openOrderDetailModal('${o.id}')" class="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1" title="Lihat Detail &amp; Peta">
                            <i class="fa-solid fa-route text-indigo-500"></i> Detail
                        </button>
                    </div>
                </div>
            </div>`;
        }

        // Kartu order khusus untuk record isCombined:true (Orderan Gabungan).
        function createCombinedOrderCardHTML(o) {
            const isCash = o.cashAmount > 0;
            const payBadge = isCash
                ? `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md font-extrabold text-[10px]">💵 Tunai (Rp${o.cashAmount.toLocaleString('id-ID')})</span>`
                : `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-bold text-[10px]">💳 Non-Tunai (Rp0)</span>`;

            const catCounts = {};
            (o.subOrders || []).forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });
            const catIconsMap = { Food: '🍲', SPX: '📦', Instan: '⚡' };
            const catIconsHTML = Object.entries(catCounts).map(([cat, n]) =>
                `<span class="text-[10px] font-bold text-slate-600">${catIconsMap[cat] || '📦'}×${n}</span>`).join(' ');

            const formattedTime = new Date(o.timestamp).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const incomeBadge = (o.orderIncome || 0) > 0
                ? `<span class="text-[10px] font-extrabold text-emerald-600">+Rp${o.orderIncome.toLocaleString('id-ID')}</span>`
                : '';

            const namesPreview = (o.subOrders || []).slice(0, 3).map(s => escapeHtml(s.recipName || '-')).join(', ') +
                ((o.subOrders || []).length > 3 ? ', ...' : '');

            return `
            <div class="bg-white rounded-3xl p-4 card-shadow border border-indigo-200 space-y-3 relative transition hover:border-indigo-400">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-bold px-2.5 py-1 rounded-xl border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                            <i class="fa-solid fa-link"></i> Gabungan • ${(o.subOrders || []).length} pesanan
                        </span>
                        <span class="text-[10px] text-slate-400 font-semibold">${formattedTime}</span>
                    </div>
                    ${payBadge}
                </div>

                <div class="flex items-start gap-3">
                    <img src="${o.screenshot}" alt="Screenshot" onclick="openImageModal('${o.screenshot}')" class="w-16 h-20 object-cover rounded-2xl border border-slate-200 cursor-pointer hover:opacity-90 transition flex-shrink-0 shadow-sm">
                    <div class="flex-1 space-y-1 overflow-hidden">
                        <h4 class="font-bold text-slate-900 text-xs truncate">${o.restoName} → ${o.recipName}</h4>
                        <p class="text-[11px] text-slate-500 line-clamp-1"><i class="fa-solid fa-location-dot text-rose-500 mr-1"></i> ${namesPreview}</p>
                        <div class="text-[10px] text-slate-500 flex items-center gap-2">${catIconsHTML}</div>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <span class="text-[10px] text-slate-400 font-mono truncate">ID: ${o.id}</span>
                        ${incomeBadge}
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button onclick="openEditModal('${o.id}')" class="text-xs font-extrabold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1" title="Edit Pesanan">
                            <i class="fa-solid fa-pen-to-square text-amber-500"></i> Edit
                        </button>
                        <button onclick="deleteOrder('${o.id}')" class="text-xs font-extrabold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1" title="Hapus Pesanan">
                            <i class="fa-solid fa-trash text-rose-500"></i>
                        </button>
                        <button onclick="openOrderDetailModal('${o.id}')" class="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1" title="Lihat Detail &amp; Peta">
                            <i class="fa-solid fa-route text-indigo-500"></i> Detail
                        </button>
                    </div>
                </div>
            </div>`;
        }

        function openOrderDetailModal(orderId) {
            const order = ordersList.find(o => o.id === orderId);
            if (!order) return;

            currentDetailOrder = order;
            currentMapRouteMode = 'full';

            if (order.isCombined) {
                openCombinedOrderDetailModal(order);
                return;
            }
            document.getElementById('detail-single-point-container').classList.remove('hidden');
            document.getElementById('detail-combined-points-container').classList.add('hidden');
            const btnNavRestoReset = document.getElementById('btn-gmap-resto');
            const btnNavRecipReset = document.getElementById('btn-gmap-recip');
            if (btnNavRestoReset) btnNavRestoReset.style.display = '';
            if (btnNavRecipReset) btnNavRecipReset.style.display = '';
            document.getElementById('detail-notes-container').classList.remove('hidden');
            document.getElementById('detail-screenshot-container').classList.remove('hidden');
            document.getElementById('detail-screenshot-multi-container').classList.add('hidden');

            document.getElementById('detail-modal-category-badge').innerText = order.category;
            document.getElementById('detail-modal-title').innerText = order.restoName;

            // Fill Category specific box
            const catBox = document.getElementById('detail-category-box');
            if (order.category === 'Food') {
                catBox.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-extrabold text-amber-700"><i class="fa-solid fa-utensils mr-1"></i> Pesanan Food</span>
                        <span class="bg-amber-100 text-amber-800 font-mono font-bold px-2 py-0.5 rounded">${order.codeOrder || '-'}</span>
                    </div>
                    <p class="text-slate-700"><strong>Menu:</strong> ${order.totalMenu || '-'}</p>
                    <p class="text-slate-400 text-[10px]">No. Pesanan: ${order.orderNo || '-'}</p>`;
            } else if (order.category === 'SPX') {
                catBox.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-extrabold text-orange-700"><i class="fa-solid fa-box mr-1"></i> Paket SPX</span>
                        <span class="bg-orange-100 text-orange-800 font-mono font-bold px-2 py-0.5 rounded">${order.codeOrder || '-'}</span>
                    </div>
                    <p class="text-slate-700"><strong>Berat:</strong> ${order.weight || '-'} | <strong>Dimensi:</strong> ${order.dimensions || '-'}</p>`;
            } else {
                catBox.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-extrabold text-emerald-700"><i class="fa-solid fa-bolt mr-1"></i> SPX Instan</span>
                        <span class="bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded">${order.itemCategory || 'Barang'}</span>
                    </div>
                    <p class="text-slate-700"><strong>Berat:</strong> ${order.weight || '-'}</p>
                    <p class="text-slate-400 text-[10px]">No. Pesanan: ${order.orderNo || '-'}</p>`;
            }

            document.getElementById('detail-resto-name').innerText = order.restoName;
            document.getElementById('detail-resto-addr').innerText = order.restoAddr || '-';
            document.getElementById('detail-recip-name').innerText = order.recipName;
            document.getElementById('detail-recip-addr').innerText = order.recipAddr || '-';
            const notesVal = order.notes || '-';
            document.getElementById('detail-notes-text').innerText = notesVal;
            const notesContainer = document.getElementById('detail-notes-container');
            if (!notesVal || notesVal === '-' || notesVal.trim() === '') {
                notesContainer.classList.add('hidden');
            } else {
                notesContainer.classList.remove('hidden');
            }
            document.getElementById('detail-time').innerText = new Date(order.timestamp).toLocaleString('id-ID');
            document.getElementById('detail-id').innerText = order.id;

            const payBadge = document.getElementById('detail-payment-badge');
            if (order.cashAmount > 0) {
                payBadge.className = 'px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800';
                payBadge.innerText = `💵 Tunai (Rp${order.cashAmount.toLocaleString('id-ID')})`;
            } else {
                payBadge.className = 'px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800';
                payBadge.innerText = `💳 Non-Tunai`;
            }

            const platformLabelsModal = { 'SPX Instan': '⚡ SPX Instan', SPX: '📦 SPX (Shopee Xpress)', ShopeeFood: '🛍️ ShopeeFood', Grab: '🟢 Grab', Gojek: '🟩 Gojek', Lainnya: '📱 Lainnya' };
            document.getElementById('detail-platform-badge').innerText = platformLabelsModal[effPlatform(order)] || platformLabelsModal.Lainnya;
            document.getElementById('detail-income-val').innerText = `Rp${(order.orderIncome || 0).toLocaleString('id-ID')}`;
            const fuelCost = computeOrderFuelCost(order);
            document.getElementById('detail-fuelcost-val').innerText = `Rp${Math.round(fuelCost).toLocaleString('id-ID')}`;
            document.getElementById('detail-netincome-val').innerText = `Rp${Math.round((order.orderIncome || 0) - fuelCost).toLocaleString('id-ID')}`;

            document.getElementById('detail-screenshot-img').src = order.screenshot;
            document.getElementById('order-detail-modal').classList.remove('hidden');

            renderCheckinBox(order.id, 'resto');
            renderCheckinBox(order.id, 'recip');

            // Render Map with delay to fix tile calculation
            setTimeout(() => {
                initOrderMap(order);
            }, 150);
        }

        // Refresh angka Est. BBM/Bersih di modal detail setelah distanceKm baru
        // dihitung (mis. setelah peta selesai memuat rute). Aman dipanggil kapan
        // saja karena hanya menulis ulang beberapa span, tidak menutup/membuka modal.
        function refreshDetailFinancialFields(order) {
            const fuelEl = document.getElementById('detail-fuelcost-val');
            const netEl = document.getElementById('detail-netincome-val');
            if (!fuelEl || !netEl) return;
            const fuelCost = computeOrderFuelCost(order);
            fuelEl.innerText = `Rp${Math.round(fuelCost).toLocaleString('id-ID')}`;
            netEl.innerText = `Rp${Math.round((order.orderIncome || 0) - fuelCost).toLocaleString('id-ID')}`;
            if (order.isCombined) {
                renderCombinedSubFinancials(order);
            }
        }

        function closeOrderDetailModal() {
            document.getElementById('order-detail-modal').classList.add('hidden');
            currentDetailOrder = null;
            if (leafletMapInstance) {
                leafletMapInstance.remove();
                leafletMapInstance = null;
            }
        }

        function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return (R * c).toFixed(2);
        }
