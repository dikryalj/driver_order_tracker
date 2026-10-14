        // ============================================================
        // ORDERAN GABUNGAN — MODAL EDIT
        // Bisa ubah/tambah/hapus subOrder dan ubah urutan titik. Jika
        // tersisa 1 subOrder, otomatis dikonversi jadi order tunggal biasa.
        // ============================================================
        let editCombinedState = null;
        let editCombinedKeyCounter = 0;

        function openEditCombinedModal(orderId) {
            const order = ordersList.find(o => o.id === orderId);
            if (!order || !order.isCombined) return;
            ensureCombinedPoints(order);

            editCombinedKeyCounter = 0;
            const keyBySubIndex = {};
            editCombinedState = {
                subOrders: order.subOrders.map((s, idx) => {
                    const key = 'k' + (editCombinedKeyCounter++);
                    keyBySubIndex[idx] = key;
                    return Object.assign({}, s, { _key: key });
                }),
                points: order.points.map(p => ({ key: keyBySubIndex[p.subIndex], role: p.role }))
            };

            document.getElementById('edit-combined-order-id').value = order.id;
            document.getElementById('edit-combined-ordertime').value = order.orderTime || '';
            document.getElementById('ec-total-income').value = order.orderIncome || 0;

            renderEditCombinedSubOrders();
            renderEditCombinedPointsList();

            document.getElementById('edit-combined-modal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        function closeEditCombinedModal() {
            document.getElementById('edit-combined-modal').classList.add('hidden');
            document.body.style.overflow = '';
            editCombinedState = null;
        }

        function renderEditCombinedSubOrders() {
            const container = document.getElementById('edit-combined-suborders-container');
            container.innerHTML = '';
            editCombinedState.subOrders.forEach((sub, i) => {
                const key = sub._key;
                const block = document.createElement('div');
                block.id = `edit-combined-block-${key}`;
                block.className = 'border-2 border-slate-200 rounded-2xl p-3 space-y-3 bg-slate-50/50 relative';
                block.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-extrabold text-slate-700">Pesanan #${i + 1}</span>
                        <button type="button" onclick="removeEditCombinedSubOrder('${key}')" class="text-rose-500 hover:text-rose-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-rose-50 transition">
                            <i class="fa-solid fa-trash-can"></i> Hapus
                        </button>
                    </div>
                    <div class="bg-indigo-50/80 p-2.5 rounded-2xl border border-indigo-100 space-y-1">
                        <label class="block text-[11px] font-extrabold text-indigo-900">Kategori Pesanan *</label>
                        <select id="ec-category-${key}" onchange="onEditCombinedCategoryChange('${key}')" class="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-700 focus:outline-none">
                            <option value="Food">🍲 Food</option>
                            <option value="SPX">📦 SPX / Paket</option>
                            <option value="Instan">⚡ SPX Instan</option>
                        </select>
                    </div>
                    <div class="bg-violet-50/80 p-2.5 rounded-2xl border border-violet-100 space-y-1">
                        <label class="block text-[11px] font-extrabold text-violet-900">Platform Aplikasi *</label>
                        <select id="ec-platform-${key}" class="w-full bg-white border border-violet-200 rounded-xl px-3 py-2 text-xs font-bold text-violet-700 focus:outline-none">
                            <option value="SPX">📦 SPX (Shopee Xpress)</option><option value="SPX Instan">⚡ SPX Instan</option>
                            <option value="ShopeeFood">🛍️ ShopeeFood</option>
                            <option value="Grab">🟢 Grab</option>
                            <option value="Gojek">🟩 Gojek</option>
                            <option value="Lainnya">📱 Lainnya</option>
                        </select>
                    </div>
                    <div class="bg-emerald-50/60 p-2.5 rounded-2xl border border-emerald-200/80 space-y-2">
                        <label class="block text-[11px] font-extrabold text-emerald-900 flex items-center gap-1.5"><i class="fa-solid fa-sack-dollar"></i> Data Finansial</label>
                        <p class="text-[9.5px] text-emerald-700 leading-snug"><i class="fa-solid fa-circle-info"></i> Pendapatan diatur satu total di atas untuk seluruh pesanan gabungan. Isi Biaya BBM Manual di bawah hanya kalau kamu mau override Est. BBM pesanan ini secara spesifik.</p>
                        <div>
                            <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Biaya BBM Manual (opsional)</label>
                            <input type="number" id="ec-fuelcost-manual-${key}" min="0" placeholder="Kosongkan = auto" class="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[11px] font-extrabold py-2 rounded-xl cursor-pointer active:scale-95 transition"><input type="file" accept="image/*" class="hidden" onchange="ecScan('${key}',this)"><i class="fa-solid fa-wand-magic-sparkles"></i> Scan Screenshot <span id="ec-scan-status-${key}"></span></label>
                        <label class="flex items-center justify-center gap-1.5 bg-slate-900 text-white text-[11px] font-extrabold py-2 rounded-xl cursor-pointer active:scale-95 transition"><input type="file" accept="image/*" capture="environment" data-ai-photo="1" class="hidden" onchange="ecScan('${key}',this)"><i class="fa-solid fa-camera"></i> Foto Kamera</label>
                    </div>
                    <div id="ec-category-fields-${key}" class="space-y-2"></div>
                    <div class="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
                        <span class="text-xs font-extrabold text-amber-700 flex items-center gap-1" id="ec-label-pengirim-${key}"><i class="fa-solid fa-utensils"></i> Data Resto / Pengirim</span>
                        <input type="text" id="ec-restoname-${key}" required placeholder="Nama Resto / Pengirim *" class="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-semibold">
                        <textarea id="ec-restoaddr-${key}" rows="2" placeholder="Alamat pengirim / resto lengkap..." class="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none custom-scrollbar"></textarea>
                    </div>
                    <div class="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
                        <span class="text-xs font-extrabold text-emerald-700 flex items-center gap-1"><i class="fa-solid fa-location-dot"></i> Data Tujuan / Penerima</span>
                        <div class="grid grid-cols-2 gap-2">
                            <input type="text" id="ec-recipname-${key}" required placeholder="Nama Penerima *" class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-semibold">
                            <input type="number" id="ec-cashamount-${key}" value="" min="0" placeholder="Rp Tunai" oninput="updateEditCombinedPaymentMethod('${key}')" class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-semibold">
                        </div>
                        <div class="flex items-center justify-between bg-white/80 p-2 rounded-xl border border-emerald-200 text-xs">
                            <span class="text-[10px] text-slate-500 font-medium">Status Pembayaran:</span>
                            <select id="ec-payment-${key}" disabled class="bg-transparent font-bold text-xs text-emerald-700 focus:outline-none">
                                <option value="Non-Tunai">Non-Tunai (Rp0)</option>
                                <option value="Tunai">Tunai (&gt; Rp0)</option>
                            </select>
                        </div>
                        <textarea id="ec-recipaddr-${key}" rows="2" placeholder="Alamat pengantaran lengkap..." class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none custom-scrollbar"></textarea>
                        <input type="text" id="ec-notes-${key}" placeholder="Catatan pemesan" class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none">
                    </div>
                `;
                container.appendChild(block);

                document.getElementById(`ec-category-${key}`).value = sub.category || 'Food';
                onEditCombinedCategoryChange(key);
                document.getElementById(`ec-platform-${key}`).value = sub.platform || 'Lainnya';
                document.getElementById(`ec-fuelcost-manual-${key}`).value = (sub.manualFuelCost !== null && sub.manualFuelCost !== undefined) ? sub.manualFuelCost : '';
                document.getElementById(`ec-restoname-${key}`).value = sub.restoName || '';
                document.getElementById(`ec-restoaddr-${key}`).value = sub.restoAddr || '';
                document.getElementById(`ec-recipname-${key}`).value = sub.recipName || '';
                document.getElementById(`ec-recipaddr-${key}`).value = sub.recipAddr || '';
                document.getElementById(`ec-notes-${key}`).value = (sub.notes && sub.notes !== '-') ? sub.notes : '';
                document.getElementById(`ec-cashamount-${key}`).value = sub.cashAmount || 0;
                updateEditCombinedPaymentMethod(key);

                if (sub.category === 'Food') {
                    const co = document.getElementById(`ec-codeorder-${key}`); if (co) co.value = sub.codeOrder || '';
                    const tm = document.getElementById(`ec-totalmenu-${key}`); if (tm) tm.value = sub.totalMenu || '';
                    const on = document.getElementById(`ec-orderno-${key}`); if (on) on.value = sub.orderNo || '';
                } else if (sub.category === 'SPX') {
                    const co = document.getElementById(`ec-codeorder-${key}`); if (co) co.value = sub.codeOrder || '';
                    const wt = document.getElementById(`ec-weight-${key}`); if (wt) wt.value = sub.weight || '';
                    const dm = document.getElementById(`ec-dimensions-${key}`); if (dm) dm.value = sub.dimensions || '';
                } else if (sub.category === 'Instan') {
                    const ic = document.getElementById(`ec-itemcategory-${key}`); if (ic) ic.value = sub.itemCategory || '';
                    const wt = document.getElementById(`ec-weight-${key}`); if (wt) wt.value = sub.weight || '';
                    const on = document.getElementById(`ec-orderno-${key}`); if (on) on.value = sub.orderNo || '';
                }
            });
        }

        function onEditCombinedCategoryChange(key) {
            const cat = document.getElementById(`ec-category-${key}`).value;
            const fieldsContainer = document.getElementById(`ec-category-fields-${key}`);
            const labelPengirim = document.getElementById(`ec-label-pengirim-${key}`);
            if (cat === 'Food') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-utensils"></i> Data Resto / Pengirim`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">Code Orderan *</label><input type="text" id="ec-codeorder-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan *</label><input type="text" id="ec-orderno-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"></div>
                    </div>
                    <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">Total Menu / Rincian Barang *</label><input type="text" id="ec-totalmenu-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none"></div>`;
            } else if (cat === 'SPX') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-box"></i> Data Pengirim SPX (Toko / Agen)`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-3 gap-2">
                        <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kode Pesanan *</label><input type="text" id="ec-codeorder-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label><input type="text" id="ec-weight-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">Besar Barang</label><input type="text" id="ec-dimensions-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"></div>
                    </div>`;
                const pf = document.getElementById(`ec-platform-${key}`);
                if (pf) pf.value = 'SPX';
            } else if (cat === 'Instan') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-bolt"></i> Data Pengirim SPX Instan`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kategori Barang</label><input type="text" id="ec-itemcategory-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label><input type="text" id="ec-weight-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"></div>
                    </div>
                    <div><label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan Instan *</label><input type="text" id="ec-orderno-${key}" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"></div>`;
            }
        }

        function updateEditCombinedPaymentMethod(key) {
            const amount = parseFloat(document.getElementById(`ec-cashamount-${key}`).value) || 0;
            const sel = document.getElementById(`ec-payment-${key}`);
            if (sel) sel.value = amount > 0 ? 'Tunai' : 'Non-Tunai';
        }

        function addEditCombinedSubOrder() {
            const key = 'k' + (editCombinedKeyCounter++);
            editCombinedState.subOrders.push({
                _key: key, category: 'Food', platform: 'ShopeeFood', screenshot: null, orderIncome: 0, manualFuelCost: null,
                restoName: '', restoAddr: '', recipName: '', recipAddr: '', notes: '-', cashAmount: 0, payment: 'Non-Tunai',
                restoCheckin: null, recipCheckin: null
            });
            editCombinedState.points.push({ key, role: 'resto' });
            editCombinedState.points.push({ key, role: 'recip' });
            renderEditCombinedSubOrders();
            renderEditCombinedPointsList();
        }

        function removeEditCombinedSubOrder(key) {
            if (editCombinedState.subOrders.length <= 1) {
                showToast('Minimal harus ada 1 pesanan.', 'rose');
                return;
            }
            editCombinedState.subOrders = editCombinedState.subOrders.filter(s => s._key !== key);
            editCombinedState.points = editCombinedState.points.filter(p => p.key !== key);
            renderEditCombinedSubOrders();
            renderEditCombinedPointsList();
        }

        function renderEditCombinedPointsList() {
            const listEl = document.getElementById('edit-combined-points-list');
            if (!listEl) return;
            listEl.innerHTML = editCombinedState.points.map((p, i) => {
                const sub = editCombinedState.subOrders.find(s => s._key === p.key);
                if (!sub) return '';
                const isPickup = p.role === 'resto';
                const label = isPickup ? getPickupLabel(sub) : getDropoffLabel(sub);
                const colorClass = isPickup ? 'rose' : 'emerald';
                const canMoveUp = i > 0;
                const canMoveDown = i < editCombinedState.points.length - 1;
                return `
                    <div class="flex items-center justify-between gap-2 bg-white rounded-xl border border-${colorClass}-200 p-2">
                        <span class="text-[11px] font-bold text-${colorClass}-800 flex items-center gap-1.5 min-w-0">
                            <span class="w-5 h-5 rounded-full bg-${colorClass}-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">${i + 1}</span>
                            <span class="truncate">${escapeHtml(label)}</span>
                        </span>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button type="button" onclick="moveEditCombinedPoint(${i}, -1)" ${canMoveUp ? '' : 'disabled'} class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${canMoveUp ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}"><i class="fa-solid fa-chevron-up"></i></button>
                            <button type="button" onclick="moveEditCombinedPoint(${i}, 1)" ${canMoveDown ? '' : 'disabled'} class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${canMoveDown ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}"><i class="fa-solid fa-chevron-down"></i></button>
                        </div>
                    </div>`;
            }).join('');

            const badgeEl = document.getElementById('edit-combined-order-badge');
            if (badgeEl) {
                badgeEl.innerHTML = combinedPatternBadgeHTML(editCombinedState.points);
            }
        }

        // Ganti urutan titik di editCombinedState (in-memory, belum tersimpan ke
        // order sampai user klik Simpan) ke salah satu template.
        function applyEditCombinedPointsTemplate(pattern) {
            if (!editCombinedState) return;
            const keys = editCombinedState.subOrders.map(s => s._key);
            const pts = [];
            if (pattern === 'interleaved') {
                keys.forEach(k => {
                    pts.push({ key: k, role: 'resto' });
                    pts.push({ key: k, role: 'recip' });
                });
            } else {
                keys.forEach(k => pts.push({ key: k, role: 'resto' }));
                keys.forEach(k => pts.push({ key: k, role: 'recip' }));
            }
            editCombinedState.points = pts;
            renderEditCombinedPointsList();
            showToast(pattern === 'interleaved' ? 'Urutan diganti ke Interleaved.' : 'Urutan diganti ke Ambil Semua Dulu.', 'indigo');
        }

        function moveEditCombinedPoint(index, direction) {
            const target = index + direction;
            if (target < 0 || target >= editCombinedState.points.length) return;
            const pts = editCombinedState.points.slice();
            const tmp = pts[index]; pts[index] = pts[target]; pts[target] = tmp;

            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                if (p.role !== 'resto') continue;
                const recipIdx = pts.findIndex(q => q.key === p.key && q.role === 'recip');
                if (recipIdx !== -1 && recipIdx < i) {
                    showToast('Titik ambil tidak boleh berada setelah titik antar pesanan yang sama.', 'rose');
                    return;
                }
            }
            editCombinedState.points = pts;
            renderEditCombinedPointsList();
        }

        function saveEditCombinedForm() {
            const orderId = document.getElementById('edit-combined-order-id').value;
            const idx = ordersList.findIndex(o => o.id === orderId);
            if (idx === -1) { showToast('Order tidak ditemukan.', 'rose'); return; }

            const orderTimeVal = document.getElementById('edit-combined-ordertime').value;
            if (!orderTimeVal) { showToast('Waktu Diterima wajib diisi.', 'rose'); return; }

            // Pendapatan/Ongkir order gabungan = SATU total (bukan hasil sum per
            // sub-pesanan lagi). Ini satu-satunya sumber kebenaran pendapatan.
            const totalIncomeVal = parseFloat(document.getElementById('ec-total-income').value) || 0;

            for (const sub of editCombinedState.subOrders) {
                const key = sub._key;
                const restoName = document.getElementById(`ec-restoname-${key}`).value;
                const recipName = document.getElementById(`ec-recipname-${key}`).value;
                if (!restoName || !recipName) {
                    showToast('Nama Resto/Pengirim dan Nama Penerima wajib diisi di semua pesanan.', 'rose');
                    return;
                }
            }

            editCombinedState.subOrders.forEach(sub => {
                const key = sub._key;
                const cat = document.getElementById(`ec-category-${key}`).value;
                const cashVal = parseFloat(document.getElementById(`ec-cashamount-${key}`).value) || 0;
                sub.category = cat;
                sub.platform = document.getElementById(`ec-platform-${key}`).value;
                const manualFuelRaw = document.getElementById(`ec-fuelcost-manual-${key}`).value;
                const manualFuelVal = manualFuelRaw !== '' ? parseFloat(manualFuelRaw) : null;
                sub.manualFuelCost = (manualFuelVal !== null && !isNaN(manualFuelVal)) ? manualFuelVal : null;
                sub.restoName = document.getElementById(`ec-restoname-${key}`).value;
                sub.restoAddr = document.getElementById(`ec-restoaddr-${key}`).value;
                sub.recipName = document.getElementById(`ec-recipname-${key}`).value;
                sub.recipAddr = document.getElementById(`ec-recipaddr-${key}`).value;
                sub.notes = document.getElementById(`ec-notes-${key}`).value || '-';
                sub.cashAmount = cashVal;
                sub.payment = cashVal > 0 ? 'Tunai' : 'Non-Tunai';

                if (cat === 'Food') {
                    sub.codeOrder = document.getElementById(`ec-codeorder-${key}`)?.value || '-';
                    sub.totalMenu = document.getElementById(`ec-totalmenu-${key}`)?.value || '-';
                    sub.orderNo = document.getElementById(`ec-orderno-${key}`)?.value || '-';
                    delete sub.weight; delete sub.dimensions; delete sub.itemCategory;
                } else if (cat === 'SPX') {
                    sub.codeOrder = document.getElementById(`ec-codeorder-${key}`)?.value || '-';
                    sub.weight = document.getElementById(`ec-weight-${key}`)?.value || '-';
                    sub.dimensions = document.getElementById(`ec-dimensions-${key}`)?.value || '-';
                    delete sub.totalMenu; delete sub.orderNo; delete sub.itemCategory;
                } else if (cat === 'Instan') {
                    sub.orderNo = document.getElementById(`ec-orderno-${key}`)?.value || '-';
                    sub.itemCategory = document.getElementById(`ec-itemcategory-${key}`)?.value || 'Barang';
                    sub.weight = document.getElementById(`ec-weight-${key}`)?.value || '-';
                    delete sub.codeOrder; delete sub.totalMenu; delete sub.dimensions;
                }
            });

            const keyToIndex = {};
            editCombinedState.subOrders.forEach((s, i) => { keyToIndex[s._key] = i; });

            const finalSubOrders = editCombinedState.subOrders.map(s => {
                const copy = Object.assign({}, s);
                delete copy._key;
                if (!copy.screenshot) copy.screenshot = createSVGPlaceholder(copy.restoName || 'Pesanan', copy.category, copy.payment);
                return copy;
            });

            if (finalSubOrders.length === 1) {
                // Tersisa 1 pesanan -> konversi otomatis jadi order tunggal biasa.
                // Total ongkir gabungan jadi Pendapatan order tunggal ini.
                const s = finalSubOrders[0];
                const singleOrder = Object.assign({
                    id: orderId,
                    screenshot: ordersList[idx].screenshot
                }, s, {
                    orderIncome: totalIncomeVal,
                    orderTime: orderTimeVal,
                    timestamp: new Date(orderTimeVal).getTime()
                });
                ordersList[idx] = singleOrder;
            } else {
                const finalPoints = editCombinedState.points
                    .filter(p => keyToIndex[p.key] !== undefined)
                    .map(p => ({ subIndex: keyToIndex[p.key], role: p.role }));

                const totalCash = finalSubOrders.reduce((s, o) => s + (o.cashAmount || 0), 0);

                const order = ordersList[idx];
                order.isCombined = true; order.category = 'Gabungan';
                order.subOrders = finalSubOrders;
                order.points = finalPoints;
                order.orderIncome = totalIncomeVal;
                order.cashAmount = totalCash;
                order.payment = totalCash > 0 ? 'Tunai' : 'Non-Tunai';
                order.restoName = `${finalSubOrders.length} pengirim`;
                order.recipName = `${finalSubOrders.length} penerima`;
                order.orderTime = orderTimeVal;
                order.timestamp = new Date(orderTimeVal).getTime();
            }

            saveToLocalStorage();
            closeEditCombinedModal();
            renderAllViews();
            showToast('Orderan gabungan berhasil diperbarui!', 'emerald');
        }
    
