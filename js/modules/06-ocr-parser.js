function ekstrakTeksLokal(rawText) {
    const text  = (rawText || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    /* -- Utilitas --------------------------------------------------- */
    const toInt  = (str) => parseInt((str || '').replace(/\./g, '').replace(/[^\d]/g, ''), 10) || 0;
    const clean  = (s)   => (s || '').replace(/[|\\\/~`^_={}<>*]{2,}/g, '').replace(/\s+/g, ' ').trim();
    const joinAddr = (arr) => arr.map(clean).filter(Boolean).join(', ').replace(/,\s*,/g, ',').trim();
    const findIdx = (re)  => lines.findIndex(l => re.test(l));

    // Baris separator kota/provinsi ShopeeFood: "DISTRICT, KAB. REGENCY, JAWA TENGAH"
    // Ini penanda AKHIR dari satu blok alamat (resto atau penerima)
    const isCityBlock = (l) =>
        /^[A-Z0-9\s,.()\-\/]+$/.test(l) &&
        l.length > 8 &&
        (/\bKAB\.\b|\bKOTA\b/i.test(l) ||
         /\b(JAWA|BALI|SUMATERA|SUMATRA|SULAWESI|KALIMANTAN|PAPUA|NTB|NTT|DIY|DKI)\b/i.test(l));

    // Apakah baris mengandung kata kunci section baru / sistem?
    const isSys = (l) =>
        /^(Pembayaran|Rincian|Informasi|Bukti|Total\s+\d|Bayar\s+tunai|Terima\s+Pembayaran|Tagih|No\.\s*Pesanan|Waktu\s*Pesanan|Berat\s|Besar\s|Salin$)/i.test(l) ||
        /^(Pengirim|Penerima|Pembeli)\s*:/i.test(l);

    /* == 1. DATA PENDUKUNG (BERAT, DIMENSI, KATEGORI, KODE, NO PESANAN) == */
    const matchLines = (re) => { for (const l of lines) { const m = l.match(re); if (m) return (m[1]||'').trim(); } return ''; };
    const weight       = matchLines(/Berat\s*[:\-]?\s*([\d.,]+\s*(?:kg|gr|gram))/i);
    const dimensions   = matchLines(/(?:Besar|Dimensi|Ukuran|Size)\s*[:\-]?\s*([\d]+\s*[xX\u00d7]\s*[\d]+\s*[xX\u00d7]\s*[\d]+\s*(?:cm)?)/i);
    const itemCategory = matchLines(/(?:Kategori|Jenis\s*Barang|Item\s*Type)\s*[:\-]?\s*([^\n\r]+)/i);

    const matchCode = text.match(/#([A-Z0-9]{2,8})\b/i);
    let codeOrder = matchCode
        ? ('#' + matchCode[1].toUpperCase())
            .replace(/\b(Diambil|Selesai|Diantar|Menuju|Pickup|Delivered|Diterima)\b/gi, '').trim()
        : '';

    let orderNo = '';
    const mOnoInline = text.match(/(?:No\.?\s*Pesanan|Nomor\s*Pesanan|Order\s*(?:ID|No\.?))\s*[:\-]?\s*(\d{14,20})/i);
    if (mOnoInline) {
        orderNo = mOnoInline[1].trim();
    } else {
        const iOnoLabel = findIdx(/^(?:No\.?\s*Pesanan|Nomor\s*Pesanan|Order\s*(?:ID|No\.?))\s*[:\-]?\s*$/i);
        if (iOnoLabel >= 0 && iOnoLabel + 1 < lines.length) {
            const nextLine = lines[iOnoLabel + 1].replace(/\s/g, '');
            if (/^\d{14,20}$/.test(nextLine)) orderNo = lines[iOnoLabel + 1].trim();
        }
        if (!orderNo) {
            const mOnoFallback = text.match(/\b(\d{16,20})\b/);
            if (mOnoFallback) orderNo = mOnoFallback[1].trim();
        }
    }

    /* == 2. DETEKSI JENIS STRUK (FOOD vs SPX vs INSTAN) ============= */
    const isFood = /Total\s+\d+\s+menu|Bayar\s+tunai\s+di\s+Resto|Rincian\s+Barang|Pembeli\s*:/i.test(text);

    // CIRI KHAS SPX INSTAN:
    // 1. Ada kata "SPX Instan", "Instant", atau "Sameday"
    // 2. Ada baris "Kategori" di dalam rincian paket (misal: "Kategori Makanan", "Kategori Dokumen", dll)
    // 3. Ada Nomor Pesanan panjang 16-20 digit TANPA kode '#' dan TANPA dimensi "Besar" (cm)
    // 4. Ada section "Informasi Pesanan" + "Waktu Pesanan" tanpa dimensi "Besar"
    const hasExplicitInstan = /SPX\s*Instan|Instant|Sameday/i.test(text);
    const hasLongOrderNo    = (orderNo && orderNo.length >= 14);
    const hasCodeOrderHash  = !!codeOrder;
    const hasDimensions     = !!dimensions;

    const isInstan = !isFood && (
        hasExplicitInstan ||
        !!itemCategory ||
        (hasLongOrderNo && !hasCodeOrderHash && !hasDimensions) ||
        (/Informasi\s*Pesanan/i.test(text) && !hasDimensions && !hasCodeOrderHash)
    );

    // CIRI KHAS SPX (REGULER/TOKO):
    // 1. Ada kode '#' (misal #38U8) ATAU ada dimensi "Besar" (misal 5x14x20 cm)
    // 2. Berisi Rincian Paket / Berat / Pengirim toko tanpa indikasi Instan
    const isExpress = !isFood && !isInstan && (
        hasCodeOrderHash ||
        hasDimensions ||
        /\bBerat\b|\bBesar\b|Pengirim\s*:|Rincian\s*Paket/i.test(text)
    );

    let category = isFood ? 'Food' : (isInstan ? 'Instan' : (isExpress ? 'SPX' : 'Food'));
    let platform  = isFood ? 'ShopeeFood' : (isInstan ? 'SPX Instan' : (isExpress ? 'SPX' : 'ShopeeFood'));
    if (/grab\s*food|grabfood/i.test(text))  { platform = 'Grab';  category = 'Food'; }
    if (/gojek|go\s*food/i.test(text))       { platform = 'Gojek'; category = 'Food'; }

    // Jika pesanan Instan, nomor panjang bukan codeOrder (codeOrder hanya untuk kode pendek bertanda '#')
    if (isInstan && (!codeOrder || !codeOrder.startsWith('#'))) {
        codeOrder = '';
    }

    /* == 3. INDEKS LANDMARK BARIS =================================== */
    const iCode     = findIdx(/#[A-Z0-9]{2,8}/i);
    const iPengirim = findIdx(/^Pengirim\s*:/i);
    const iPenerima = findIdx(/^Penerima\s*:/i);
    const iPembeli  = findIdx(/^Pembeli\s*:/i);
    const iRincian  = findIdx(/^Rincian\s+(Barang|Paket)/i);

    let restoName = '', restoAddr = '', recipName = '', recipAddr = '';

    /* == 4-5. EKSTRAKSI NAMA & ALAMAT =============================== */

    if (isExpress || isInstan) {
        /* -- SPX LAYOUT ---------------------------------------------
           [#kode]
           [restoAddr baris...]     ← blok sebelum "Pengirim:"
           Pengirim: NAMA           ← restoName (mungkin wrap ke baris berikut)
           [recipAddr baris...]     ← blok sebelum "Penerima:"
           Penerima: NAMA           ← recipName (mungkin wrap ke baris berikut)
        ----------------------------------------------------------- */
        const inlineVal = (lineStr, re) => { const m = lineStr.match(re); return m ? m[1].trim() : ''; };

        // restoName: inline "Pengirim: ..." + kemungkinan baris lanjutan (nama terpotong)
        if (iPengirim >= 0) {
            const parts = [inlineVal(lines[iPengirim], /^Pengirim\s*:\s*(.+)/i)];
            for (let j = iPengirim + 1; j <= iPengirim + 3 && j < lines.length; j++) {
                const l = lines[j];
                if (isSys(l) || isCityBlock(l) || /\b(Jl\.|Jalan|RT[\s./]|RW[\s./]|No\.\s*\d|Gg\.|Gang)/i.test(l) || /^(Penerima|Pembayaran|Rincian|Bukti)/i.test(l)) break;
                parts.push(clean(l));
            }
            restoName = parts.filter(Boolean).join(' ').trim();
        }

        // restoAddr: baris antara [#kode] dan "Pengirim:"
        if (iPengirim > 0) {
            const start = iCode >= 0 ? iCode + 1 : 0;
            const arr = [];
            for (let i = start; i < iPengirim; i++) {
                const l = clean(lines[i]);
                if (l && !/#[A-Z0-9]/i.test(l)) arr.push(l);
            }
            restoAddr = joinAddr(arr);
        }

        // recipName: inline "Penerima: ..." + kemungkinan baris lanjutan
        if (iPenerima >= 0) {
            const parts = [inlineVal(lines[iPenerima], /^Penerima\s*:\s*(.+)/i)];
            for (let j = iPenerima + 1; j <= iPenerima + 3 && j < lines.length; j++) {
                const l = lines[j];
                if (isSys(l) || isCityBlock(l) || /\b(Jl\.|Jalan|RT[\s./]|RW[\s./]|No\.\s*\d|Gg\.|Gang)/i.test(l) || /^(Pengirim|Pembayaran|Rincian|Bukti)/i.test(l)) break;
                parts.push(clean(l));
            }
            recipName = parts.filter(Boolean).join(' ').trim();
        }

        // recipAddr: baris antara akhir blok restoName dan "Penerima:"
        if (iPengirim >= 0 && iPenerima > iPengirim) {
            const nameExtra = (restoName.split(/\s+/).length > 6) ? 2 : 1;
            const arr = [];
            for (let i = iPengirim + nameExtra; i < iPenerima; i++) {
                const l = clean(lines[i]);
                if (l) arr.push(l);
            }
            recipAddr = joinAddr(arr);
        }

    } else {
        /* -- SHOPEEFOOD LAYOUT --------------------------------------
           [#kode]
           [icon OCR garbage?]
           [restoName baris 1..n]   ← bold title resto, mungkin multi-baris
           [restoAddr baris...]     ← alamat jalan resto
           KECAMATAN, KAB.X, JAWA  ← CITY BLOCK → batas akhir restoAddr
           [recipAddr baris...]     ← alamat tujuan penerima
           KECAMATAN, KAB.X, JAWA  ← CITY BLOCK → batas akhir recipAddr
           Pembeli: NAMA
           Catatan: ...
        ----------------------------------------------------------- */

        // recipName dari label "Pembeli:" atau "Penerima:"
        const iRecipLabel = iPembeli >= 0 ? iPembeli : iPenerima;
        if (iRecipLabel >= 0) {
            const re = iPembeli >= 0 ? /^Pembeli\s*:\s*(.+)/i : /^Penerima\s*:\s*(.+)/i;
            const m = lines[iRecipLabel].match(re);
            recipName = m ? m[1].trim() : '';
        }

        const searchEnd = iRecipLabel >= 0 ? iRecipLabel : lines.length;
        const startSearch = iCode >= 0 ? iCode + 1 : 0;

        // Pola yang BUKAN nama resto (skip)
        const SKIP = /^(\d+|#\S+)$|^(Total|Bayar|Tunai|COD|Rp\s*\d|No\.|Waktu|Status|Pembeli|Penerima|Pengirim|Catatan|Alamat|Detail|Pesanan|Informasi|Rincian|Pembayaran|Shopee|Grab|Gojek|SPX|Diterima|Diambil|Diantar|Selesai|Menuju|Salin)/i;

        const stripIconPrefix = (s) => {
            const t = (s || '').trim();
            const m = t.match(/^(\S{1,3})\s+(.+)$/);
            if (m) {
                const p = m[1];
                const isGarbage = (/[^A-Za-z0-9]/.test(p) && (p.match(/[A-Za-z]/g) || []).length <= 1) || /^\d{1,2}$/.test(p);
                if (isGarbage && /^[A-Z\u00C0-\u024F]/.test(m[2])) return m[2];
            }
            return t;
        };

        // Cari baris mulai nama resto (huruf kapital, bukan garbage, bukan alamat, bukan keyword)
        let cursor = startSearch;
        let restoStart = -1;
        while (cursor < searchEnd) {
            const cl = stripIconPrefix(clean(lines[cursor]));
            // Strip prefix garbage OCR seperti "G1)", "1)", "())" di awal
            const stripped = cl.replace(/^[^A-Z\u00C0-\u024F\w]*/, '').trim();
            if (stripped.length > 4 && (/^[A-Z\u00C0-\u024F]/.test(stripped) || /^\d{1,2}\s+[A-Z\u00C0-\u024F]/.test(stripped)) &&
                !SKIP.test(stripped) && !isCityBlock(stripped)) {
                restoStart = cursor;
                break;
            }
            cursor++;
        }

        if (restoStart >= 0) {
            // Nama resto bisa multi-baris (contoh: "Warung Sate Kambing Muda Pak H Bunder -" + "Kartasura")
            // Berhenti saat ketemu baris alamat (Jl./RT/RW) atau city block
            const nameParts = [];
            let i = restoStart;
            while (i < searchEnd) {
                const cl = clean(lines[i]);
                // Strip prefix garbage OCR di baris pertama saja.
                // Pola: "A1) ", "1) ", "(1) ", "A) ", dst. yang dihasilkan OCR sebelum nama resto.
                // Catatan: [^A-Z]+ TIDAK bisa menghapus "A1)" karena "A" adalah huruf kapital.
                // Gunakan regex eksplisit yang mengenali pola <huruf?><angka+><tanda kurung/titik>.
                const raw = i === restoStart
                    ? stripIconPrefix(cl).replace(/^(?:[A-Z]?\d+[).]\s*|\([A-Z0-9]+\)\s*|[^A-Za-z\u00C0-\u024F]+)/, '').trim()
                    : cl;
                if (!raw || isCityBlock(raw) || SKIP.test(raw) || isSys(raw)) break;
                // Baris alamat (Jl., RT dst) → nama selesai
                if (/\b(Jl\.|Jalan|RT[\s./]|RW[\s./]|No\.\s*\d|Gg\.|Gang|Blok\s+[A-Z]\d)/i.test(raw)) break;
                nameParts.push(raw);
                i++;
                if (nameParts.length >= 4) break;
            }
            restoName = nameParts.join(' ').trim();
            cursor = i;

            // ── Blok 1: restoAddr ───────────────────────────────────────
            // Kumpulkan semua baris hingga city block pertama (inklusif)
            const restoAddrParts = [];
            while (cursor < searchEnd) {
                const cl = clean(lines[cursor]);
                if (!cl || isSys(cl) || /^(Pembeli|Penerima)/i.test(cl)) break;
                restoAddrParts.push(cl);
                cursor++;
                // Jika baris terakhir yang baru ditambah adalah city block → blok resto selesai
                if (isCityBlock(restoAddrParts[restoAddrParts.length - 1])) break;
            }
            restoAddr = joinAddr(restoAddrParts);

            // ── Blok 2: recipAddr ───────────────────────────────────────
            // Kumpulkan semua baris hingga city block berikutnya (inklusif).
            // Setiap baris di-strip prefix nomor/huruf OCR ("2) ", "1. ", dsb.)
            // yang sering muncul sebelum alamat penerima di struk ShopeeFood.
            const stripAddrPrefix = s => s.replace(/^(?:[A-Z]?\d+[).]\s*|\([A-Z0-9]+\)\s*)/, '').trim();
            const recipAddrParts = [];
            while (cursor < searchEnd) {
                const cl = stripAddrPrefix(clean(lines[cursor]));
                if (!cl || isSys(cl) || /^(Pembeli|Penerima)/i.test(cl)) break;
                recipAddrParts.push(cl);
                cursor++;
                if (isCityBlock(recipAddrParts[recipAddrParts.length - 1])) break;
            }
            recipAddr = joinAddr(recipAddrParts);
        }
    }

    /* == 6. NOMINAL PEMBAYARAN / COD ================================ */
    let cashAmount = 0;
    const cashSources = [
        /Terima\s*Pembayaran\s*dari\s*Pembeli\s*[:\-]?\s*(?:Rp\.?\s*)?([\d.]+)/i,
        /Tagih\s*dari\s*Penerima\s*[:\-]?\s*(?:Rp\.?\s*)?([\d.]+)/i,
        /Tagih\s*dari\s*Pengirim\s*[:\-]?\s*(?:Rp\.?\s*)?([\d.]+)/i,
        /(?:COD|Tunai|Uang\s*Tunai)\s*[:\-]?\s*(?:Rp\.?\s*)?([\d.]+)/i,
        /(?:Total\s*(?:Bayar|Tagihan?)|Tagih)\s*[:\-]?\s*(?:Rp\.?\s*)?([\d.]+)/i
    ];
    for (const re of cashSources) {
        const m = text.match(re);
        if (m) { cashAmount = toInt(m[1]); break; }
    }
    const cashLabel = cashAmount > 0
        ? 'Tunai (Rp' + cashAmount.toLocaleString('id-ID') + ')'
        : 'Non-Tunai (Rp0)';

    /* == 7. RINGKASAN MENU (Food) ==================================== */
    let totalMenu = '';
    if (isFood) {
        const mTotal = text.match(/Total\s+(\d+)\s+menu/i);
        const menuStart = iRincian >= 0 ? iRincian + 1 : 0;
        const menuItems = [];
        for (let i = menuStart; i < lines.length; i++) {
            const l = lines[i];
            if (/^Total\s+\d+\s+menu/i.test(l) || /^(Informasi|No\.\s*Pesanan|Waktu)/i.test(l)) break;
            if (/^\d+\s*[xX\u00d7]\s*\S/.test(l) || /\b\d+\s*porsi\b/i.test(l)) {
                const item = l.replace(/\s*Rp[\d.,]+\s*$/i, '').replace(/\s+/g, ' ').trim();
                if (item) menuItems.push(item);
            } else if (menuItems.length > 0 && l && !/^Rp/i.test(l) && !/^\d+\s*[xX]/.test(l) && !isSys(l)) {
                const cont = l.replace(/\s*Rp[\d.,]+\s*$/i, '').trim();
                if (cont) menuItems[menuItems.length - 1] += ' ' + cont;
            }
            if (menuItems.length >= 6) break;
        }
        totalMenu = menuItems.length
            ? menuItems.join(', ')
            : (mTotal ? mTotal[1] + ' menu' : '');
    }

    /* == 8. BERAT & DIMENSI (sudah diekstrak di awal untuk deteksi jenis) == */

    /* == 9. CATATAN (inline ATAU baris berikutnya) ================== */
    // "Catatan: teks"  → inline
    // "Catatan:\nteks" → next line
    let rawNotes = '';
    for (let i = 0; i < lines.length; i++) {
        if (/^Catatan\s*:/i.test(lines[i])) {
            const inline = lines[i].match(/^Catatan\s*:\s*(.+)/i);
            if (inline && inline[1].trim()) {
                rawNotes = inline[1].trim();
            } else if (lines[i + 1] && !isSys(lines[i + 1]) && !isCityBlock(lines[i + 1])) {
                rawNotes = lines[i + 1].trim();
            }
            break;
        }
    }

    /* == 10. SUSUN CATATAN AKHIR ==================================== */
    const extraParts = [];
    if (rawNotes) extraParts.push(rawNotes);
    if (isExpress || isInstan) {
        const trackingNo = (text.match(/\b(SPXID[A-Z0-9]+)\b/i) || [])[1] || '';
        if (trackingNo) extraParts.push('No. Resi: ' + trackingNo);
        const pickupCode = matchLines(/(?:Kode\s*(?:Ambil|Pengambilan)|Pickup\s*Code)\s*:\s*([^\n\r]+)/i);
        if (pickupCode) extraParts.push('Kode Ambil: ' + pickupCode);
        const deadline = matchLines(/(?:Batas\s*(?:Kirim|Pengiriman)|Deadline)\s*:\s*([^\n\r]+)/i);
        if (deadline) extraParts.push('Batas Kirim: ' + deadline);
    }
    extraParts.push('Bayar: ' + cashLabel);

    return {
        category, platform,
        restoName, restoAddr,
        recipName, recipAddr,
        notes: extraParts.join(' | '),
        codeOrder, totalMenu, orderNo, cashAmount,
        weight, dimensions, itemCategory,
        _rawText: text
    };
}

        // AI Fusion di modal Edit Gabungan
        async function ecScan(key, input) {
            const photo = aiPhotoMode;
            const file = input.files[0]; input.value = '';
            if (!file) return;
            const st = document.getElementById(`ec-scan-status-${key}`);
            if (st) st.innerText = '⏳';
            try {
                const img = await aiResizeFile(file);
                const p = await aiExtract(img.ai);
                if (p) {
                    aiApply(p, n => document.getElementById(`ec-${n}-${key}`), () => onEditCombinedCategoryChange(key), () => updateEditCombinedPaymentMethod(key));
                    const sub = editCombinedState.subOrders.find(x => x._key === key); if (sub) sub.screenshot = img.store;
                    showToast(p._label ? '✨ Label SPX terbaca. Cek ulang No. Pesanan & Kode Ambil (di Catatan).' : photo ? '✨ AI membaca foto. Periksa lagi hasilnya.' : '✨ AI berhasil mengisi pesanan ini', photo ? 'amber' : 'emerald');
                }
            } catch (e) { showToast('Gagal memproses screenshot.', 'rose'); }
            if (st) st.innerText = '';
        }
