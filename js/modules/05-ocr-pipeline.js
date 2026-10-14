        // ============================================================
        // AI API KEY MANAGEMENT
        // Key disimpan di localStorage, tidak pernah hardcode di HTML.
        // ============================================================
        const GROK_API_KEY_STORAGE = 'drivertrack_grok_api_key';

        function getGrokApiKey() {
            return localStorage.getItem(GROK_API_KEY_STORAGE) || '';
        }

        function saveGrokApiKey() {
            const input = document.getElementById('grok-key-input-banner');
            const key = (input?.value || '').trim();
            if (!key || !key.startsWith('gsk_')) {
                showToast('Masukkan API Key AI yang valid (dimulai dengan gsk_).', 'rose');
                return;
            }
            localStorage.setItem(GROK_API_KEY_STORAGE, key);
            input.value = '';
            updateGrokKeyUI();
            showToast('API Key AI berhasil disimpan! AI siap digunakan.', 'emerald');
        }

        function saveGrokApiKeyFromProfile() {
            const input = document.getElementById('profile-grok-key-input');
            const key = (input?.value || '').trim();
            if (!key || !key.startsWith('gsk_')) {
                showToast('Masukkan API Key AI yang valid (dimulai dengan gsk_).', 'rose');
                return;
            }
            localStorage.setItem(GROK_API_KEY_STORAGE, key);
            input.value = '';
            updateGrokKeyUI();
            showToast('API Key AI berhasil disimpan!', 'emerald');
        }

        function clearGrokApiKey() {
            localStorage.removeItem(GROK_API_KEY_STORAGE);
            updateGrokKeyUI();
            showToast('API Key dihapus.', 'amber');
        }

        function toggleProfileKeyVisibility() {
            const input = document.getElementById('profile-grok-key-input');
            const icon = document.querySelector('#btn-toggle-key-visibility i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fa-solid fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fa-solid fa-eye';
            }
        }

        function updateGrokKeyUI() {
            const key = getGrokApiKey();
            const hasKey = key.length > 0;

            // Upload tab banner
            const banner = document.getElementById('grok-key-banner');
            const connected = document.getElementById('grok-key-connected');
            if (banner) banner.classList.toggle('hidden', hasKey);
            if (connected) connected.classList.toggle('hidden', !hasKey);

            // Masked key display
            const maskedEl = document.getElementById('grok-key-masked');
            if (maskedEl && hasKey) {
                const visible = key.slice(0, 8);
                maskedEl.textContent = `Key: ${visible}${'•'.repeat(Math.min(key.length - 8, 12))}`;
            }

            // Profile tab status
            const dot = document.getElementById('profile-grok-status-dot');
            const statusText = document.getElementById('profile-grok-status-text');
            const clearBtn = document.getElementById('btn-clear-grok-key');
            if (dot && statusText) {
                if (hasKey) {
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0';
                    statusText.textContent = 'Terhubung — AI Vision aktif';
                    statusText.className = 'text-[11px] font-semibold text-emerald-600';
                } else {
                    dot.className = 'w-2 h-2 rounded-full bg-rose-400 flex-shrink-0';
                    statusText.textContent = 'Belum diatur — AI tidak aktif';
                    statusText.className = 'text-[11px] font-semibold text-rose-500';
                }
            }
            if (clearBtn) clearBtn.classList.toggle('hidden', !hasKey);
        }

        // ============================================================
        // GROQ VISION API — Ekstrak screenshot pesanan (groq.com)
        // Base URL: https://api.groq.com/openai/v1/chat/completions
        // Models: llama-3.2-11b-vision-preview, qwen/qwen3.6-27b
        // ============================================================
                const AI_MODELS = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'];
        // Mode foto kamera: true jika gambar berasal dari kamera (diset oleh input bertanda data-ai-photo).
        let aiPhotoMode = false;
        // Hanya dipakai bila gambar dari KAMERA. Screenshot tidak pernah menerima petunjuk ini.
        const AI_LABEL_HINT = [
            '',
            'JIKA foto adalah LABEL PENGIRIMAN SPX (Shopee Xpress / SPX Instant / Sameday), tambahkan satu kunci "label" ke objek JSON:',
            '"label":{"kind":"Instan|SPX","orderNo":"","trackingNo":"","pickupCode":"","deadline":"","payType":"CASHLESS|COD","codAmount":0,"codCheck":"","product":"","variant":"","sku":"","qty":"","senderPhone":"","itemType":""}',
            'ATURAN LABEL:',
            '- kind = "Instan" bila tertulis INSTANT/SAMEDAY; "SPX" untuk resi reguler. category di objek utama harus sama.',
            '- orderNo = "No. Pesanan" (panjang). pickupCode = "Kode Pengambilan"/"Kode Ambil" (pendek, 4-6 karakter). trackingNo = No. Resi/AWB bila ada (mis. SPXID...). Jangan tertukar.',
            '- Pengirim -> restoName (+ restoAddr bila ada; jika hanya kota/kabupaten, tulis itu saja). Penerima -> recipName & recipAddr.',
            '- Alamat: gabungkan kata yang terpotong antar baris (mis. "K" + "ota" = "Kota"), hapus koma ganda. Jangan menambah alamat yang tidak tercetak.',
            '- weight dalam kg ("980 gr" = "0.98 kg"). deadline = "Batas Kirim" seperti tercetak.',
            '- payType "CASHLESS" bila tertulis cashless; "COD" bila COD (isi codAmount angka hanya jika ada nominal). "COD: Tidak" bukan COD. codCheck = nilai "COD Cek Dulu" (Ya/Tidak). cashAmount = 0 bila cashless atau COD Tidak.',
            '- product = nama produk (tanpa SKU), variant = Variasi, sku, qty = jumlah; senderPhone = nomor telepon pengirim bila tercetak; itemType = jenis barang singkat (Buku, Pakaian, Makanan, Elektronik, dll).',
            '- Kunci "label" HANYA diisi bila foto memang label pengiriman SPX; selain itu abaikan.'
        ].join('\n');
        const AI_PHOTO_HINT = '\nCATATAN: gambar ini adalah FOTO dari kamera (bukan screenshot): bisa miring, buram, ada pantulan/bayangan, atau berupa foto layar HP lain / struk / nota. Baca seteliti mungkin. Jika sebuah karakter, nomor, atau alamat tidak terbaca jelas, kosongkan bagian itu (""), JANGAN menebak.';
        const AI_PROMPT = `Anda OCR AI untuk screenshot pesanan driver ojol Indonesia (ShopeeFood, SPX/Shopee Xpress, SPX Instan, Grab, Gojek).
Balas HANYA satu objek JSON valid (tanpa markdown/penjelasan/<think>) dengan kunci:
{"category":"Food|SPX|Instan","platform":"ShopeeFood|Grab|Gojek|SPX|SPX Instan","restoName":"","restoAddr":"","recipName":"","recipAddr":"","notes":"","cashAmount":0,"codeOrder":"","totalMenu":"","orderNo":"","weight":"","dimensions":"","itemCategory":""}
ATURAN KATEGORI & PLATFORM:
- Food: Pesanan makanan/minuman (ShopeeFood, GrabFood, GoFood). Ada ringkasan menu (totalMenu).
- SPX (Reguler/Toko):
  * Tepat di bawah "Detail Pesanan" ada KODE PENDEK diawali '#' (contoh: #38U8, #4N73). Masukkan ke codeOrder.
  * Pada "Rincian Paket" ada "Berat" (misal 8.0 kg) dan "Besar" (dimensi cm, misal 5x14x20 cm). Masukkan ke dimensions.
  * TIDAK ADA baris "Kategori" di dalam Rincian Paket.
  * Pengirim biasanya toko/agen/merchant (contoh: INDOMARET ...).
  * Set category: "SPX", platform: "SPX".
- Instan (SPX Instan):
  * Tepat di bawah "Detail Pesanan" LANGSUNG berupa NOMOR PESANAN PANJANG 16-20 digit angka murni TANPA tanda '#' (contoh: 3300026836141568094). Masukkan ke orderNo, codeOrder KOSONGKAN ("").
  * Pada "Rincian Paket" ADA baris "Kategori" (contoh: "Kategori Makanan", "Kategori Dokumen", "Kategori Pakaian", dll) dan "Berat". Masukkan isi kategori ke itemCategory.
  * TIDAK ADA baris "Besar" (dimensi cm) di Rincian Paket.
  * Ada bagian "Informasi Pesanan" di bawah dengan No. Pesanan dan Waktu Pesanan.
  * Pengirim & Penerima biasanya orang perorangan.
  * Set category: "Instan", platform: "SPX Instan".

ATURAN DATA LAINNYA:
- restoName/restoAddr = RESTO atau PENGIRIM (titik ambil/pickup). recipName/recipAddr = PENERIMA (titik antar/tujuan). Jangan tertukar.
- Alamat tulis selengkap yang tampak (jalan, no, RT/RW, kelurahan, kecamatan, kota). Jangan menebak.
- cashAmount = ANGKA tunai yang ditagih ke penerima/customer (tanpa Rp/titik). Non-tunai/Rp0 = 0.
- totalMenu = ringkasan menu + jumlah (mis. "2 x Nasi Goreng, 1 x Es Teh").
- Teks tidak terlihat/tidak ada = "" (string kosong) atau 0. Status pesanan (Diambil, Diterima, dll) JANGAN dicatat.`;

        function aiClean(v) {
            if (v === null || v === undefined) return '';
            const t = String(v).replace(/\s+/g, ' ').trim();
            return /^(-|—|null|n\/a|none|tidak ada|undefined)$/i.test(t) ? '' : t;
        }
        function aiParseJson(text) {
            const t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '');
            for (let st = t.indexOf('{'); st !== -1; st = t.indexOf('{', st + 1)) {
                let d = 0, inStr = false, esc = false;
                for (let i = st; i < t.length; i++) {
                    const c = t[i];
                    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
                    if (c === '"') inStr = true; else if (c === '{') d++; else if (c === '}' && --d === 0) {
                        try { return JSON.parse(t.slice(st, i + 1)); } catch (e) { break; }
                    }
                }
            }
            return null;
        }
        function aiNormalize(p) {
            const o = {};
            ['restoName','restoAddr','recipName','recipAddr','notes','codeOrder','totalMenu','orderNo','weight','dimensions','itemCategory'].forEach(k => o[k] = aiClean(p[k]));
            o.codeOrder = o.codeOrder.replace(/\b(Diambil|Selesai|Diantar|Menuju|Pickup|Delivered|Dalam perjalanan|Diterima)\b/gi, '').trim();

            // Jika nomor pesanan panjang salah dimasukkan ke codeOrder, pindahkan ke orderNo
            const cleanDigitsCode = o.codeOrder.replace(/\D/g, '');
            if (cleanDigitsCode.length >= 14 && (!o.orderNo || o.orderNo.length < 10)) {
                o.orderNo = cleanDigitsCode;
                o.codeOrder = '';
            }

            const rawCat = aiClean(p.category).toLowerCase();
            const hasFood = rawCat.includes('food') || !!o.totalMenu;
            const hasKategoriBarang = !!o.itemCategory; // Ciri khas Instan
            const hasLongOrderNo = !!(o.orderNo && o.orderNo.length >= 14);
            const hasCodeOrderHash = o.codeOrder.startsWith('#');
            const hasDimensions = !!o.dimensions; // Ciri khas SPX

            if (hasFood && !hasKategoriBarang && !hasDimensions && !rawCat.includes('instan')) {
                o.category = 'Food';
            } else if (
                rawCat.includes('instan') || rawCat.includes('instant') ||
                hasKategoriBarang || // Kategori: Makanan/Barang/Dokumen
                (hasLongOrderNo && !hasCodeOrderHash && !hasDimensions)
            ) {
                o.category = 'Instan';
                o.platform = 'SPX Instan';
                if (!o.codeOrder.startsWith('#')) o.codeOrder = '';
            } else if (rawCat.startsWith('spx') || hasCodeOrderHash || hasDimensions || o.weight) {
                o.category = 'SPX';
                o.platform = 'SPX';
            } else {
                o.category = 'Food';
            }

            if (o.category === 'Instan') {
                o.platform = 'SPX Instan';
            } else if (o.category === 'SPX') {
                o.platform = 'SPX';
            } else if (o.category === 'Food') {
                const pl = aiClean(p.platform).toLowerCase();
                o.platform = pl.includes('grab') ? 'Grab' : (pl.includes('gojek') ? 'Gojek' : 'ShopeeFood');
            }

            let cash = typeof p.cashAmount === 'number' ? p.cashAmount : parseInt(String(p.cashAmount || '0').replace(/[^\d]/g, ''), 10);
            o.cashAmount = isNaN(cash) ? 0 : cash;
            return o;
        }
        // Berat dari label ("980 gr") -> "0.98 kg" agar sama dengan format kolom berat.
        function aiWeightKg(w) {
            const t = aiClean(w);
            const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(gr|g|gram)\b/i);
            if (!m) return t;
            const kg = parseFloat(m[1].replace(',', '.')) / 1000;
            return (Math.round(kg * 1000) / 1000) + ' kg';
        }
        // Khusus FOTO label SPX: isi kolom yang ada, sisanya (kode ambil, batas kirim, produk, kontak)
        // dicatat di Catatan supaya tidak terlewat. Screenshot tidak melewati fungsi ini.
        function aiApplyLabel(o, L) {
            if (!L || typeof L !== 'object') return o;
            if (o.category && o.category !== 'SPX' && o.category !== 'Instan') return o;
            const g = k => aiClean(L[k]);
            const kind = g('kind').toLowerCase();
            if (!o.category) o.category = (kind.includes('instan') || kind.includes('instant')) ? 'Instan' : 'SPX';
            const fixAddr = a => String(a || '').replace(/,(\s*,)+/g, ',').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
            o.restoAddr = fixAddr(o.restoAddr); o.recipAddr = fixAddr(o.recipAddr);
            o.weight = aiWeightKg(o.weight || g('weight'));
            if (o.category === 'Instan') {
                if (!o.orderNo) o.orderNo = g('orderNo');
                if (!o.itemCategory) o.itemCategory = g('itemType') || 'Paket';
            } else if (!o.codeOrder) {
                o.codeOrder = g('pickupCode') || g('trackingNo');
            }
            const payType = g('payType').toUpperCase();
            const isCod = payType.includes('COD') && !payType.includes('CASHLESS');
            const codAmt = parseInt(String(L.codAmount || '0').replace(/[^\d]/g, ''), 10) || 0;
            if (isCod && codAmt > 0) o.cashAmount = codAmt;
            let phone = g('senderPhone').replace(/[^\d+]/g, '');
            if (/^62\d{8,13}$/.test(phone)) phone = '+' + phone;
            const prod = g('product'), variant = g('variant'), sku = g('sku'), qty = g('qty');
            const detail = [variant && ('Var: ' + variant), sku && ('SKU ' + sku)].filter(Boolean).join(', ');
            const parts = [];
            if (o.notes) parts.push(o.notes);
            if (g('pickupCode') && o.category === 'Instan') parts.push('Kode Ambil: ' + g('pickupCode'));
            if (o.category === 'SPX') {
                if (g('trackingNo')) parts.push('No. Resi: ' + g('trackingNo'));
                if (g('orderNo')) parts.push('No. Pesanan: ' + g('orderNo'));
                if (g('pickupCode') && o.codeOrder !== g('pickupCode')) parts.push('Kode Ambil: ' + g('pickupCode'));
            }
            if (g('deadline')) parts.push('Batas Kirim: ' + g('deadline'));
            if (prod) parts.push('Barang: ' + prod + (detail ? ' (' + detail + ')' : '') + (qty ? ' x' + qty : ''));
            if (payType) parts.push('Bayar: ' + (isCod ? (codAmt ? 'COD Rp' + codAmt.toLocaleString('id-ID') : 'COD') : 'CASHLESS'));
            if (g('codCheck')) parts.push('COD Cek Dulu: ' + g('codCheck'));
            if (phone) parts.push('Kontak pengirim: ' + phone);
            o.notes = parts.join(' | ');
            o._label = true;
            return o;
        }
        // Return data ter-normalisasi, atau null (pesan error sudah ditampilkan)
        async function aiExtract(dataUrl) {
            const photo = aiPhotoMode; aiPhotoMode = false;   // dipakai sekali per gambar
            const apiKey = getGrokApiKey();
            if (!apiKey) { showToast('API Key AI belum diatur. Masukkan key terlebih dahulu.', 'rose'); updateGrokKeyUI(); return null; }
            let lastErr = null;
            for (const model of AI_MODELS) {
                let res;
                try {
                    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model, temperature: 0, max_tokens: 1400, messages: [
                            { role: 'system', content: AI_PROMPT + (photo ? AI_PHOTO_HINT + AI_LABEL_HINT : '') },
                            { role: 'user', content: [ { type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text: photo ? 'Ekstrak foto ini ke JSON.' : 'Ekstrak screenshot ini ke JSON.' } ] }
                        ] })
                    });
                } catch (e) { lastErr = { network: true }; continue; }
                if (res.ok) {
                    const data = await res.json();
                    const parsed = aiParseJson(data.choices?.[0]?.message?.content);
                    if (parsed) { const norm = aiNormalize(parsed); return photo ? aiApplyLabel(norm, parsed.label) : norm; }
                    lastErr = { parse: true }; continue; // coba model berikutnya
                }
                const err = await res.json().catch(() => ({}));
                lastErr = { status: res.status, msg: err?.error?.message || res.statusText };
                if (res.status === 401 || res.status === 403) break;
            }
            if (lastErr?.status === 401 || lastErr?.status === 403) { showToast('API Key AI tidak valid. Periksa kembali key Anda di menu Profil.', 'rose'); clearGrokApiKey(); }
            else if (lastErr?.status === 429) showToast('Batas penggunaan AI tercapai. Tunggu sebentar lalu coba lagi.', 'amber');
            else if (lastErr?.network) showToast('Koneksi gagal. Periksa internet & coba lagi.', 'rose');
            else if (lastErr?.parse) showToast('AI tidak dapat membaca gambar ini. Isi form manual.', 'amber');
            else showToast(`AI Error (${lastErr?.status || 500}): ${lastErr?.msg || ''}`, 'rose');
            return null;
        }
        // Validasi "grounding" terhadap teks OCR mentah (mencegah halusinasi & nilai basi)
        function validateGrounding(p, rawText) {
            if (!p) return p;
            p._warnings = p._warnings || [];

            // 1. Tolak restoName yang mengandung dua atau lebih penanda alamat (RT, RW, No, Jl, Gg)
            if (p.restoName) {
                const addrMarkers = p.restoName.match(/\b(?:RT[\s./\d]|RW[\s./\d]|No\.?\s*\d|Jl\.?|Jalan|Gg\.?|Gang)/gi) || [];
                if (addrMarkers.length >= 2) {
                    p._warnings.push(`Nama resto "${p.restoName}" ditolak karena menyerupai alamat`);
                    p.restoName = '';
                }
            }

            // Jika rawText kosong (misal Tier-2 Groq), lewati token check
            if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
                return p;
            }

            const normRaw = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

            const checkTokens = (val, fieldName, threshold) => {
                if (!val) return true;
                const normVal = val.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
                const tokens = normVal.split(/\s+/).filter(t => t.length >= 3);
                if (tokens.length === 0) return true;
                const matches = tokens.filter(t => normRaw.includes(t));
                const ratio = matches.length / tokens.length;
                if (ratio < threshold) {
                    p._warnings.push(`${fieldName} "${val}" tidak cocok dengan teks OCR mentah (${Math.round(ratio * 100)}% token cocok)`);
                    return false;
                }
                return true;
            };

            if (p.restoName && !checkTokens(p.restoName, 'Nama Resto', 0.6)) {
                p.restoName = '';
            }

            if (p.recipName && !checkTokens(p.recipName, 'Nama Penerima', 0.6)) {
                p.recipName = '';
            }

            if (p.codeOrder) {
                const codeClean = p.codeOrder.replace(/^#/, '').toLowerCase().trim();
                if (codeClean && !normRaw.includes(codeClean)) {
                    p._warnings.push(`Kode order "${p.codeOrder}" tidak ditemukan di teks OCR`);
                    p.codeOrder = '';
                }
            }

            if (p.orderNo) {
                const orderClean = p.orderNo.replace(/\D/g, '');
                const rawDigits = rawText.replace(/\D/g, '');
                if (orderClean.length >= 8 && !rawDigits.includes(orderClean)) {
                    p._warnings.push(`No. Pesanan "${p.orderNo}" tidak ditemukan di teks OCR`);
                    p.orderNo = '';
                }
            }

            return p;
        }

        // Terapkan hasil ke form. get(nama) -> elemen input
        function aiApply(p, get, onCat, onCash) {
            const set = (n, v) => {
                const el = get(n);
                if (!el) return;
                const val = (v === null || v === undefined) ? '' : String(v).trim();
                if (val !== '') {
                    el.value = val;
                    el.dataset.aiFilled = '1';
                } else if (el.dataset.aiFilled === '1') {
                    // Hanya kosongkan jika field sebelumnya diisi oleh AI
                    el.value = '';
                    delete el.dataset.aiFilled;
                }
            };
            if (p.category) {
                const catEl = get('category');
                if (catEl) {
                    catEl.value = p.category;
                    catEl.dataset.aiFilled = '1';
                    if (typeof onCat === 'function') onCat();
                }
            }
            if (p.platform) set('platform', p.platform);
            ['restoname:restoName','restoaddr:restoAddr','recipname:recipName','recipaddr:recipAddr','notes:notes','codeorder:codeOrder','totalmenu:totalMenu','orderno:orderNo','weight:weight','dimensions:dimensions','itemcategory:itemCategory']
                .forEach(x => { const [f, k] = x.split(':'); set(f, p[k]); });
            const cash = get('cashamount');
            if (cash) {
                if (p.cashAmount !== undefined && p.cashAmount !== null && p.cashAmount !== '') {
                    cash.value = p.cashAmount || 0;
                    cash.dataset.aiFilled = '1';
                    if (typeof onCash === 'function') onCash();
                } else if (cash.dataset.aiFilled === '1') {
                    cash.value = '';
                    delete cash.dataset.aiFilled;
                    if (typeof onCash === 'function') onCash();
                }
            }
        }

        // Hapus tanda aiFilled saat pengguna mengetik manual di input form manapun
        if (typeof document !== 'undefined') {
            document.addEventListener('input', function(e) {
                if (e.target && e.target.dataset && e.target.dataset.aiFilled) {
                    delete e.target.dataset.aiFilled;
                }
            }, true);
        }
        function aiResizeFile(file) {
            return new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = e => { const img = new Image(); img.onload = () => {
                    const m = aiPhotoMode ? 2048 : 1600; let w = img.width, h = img.height;
                    if (w > m || h > m) { if (w > h) { h = Math.round(h * m / w); w = m; } else { w = Math.round(w * m / h); h = m; } }
                    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve({ ai: c.toDataURL('image/jpeg', 0.85), store: makeStorageImage(img) });
                }; img.onerror = reject; img.src = e.target.result; };
                r.onerror = reject; r.readAsDataURL(file);
            });
        }

// ═══════════════════════════════════════════════════════════════════════
// OCR 3-TIER FALLBACK SYSTEM
// Tier 1 → Google ML Kit (Offline Native Android)
// Tier 2 → Groq Vision API (Online)
// Tier 3 → Tesseract.js (Offline Web Fallback)
// ═══════════════════════════════════════════════════════════════════════

// ── PRE-PROCESSING: resize 1200px + auto-contrast grayscale via HTML5 Canvas ──
// Dipanggil sebelum gambar dikirim ke ML Kit atau Tesseract.
async function preProcessImageForOCR(base64DataUrl, maxPx) {
    maxPx = maxPx || 1200;
    return new Promise(function(resolve) {
        try {
            var img = new Image();
            img.onload = function() {
                try {
                    var w = img.naturalWidth || img.width;
                    var h = img.naturalHeight || img.height;
                    // Resize agar sisi terpanjang tidak melebihi maxPx
                    if (w > maxPx || h > maxPx) {
                        if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
                        else { w = Math.round(w * maxPx / h); h = maxPx; }
                    }
                    var canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    // Grayscale + auto-contrast (stretch histogram)
                    var id = ctx.getImageData(0, 0, w, h);
                    var d = id.data;
                    var minG = 255, maxG = 0;
                    for (var i = 0; i < d.length; i += 4) {
                        var g = Math.round(0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]);
                        if (g < minG) minG = g;
                        if (g > maxG) maxG = g;
                    }
                    var range = maxG - minG || 1;
                    for (var j = 0; j < d.length; j += 4) {
                        var gv = Math.round(0.299*d[j] + 0.587*d[j+1] + 0.114*d[j+2]);
                        var sv = Math.min(255, Math.round((gv - minG) * 255 / range));
                        d[j] = d[j+1] = d[j+2] = sv;
                    }
                    ctx.putImageData(id, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.92));
                } catch(err) {
                    console.warn('[OCR-preProcess] Canvas error, pakai gambar asli:', err);
                    resolve(base64DataUrl);
                }
            };
            img.onerror = function() { resolve(base64DataUrl); };
            img.src = base64DataUrl;
        } catch(e) { resolve(base64DataUrl); }
    });
}

// Flag diagnostic OCR (dapat dimatikan lewat window.DT_OCR_DEBUG = false)
if (typeof window !== 'undefined' && typeof window.DT_OCR_DEBUG === 'undefined') {
    window.DT_OCR_DEBUG = true;
}

async function processImageWithGrok(base64DataUrl, idx) {
    idx = (idx === undefined || idx === null) ? 0 : idx;
    const photo = aiPhotoMode;
    const suffix = idx === 0 ? '' : `-${idx}`;
    const requestId = 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const loading = document.getElementById('ocr-loading' + suffix) || document.getElementById(`extra-ocr-loading-${idx}`);
    if (loading) loading.classList.remove('hidden');

    const ocrLog = function(...args) {
        if (typeof window !== 'undefined' && window.DT_OCR_DEBUG) {
            console.log(`[OCR][${requestId}]`, ...args);
        }
    };

    // Simpan URL foto asli sebelum diproses
    const originalPhotoUrl = base64DataUrl;

    try {
        let p = null;
        let tierUsed = 'none';

        // ── Pre-process: resize 1200px + grayscale + auto-contrast ──
        let processedUrl = base64DataUrl;
        try {
            processedUrl = await preProcessImageForOCR(base64DataUrl, 1200);
            ocrLog(`Pre-process selesai. Ukuran asli: ${base64DataUrl.length}b, hasil: ${processedUrl.length}b`);
        } catch (ep) {
            console.warn('[OCR] Pre-process gagal, pakai gambar asli:', ep);
        }

        // ── TIER 1: Google ML Kit (Capacitor Plugin — Offline Native) ──
        p = await jalankanMLKit(processedUrl);
        if (p) {
            tierUsed = 'Tier-1 ML Kit (Native)';
            ocrLog('Tier-1 ML Kit ✓');
        }

        // ── TIER 2: Groq Vision API (Online) ──
        if (!p) {
            if (navigator.onLine && getGrokApiKey()) {
                ocrLog('Tier-1 gagal/skip → Tier-2 Groq API...');
                try {
                    // Groq menerima gambar asli (bukan grayscale) agar logo/warna terbaca
                    p = await aiExtract(base64DataUrl);
                    if (p) {
                        tierUsed = 'Tier-2 Groq Vision (Online)';
                        ocrLog('Tier-2 Groq ✓');
                    }
                } catch (e2) {
                    console.warn('[OCR] Tier-2 Groq error:', e2);
                }
            } else {
                ocrLog('Tier-2 skip (offline atau key kosong).');
            }
        }

        // ── TIER 3: Tesseract.js (Offline Web Fallback) ──
        if (!p) {
            ocrLog('Tier-2 gagal/skip → Tier-3 Tesseract.js...');
            showToast('Memproses dengan AI Lokal (Tesseract)...', 'amber');
            try {
                p = await jalankanTesseract(processedUrl, idx);
                if (p) {
                    tierUsed = 'Tier-3 Tesseract.js (Offline)';
                    ocrLog('Tier-3 Tesseract ✓');
                }
            } catch (e3) {
                console.warn('[OCR] Tier-3 Tesseract error:', e3);
            }
        }

        // Isolasi permintaan: cek apakah form target masih ada (mungkin user sudah menghapus pesanan tambahan)
        if (idx > 0 && !document.getElementById('extra-order-block-' + idx)) {
            ocrLog(`Form target idx=${idx} sudah dihapus oleh user. Permintaan dibatalkan.`);
            return;
        }

        // ── Terapkan hasil ke form ──
        if (p) {
            // Validasi grounding terhadap teks OCR mentah (jika ada)
            p = validateGrounding(p, p._rawText);

            const getFieldVal = id => (document.getElementById(id + suffix)?.value || '');
            const beforeValues = {
                restoname: getFieldVal('form-restoname'),
                restoaddr: getFieldVal('form-restoaddr'),
                recipname: getFieldVal('form-recipname'),
                codeorder: getFieldVal('form-codeorder'),
                orderno:   getFieldVal('form-orderno')
            };

            ocrLog(`Tier dipakai: ${tierUsed}, Target Form: idx=${idx} (suffix: "${suffix}")`);
            ocrLog('300 karakter pertama teks OCR mentah:', ((p._rawText || '').slice(0, 300)));
            ocrLog('Objek hasil parser:', JSON.stringify(p));
            ocrLog('Nilai form SEBELUM aiApply:', beforeValues);

            aiApply(p, n => document.getElementById(`form-${n}${suffix}`),
                () => idx === 0 ? onCategoryChange() : onExtraCategoryChange(idx),
                () => idx === 0 ? updatePaymentMethodFromAmount() : updateExtraPaymentMethod(idx));

            const afterValues = {
                restoname: getFieldVal('form-restoname'),
                restoaddr: getFieldVal('form-restoaddr'),
                recipname: getFieldVal('form-recipname'),
                codeorder: getFieldVal('form-codeorder'),
                orderno:   getFieldVal('form-orderno')
            };
            ocrLog('Nilai form SESUDAH aiApply:', afterValues);

            // Beri tahu pengguna jika nama resto tidak terbaca & sorot border merah
            const restoInput = document.getElementById(`form-restoname${suffix}`);
            if (restoInput && !restoInput.value) {
                restoInput.classList.add('border-rose-500', 'ring-1', 'ring-rose-500');
                const clearHighlight = function() {
                    restoInput.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500');
                    restoInput.removeEventListener('input', clearHighlight);
                };
                restoInput.addEventListener('input', clearHighlight, { once: true });
                showToast('Nama Resto tidak terbaca, mohon isi manual.', 'amber');
            } else if (p._warnings && p._warnings.length > 0) {
                showToast(p._warnings[0], 'amber');
            } else {
                showToast(photo ? '✨ AI membaca foto. Periksa lagi hasilnya.' : '✨ Berhasil membaca gambar!', 'emerald');
            }
        } else {
            // OCR gagal total: pastikan foto tetap ditampilkan di preview
            try {
                const imgPrev = document.getElementById('image-preview' + suffix) || document.getElementById('image-preview');
                if (imgPrev && !imgPrev.src) { imgPrev.src = originalPhotoUrl; }
                if (imgPrev) imgPrev.classList.remove('hidden');
                const cont = document.getElementById('image-preview-container' + suffix) || document.getElementById('image-preview-container');
                if (cont) cont.classList.remove('hidden');
            } catch(_) {}
            showToast('OCR tidak dapat membaca teks dengan jelas. Foto tetap tersimpan, silakan lengkapi data secara manual.', 'amber');
        }
    } catch (err) {
        console.warn('[OCR] Fatal error:', err);
        showToast('Gagal memproses gambar. Silakan isi form secara manual.', 'rose');
    } finally {
        if (loading) loading.classList.add('hidden');
        if (idx === 0) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const ot = document.getElementById('form-ordertime');
            if (ot) ot.value = now.toISOString().slice(0, 16);
        }
    }
}

// ── TIER 1: Google ML Kit via Capacitor Plugin ────────────────────────────
// Berjalan secara native di Android (offline, cepat, tanpa internet).
// processImage() MEMBUTUHKAN path file lokal, bukan base64 data URL.
// Alur: base64 → tulis ke cache dir via Filesystem → pass path → hapus file.
// Di browser/laptop, Capacitor.Plugins.TextRecognition tidak ada
// → fungsi return null sehingga sistem otomatis lanjut ke Tier 2.
async function jalankanMLKit(base64DataUrl) {
    let tempFileName = null;
    try {
        const mlkit = window.Capacitor &&
            window.Capacitor.Plugins &&
            window.Capacitor.Plugins.TextRecognition;
        if (!mlkit) return null; // Tidak di Android → skip ke Tier 2

        const fs = window.Capacitor.Plugins.Filesystem;
        if (!fs) {
            console.warn('[OCR] Filesystem plugin tidak tersedia.');
            return null;
        }

        // ── Tulis base64 ke file sementara di cache dir Android ──────────
        // Strip header "data:image/jpeg;base64," jika ada
        const b64data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
        tempFileName = `ocr_tmp_${Date.now()}.jpg`;

        await fs.writeFile({
            path: tempFileName,
            data: b64data,
            directory: 'CACHE',   // Directory.Cache — tidak perlu izin storage
            encoding: 'base64'
        });

        // ── Ambil URI absolut file agar ML Kit bisa membacanya ────────────
        const uriResult = await fs.getUri({
            path: tempFileName,
            directory: 'CACHE'
        });
        const filePath = uriResult && uriResult.uri ? uriResult.uri : tempFileName;

        // ── Panggil ML Kit Text Recognition ──────────────────────────────
        const result = await mlkit.processImage({
            path: filePath,
            script: 'LATIN'  // Latin mencakup alfabet + angka (cukup untuk BINDO)
        });

        // result.text sudah berisi seluruh teks gabungan dari semua blok
        const text = (result && result.text) ? result.text : '';

        if (!text || text.trim().length < 10) return null;

        console.log('[OCR] ML Kit raw text length:', text.length);
        return ekstrakTeksLokal(text);

    } catch (e) {
        // Plugin error atau tidak tersedia → cascade ke Tier 2
        console.info('[OCR] ML Kit tidak tersedia atau error:', e.message || e);
        return null;
    } finally {
        // ── Hapus file sementara apapun hasilnya ─────────────────────────
        if (tempFileName) {
            try {
                const fs2 = window.Capacitor &&
                    window.Capacitor.Plugins &&
                    window.Capacitor.Plugins.Filesystem;
                if (fs2) await fs2.deleteFile({ path: tempFileName, directory: 'CACHE' });
            } catch (_) { /* abaikan error hapus file */ }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// TIER 3: Tesseract.js (Offline AI Lokal — Singleton & Optimized)
// ═══════════════════════════════════════════════════════════════════════
const OCR_IDLE_TIMEOUT_MS = 90000;       // 90 detik idle sebelum terminate worker
const OCR_RECOGNIZE_TIMEOUT_MS = 60000;  // 60 detik batas maksimal pembacaan per gambar
const OCR_LOAD_TIMEOUT_MS = 90000;       // 90 detik toleransi pemuatan model awal (HP lambat)

let _ocrWorker = null;
let _ocrWorkerPromise = null;
let _ocrIdleTimer = null;
let _ocrQueue = Promise.resolve();
let _tesseractScriptPromise = null;

// Helper: load script tesseract.min.js on-demand (sekali saja)
function loadTesseractLib() {
    if (typeof Tesseract !== 'undefined') return Promise.resolve(Tesseract);
    if (_tesseractScriptPromise) return _tesseractScriptPromise;

    _tesseractScriptPromise = new Promise(function(resolve, reject) {
        var baseUrl = getTesseractBaseUrl();
        var script = document.createElement('script');
        script.src = baseUrl + 'tesseract.min.js';
        script.onload = function() {
            if (typeof Tesseract !== 'undefined') {
                console.log('[OCR] tesseract.min.js berhasil dimuat secara on-demand.');
                resolve(Tesseract);
            } else {
                reject(new Error('Tesseract script dimuat tetapi objek Tesseract tidak ditemukan'));
            }
        };
        script.onerror = function() {
            _tesseractScriptPromise = null;
            reject(new Error('Gagal memuat tesseract.min.js dari ' + script.src));
        };
        document.head.appendChild(script);
    });
    return _tesseractScriptPromise;
}

function getTesseractBaseUrl() {
    try {
        var loc = window.location.href;
        if (/^(capacitor:|file:)/.test(loc)) {
            return window.location.origin + '/assets/ocr/';
        }
    } catch(_) {}
    return 'assets/ocr/';
}

function resetOcrIdleTimer() {
    if (_ocrIdleTimer) clearTimeout(_ocrIdleTimer);
    _ocrIdleTimer = setTimeout(function() {
        terminateOcrWorker('Idle timeout (90 detik tanpa permintaan)');
    }, OCR_IDLE_TIMEOUT_MS);
}

function terminateOcrWorker(reason) {
    if (_ocrIdleTimer) { clearTimeout(_ocrIdleTimer); _ocrIdleTimer = null; }
    if (_ocrWorker) {
        console.log('[OCR] Membebaskan worker Tesseract RAM:', reason || 'selesai');
        var w = _ocrWorker;
        _ocrWorker = null;
        _ocrWorkerPromise = null;
        try { w.terminate(); } catch(_) {}
    }
}

// Background handler: bebaskan worker jika user meminimize aplikasi > 30 detik
let _backgroundTimer = null;
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        _backgroundTimer = setTimeout(function() {
            terminateOcrWorker('Aplikasi diminimize / di background > 30s');
        }, 30000);
    } else {
        if (_backgroundTimer) { clearTimeout(_backgroundTimer); _backgroundTimer = null; }
    }
});

// Pre-process gambar khusus Tesseract (optimal untuk screenshot / nota ponsel)
async function preProcessImageForTesseract(base64DataUrl) {
    return new Promise(function(resolve) {
        try {
            var img = new Image();
            img.onload = function() {
                try {
                    var origW = img.naturalWidth || img.width;
                    var origH = img.naturalHeight || img.height;
                    var maxLong = 2600;
                    var targetW = 1200;

                    if (origW < 800) {
                        targetW = Math.min(1200, Math.round(origW * 1.4));
                    } else if (origW > 1600) {
                        targetW = 1600;
                    } else {
                        targetW = origW;
                    }

                    var scale = targetW / origW;
                    var w = Math.round(origW * scale);
                    var h = Math.round(origH * scale);

                    var longSide = Math.max(w, h);
                    if (longSide > maxLong) {
                        var longScale = maxLong / longSide;
                        w = Math.round(w * longScale);
                        h = Math.round(h * longScale);
                    }

                    var canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);

                    var id = ctx.getImageData(0, 0, w, h);
                    var d = id.data;
                    var minG = 255, maxG = 0;
                    for (var i = 0; i < d.length; i += 4) {
                        var g = Math.round(0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]);
                        if (g < minG) minG = g;
                        if (g > maxG) maxG = g;
                    }
                    var range = maxG - minG || 1;
                    for (var j = 0; j < d.length; j += 4) {
                        var gv = Math.round(0.299 * d[j] + 0.587 * d[j+1] + 0.114 * d[j+2]);
                        var sv = Math.min(255, Math.round((gv - minG) * 255 / range));
                        d[j] = d[j+1] = d[j+2] = sv;
                    }
                    ctx.putImageData(id, 0, 0);
                    var resultDataUrl = canvas.toDataURL('image/jpeg', 0.92);

                    canvas.width = canvas.height = 0; // Bebaskan canvas RAM segera
                    resolve(resultDataUrl);
                } catch(err) {
                    console.warn('[Tesseract-preProcess] Canvas error, fallback to original:', err);
                    resolve(base64DataUrl);
                }
            };
            img.onerror = function() { resolve(base64DataUrl); };
            img.src = base64DataUrl;
        } catch(e) { resolve(base64DataUrl); }
    });
}

// Inisialisasi Singleton Worker Tesseract (Thread-safe & Leak-proof)
async function getOrCreateTesseractWorker(onProgress) {
    if (_ocrWorker) {
        resetOcrIdleTimer();
        return _ocrWorker;
    }
    if (_ocrWorkerPromise) {
        return _ocrWorkerPromise;
    }

    await loadTesseractLib();

    var baseUrl = getTesseractBaseUrl();
    var isNative = /^(capacitor:|file:)/.test(window.location.href);

    var workerInstancePromise = Tesseract.createWorker('ind', 1, {
        workerPath: baseUrl + 'worker.min.js',
        langPath:   baseUrl,
        corePath:   baseUrl,
        gzip: false,
        cacheMethod: isNative ? 'none' : 'write',
        logger: function(m) {
            if (typeof onProgress === 'function') {
                try { onProgress(m); } catch(_) {}
            }
        }
    });

    var hasTimedOut = false;
    var loadTimeout = new Promise(function(_, rej) {
        setTimeout(function() {
            hasTimedOut = true;
            rej(new Error('Tesseract createWorker timeout (' + (OCR_LOAD_TIMEOUT_MS/1000) + 's)'));
        }, OCR_LOAD_TIMEOUT_MS);
    });

    _ocrWorkerPromise = Promise.race([workerInstancePromise, loadTimeout])
        .then(async function(worker) {
            if (hasTimedOut) {
                try { worker.terminate(); } catch(_) {}
                throw new Error('Worker creation timed out');
            }
            try {
                await worker.setParameters({
                    preserve_interword_spaces: '1',
                    user_defined_dpi: '300',
                    tessedit_pageseg_mode: '6'
                });
            } catch(paramErr) {
                console.warn('[OCR] Warning setParameters:', paramErr);
            }
            _ocrWorker = worker;
            _ocrWorkerPromise = null;
            resetOcrIdleTimer();
            return worker;
        })
        .catch(function(err) {
            _ocrWorkerPromise = null;
            _ocrWorker = null;
            workerInstancePromise.then(function(w) {
                try { if (w) w.terminate(); } catch(_) {}
            }).catch(function(){});
            throw err;
        });

    return _ocrWorkerPromise;
}

// Eksekusi antrean serial OCR Tesseract
async function jalankanTesseract(base64DataUrl, idx) {
    return new Promise(function(resolve, reject) {
        _ocrQueue = _ocrQueue.then(async function() {
            try {
                var res = await _eksekusiTesseractInternal(base64DataUrl, idx);
                resolve(res);
            } catch(err) {
                resolve(null);
            }
        }).catch(function() {
            resolve(null);
        });
    });
}

async function _eksekusiTesseractInternal(base64DataUrl, idx) {
    idx = (idx === undefined || idx === null) ? 0 : idx;
    var suffix = idx === 0 ? '' : ('-' + idx);
    var loadingEl = document.getElementById('ocr-loading' + suffix) || document.getElementById('extra-ocr-loading-' + idx);

    function updateLoadingText(text) {
        if (!loadingEl) return;
        var p = loadingEl.querySelector('p');
        if (p) p.textContent = text;
    }

    try {
        updateLoadingText('Memuat AI Lokal (Tesseract)...');

        var worker = await getOrCreateTesseractWorker(function(progress) {
            if (!progress || !progress.status) return;
            if (progress.status === 'recognizing text') {
                var pct = Math.round((progress.progress || 0) * 100);
                updateLoadingText('Membaca teks... ' + pct + '%');
            } else if (progress.status.includes('loading')) {
                updateLoadingText('Memuat model bahasa...');
            } else if (progress.status.includes('initializing')) {
                updateLoadingText('Menyiapkan AI Lokal...');
            }
        });

        // Pre-process gambar khusus Tesseract
        var processedImage = await preProcessImageForTesseract(base64DataUrl);

        var recP = worker.recognize(processedImage);
        var toP = new Promise(function(_, rej) {
            setTimeout(function() {
                rej(new Error('Tesseract recognize timeout (' + (OCR_RECOGNIZE_TIMEOUT_MS/1000) + 's)'));
            }, OCR_RECOGNIZE_TIMEOUT_MS);
        });

        var recResult = await Promise.race([recP, toP]);
        resetOcrIdleTimer();

        var text = (recResult && recResult.data && recResult.data.text) ? recResult.data.text : '';
        if (!text || text.trim().length < 10) {
            console.warn('[OCR] Tesseract menghasilkan teks terlalu pendek atau kosong.');
            return null;
        }

        console.log('[OCR] Tesseract berhasil membaca teks. Panjang:', text.length);
        return ekstrakTeksLokal(text);

    } catch(err) {
        console.error('[OCR] Tesseract error:', err.message || err);
        terminateOcrWorker('Error saat recognize: ' + (err.message || err));
        return null;
    } finally {
        if (loadingEl) {
            var p = loadingEl.querySelector('p');
            if (p) p.textContent = 'Membaca gambar dengan AI...';
        }
    }
}

// Alias mundur agar kompatibel
const jalankanAILokal = jalankanTesseract;

// Fungsi pembaca pola teks hasil OCR Tesseract — parser struktural 3-layout
