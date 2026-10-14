        // ============================================================
        // ORDERAN GABUNGAN — FORM INPUT ("+ Tambah Pesanan Lain")
        // Setiap pesanan tambahan adalah blok form lengkap dengan id
        // bersuffix -{idx} agar tidak bentrok dengan form-* utama (idx=0).
        // ============================================================
        let extraOrderCounter = 0;
        let extraOrderIndexes = [];
        let extraOrderImages = {}; // { idx: dataUrl } — screenshot per pesanan tambahan, sesuai urutan

        function escapeHtml(str) {
            return String(str === null || str === undefined ? '' : str)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function addExtraOrder() {
            extraOrderCounter++;
            const idx = extraOrderCounter;
            extraOrderIndexes.push(idx);

            const container = document.getElementById('extra-orders-container');
            const block = document.createElement('div');
            block.id = `extra-order-block-${idx}`;
            block.className = 'border-2 border-indigo-200 rounded-2xl p-3 space-y-3 bg-indigo-50/30 relative';
            block.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-xs font-extrabold text-indigo-700" data-extra-order-label>Pesanan Tambahan</span>
                    <button type="button" onclick="removeExtraOrder(${idx})" class="text-rose-500 hover:text-rose-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-rose-50 transition">
                        <i class="fa-solid fa-trash-can"></i> Hapus
                    </button>
                </div>

                <div class="bg-white/70 p-2.5 rounded-2xl border border-indigo-100 space-y-2">
                    <label class="block text-[11px] font-extrabold text-indigo-900 flex items-center gap-1.5">
                        <i class="fa-solid fa-camera"></i> <span data-extra-screenshot-label>Screenshot Pesanan Ini *</span>
                    </label>
                    <div id="extra-dropzone-${idx}" class="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 transition rounded-xl p-3 text-center cursor-pointer relative group">
                        <input type="file" id="extra-file-input-${idx}" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onchange="handleExtraFileSelect(${idx}, event)">
                        <div class="space-y-1 pointer-events-none">
                            <i class="fa-solid fa-cloud-arrow-up text-lg text-indigo-400 group-hover:scale-110 transition transform"></i>
                            <p class="text-[10.5px] font-bold text-slate-700">Pilih Screenshot / Foto</p>
                            <p class="text-[9px] text-slate-400">PNG, JPG, JPEG (Kompresi Otomatis)</p>
                        </div>
                    </div>
                    <label class="flex items-center justify-center gap-2 bg-slate-900 text-white text-[11px] font-extrabold py-2 rounded-xl cursor-pointer active:scale-95 transition">
                        <input type="file" accept="image/*" capture="environment" data-ai-photo="1" class="hidden" onchange="handleExtraFileSelect(${idx}, event)">
                        <i class="fa-solid fa-camera"></i> Foto dengan Kamera (AI Fusion)
                    </label>
                    <div id="extra-image-preview-container-${idx}" class="hidden bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 overflow-hidden">
                            <img id="extra-uploaded-image-preview-${idx}" src="" alt="Preview Screenshot" class="w-11 h-12 object-cover rounded-lg border border-slate-300 shadow-sm cursor-pointer hover:opacity-90 transition flex-shrink-0" onclick="openImageModal(this.src)">
                            <div class="overflow-hidden">
                                <p class="text-[10.5px] font-bold text-emerald-600 flex items-center gap-1">
                                    <i class="fa-solid fa-circle-check"></i> Foto Tersimpan
                                </p>
                                <p class="text-[10px] font-medium text-slate-600 truncate" id="extra-uploaded-file-name-${idx}">screenshot.png</p>
                                <p class="text-[9.5px] text-slate-400" id="extra-uploaded-file-size-${idx}">Ukuran: -</p>
                            </div>
                        </div>
                        <button type="button" onclick="removeExtraUploadedImage(${idx})" class="text-slate-400 hover:text-rose-500 p-1.5 text-xs transition flex-shrink-0">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                    <div id="extra-ocr-loading-${idx}" class="hidden bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-center space-y-1">
                        <div class="inline-block animate-spin text-indigo-600 text-lg">
                            <i class="fa-solid fa-circle-notch"></i>
                        </div>
                        <p class="text-[10.5px] font-bold text-indigo-900">AI Vision Membaca Gambar...</p>
                    </div>
                </div>

                <div class="bg-indigo-50/80 p-2.5 rounded-2xl border border-indigo-100 space-y-1">
                    <label class="block text-[11px] font-extrabold text-indigo-900">Kategori Pesanan *</label>
                    <select id="form-category-${idx}" onchange="onExtraCategoryChange(${idx})" class="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-700 focus:outline-none">
                        <option value="Food">🍲 Food (Code Order, Total Menu, No. Pesanan)</option>
                        <option value="SPX">📦 SPX / Paket (Kode Pesanan, Berat, Besar)</option>
                        <option value="Instan">⚡ SPX Instan (Kategori, Berat, No. Pesanan)</option>
                    </select>
                </div>

                <div class="bg-violet-50/80 p-2.5 rounded-2xl border border-violet-100 space-y-1">
                    <label class="block text-[11px] font-extrabold text-violet-900">Platform Aplikasi *</label>
                    <select id="form-platform-${idx}" class="w-full bg-white border border-violet-200 rounded-xl px-3 py-2 text-xs font-bold text-violet-700 focus:outline-none">
                        <option value="SPX">📦 SPX (Shopee Xpress)</option><option value="SPX Instan">⚡ SPX Instan</option>
                        <option value="ShopeeFood">🛍️ ShopeeFood</option>
                        <option value="Grab">🟢 Grab</option>
                        <option value="Gojek">🟩 Gojek</option>
                        <option value="Lainnya">📱 Lainnya</option>
                    </select>
                </div>

                <div class="bg-emerald-50/60 p-2.5 rounded-2xl border border-emerald-200/80 space-y-2">
                    <label class="block text-[11px] font-extrabold text-emerald-900 flex items-center gap-1.5"><i class="fa-solid fa-sack-dollar"></i> Data Finansial</label>
                    <div class="grid grid-cols-2 gap-2">
                        <div id="form-income-wrapper-${idx}">
                            <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Pendapatan / Ongkir (Rp)</label>
                            <input type="number" id="form-income-${idx}" value="" min="0" placeholder="Contoh: 12000" class="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Biaya BBM Manual (opsional)</label>
                            <input type="number" id="form-fuelcost-manual-${idx}" min="0" placeholder="Kosongkan = auto" class="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                </div>

                <div id="category-specific-fields-${idx}" class="space-y-2"></div>

                <div class="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
                    <span class="text-xs font-extrabold text-amber-700 flex items-center gap-1" id="label-pengirim-title-${idx}">
                        <i class="fa-solid fa-utensils"></i> Data Resto / Pengirim
                    </span>
                    <div>
                        <input type="text" id="form-restoname-${idx}" required autocomplete="off" placeholder="Nama Resto / Pengirim *" class="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-semibold">
                    </div>
                    <div>
                        <textarea id="form-restoaddr-${idx}" rows="2" placeholder="Alamat pengirim / resto lengkap..." class="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none custom-scrollbar"></textarea>
                    </div>
                </div>

                <div class="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
                    <span class="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                        <i class="fa-solid fa-location-dot"></i> Data Tujuan / Penerima
                    </span>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="text" id="form-recipname-${idx}" required autocomplete="off" placeholder="Nama Penerima *" class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-semibold">
                        <input type="number" id="form-cashamount-${idx}" value="" min="0" placeholder="Rp Tunai" oninput="updateExtraPaymentMethod(${idx})" class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-semibold">
                    </div>
                    <div class="flex items-center justify-between bg-white/80 p-2 rounded-xl border border-emerald-200 text-xs">
                        <span class="text-[10px] text-slate-500 font-medium">Status Pembayaran:</span>
                        <select id="form-payment-${idx}" disabled class="bg-transparent font-bold text-xs text-emerald-700 focus:outline-none">
                            <option value="Non-Tunai">Non-Tunai (Rp0)</option>
                            <option value="Tunai">Tunai (&gt; Rp0)</option>
                        </select>
                    </div>
                    <div>
                        <textarea id="form-recipaddr-${idx}" rows="2" placeholder="Alamat pengantaran lengkap..." class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none custom-scrollbar"></textarea>
                    </div>
                    <div>
                        <input type="text" id="form-notes-${idx}" placeholder="Catatan pemesan (pagar hijau...)" class="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none">
                    </div>
                </div>
            `;
            container.appendChild(block);
            onExtraCategoryChange(idx);
            renumberExtraOrders();
            updateCombinedIncomeModeUI();
        }

        function removeExtraOrder(idx) {
            const block = document.getElementById(`extra-order-block-${idx}`);
            if (block) block.remove();
            extraOrderIndexes = extraOrderIndexes.filter(i => i !== idx);
            delete extraOrderImages[idx];
            renumberExtraOrders();
            updateCombinedIncomeModeUI();
        }

        // Ketika mode Orderan Gabungan aktif (>=2 pesanan), sembunyikan semua
        // input Pendapatan/Ongkir per sub-pesanan dan tampilkan SATU input total
        // gabungan sebagai gantinya (lihat PERUBAHAN #2 di prompt fitur).
        function updateCombinedIncomeModeUI() {
            const isCombinedMode = extraOrderIndexes.length > 0;
            const mainWrap = document.getElementById('form-income-wrapper');
            if (mainWrap) mainWrap.classList.toggle('hidden', isCombinedMode);
            extraOrderIndexes.forEach(idx => {
                const w = document.getElementById(`form-income-wrapper-${idx}`);
                if (w) w.classList.toggle('hidden', isCombinedMode);
            });
            const totalWrap = document.getElementById('form-combined-total-income-wrapper');
            if (totalWrap) totalWrap.classList.toggle('hidden', !isCombinedMode);
        }

        function renumberExtraOrders() {
            extraOrderIndexes.forEach((idx, i) => {
                const block = document.getElementById(`extra-order-block-${idx}`);
                if (block) {
                    const label = block.querySelector('[data-extra-order-label]');
                    if (label) label.innerText = `Pesanan #${i + 2}`;
                    const shotLabel = block.querySelector('[data-extra-screenshot-label]');
                    if (shotLabel) shotLabel.innerText = `Screenshot Pesanan #${i + 2} *`;
                }
            });
        }

        function resetExtraOrders() {
            const container = document.getElementById('extra-orders-container');
            if (container) container.innerHTML = '';
            extraOrderIndexes = [];
            extraOrderImages = {};
            const totalIncomeInput = document.getElementById('form-combined-total-income');
            if (totalIncomeInput) totalIncomeInput.value = '';
            updateCombinedIncomeModeUI();
        }

        // ============================================================
        // SCREENSHOT PER PESANAN TAMBAHAN (Pesanan #2, #3, dst)
        // Setiap pesanan tambahan punya foto sendiri, disimpan terpisah
        // di extraOrderImages[idx] agar urutannya selalu cocok dengan
        // urutan pesanan saat disimpan (lihat collectOrderEntry).
        // ============================================================
        function handleExtraFileSelect(idx, e) {
            const file = e.target.files[0];
            if (!file) return;

            const nameEl = document.getElementById(`extra-uploaded-file-name-${idx}`);
            const sizeEl = document.getElementById(`extra-uploaded-file-size-${idx}`);
            if (nameEl) nameEl.innerText = file.name;
            if (sizeEl) sizeEl.innerText = `Ukuran: ${(file.size / 1024).toFixed(1)} KB`;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const rawImg = new Image();
                rawImg.onload = function() {
                    const canvas = document.createElement('canvas');
                    const maxDim = aiPhotoMode ? 2048 : 1600;
                    let w = rawImg.width;
                    let h = rawImg.height;

                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }

                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(rawImg, 0, 0, w, h);
                    const aiDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    const dataUrl = makeStorageImage(rawImg);
                    extraOrderImages[idx] = dataUrl;

                    const previewImg = document.getElementById(`extra-uploaded-image-preview-${idx}`);
                    const previewContainer = document.getElementById(`extra-image-preview-container-${idx}`);
                    if (previewImg) previewImg.src = dataUrl;
                    if (previewContainer) previewContainer.classList.remove('hidden');

                    processImageWithGrok(aiDataUrl, idx);
                };
                rawImg.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }

        function removeExtraUploadedImage(idx) {
            delete extraOrderImages[idx];
            const input = document.getElementById(`extra-file-input-${idx}`);
            const previewContainer = document.getElementById(`extra-image-preview-container-${idx}`);
            if (input) input.value = '';
            if (previewContainer) previewContainer.classList.add('hidden');
        }

        function onExtraCategoryChange(idx) {
            const cat = document.getElementById(`form-category-${idx}`).value;
            const fieldsContainer = document.getElementById(`category-specific-fields-${idx}`);
            const labelPengirim = document.getElementById(`label-pengirim-title-${idx}`);

            if (cat === 'Food') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-utensils"></i> Data Resto / Pengirim`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Code Orderan *</label>
                            <input type="text" id="form-codeorder-${idx}" placeholder="Contoh: #782" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan *</label>
                            <input type="text" id="form-orderno-${idx}" placeholder="325241133197056..." class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Total Menu / Rincian Barang *</label>
                        <input type="text" id="form-totalmenu-${idx}" placeholder="Contoh: 1 x Bakmi Goreng (Total 1 menu)" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none">
                    </div>`;
            } else if (cat === 'SPX') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-box"></i> Data Pengirim SPX (Toko / Agen)`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kode Pesanan *</label>
                            <input type="text" id="form-codeorder-${idx}" placeholder="#4N73" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label>
                            <input type="text" id="form-weight-${idx}" placeholder="1.5 kg" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Besar Barang</label>
                            <input type="text" id="form-dimensions-${idx}" placeholder="0x0x0 cm" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>`;
                const pf = document.getElementById(`form-platform-${idx}`);
                if (pf) pf.value = 'SPX';
            } else if (cat === 'Instan') {
                labelPengirim.innerHTML = `<i class="fa-solid fa-bolt"></i> Data Pengirim SPX Instan`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kategori Barang</label>
                            <input type="text" id="form-itemcategory-${idx}" placeholder="Makanan / Paket" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label>
                            <input type="text" id="form-weight-${idx}" placeholder="1.0 kg" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan Instan *</label>
                        <input type="text" id="form-orderno-${idx}" placeholder="3248025614224384096" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                    </div>`;
            }
        }

        function updateExtraPaymentMethod(idx) {
            const amount = parseFloat(document.getElementById(`form-cashamount-${idx}`).value) || 0;
            const paymentSelect = document.getElementById(`form-payment-${idx}`);
            if (paymentSelect) paymentSelect.value = amount > 0 ? 'Tunai' : 'Non-Tunai';
        }

        // Kumpulkan 1 blok pesanan (idx=0 artinya form utama form-*, idx>0
        // artinya blok tambahan form-*-{idx}) menjadi object subOrder polos.
        function collectOrderEntry(idx) {
            const suffix = idx === 0 ? '' : `-${idx}`;
            const get = (id) => document.getElementById(id + suffix);
            const cat = get('form-category').value;
            const cashVal = parseFloat(get('form-cashamount').value) || 0;
            const platform = get('form-platform')?.value || 'Lainnya';
            const incomeVal = parseFloat(get('form-income')?.value) || 0;
            const manualFuelRaw = get('form-fuelcost-manual')?.value;
            const manualFuelVal = manualFuelRaw !== '' && manualFuelRaw !== undefined ? parseFloat(manualFuelRaw) : null;

            const entry = {
                category: cat,
                platform: platform,
                orderIncome: incomeVal,
                manualFuelCost: (manualFuelVal !== null && !isNaN(manualFuelVal)) ? manualFuelVal : null,
                restoName: get('form-restoname').value,
                restoAddr: get('form-restoaddr').value,
                recipName: get('form-recipname').value,
                recipAddr: get('form-recipaddr').value,
                notes: get('form-notes').value || '-',
                cashAmount: cashVal,
                payment: cashVal > 0 ? 'Tunai' : 'Non-Tunai',
                restoCheckin: null,
                recipCheckin: null,
                // Screenshot pesanan ini: pesanan #1 (idx 0) pakai uploader utama,
                // pesanan #2 dst pakai uploader masing-masing (extraOrderImages).
                screenshot: idx === 0 ? uploadedImageDataUrl : (extraOrderImages[idx] || null)
            };

            if (cat === 'Food') {
                entry.codeOrder = get('form-codeorder')?.value || '-';
                entry.totalMenu = get('form-totalmenu')?.value || '-';
                entry.orderNo = get('form-orderno')?.value || '-';
            } else if (cat === 'SPX') {
                entry.codeOrder = get('form-codeorder')?.value || '-';
                entry.weight = get('form-weight')?.value || '-';
                entry.dimensions = get('form-dimensions')?.value || '-';
            } else if (cat === 'Instan') {
                entry.orderNo = get('form-orderno')?.value || '-';
                entry.itemCategory = get('form-itemcategory')?.value || 'Barang';
                entry.weight = get('form-weight')?.value || '-';
            }
            return entry;
        }

        function handleFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;

            document.getElementById('uploaded-file-name').innerText = file.name;
            document.getElementById('uploaded-file-size').innerText = `Ukuran: ${(file.size / 1024).toFixed(1)} KB`;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const rawImg = new Image();
                rawImg.onload = function() {
                    const canvas = document.createElement('canvas');
                    // Tingkatkan resolusi max agar teks kecil screenshot bisa terbaca AI
                    const maxDim = aiPhotoMode ? 2048 : 1600;
                    let w = rawImg.width;
                    let h = rawImg.height;

                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }

                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(rawImg, 0, 0, w, h);
                    const aiDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    uploadedImageDataUrl = makeStorageImage(rawImg);

                    document.getElementById('uploaded-image-preview').src = uploadedImageDataUrl;
                    document.getElementById('image-preview-container').classList.remove('hidden');

                    processImageWithGrok(aiDataUrl);
                };
                rawImg.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }

        function removeUploadedImage() {
            uploadedImageDataUrl = null;
            document.getElementById('file-input').value = '';
            document.getElementById('image-preview-container').classList.add('hidden');
        }
