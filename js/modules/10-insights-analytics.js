        // ============================================================
        // CONTROLLER INSIGHTS: MY SCHEDULE & TODAY'S PROGRESS
        // Mengikuti UI Gambar: Kalender Mingguan, Donut Ring, Order Plan
        // Data diambil dari input user & klik kartu membuka detail pesanan
        // ============================================================
        let insightsSelectedDate = new Date();
        let insightsDailyTarget = parseInt(localStorage.getItem('drivertrack_daily_target') || '10');
        let insightsPeriodMode = 'daily'; // 'daily' | 'weekly'

        function initInsightsDate() {
            if (ordersList && ordersList.length > 0) {
                const todayHasOrders = ordersList.some(o => isSameDay(o.timestamp, new Date()));
                if (!todayHasOrders) {
                    const sorted = [...ordersList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    if (sorted[0] && sorted[0].timestamp) {
                        insightsSelectedDate = new Date(sorted[0].timestamp);
                        return;
                    }
                }
            }
            insightsSelectedDate = new Date();
        }

        function isSameDay(d1Val, d2Val) {
            const d1 = new Date(d1Val);
            const d2 = new Date(d2Val);
            return d1.getFullYear() === d2.getFullYear() &&
                   d1.getMonth() === d2.getMonth() &&
                   d1.getDate() === d2.getDate();
        }

        function selectInsightsDate(isoDateStr) {
            insightsSelectedDate = new Date(isoDateStr);
            renderInsightsView();
        }

        function navigateInsightsWeek(direction) {
            const newDate = new Date(insightsSelectedDate);
            newDate.setDate(newDate.getDate() + (direction * 7));
            insightsSelectedDate = newDate;
            renderInsightsView();
        }

        function onInsightsMonthChange(val) {
            if (!val) return;
            const parts = val.split('-');
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            insightsSelectedDate = new Date(year, month - 1, 1);
            renderInsightsView();
        }

        function openTargetModal() {
            const val = prompt('Masukkan target jumlah pesanan harian Anda:', insightsDailyTarget);
            if (val && !isNaN(val) && parseInt(val) > 0) {
                insightsDailyTarget = parseInt(val);
                localStorage.setItem('drivertrack_daily_target', String(insightsDailyTarget));
                renderInsightsView();
                renderDailyDriverMessage();
                showToast(`Target harian diatur ke ${insightsDailyTarget} pesanan.`, 'emerald');
            }
        }

        // ============================================================
        // PERIOD TOGGLE: Harian | Mingguan
        // ============================================================
        function setInsightsPeriodMode(mode) {
            insightsPeriodMode = mode;
            const btnDaily = document.getElementById('btn-period-daily');
            const btnWeekly = document.getElementById('btn-period-weekly');
            if (btnDaily && btnWeekly) {
                if (mode === 'daily') {
                    btnDaily.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl bg-white text-emerald-700 shadow-sm transition';
                    btnWeekly.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-900 transition';
                } else {
                    btnWeekly.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl bg-white text-emerald-700 shadow-sm transition';
                    btnDaily.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-900 transition';
                }
            }
            renderInsightsView();
        }

        function getWeekBounds(date) {
            const curr = new Date(date);
            // Minggu kerja: Senin 00:00:00.000 s/d Minggu 23:59:59.999
            const dow = (curr.getDay() + 6) % 7; // 0=Senin ... 6=Minggu
            const start = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() - dow, 0, 0, 0, 0);
            const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
            return { start, end };
        }

        function formatWeekRange(start, end) {
            const opts = { day: 'numeric', month: 'short', year: 'numeric' };
            const s = start.toLocaleDateString('id-ID', opts);
            const e = end.toLocaleDateString('id-ID', opts);
            return `${s} – ${e}`;
        }

        function toggleExtraCharts() {
            const container = document.getElementById('extra-charts-container');
            const label = document.getElementById('toggle-charts-label');
            const icon = document.getElementById('toggle-charts-icon');
            if (!container) return;

            const isHidden = container.classList.contains('hidden');
            if (isHidden) {
                container.classList.remove('hidden');
                if (label) label.innerText = 'Sembunyikan Analisis Grafik';
                if (icon) icon.classList.add('rotate-180');
                renderCharts();
            } else {
                container.classList.add('hidden');
                if (label) label.innerText = 'Tampilkan Analisis Grafik Jam & Platform';
                if (icon) icon.classList.remove('rotate-180');
            }
        }

        function renderInsightsView() {
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            const currentYear = insightsSelectedDate.getFullYear();
            const currentMonthIndex = insightsSelectedDate.getMonth();
            const monthLabelEl = document.getElementById('insights-month-label');
            const monthInputEl = document.getElementById('insights-month-input');

            if (monthLabelEl) {
                monthLabelEl.innerText = `${monthNames[currentMonthIndex]}, ${currentYear}`;
            }
            if (monthInputEl) {
                const monthStr = String(currentMonthIndex + 1).padStart(2, '0');
                monthInputEl.value = `${currentYear}-${monthStr}`;
            }

            // 1. Render Strip Kalender Mingguan (Senin - Minggu)
            renderInsightsWeekStrip();

            // ----------------------------------------------------------------
            // DAILY vs WEEKLY mode
            // ----------------------------------------------------------------
            const { start: weekStart, end: weekEnd } = getWeekBounds(insightsSelectedDate);
            const weekOrders = ordersList.filter(o => {
                const ts = new Date(o.timestamp);
                return ts >= weekStart && ts <= weekEnd;
            });

            const isWeekly = insightsPeriodMode === 'weekly';

            // Judul kartu
            const progressTitleEl = document.getElementById('insights-progress-title');
            const ordersTitleEl = document.getElementById('insights-orders-title');
            if (progressTitleEl) progressTitleEl.innerText = isWeekly ? "Weekly Progress" : "Today's Progress";
            if (ordersTitleEl) ordersTitleEl.innerText = isWeekly ? "This Week's Orders" : "Today's Orders";

            // Range label
            const rangeEl = document.getElementById('insights-range-label');
            if (rangeEl) {
                rangeEl.innerText = isWeekly ? formatWeekRange(weekStart, weekEnd) : '';
            }

            // Badge grafik
            const badgeEl = document.getElementById('comparison-chart-badge');
            if (badgeEl) badgeEl.innerText = isWeekly ? '7 Hari' : 'Hari Ini';
            const subtitleEl = document.getElementById('comparison-chart-subtitle');
            if (subtitleEl) subtitleEl.innerText = isWeekly ? 'Perbandingan 7 hari (Senin - Minggu)' : 'Pendapatan & BBM hari terpilih per jam';

            // 2. Pilih pesanan yang akan diarahkan
            const dayOrders = ordersList.filter(o => isSameDay(o.timestamp, insightsSelectedDate));
            const targetOrders = isWeekly ? weekOrders : dayOrders;

            // 3. Hitung Agregasi Data (jumlah pesanan dihitung per subOrder untuk Gabungan)
            const totalOrders = countOrderUnits(targetOrders);
            let totalIncome = 0;
            let totalFuel = 0;
            let foodCount = 0;
            let spxCount = 0;

            targetOrders.forEach(o => {
                totalIncome += (o.orderIncome || 0);
                totalFuel += computeOrderFuelCost(o);
                if (o.isCombined) {
                    (o.subOrders || []).forEach(s => {
                        if (s.category === 'Food') foodCount++;
                        if (s.category === 'SPX' || s.category === 'Instan') spxCount++;
                    });
                } else {
                    if (o.category === 'Food') foodCount++;
                    if (o.category === 'SPX' || o.category === 'Instan') spxCount++;
                }
            });

            const netIncome = Math.max(0, totalIncome - totalFuel);

            // Target (harian atau mingguan)
            const effectiveTarget = isWeekly ? (insightsDailyTarget * 7) : insightsDailyTarget;

            // 4. Update Circular Donut Ring Progress
            const ringEl = document.getElementById('insights-ring-progress');
            const ringValEl = document.getElementById('insights-ring-value');
            const ringSubEl = document.getElementById('insights-ring-sublabel');
            const ringUnitEl = document.getElementById('insights-ring-unit');

            const circumference = 251.327; // 2 * PI * r (r=40)
            const progressRatio = Math.min(totalOrders / effectiveTarget, 1);
            const strokeOffset = circumference * (1 - progressRatio);

            if (ringEl) {
                ringEl.style.strokeDashoffset = strokeOffset;
            }

            {
                const isTodaySel = isSameDay(insightsSelectedDate, new Date());
                if (ringSubEl) ringSubEl.innerText = isWeekly ? 'Minggu ini' : (isTodaySel ? 'Hari ini' : insightsSelectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
                if (ringValEl) ringValEl.innerText = totalOrders;
                if (ringUnitEl) ringUnitEl.innerText = 'order';
            }

            // 5. Update Metrik Kanan (Income & Fuel)
            const incomeEl = document.getElementById('insights-metric-income');
            const fuelEl = document.getElementById('insights-metric-fuel');
            if (incomeEl) incomeEl.innerText = `Rp${Math.round(totalIncome).toLocaleString('id-ID')}`;
            if (fuelEl) fuelEl.innerText = `Rp${Math.round(totalFuel).toLocaleString('id-ID')}`;
            const noteEl = document.getElementById('insights-fuel-note');
            if (noteEl) {
                const gap = targetOrders.filter(o => {
                    if (o.manualFuelCost !== null && o.manualFuelCost !== undefined && !isNaN(o.manualFuelCost)) return false;
                    if (!(o.distanceKm > 0)) return true;
                    if (o.isCombined) {
                        ensureCombinedPoints(o);
                        return (o.points || []).some(pt => !getPointCheckin(o, pt));
                    }
                    return false;
                }).length;
                noteEl.classList.toggle('hidden', gap === 0);
                noteEl.innerText = gap ? `${gap} order belum lengkap dipetakan, BBM mungkin lebih besar` : '';
            }

            // 6. Update 3 Mini Progress Bar
            const barFoodVal = document.getElementById('insights-bar-food-val');
            const barFoodProg = document.getElementById('insights-bar-food-progress');
            const barSpxVal = document.getElementById('insights-bar-spx-val');
            const barSpxProg = document.getElementById('insights-bar-spx-progress');
            const barNetVal = document.getElementById('insights-bar-net-val');
            const barNetProg = document.getElementById('insights-bar-net-progress');

            if (barFoodVal) barFoodVal.innerText = `${foodCount}/${totalOrders}`;
            if (barFoodProg) barFoodProg.style.width = `${totalOrders > 0 ? (foodCount / totalOrders) * 100 : 0}%`;

            if (barSpxVal) barSpxVal.innerText = `${spxCount}/${totalOrders}`;
            if (barSpxProg) barSpxProg.style.width = `${totalOrders > 0 ? (spxCount / totalOrders) * 100 : 0}%`;

            if (barNetVal) barNetVal.innerText = `Rp${Math.round(netIncome).toLocaleString('id-ID')}`;
            if (barNetProg) barNetProg.style.width = `${totalIncome > 0 ? Math.min(100, (netIncome / totalIncome) * 100) : 0}%`;

            // 7. Render List Pesanan
            if (isWeekly) {
                renderWeeklyOrdersList(weekOrders, weekStart);
            } else {
                renderInsightsOrdersList(dayOrders);
            }

            // 8. Render Comparison Chart
            renderComparisonChart(weekStart);
        }

        // ============================================================
        // GRAFIK PENDAPATAN vs EST. BBM (Grouped Bar Chart)
        // ============================================================
        function renderComparisonChart(weekStart) {
            const canvas = document.getElementById('chart-comparison');
            const emptyEl = document.getElementById('chart-comparison-empty');
            if (!canvas) return;

            // Destroy sebelumnya
            if (chartComparisonInstance) {
                chartComparisonInstance.destroy();
                chartComparisonInstance = null;
            }

            const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']; // Senin → Minggu
            const incomeData = [];
            const fuelData = [];
            const fullLabels = [];

            const isWeekly = insightsPeriodMode === 'weekly';
            const selectedDayIndex = (insightsSelectedDate.getDay() + 6) % 7; // 0=Senin ... 6=Minggu

            let hasData = false;
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                const dayEnd = new Date(d);
                dayEnd.setHours(23, 59, 59, 999);

                const dayOrds = ordersList.filter(o => {
                    const ts = new Date(o.timestamp);
                    return ts >= d && ts <= dayEnd;
                });

                const inc = dayOrds.reduce((s, o) => s + (o.orderIncome || 0), 0);
                const fuel = dayOrds.reduce((s, o) => s + computeOrderFuelCost(o), 0);
                incomeData.push(Math.round(inc));
                fuelData.push(Math.round(fuel));
                if (inc > 0 || fuel > 0) hasData = true;

                const dateNum = d.getDate();
                fullLabels.push(`${dayLabels[i]}\n${dateNum}`);
            }

            if (!hasData) {
                if (emptyEl) emptyEl.classList.remove('hidden');
                canvas.style.display = 'none';
                return;
            }

            if (emptyEl) emptyEl.classList.add('hidden');
            canvas.style.display = '';

            // Warna: highlight hari terpilih di mode Harian
            const __S = (window.__isSales && window.__isSales());
            const incomeColors = incomeData.map((_, i) => {
                if (!isWeekly && i !== selectedDayIndex) return __S ? 'rgba(30,33,29,0.25)' : 'rgba(16,185,129,0.35)';
                return __S ? '#1E211D' : '#10B981';
            });
            const fuelColors = fuelData.map((_, i) => {
                if (!isWeekly && i !== selectedDayIndex) return __S ? 'rgba(30,33,29,0.2)' : 'rgba(244,63,94,0.35)';
                return __S ? '#1E211D' : '#F43F5E';
            });

            const ctx = canvas.getContext('2d');
            chartComparisonInstance = new Chart(ctx, {
                type: __S ? 'line' : 'bar',
                data: {
                    labels: fullLabels,
                    datasets: [
                        {
                            label: 'Pendapatan',
                            data: incomeData,
                            ...(__S ? {
                                fill: true, tension: 0.42, borderWidth: 2, borderColor: '#C4EA00',
                                backgroundColor: (c) => { const a = c.chart.chartArea; if (!a) return 'rgba(221,255,0,.5)';
                                    const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
                                    g.addColorStop(0, 'rgba(221,255,0,.9)'); g.addColorStop(1, 'rgba(221,255,0,.06)'); return g; },
                                pointBackgroundColor: incomeColors, pointBorderColor: '#DDFF00', pointBorderWidth: 2,
                                pointRadius: 4, pointHoverRadius: 7
                            } : {
                                backgroundColor: incomeColors,
                                borderRadius: 6,
                                borderSkipped: false
                            })
                        },
                        {
                            label: 'Est. BBM',
                            data: fuelData,
                            ...(__S ? {
                                fill: false, tension: 0.42, borderWidth: 1.6, borderDash: [5, 5], borderColor: '#1E211D',
                                backgroundColor: 'transparent',
                                pointBackgroundColor: fuelColors, pointBorderColor: '#fff', pointBorderWidth: 1.5,
                                pointRadius: 3, pointHoverRadius: 6
                            } : {
                                backgroundColor: fuelColors,
                                borderRadius: 6,
                                borderSkipped: false
                            })
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 10, weight: 'bold' },
                                boxWidth: 10,
                                padding: 8,
                                color: '#64748B'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `Rp${Math.round(ctx.parsed.y).toLocaleString('id-ID')}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.04)' },
                            ticks: {
                                font: { size: 9 },
                                color: '#94A3B8',
                                callback: (v) => v >= 1000 ? `${Math.round(v/1000)}k` : v
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: { size: 9 },
                                color: '#94A3B8'
                            }
                        }
                    }
                }
            });
        }

        // ============================================================
        // WEEKLY ORDERS LIST (grouped per hari)
        // ============================================================
        function renderWeeklyOrdersList(weekOrders, weekStart) {
            const container = document.getElementById('insights-orders-list');
            if (!container) return;

            if (weekOrders.length === 0) {
                container.innerHTML = `
                    <div class="py-6 text-center space-y-2.5">
                        <div class="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-base shadow-sm">
                            <i class="fa-regular fa-calendar-xmark"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-xs">Belum Ada Pesanan Minggu Ini</h4>
                            <p class="text-[11px] text-slate-400 mt-0.5">Tambahkan pesanan baru untuk mulai mencatat.</p>
                        </div>
                        <button type="button" onclick="switchTab('upload')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-sm shadow-emerald-200 active:scale-95">
                            <i class="fa-solid fa-plus text-[10px]"></i> Catat Pesanan Baru
                        </button>
                    </div>`;
                return;
            }

            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

            // Kelompokkan per hari
            const groups = {};
            weekOrders.forEach(o => {
                const d = new Date(o.timestamp);
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                if (!groups[key]) groups[key] = { date: d, orders: [] };
                groups[key].orders.push(o);
            });

            // Sort hari ascending
            const sortedKeys = Object.keys(groups).sort((a, b) => groups[a].date - groups[b].date);

            let html = '';
            sortedKeys.forEach(key => {
                const g = groups[key];
                const d = g.date;
                const dayLabel = `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
                const dayInc = g.orders.reduce((s, o) => s + (o.orderIncome || 0), 0);

                html += `
                    <div class="space-y-1 pt-2 first:pt-0">
                        <div class="flex items-center justify-between py-1 border-b border-slate-50">
                            <span class="text-xs font-extrabold text-slate-800">${dayLabel}</span>
                            <span class="text-[11px] font-semibold text-emerald-600">Rp${Math.round(dayInc).toLocaleString('id-ID')}</span>
                        </div>
                        <div class="divide-y divide-slate-50">
                            ${g.orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map(o => createInsightsOrderCardHTML(o)).join('')}
                        </div>
                    </div>`;
            });

            container.innerHTML = html;
        }

        function renderInsightsWeekStrip() {
            const stripContainer = document.getElementById('insights-week-strip');
            if (!stripContainer) return;

            const curr = new Date(insightsSelectedDate);
            const startOfWeek = getWeekBounds(curr).start; // Senin 00:00

            const dayInitials = ['S', 'S', 'R', 'K', 'J', 'S', 'M']; // Sen Sel Rab Kam Jum Sab Min
            let html = '';

            for (let i = 0; i < 7; i++) {
                const dateObj = new Date(startOfWeek);
                dateObj.setDate(startOfWeek.getDate() + i);

                const isSelected = isSameDay(dateObj, insightsSelectedDate);
                const hasOrders = ordersList.some(o => isSameDay(o.timestamp, dateObj));
                const dayNum = dateObj.getDate();
                const dayInit = dayInitials[i];
                const isoStr = dateObj.toISOString();

                if (isSelected) {
                    // Pill Vertikal Hijau Toska / Emerald Sesuai Gambar Referensi Asli!
                    html += `
                        <div class="bg-emerald-500 text-white rounded-2xl py-2 px-1 flex flex-col items-center justify-between shadow-sm cursor-pointer select-none">
                            <span class="text-[11px] font-bold text-white/90 leading-none">${dayInit}</span>
                            <span class="w-6 h-6 rounded-full bg-white text-emerald-600 font-black text-[11px] flex items-center justify-center mt-1.5 shadow-sm">
                                ${dayNum}
                            </span>
                        </div>`;
                } else {
                    html += `
                        <button type="button" onclick="selectInsightsDate('${isoStr}')" class="py-2 px-1 flex flex-col items-center justify-between rounded-2xl hover:bg-slate-50 transition group select-none">
                            <span class="text-[11px] font-medium text-slate-400 group-hover:text-slate-600 leading-none">${dayInit}</span>
                            <span class="text-xs font-bold text-slate-800 mt-1.5 leading-none">${dayNum}</span>
                            <span class="w-1 h-1 rounded-full mt-1.5 ${hasOrders ? 'bg-emerald-500' : 'bg-transparent'}"></span>
                        </button>`;
                }
            }

            stripContainer.innerHTML = html;
        }

        function renderInsightsOrdersList(orders) {
            const container = document.getElementById('insights-orders-list');
            if (!container) return;

            if (orders.length === 0) {
                const dateFormatted = insightsSelectedDate.toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                });
                container.innerHTML = `
                    <div class="py-6 text-center space-y-2.5">
                        <div class="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-base shadow-sm">
                            <i class="fa-regular fa-calendar-xmark"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-xs">Belum Ada Pesanan</h4>
                            <p class="text-[11px] text-slate-400 mt-0.5">${dateFormatted}</p>
                        </div>
                        <button type="button" onclick="switchTab('upload')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-sm shadow-emerald-200 active:scale-95">
                            <i class="fa-solid fa-plus text-[10px]"></i> Catat Pesanan Baru
                        </button>
                    </div>`;
                return;
            }

            const sortedOrders = [...orders].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Kelompokkan waktu seperti Breakfast, Lunch, Dinner di gambar referensi
            const groups = {
                morning: { title: 'Breakfast (Pagi)', icon: '☕', items: [] },
                noon: { title: 'Lunch (Siang)', icon: '🍲', items: [] },
                night: { title: 'Dinner (Sore / Malam)', icon: '🌙', items: [] }
            };

            sortedOrders.forEach(o => {
                const hour = new Date(o.timestamp).getHours();
                if (hour >= 5 && hour < 12) {
                    groups.morning.items.push(o);
                } else if (hour >= 12 && hour < 17) {
                    groups.noon.items.push(o);
                } else {
                    groups.night.items.push(o);
                }
            });

            let html = '';
            for (const key of ['morning', 'noon', 'night']) {
                const g = groups[key];
                if (g.items.length > 0) {
                    html += `
                        <div class="space-y-1 pt-1 first:pt-0">
                            <!-- Group Header Sesuai Gambar Referensi -->
                            <div class="flex items-center justify-between py-1 border-b border-slate-50">
                                <span class="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                                    <span class="text-sm">${g.icon}</span> ${g.title}
                                </span>
                                <button type="button" onclick="switchTab('upload')" class="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 transition" title="Tambah Pesanan">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                            <div class="divide-y divide-slate-50">
                                ${g.items.map(o => createInsightsOrderCardHTML(o)).join('')}
                            </div>
                        </div>`;
                }
            }

            if (html === '') {
                html = `<div class="divide-y divide-slate-50">${sortedOrders.map(o => createInsightsOrderCardHTML(o)).join('')}</div>`;
            }

            container.innerHTML = html;
        }

        // Nama resto per pesanan. Orderan gabungan -> nama resto tiap sub-pesanan (bukan kata "gabungan").
        // Dipakai bersama oleh daftar pesanan Insights dan peringkat resto agar selalu konsisten.
        function normRestoName(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
        function getOrderRestoNames(o) {
            const raw = o.isCombined ? (o.subOrders || []).map(x => x.restoName) : [o.restoName];
            return raw.map(normRestoName).filter(n => n && n !== '-');
        }
        // "Azdan Seblak ×2 + Seblak Prasmanan" (nama sama digabung dengan jumlah)
        function getOrderRestoLabel(o) {
            const seen = new Map();
            getOrderRestoNames(o).forEach(n => {
                const k = n.toLowerCase();
                if (!seen.has(k)) seen.set(k, { name: n, c: 0 });
                seen.get(k).c++;
            });
            const parts = [...seen.values()].map(v => v.c > 1 ? `${v.name} ×${v.c}` : v.name);
            return parts.length ? parts.join(' + ') : (o.platform || 'Pesanan');
        }
        function getOrderRecipLabel(o) {
            const names = (o.isCombined ? (o.subOrders || []).map(x => x.recipName) : [o.recipName]).map(normRestoName).filter(n => n && n !== '-');
            return names.length ? names.join(', ') : 'Penerima';
        }

        function createInsightsOrderCardHTML(o) {
            const timeStr = new Date(o.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const isCash = o.cashAmount > 0;
            const payText = isCash ? `💵 Rp${o.cashAmount.toLocaleString('id-ID')}` : '💳 Non-Tunai';

            // Foto Bulat (Circle) Sesuai Gambar Referensi!
            let thumbHTML = '';
            if (o.screenshot && !o.screenshot.startsWith('data:image/svg')) {
                thumbHTML = `<img src="${o.screenshot}" alt="Order" class="w-full h-full object-cover rounded-full">`;
            } else {
                const bgColors = { Food: 'bg-amber-100 text-amber-700', SPX: 'bg-orange-100 text-orange-700', Instan: 'bg-emerald-100 text-emerald-700' };
                const icons = { Food: 'fa-utensils', SPX: 'fa-box', Instan: 'fa-bolt' };
                thumbHTML = `<div class="w-full h-full rounded-full flex items-center justify-center text-xs ${bgColors[o.category] || 'bg-indigo-100 text-indigo-700'}">
                                <i class="fa-solid ${icons[o.category] || 'fa-bag-shopping'}"></i>
                             </div>`;
            }

            return `
                <div onclick="openOrderDetailModal('${o.id}')" class="flex items-center justify-between gap-3 py-2.5 px-1 hover:bg-slate-50 rounded-2xl transition cursor-pointer active:scale-[0.99] group">
                    <!-- Thumbnail Bulat (Circle) Sesuai Gambar -->
                    <div class="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                        ${thumbHTML}
                    </div>

                    <!-- Info Order Sesuai Desain Referensi -->
                    <div class="flex-1 min-w-0 space-y-0.5">
                        <div class="flex items-center justify-between gap-1">
                            <h5 class="text-xs font-extrabold text-slate-900 group-hover:text-emerald-600 transition" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;line-height:1.3">
                                ${escapeHtml(getOrderRestoLabel(o))}
                            </h5>
                            <span class="text-[10px] font-semibold text-slate-400 flex-shrink-0">${timeStr}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 font-medium truncate flex items-center gap-1">
                            <span class="text-amber-500 font-bold">💰 Rp${(o.orderIncome || 0).toLocaleString('id-ID')}</span>
                            ${o.distanceKm ? `<span>• 📍 ${o.distanceKm} km</span>` : ''}
                            <span class="truncate">• ➔ ${escapeHtml(getOrderRecipLabel(o))}</span>
                        </p>
                    </div>

                    <!-- Tombol Action Kanan (Chevron / Detail) -->
                    <button type="button" class="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 group-hover:text-slate-600 hover:bg-slate-200/60 transition flex-shrink-0" title="Buka Detail">
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>`;
        }

        function renderCharts() {
            const filtered = getFilteredOrders();

            // Hourly distribution
            const hours = Array(24).fill(0);
            filtered.forEach(o => {
                const h = new Date(o.timestamp).getHours();
                hours[h]++;
            });

            if (chartHoursInstance) chartHoursInstance.destroy();

            const ctx1 = document.getElementById('chart-hours').getContext('2d');
            chartHoursInstance = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`),
                    datasets: [{
                        label: 'Jumlah Order',
                        data: hours,
                        ...(window.__isSales && window.__isSales() ? {
                            backgroundColor: hours.map(v => (v > 0 && v === Math.max(...hours)) ? '#1E211D' : window.__hatch()),
                            borderColor: 'rgba(27,29,26,.25)', borderWidth: 1,
                            borderRadius: 10, borderSkipped: false
                        } : {
                            backgroundColor: '#6366F1',
                            borderRadius: 6
                        })
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                        x: { grid: { display: false } }
                    }
                }
            });

            renderRestoRank(filtered);

            renderPlatformChart(filtered);
        }


        // Peringkat resto: daftar HTML (nama penuh, jumlah, bar) agar terbaca di semua tema.
        // Pesanan gabungan dihitung per resto masing-masing; nama dinormalisasi (besar/kecil huruf, spasi).
        function renderRestoRank(filtered) {
            const el = document.getElementById('resto-rank-list');
            if (!el) return;
            const map = {};
            filtered.forEach(o => {
                getOrderRestoNames(o).forEach(label => {
                    const key = label.toLowerCase();
                    if (!map[key]) map[key] = { name: label, n: 0 };
                    map[key].n++;
                });
            });
            const rows = Object.values(map).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 7);
            if (!rows.length) { el.innerHTML = '<p class="text-[11px] text-center py-6 rk-muted">Belum ada data resto.</p>'; return; }
            const max = rows[0].n;
            el.innerHTML = rows.map((r, i) => `
                <div class="rk-row">
                    <span class="rk-no ${i === 0 ? 'rk-top' : ''}">${i + 1}</span>
                    <div class="rk-body">
                        <div class="rk-head"><span class="rk-name">${escapeHtml(r.name)}</span><span class="rk-val">${r.n}<small> order</small></span></div>
                        <div class="rk-track"><div class="rk-fill ${i === 0 ? 'rk-top' : ''}" style="width:${Math.max(6, Math.round(r.n / max * 100))}%"></div></div>
                    </div>
                </div>`).join('');
        }

        function renderPlatformChart(filtered) {
            const breakdown = computePlatformBreakdown(filtered);
            const order = ['SPX', 'SPX Instan', 'ShopeeFood', 'Grab', 'Gojek', 'Lainnya'];
            const platforms = Object.keys(breakdown).sort((a, b) => {
                const ia = order.indexOf(a), ib = order.indexOf(b);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            });
            const theme = (window.getUITheme && window.getUITheme()) || 'default';
            const palettes = {
                default: { SPX: '#F97316', 'SPX Instan': '#F59E0B', ShopeeFood: '#EA580C', Grab: '#16A34A', Gojek: '#059669', Lainnya: '#6366F1' },
                sales:   { SPX: '#1E211D', 'SPX Instan': '#7A8F00', ShopeeFood: '#A9BF00', Grab: '#5C6650', Gojek: '#8E9486', Lainnya: '#C9CCC2' },
                neon:    { SPX: '#15171A', 'SPX Instan': '#4C8A00', ShopeeFood: '#99FF33', Grab: '#5C6650', Gojek: '#8E9486', Lainnya: '#C9CCC2' },
                lime:    { SPX: '#161914', 'SPX Instan': '#4C8A00', ShopeeFood: '#A6FF1F', Grab: '#5C6650', Gojek: '#8E9486', Lainnya: '#C9CCC2' },
                focus:   { SPX: '#3E5BFF', 'SPX Instan': '#00A3FF', ShopeeFood: '#FF7A45', Grab: '#12B76A', Gojek: '#111318', Lainnya: '#9AA0B8' }
            };
            const pal = palettes[theme] || palettes.default;
            const colorOf = p => pal[p] || pal.Lainnya;

            if (chartPlatformInstance) chartPlatformInstance.destroy();
            const ctx3 = document.getElementById('chart-platform').getContext('2d');
            const maxIncome = Math.max(0, ...platforms.map(p => breakdown[p].income));
            chartPlatformInstance = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: platforms,
                    datasets: [{
                        label: 'Pendapatan (Rp)',
                        data: platforms.map(p => breakdown[p].income),
                        backgroundColor: platforms.map(colorOf),
                        borderRadius: 8,
                        borderSkipped: false,
                        // order tanpa pendapatan tetap terlihat sebagai batang tipis
                        minBarLength: 6,
                        maxBarThickness: 46
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: {
                            label: ctx => `Rp${Math.round(ctx.parsed.y).toLocaleString('id-ID')} · ${breakdown[ctx.label].orders} order`
                        } }
                    },
                    scales: {
                        y: { beginAtZero: true, suggestedMax: maxIncome > 0 ? undefined : 10000,
                             ticks: { callback: v => v >= 1000 ? `${Math.round(v / 100) / 10}k` : v } },
                        x: { grid: { display: false }, ticks: { font: { weight: '600' } } }
                    }
                }
            });

            const listEl = document.getElementById('platform-breakdown-list');
            if (platforms.length === 0) {
                listEl.innerHTML = `<div class="col-span-2 text-center text-[11px] text-slate-400 py-2">Belum ada data pendapatan.</div>`;
                return;
            }
            listEl.innerHTML = platforms.map(p => `
                <div class="plat-item bg-slate-50 rounded-xl p-2.5 border border-slate-100" style="border-left:4px solid ${colorOf(p)}">
                    <p class="text-[10px] font-bold text-slate-500">${escapeHtml(p)}</p>
                    <p class="text-xs font-extrabold text-slate-900">Rp${Math.round(breakdown[p].income).toLocaleString('id-ID')}</p>
                    <p class="text-[9.5px] text-slate-400">${breakdown[p].orders} order</p>
                </div>
            `).join('');
        }

        function openImageModal(src, title = "Screenshot Detail") {
            const modal = document.getElementById('image-modal');
            document.getElementById('modal-image').src = src;
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-download-btn').href = src;
            modal.classList.remove('hidden');
        }

        function closeImageModal() {
            document.getElementById('image-modal').classList.add('hidden');
        }

        function resetToMockData() {
            if (!confirm('Muat data contoh? Ini akan MENIMPA semua pesanan yang ada saat ini.')) return;
            ordersList = getInitialMockOrders();
            saveToLocalStorage();
            renderAllViews();
            showToast("Data contoh berhasil dimuat!", "indigo");
        }

        function clearAllData() {
            if (!confirm('Hapus semua pesanan? Tindakan ini tidak dapat dibatalkan. (Profil tetap tersimpan)')) return;
            ordersList = [];
            saveToLocalStorage();
            renderAllViews();
            showToast("Semua pesanan berhasil dihapus.", "rose");
        }
