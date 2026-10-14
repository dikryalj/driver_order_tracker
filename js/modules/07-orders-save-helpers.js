        // Edit pesanan tunggal -> tambah pesanan lain (jadi gabungan)
        function convertSingleToCombinedEdit() {
            const id = document.getElementById('edit-form-id').value;
            saveEditForm({ preventDefault() {} });
            const o = ordersList.find(x => x.id === id);
            if (!o || o.isCombined) return;
            const sub = Object.assign({}, o, { _key: 'k0' });
            ['id','isCombined','subOrders','points','timestamp','orderTime','distanceKm','routeDurationMin','startCheckin'].forEach(k => delete sub[k]);
            sub.orderIncome = 0;
            editCombinedKeyCounter = 1;
            editCombinedState = { subOrders: [sub], points: [{ key: 'k0', role: 'resto' }, { key: 'k0', role: 'recip' }] };
            document.getElementById('edit-combined-order-id').value = o.id;
            document.getElementById('edit-combined-ordertime').value = o.orderTime || '';
            document.getElementById('ec-total-income').value = o.orderIncome || 0;
            addEditCombinedSubOrder();
            document.getElementById('edit-combined-modal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        // Platform sesuai kategori: Food->ShopeeFood (Grab/Gojek tetap boleh), SPX->SPX, Instan->SPX Instan
        function effPlatform(x) {
            const c = x.category, p = x.platform || 'Lainnya';
            if (c === 'Instan') return 'SPX Instan';
            if (c === 'SPX') return 'SPX';
            if (c === 'Food') return (p === 'SPX' || p === 'SPX Instan' || p === 'Lainnya') ? 'ShopeeFood' : p;
            return p;
        }
        function autoPlat(catId, platId) {
            const c = document.getElementById(catId), p = document.getElementById(platId);
            if (!c || !p) return;
            p.value = effPlatform({ category: c.value, platform: p.value });
        }


        function saveOrderForm(e) {
            e.preventDefault();

            // ORDERAN GABUNGAN: kalau ada pesanan tambahan (>=2 pesanan total),
            // bangun SATU record gabungan dan jangan jalankan alur order tunggal.
            if (extraOrderIndexes.length > 0) {
                saveCombinedOrderForm();
                return;
            }

            const cat = document.getElementById('form-category').value;
            const cashVal = parseFloat(document.getElementById('form-cashamount').value) || 0;
            const platform = document.getElementById('form-platform')?.value || 'Lainnya';
            const incomeVal = parseFloat(document.getElementById('form-income')?.value) || 0;
            const manualFuelRaw = document.getElementById('form-fuelcost-manual')?.value;
            const manualFuelVal = manualFuelRaw !== '' && manualFuelRaw !== undefined ? parseFloat(manualFuelRaw) : null;

            const newOrder = {
                id: 'ord-' + Date.now(),
                category: cat,
                platform: platform,
                orderIncome: incomeVal,
                manualFuelCost: (manualFuelVal !== null && !isNaN(manualFuelVal)) ? manualFuelVal : null,
                restoName: document.getElementById('form-restoname').value,
                restoAddr: document.getElementById('form-restoaddr').value,
                recipName: document.getElementById('form-recipname').value,
                recipAddr: document.getElementById('form-recipaddr').value,
                notes: document.getElementById('form-notes').value || '-',
                cashAmount: cashVal,
                payment: cashVal > 0 ? 'Tunai' : 'Non-Tunai',
                orderTime: document.getElementById('form-ordertime').value,
                timestamp: new Date(document.getElementById('form-ordertime').value).getTime(),
                screenshot: uploadedImageDataUrl || createSVGPlaceholder(document.getElementById('form-restoname').value, cat, cashVal > 0 ? 'Tunai' : 'Non-Tunai')
            };

            if (cat === 'Food') {
                newOrder.codeOrder = document.getElementById('form-codeorder')?.value || '-';
                newOrder.totalMenu = document.getElementById('form-totalmenu')?.value || '-';
                newOrder.orderNo = document.getElementById('form-orderno')?.value || '-';
            } else if (cat === 'SPX') {
                newOrder.codeOrder = document.getElementById('form-codeorder')?.value || '-';
                newOrder.weight = document.getElementById('form-weight')?.value || '-';
                newOrder.dimensions = document.getElementById('form-dimensions')?.value || '-';
            } else if (cat === 'Instan') {
                newOrder.orderNo = document.getElementById('form-orderno')?.value || '-';
                newOrder.itemCategory = document.getElementById('form-itemcategory')?.value || 'Barang';
                newOrder.weight = document.getElementById('form-weight')?.value || '-';
            }

            ordersList.unshift(newOrder);
            saveToLocalStorage();
            removeUploadedImage();
            document.getElementById('order-form').reset();
            onCategoryChange();
            resetExtraOrders();

            showToast("Pesanan & Screenshot Berhasil Disimpan!", "emerald");
            renderAllViews();
            switchTab('orders');
        }

        // ============================================================
        // ORDERAN GABUNGAN — SIMPAN (≥2 pesanan dalam satu form)
        // ============================================================
        function saveCombinedOrderForm() {
            const orderTimeVal = document.getElementById('form-ordertime').value;
            if (!orderTimeVal) {
                showToast('Waktu Diterima wajib diisi.', 'rose');
                return;
            }

            const totalIncome = parseFloat(document.getElementById('form-combined-total-income')?.value) || 0;

            const entries = [collectOrderEntry(0)];
            extraOrderIndexes.forEach(idx => entries.push(collectOrderEntry(idx)));

            for (const entry of entries) {
                if (!entry.restoName || !entry.recipName) {
                    showToast('Nama Resto/Pengirim dan Nama Penerima wajib diisi di semua pesanan.', 'rose');
                    return;
                }
            }

            // Lengkapi placeholder untuk pesanan yang belum ada screenshot,
            // agar setiap sub-pesanan tetap punya gambar valid untuk ditampilkan.
            entries.forEach((entry, i) => {
                if (!entry.screenshot) {
                    entry.screenshot = createSVGPlaceholder(entry.restoName || `Pesanan #${i + 1}`, entry.category, entry.payment);
                }
                // Pendapatan per sub-pesanan TIDAK lagi jadi sumber kebenaran untuk
                // order gabungan — total-nya diisi manual lewat form-combined-total-income
                // dan dibagi otomatis per jarak lewat computeCombinedSubOrderFinancials().
                entry.orderIncome = 0;
            });

            const subOrders = entries;
            const totalCash = subOrders.reduce((s, o) => s + (o.cashAmount || 0), 0);

            // Urutan titik default: "Ambil Semua Dulu" (semua Ambil duluan, baru
            // semua Antar) — pola paling umum dipakai driver baik utk Food
            // maupun SPX. Bisa diganti ke Interleaved atau custom kapan saja
            // lewat tombol template/reorder di modal Detail & Edit.
            const points = buildGroupedPoints(subOrders.length);

            const catCounts = {};
            subOrders.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });

            const newOrder = {
                id: 'ord-' + Date.now(),
                category: 'Gabungan',
                isCombined: true,
                subOrders: subOrders,
                points: points,
                orderIncome: totalIncome,
                cashAmount: totalCash,
                payment: totalCash > 0 ? 'Tunai' : 'Non-Tunai',
                restoName: `${subOrders.length} pengirim`,
                recipName: `${subOrders.length} penerima`,
                notes: '-',
                orderTime: orderTimeVal,
                timestamp: new Date(orderTimeVal).getTime(),
                // screenshot utama (thumbnail) pakai foto pesanan #1; detail per pesanan tetap
                // tersimpan lengkap & berurutan di masing-masing subOrders[i].screenshot
                screenshot: subOrders[0].screenshot
            };

            ordersList.unshift(newOrder);
            saveToLocalStorage();
            removeUploadedImage();
            document.getElementById('order-form').reset();
            onCategoryChange();
            resetExtraOrders();

            showToast(`Orderan Gabungan (${subOrders.length} pesanan) berhasil disimpan!`, "emerald");
            renderAllViews();
            switchTab('orders');
        }

        function filterDays(days) {
            activeFilterDays = days;
            // Ada 2 set tombol yang harus disinkronkan: yang di Dashboard
            // (filter-7d/30d/all) dan yang di tab Orders (filter-orders-7d/30d/all),
            // karena keduanya kontrol untuk state activeFilterDays yang sama.
            ['7d', '30d', 'all'].forEach(id => {
                const isActive = (days === 7 && id === '7d') || (days === 30 && id === '30d') || (days === 'all' && id === 'all');
                const activeClass = "flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-md transition";
                const inactiveClass = "flex-1 py-2 text-xs font-medium rounded-xl text-slate-500 hover:text-slate-900 transition";
                [`filter-${id}`, `filter-orders-${id}`].forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.className = isActive ? activeClass : inactiveClass;
                });
            });
            renderAllViews();
        }

        function filterCategory(cat) {
            activeCategory = cat;
            document.getElementById('filter-category-select').value = cat;

            ['ALL', 'Food', 'SPX', 'Instan', 'Gabungan'].forEach(c => {
                const btn = document.getElementById(`cat-filter-${c}`);
                if (btn) {
                    if (c === cat) {
                        btn.className = "px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white transition flex-shrink-0";
                    } else {
                        btn.className = "px-3 py-1.5 text-xs font-bold rounded-xl bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition flex-shrink-0";
                    }
                }
            });
            renderAllViews();
        }

        function getFilteredOrders() {
            const searchStr = (document.getElementById('search-input')?.value || '').toLowerCase();
            const payFilter = document.getElementById('filter-payment')?.value || 'ALL';
            const platformFilter = document.getElementById('filter-platform')?.value || 'ALL';

            const now = Date.now();
            const cutoff = activeFilterDays === 7 ? now - 7 * 86400000 : (activeFilterDays === 30 ? now - 30 * 86400000 : 0);

            return ordersList.filter(o => {
                if (cutoff > 0 && o.timestamp < cutoff) return false;

                if (activeCategory !== 'ALL') {
                    if (o.isCombined) {
                        if (activeCategory === 'Gabungan') {
                            // lolos
                        } else if (!(o.subOrders || []).some(s => s.category === activeCategory)) {
                            return false;
                        }
                    } else if (activeCategory === 'Gabungan') {
                        return false;
                    } else if (o.category !== activeCategory) {
                        return false;
                    }
                }

                if (payFilter !== 'ALL' && o.payment !== payFilter) return false;

                if (platformFilter !== 'ALL') {
                    if (o.isCombined) {
                        if (!(o.subOrders || []).some(s => effPlatform(s) === platformFilter)) return false;
                    } else if (effPlatform(o) !== platformFilter) {
                        return false;
                    }
                }

                if (searchStr) {
                    let combined = `${o.restoName} ${o.recipName} ${o.restoAddr} ${o.recipAddr} ${o.codeOrder || ''} ${o.orderNo || ''}`;
                    if (o.isCombined) {
                        (o.subOrders || []).forEach(s => {
                            combined += ` ${s.restoName || ''} ${s.recipName || ''} ${s.restoAddr || ''} ${s.recipAddr || ''} ${s.codeOrder || ''} ${s.orderNo || ''}`;
                        });
                    }
                    if (!combined.toLowerCase().includes(searchStr)) return false;
                }
                return true;
            });
        }

        // ============================================================
        // ORDERAN GABUNGAN — HELPER UMUM
        // Semua helper di bawah ini KHUSUS untuk record isCombined:true.
        // Order tunggal (category Food/SPX/Instan lama) tidak tersentuh
        // sama sekali oleh fungsi-fungsi ini.
        // ============================================================
        function getOrderUnitCount(order) {
            return (order && order.isCombined && Array.isArray(order.subOrders)) ? order.subOrders.length : 1;
        }

        function countOrderUnits(orders) {
            return orders.reduce((sum, o) => sum + getOrderUnitCount(o), 0);
        }

        function getPickupLabel(sub) {
            const name = sub.restoName || '-';
            if (sub.category === 'Food') return `🍲 Resto: ${name}`;
            if (sub.category === 'SPX') return `📦 Toko/Agen: ${name}`;
            return `⚡ Pengirim: ${name}`;
        }

        function getDropoffLabel(sub) {
            return `📍 Penerima: ${sub.recipName || '-'}`;
        }

        function getSubOrderCode(sub) {
            if (sub.category === 'Food') return sub.codeOrder || '-';
            if (sub.category === 'SPX') return sub.codeOrder || '-';
            return sub.orderNo || '-';
        }

        function getSubCategoryIcon(cat) {
            if (cat === 'Food') return 'fa-utensils text-amber-500';
            if (cat === 'SPX') return 'fa-box text-orange-500';
            return 'fa-bolt text-emerald-500';
        }

        // Bangun urutan titik pola "Ambil Semua Dulu": semua titik Ambil (resto)
        // duluan, baru semua titik Antar (recip). Ini DEFAULT untuk order
        // gabungan (Food maupun SPX) karena di lapangan driver sering ambil
        // beberapa pesanan dulu (terutama kalau toko/rumahnya berdekatan)
        // sebelum muter buat antar, baik itu Food ataupun SPX/Paket.
        function buildGroupedPoints(n) {
            const pts = [];
            for (let i = 0; i < n; i++) pts.push({ subIndex: i, role: 'resto' });
            for (let i = 0; i < n; i++) pts.push({ subIndex: i, role: 'recip' });
            return pts;
        }

        // Pola alternatif: interleaved (Ambil-A, Antar-A, Ambil-B, Antar-B, ...).
        // Bukan default, tapi tetap disediakan sebagai template 1-tap kalau
        // driver mau langsung antar begitu ambil (misal urutan lokasinya
        // kebetulan pas begitu).
        function buildInterleavedPoints(n) {
            const pts = [];
            for (let i = 0; i < n; i++) {
                pts.push({ subIndex: i, role: 'resto' });
                pts.push({ subIndex: i, role: 'recip' });
            }
            return pts;
        }

        // Memastikan order.points selalu ada & konsisten dengan subOrders
        // (dipanggil sebelum dipakai di mana pun agar aman untuk data lama).
        function ensureCombinedPoints(order) {
            if (!order.isCombined) return;
            const n = (order.subOrders || []).length;
            const valid = Array.isArray(order.points) && order.points.length === n * 2 &&
                order.points.every(p => p && typeof p.subIndex === 'number' && (p.role === 'resto' || p.role === 'recip') && p.subIndex < n);
            if (!valid) {
                order.points = buildGroupedPoints(n);
            }
            // Catatan: TIDAK ada normalisasi/migrasi paksa di sini lagi — pola
            // "Ambil Semua Dulu" maupun "Interleaved" sama-sama pola yang sah
            // dan dianggap sengaja dipilih driver (baik lewat default otomatis
            // maupun tombol template/manual reorder), jadi tidak pernah ditimpa
            // otomatis oleh sistem.
        }

        // Cek apakah urutan titik masih berpasangan rapi: Ambil-X selalu langsung
        // diikuti Antar-X sebelum lanjut ke pesanan lain.
        function isCombinedPointsInterleaved(points) {
            if (!Array.isArray(points) || points.length % 2 !== 0) return false;
            for (let i = 0; i < points.length; i += 2) {
                const a = points[i], b = points[i + 1];
                if (!a || !b) return false;
                const aKey = a.subIndex !== undefined ? a.subIndex : a.key;
                const bKey = b.subIndex !== undefined ? b.subIndex : b.key;
                if (a.role !== 'resto' || b.role !== 'recip' || aKey !== bKey) return false;
            }
            return true;
        }

        // Cek apakah urutan titik masih pola "Ambil Semua Dulu": separuh awal
        // semuanya Ambil, separuh akhir semuanya Antar (urutan sub-pesanan di
        // dalam tiap separuh bebas).
        function isCombinedPointsGrouped(points) {
            if (!Array.isArray(points) || points.length === 0 || points.length % 2 !== 0) return false;
            const half = points.length / 2;
            return points.slice(0, half).every(p => p.role === 'resto') &&
                   points.slice(half).every(p => p.role === 'recip');
        }

        // Deteksi pola urutan titik saat ini: 'interleaved', 'grouped', atau
        // 'custom' (hasil reorder manual yang gak cocok dua template di atas).
        // Murni buat badge informasi UX — tidak ada satu pun pola yang
        // dianggap "lebih benar", semuanya sah dipakai driver.
        function getCombinedPointsPattern(points) {
            if (isCombinedPointsInterleaved(points)) return 'interleaved';
            if (isCombinedPointsGrouped(points)) return 'grouped';
            return 'custom';
        }

        function combinedPatternBadgeHTML(points) {
            const pattern = getCombinedPointsPattern(points);
            if (pattern === 'interleaved') {
                return `<span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">🔀 Interleaved</span>`;
            } else if (pattern === 'grouped') {
                return `<span class="inline-flex items-center gap-1 bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-[10px] font-bold">📦 Ambil Semua Dulu</span>`;
            }
            return `<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">✏️ Custom</span>`;
        }

        function getPointCheckin(order, point) {
            const sub = order.subOrders[point.subIndex];
            if (!sub) return null;
            return point.role === 'resto' ? (sub.restoCheckin || null) : (sub.recipCheckin || null);
        }

        function getPointLabel(order, point) {
            const sub = order.subOrders[point.subIndex];
            if (!sub) return '-';
            return point.role === 'resto' ? getPickupLabel(sub) : getDropoffLabel(sub);
        }

        function getPointAddress(order, point) {
            const sub = order.subOrders[point.subIndex];
            if (!sub) return '';
            return point.role === 'resto' ? (sub.restoAddr || sub.restoName || '') : (sub.recipAddr || sub.recipName || '');
        }
