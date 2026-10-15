        // ============================================================
        // PROFILE CONTROLLER
        // ============================================================
        function loadUserProfile() {
            try {
                const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
                if (saved) {
                    const p = JSON.parse(saved);
                    userProfile = {
                        name: p.name || '',
                        email: p.email || '',
                        photo: p.photo || null,
                        driverTypes: Array.isArray(p.driverTypes) ? p.driverTypes : [],
                        otherType: p.otherType || ''
                    };
                }
            } catch(e) {
                userProfile = { name: '', email: '', photo: null, driverTypes: [], otherType: '' };
            }
            renderProfileUI();
        }

        function saveUserProfile(profile) {
            try {
                localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
                userProfile = profile;
                renderProfileUI();
            } catch(e) {
                showToast('Gagal menyimpan profil. Storage penuh.', 'rose');
            }
        }

        // Sapaan berdasarkan jam perangkat
        //  00.00–04.59 Dini Hari | 05.00–10.59 Pagi | 11.00–14.59 Siang
        //  15.00–17.59 Sore      | 18.00–18.59 Senja | 19.00–23.59 Malam
        function getTimeGreeting(date) {
            const h = (date || new Date()).getHours();
            if (h < 5)  return 'Selamat Dini Hari';
            if (h < 11) return 'Selamat Pagi';
            if (h < 15) return 'Selamat Siang';
            if (h < 18) return 'Selamat Sore';
            if (h < 19) return 'Selamat Senja';
            return 'Selamat Malam';
        }


        // ============================================================
        // PESAN HARIAN DRIVER (Home, semua tema)
        // - Teks lokal: indeks ditentukan tanggal → stabil saat refresh, berganti tiap hari.
        // - Jika API Key AI tersimpan & online: kalimat dibuat AI sekali per hari
        //   per status (disimpan di localStorage), lalu dipakai ulang.
        //   Gagal/offline → otomatis pakai teks lokal.
        // ============================================================
        const DAILY_MSG_START = [
            "Hari baru, rezeki baru, {nama}! Target hari ini {target} order — yuk mulai pelan tapi pasti. 🚀",
            "Semangat {nama}! Setiap kilometer adalah rezeki, siap lanjut orderan berikutnya? 💪",
            "Tarik napas, cek kendaraan, lalu gas! Hari ini bisa jadi hari terbaikmu, {nama}. ✨",
            "Tenang, satu order berikutnya biasanya membuka jalan untuk order-order lainnya. 🙌",
            "Konsisten itu kunci, {nama}. Tinggal {sisa} order lagi untuk menutup target hari ini. 🎯",
            "Jangan lupa isi tenaga dulu ya, {nama}. Driver yang bugar, order lancar! 🍚",
            "Pelan-pelan saja, yang penting selamat sampai tujuan. Target {target} order pasti terkejar! 🛵",
            "Hari ini siapa tahu ada bonus menunggu. Yuk, jemput orderan berikutnya, {nama}! 🌟",
            "Satu order demi satu order, lama-lama jadi target tercapai. Semangat, {nama}! 💫",
            "Rezeki sudah diatur, tugas kita jemput dengan sabar dan hati-hati. Siap jalan? 🤲",
            "Cuaca boleh berubah, semangatmu jangan. Ayo lanjut, {nama}! ☀️",
            "Target hari ini {target} order. Kamu pernah melewati hari yang lebih berat, kok. 🔥",
            "Atur ritme, jaga keselamatan, dan nikmati perjalanannya. Orderan berikutnya menunggu! 🚦",
            "Kamu hebat sudah bangun dan berjuang hari ini, {nama}. Yuk kejar target pelan-pelan! 💚"
        ];
        const DAILY_MSG_NEAR = [
            "Target hari ini tinggal sedikit lagi, yuk tambah {sisa} orderan lagi! 💪",
            "Sedikit lagi, {nama}! Tinggal {sisa} order untuk menutup target hari ini. 🎯",
            "Hampir sampai! Satu dua order lagi dan target harianmu beres. 🚀",
            "Tetap semangat {nama}, setiap kilometer adalah rezeki. Siap lanjut orderan berikutnya? 🚀",
            "Progres hari ini sudah bagus, {nama}. Tinggal {sisa} langkah lagi menuju target! ✨",
            "Garis finish sudah kelihatan. Jaga fokus dan keselamatan, ya! 🏁",
            "Sudah sejauh ini, masa berhenti sekarang? Tinggal {sisa} order lagi, {nama}! 🔥",
            "Napas panjang, minum dulu sebentar, lalu gas lagi. Target tinggal {sisa} order! 🥤",
            "Kerja kerasmu hari ini kelihatan hasilnya. Sedikit lagi, {nama}! 🌟",
            "Tinggal {sisa} order lagi. Kamu pasti bisa menyelesaikannya dengan aman! 🛵",
            "Ritme hari ini sudah pas, {nama}. Pertahankan sampai target tercapai! 💫",
            "Hampir tuntas! Jangan terburu-buru, yang penting selamat dan lancar. 🙏"
        ];
        const DAILY_MSG_DONE = [
            "Luar biasa! Target harianmu sudah tercapai hari ini! 🔥 Tetap jaga keselamatan ya!",
            "Mantap {nama}! Rekor hari ini tembus target. Waktunya istirahat cukup atau bonus tambahan? 😎",
            "Target {target} order tuntas, {nama}! Kamu keren hari ini. 🏆",
            "Alhamdulillah, target hari ini aman. Boleh lanjut cari bonus atau pulang dengan tenang. 🌙",
            "Kerja keras hari ini terbayar, {nama}. Jangan lupa istirahat dan makan yang cukup! 🍽️",
            "Target tercapai! Setiap order tambahan sekarang adalah bonus untukmu. 🎉",
            "Hebat, {nama}! Konsistensimu patut diacungi jempol. Tetap hati-hati di jalan. 👏",
            "Misi hari ini selesai dengan baik. Mau tancap gas lagi atau istirahat dulu? 😄",
            "Target sudah di tangan, {nama}! Tubuhmu juga butuh rehat, jangan dipaksa. 💚",
            "Pencapaian bagus hari ini! Besok kita lanjutkan dengan semangat yang sama. 🚀",
            "Kamu berhasil, {nama}! Syukuri hasilnya dan tetap utamakan keselamatan. 🤲",
            "Target harian lunas! Sisa waktu hari ini bonus, gunakan sesuai tenagamu. ✨"
        ];
        const DAILY_MSG_AI_KEY = 'drivertrack_daily_msg_ai';
        const DAILY_MSG_AI_MODELS = ['llama-3.1-8b-instant', 'qwen/qwen3.6-27b'];
        let dailyMsgAiPending = false;

        // Nomor hari lokal (stabil sepanjang hari, berganti tepat tengah malam)
        function getDayNumber(date) {
            const d = date || new Date();
            return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
        }
        function getLocalDateKey(date) {
            const d = date || new Date();
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
        function getDriverFirstName() {
            try {
                const n = (userProfile && userProfile.name || '').trim().split(/\s+/)[0];
                return n || 'Driver';
            } catch (e) { return 'Driver'; }
        }
        function fillDailyTemplate(tpl, ctx) {
            return tpl.replace(/\{nama\}/g, ctx.nama).replace(/\{sisa\}/g, ctx.sisa)
                      .replace(/\{target\}/g, ctx.target).replace(/\{jumlah\}/g, ctx.count);
        }
        // Penyedia pesan harian: status 'start' (< 60% target), 'near' (60%–99%), 'done' (>= target)
        function getDailyDriverMessage(count, target, name, date) {
            const status = count >= target ? 'done' : (target > 0 && count / target >= 0.6 ? 'near' : 'start');
            const list = status === 'done' ? DAILY_MSG_DONE : status === 'near' ? DAILY_MSG_NEAR : DAILY_MSG_START;
            const tpl = list[getDayNumber(date) % list.length];
            const text = fillDailyTemplate(tpl, {
                nama: name, sisa: Math.max(1, target - count), target: target, count: count
            });
            return { status, text };
        }

        function loadDailyAiCache() {
            try {
                const c = JSON.parse(localStorage.getItem(DAILY_MSG_AI_KEY) || 'null');
                if (c && c.date === getLocalDateKey()) return c;
            } catch (e) {}
            return { date: getLocalDateKey() };
        }
        function saveDailyAiCache(c) {
            try { localStorage.setItem(DAILY_MSG_AI_KEY, JSON.stringify(c)); } catch (e) {}
        }

        async function fetchAiDailyMessage(status, name, count, target) {
            if (typeof getGrokApiKey !== 'function') return null;
            const apiKey = getGrokApiKey();
            if (!apiKey || !navigator.onLine) return null;
            const now = new Date();
            const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][now.getDay()];
            const situasi = status === 'done'
                ? 'Target order harian sudah TERCAPAI. Beri apresiasi singkat dan ingatkan istirahat/keselamatan.'
                : status === 'near'
                ? 'Target order harian HAMPIR tercapai. Beri semangat untuk menuntaskan sedikit lagi.'
                : 'Target order harian masih jauh/baru mulai. Beri semangat hangat untuk lanjut narik.';
            const sys = 'Kamu penulis pesan penyemangat untuk driver ojek online Indonesia. Tulis SATU pesan singkat '
                + '(maksimal 130 karakter, 1-2 kalimat) dalam bahasa Indonesia santai dan hangat, dengan 1 emoji. '
                + 'Sapa dengan nama bila natural. JANGAN pakai angka/digit, tanda kutip, hashtag, atau penjelasan tambahan. '
                + 'Hanya keluarkan isi pesannya. Variasikan gaya tiap hari: bisa pertanyaan, ajakan, atau apresiasi.';
            const usr = `Nama driver: ${name}. Hari: ${hari}. Tanggal: ${getLocalDateKey(now)}. ${situasi}`;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 9000);
            try {
                for (const model of DAILY_MSG_AI_MODELS) {
                    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        signal: ctrl.signal,
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model, temperature: 1, max_tokens: 90, messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: usr }
                        ] })
                    });
                    if (res.status === 401 || res.status === 403) return null;
                    if (!res.ok) continue;
                    const data = await res.json();
                    let text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
                    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().split('\n')[0]
                               .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').trim();
                    if (text.length >= 8 && text.length <= 200 && !/\d/.test(text)) return text;
                }
            } catch (e) { /* offline / timeout → pakai teks lokal */ }
            finally { clearTimeout(timer); }
            return null;
        }

        function maybeRefreshDailyMessageWithAI(status, name, count, target) {
            if (dailyMsgAiPending || typeof getGrokApiKey !== 'function' || !getGrokApiKey() || !navigator.onLine) return;
            const cache = loadDailyAiCache();
            const slot = cache[status];
            if (slot && slot.text) return;                                   // sudah ada pesan AI hari ini
            if (slot && ((slot.fails || 0) >= 3 || Date.now() - (slot.ts || 0) < 20 * 60 * 1000)) return; // jangan spam
            dailyMsgAiPending = true;
            fetchAiDailyMessage(status, name, count, target).then(text => {
                const c = loadDailyAiCache();
                const prev = c[status] || {};
                c[status] = text ? { text, ts: Date.now() } : { text: null, ts: Date.now(), fails: (prev.fails || 0) + 1 };
                saveDailyAiCache(c);
            }).catch(() => {}).finally(() => {
                dailyMsgAiPending = false;
                renderDailyDriverMessage();
            });
        }

        function renderDailyDriverMessage() {
            const el = document.getElementById('driver-daily-message-text');
            if (!el) return;
            let count, target;
            try { count = getTodayOrderUnitCount(); target = insightsDailyTarget || 10; }
            catch (e) { return; } // data order belum siap; akan dirender ulang oleh renderAllViews()
            const name = getDriverFirstName();
            const msg = getDailyDriverMessage(count, target, name);
            const cache = loadDailyAiCache();
            const aiText = cache[msg.status] && cache[msg.status].text;
            const finalText = aiText || msg.text;
            if (el.textContent !== finalText) el.textContent = finalText; // textContent: aman dari injeksi HTML
            if (!aiText) maybeRefreshDailyMessageWithAI(msg.status, name, count, target);
        }

        // Sapaan & pesan harian ikut berganti saat jam/hari berubah tanpa perlu reload
        function refreshTimeBasedUI() {
            try { updateHeaderGreeting(); } catch (e) {}
            try { renderDailyDriverMessage(); } catch (e) {}
        }
        setInterval(refreshTimeBasedUI, 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTimeBasedUI(); });

        function updateHeaderGreeting() {
            const el = document.getElementById('header-greeting');
            if (!el) return;
            const greetingText = `${getTimeGreeting()} 👋`;
            if (el.innerText !== greetingText) el.innerText = greetingText;
            // Tema yang menyembunyikan teks asli (Focus) membaca sapaan dari atribut ini
            el.setAttribute('data-greeting', greetingText);
        }

        function renderProfileUI() {
            const name = userProfile.name ? userProfile.name.trim() : '';
            const photo = userProfile.photo;
            const types = userProfile.driverTypes || [];
            const otherType = userProfile.otherType || '';

            // ---- Header ----
            const headerAvatar = document.getElementById('header-driver-avatar');
            const headerName = document.getElementById('header-driver-name');
            const headerGreeting = document.getElementById('header-greeting');

            if (headerName) headerName.innerText = name || 'Driver';
            if (headerGreeting) updateHeaderGreeting();
            try { renderDailyDriverMessage(); } catch (e) {}
            if (headerAvatar) {
                if (photo) {
                    headerAvatar.innerHTML = `<img src="${photo}" alt="Avatar" class="w-full h-full object-cover">`;
                } else if (name) {
                    headerAvatar.innerHTML = `<span class="font-extrabold text-sm">${name.charAt(0).toUpperCase()}</span>`;
                } else {
                    headerAvatar.innerHTML = `<img src="assets/app-logo.png" alt="Avatar" class="w-full h-full object-cover p-0.5">`;
                }
            }

            // ---- Profile Card ----
            const profileAvatarContainer = document.getElementById('profile-avatar-container');
            const profileName = document.getElementById('profile-driver-name');
            const profileSubtitle = document.getElementById('profile-driver-subtitle');
            const profileChips = document.getElementById('profile-driver-chips');

            if (profileName) profileName.innerText = name || 'Driver';
            if (profileSubtitle) {
                if (!name) {
                    profileSubtitle.innerText = 'Ketuk untuk melengkapi profil';
                    profileSubtitle.classList.add('cursor-pointer');
                } else if (types.length > 0) {
                    const labels = types.map(t => t === 'Lainnya' ? otherType || 'Lainnya' : t);
                    profileSubtitle.innerText = labels.join(' • ');
                } else {
                    profileSubtitle.innerText = 'Driver';
                    profileSubtitle.classList.remove('cursor-pointer');
                }
            }

            const profileEmail = document.getElementById('profile-driver-email');
            if (profileEmail) {
                if (userProfile.email) {
                    profileEmail.innerHTML = `<i class="fa-solid fa-envelope text-[10px]"></i> ${userProfile.email}`;
                    profileEmail.classList.remove('hidden');
                } else {
                    profileEmail.classList.add('hidden');
                }
            }
            if (profileAvatarContainer) {
                if (photo) {
                    profileAvatarContainer.innerHTML = `<img src="${photo}" alt="Foto Profil" class="w-full h-full object-cover">`;
                } else if (name) {
                    profileAvatarContainer.innerHTML = `<span class="font-extrabold text-2xl">${name.charAt(0).toUpperCase()}</span>`;
                } else {
                    profileAvatarContainer.innerHTML = `<img src="assets/app-logo.png" alt="Foto Profil" class="w-full h-full object-cover p-1">`;
                }
            }
            if (profileChips) {
                if (types.length > 0) {
                    profileChips.innerHTML = types.map(t => {
                        const label = t === 'Lainnya' ? (otherType || 'Lainnya') : t;
                        return `<span class="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-100">${label}</span>`;
                    }).join('');
                } else {
                    profileChips.innerHTML = '';
                }
            }
        }

        function openEditProfileModal() {
            editProfileSelectedTypes = [...(userProfile.driverTypes || [])];
            editProfileTempPhoto = userProfile.photo || null;

            // Pre-fill nama
            const nameInput = document.getElementById('edit-profile-name');
            if (nameInput) nameInput.value = userProfile.name || '';

            // Pre-fill custom type
            const customInput = document.getElementById('edit-profile-custom-type');
            if (customInput) customInput.value = userProfile.otherType || '';

            // Render chips
            renderDriverTypeChips();

            // Foto preview
            updateEditProfilePhotoPreview();

            document.getElementById('edit-profile-modal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        function closeEditProfileModal() {
            document.getElementById('edit-profile-modal').classList.add('hidden');
            document.body.style.overflow = '';
            editProfileTempPhoto = null;
        }

        const DRIVER_TYPE_OPTIONS = [
            'Ojol Motor',
            'Taksi Online (Mobil)',
            'Kurir Paket (SPX)',
            'Food Delivery',
            'Kurir Instan',
            'Lainnya'
        ];

        function renderDriverTypeChips() {
            const container = document.getElementById('driver-types-chips-container');
            if (!container) return;
            container.innerHTML = DRIVER_TYPE_OPTIONS.map(t => {
                const isActive = editProfileSelectedTypes.includes(t);
                const activeClass = isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300';
                return `<button type="button" onclick="toggleDriverType('${t}')" class="text-[11px] font-bold px-3 py-1.5 rounded-full border transition active:scale-95 ${activeClass}">${t}</button>`;
            }).join('');

            // Toggle custom input untuk 'Lainnya'
            const customContainer = document.getElementById('custom-driver-type-container');
            if (customContainer) {
                if (editProfileSelectedTypes.includes('Lainnya')) {
                    customContainer.classList.remove('hidden');
                } else {
                    customContainer.classList.add('hidden');
                }
            }
        }

        function toggleDriverType(type) {
            const idx = editProfileSelectedTypes.indexOf(type);
            if (idx > -1) {
                editProfileSelectedTypes.splice(idx, 1);
            } else {
                editProfileSelectedTypes.push(type);
            }
            renderDriverTypeChips();
        }

        function processProfileImage(file, callback) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const size = 256;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');

                    // Square crop dari tengah
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

                    try {
                        const base64 = canvas.toDataURL('image/jpeg', 0.8);
                        callback(base64);
                    } catch(err) {
                        showToast('Gagal memproses foto.', 'rose');
                    }
                };
                img.onerror = () => showToast('Foto tidak bisa dibaca.', 'rose');
                img.src = e.target.result;
            };
            reader.onerror = () => showToast('Gagal membaca file foto.', 'rose');
            reader.readAsDataURL(file);
        }

        function handleProfilePhotoSelect(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast('File harus berupa gambar.', 'rose');
                return;
            }
            processProfileImage(file, (base64) => {
                editProfileTempPhoto = base64;
                updateEditProfilePhotoPreview();
            });
            event.target.value = '';
        }

        function deleteProfilePhoto() {
            editProfileTempPhoto = null;
            updateEditProfilePhotoPreview();
        }

        function updateEditProfilePhotoPreview() {
            const previewImg = document.getElementById('edit-profile-preview-img');
            const previewPlaceholder = document.getElementById('edit-profile-preview-placeholder');
            const deleteBtn = document.getElementById('btn-delete-profile-photo');

            if (editProfileTempPhoto) {
                if (previewImg) { previewImg.src = editProfileTempPhoto; previewImg.classList.remove('hidden'); }
                if (previewPlaceholder) previewPlaceholder.classList.add('hidden');
                if (deleteBtn) deleteBtn.classList.remove('hidden');
            } else {
                if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
                if (previewPlaceholder) previewPlaceholder.classList.remove('hidden');
                if (deleteBtn) deleteBtn.classList.add('hidden');
            }
        }

        function saveProfileForm(e) {
            e.preventDefault();
            const nameInput = document.getElementById('edit-profile-name');
            const name = (nameInput ? nameInput.value : '').trim();
            if (!name) {
                showToast('Nama driver tidak boleh kosong.', 'rose');
                return;
            }
            if (name.length > 30) {
                showToast('Nama maksimal 30 karakter.', 'rose');
                return;
            }
            const customInput = document.getElementById('edit-profile-custom-type');
            const otherType = (customInput ? customInput.value : '').trim();

            const newProfile = {
                name,
                photo: editProfileTempPhoto,
                driverTypes: [...editProfileSelectedTypes],
                otherType
            };

            saveUserProfile(newProfile);
            closeEditProfileModal();
            showToast('Profil berhasil disimpan!', 'emerald');
        }

        // ============================================================
        // CRUD: DELETE ORDER
        // ============================================================
        function deleteOrder(orderId) {
            if (!confirm('Hapus pesanan ini? Tindakan tidak dapat dibatalkan.')) return;
            ordersList = ordersList.filter(o => o.id !== orderId);
            saveToLocalStorage();
            renderAllViews();
            showToast('Pesanan berhasil dihapus.', 'rose');
        }

        // ============================================================
        // CRUD: EDIT ORDER — Render dynamic fields for edit modal
        // ============================================================
        function onEditCategoryChange() {
            const cat = document.getElementById('edit-form-category').value;
            const fieldsContainer = document.getElementById('edit-category-specific-fields');
            const labelPengirim = document.getElementById('edit-label-pengirim-title');

            if (cat === 'Food') {
                if (labelPengirim) labelPengirim.innerHTML = `<i class="fa-solid fa-utensils"></i> Data Resto / Pengirim`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Code Orderan *</label>
                            <input type="text" id="edit-form-codeorder" placeholder="Contoh: #782" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan *</label>
                            <input type="text" id="edit-form-orderno" placeholder="325241133197056..." class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Total Menu / Rincian Barang *</label>
                        <input type="text" id="edit-form-totalmenu" placeholder="Contoh: 1 x Bakmi Goreng (Total 1 menu)" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none">
                    </div>`;
            } else if (cat === 'SPX') {
                if (labelPengirim) labelPengirim.innerHTML = `<i class="fa-solid fa-box"></i> Data Pengirim SPX (Toko / Agen)`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kode Pesanan *</label>
                            <input type="text" id="edit-form-codeorder" placeholder="#4N73" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label>
                            <input type="text" id="edit-form-weight" placeholder="1.5 kg" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Besar Barang</label>
                            <input type="text" id="edit-form-dimensions" placeholder="0x0x0 cm" class="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>`;
            } else if (cat === 'Instan') {
                if (labelPengirim) labelPengirim.innerHTML = `<i class="fa-solid fa-bolt"></i> Data Pengirim SPX Instan`;
                fieldsContainer.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Kategori Barang</label>
                            <input type="text" id="edit-form-itemcategory" placeholder="Makanan / Paket" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Berat Barang</label>
                            <input type="text" id="edit-form-weight" placeholder="1.0 kg" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">No. Pesanan Instan *</label>
                        <input type="text" id="edit-form-orderno" placeholder="3248025614224384096" class="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                    </div>`;
            }
        }

        function updateEditPaymentMethod() {
            const amount = parseFloat(document.getElementById('edit-form-cashamount').value) || 0;
            const paymentSelect = document.getElementById('edit-form-payment');
            if (paymentSelect) paymentSelect.value = amount > 0 ? 'Tunai' : 'Non-Tunai';
        }

        // ============================================================
        // CRUD: EDIT ORDER — Open Modal & Populate Form
        // ============================================================
        function openEditModal(orderId) {
            const order = ordersList.find(o => o.id === orderId);
            if (!order) return;

            if (order.isCombined) {
                openEditCombinedModal(orderId);
                return;
            }

            document.getElementById('edit-form-id').value = order.id;
            document.getElementById('edit-form-category').value = order.category || 'Food';
            onEditCategoryChange(); // render dynamic fields first

            document.getElementById('edit-form-platform').value = order.platform || 'Lainnya';
            document.getElementById('edit-form-income').value = order.orderIncome || 0;
            const fuelInput = document.getElementById('edit-form-fuelcost-manual');
            fuelInput.value = (order.manualFuelCost !== null && order.manualFuelCost !== undefined) ? order.manualFuelCost : '';

            document.getElementById('edit-form-restoname').value = order.restoName || '';
            document.getElementById('edit-form-restoaddr').value = order.restoAddr || '';
            document.getElementById('edit-form-recipname').value = order.recipName || '';
            document.getElementById('edit-form-cashamount').value = order.cashAmount || 0;
            document.getElementById('edit-form-recipaddr').value = order.recipAddr || '';
            document.getElementById('edit-form-notes').value = (order.notes && order.notes !== '-') ? order.notes : '';
            document.getElementById('edit-form-ordertime').value = order.orderTime || '';
            updateEditPaymentMethod();

            // Populate category-specific fields after they are rendered
            if (order.category === 'Food') {
                const co = document.getElementById('edit-form-codeorder');
                const tm = document.getElementById('edit-form-totalmenu');
                const on = document.getElementById('edit-form-orderno');
                if (co) co.value = order.codeOrder || '';
                if (tm) tm.value = order.totalMenu || '';
                if (on) on.value = order.orderNo || '';
            } else if (order.category === 'SPX') {
                const co = document.getElementById('edit-form-codeorder');
                const wt = document.getElementById('edit-form-weight');
                const dm = document.getElementById('edit-form-dimensions');
                if (co) co.value = order.codeOrder || '';
                if (wt) wt.value = order.weight || '';
                if (dm) dm.value = order.dimensions || '';
            } else if (order.category === 'Instan') {
                const ic = document.getElementById('edit-form-itemcategory');
                const wt = document.getElementById('edit-form-weight');
                const on = document.getElementById('edit-form-orderno');
                if (ic) ic.value = order.itemCategory || '';
                if (wt) wt.value = order.weight || '';
                if (on) on.value = order.orderNo || '';
            }

            document.getElementById('edit-order-modal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        function closeEditModal() {
            document.getElementById('edit-order-modal').classList.add('hidden');
            document.body.style.overflow = '';
        }

        // ============================================================
        // CRUD: EDIT ORDER — Save Changes
        // ============================================================
        function saveEditForm(e) {
            e.preventDefault();
            const orderId = document.getElementById('edit-form-id').value;
            const idx = ordersList.findIndex(o => o.id === orderId);
            if (idx === -1) { showToast('Order tidak ditemukan.', 'rose'); return; }

            const order = ordersList[idx];
            const cat = document.getElementById('edit-form-category').value;
            const cashVal = parseFloat(document.getElementById('edit-form-cashamount').value) || 0;
            const manualFuelRaw = document.getElementById('edit-form-fuelcost-manual').value;
            const manualFuelVal = manualFuelRaw !== '' ? parseFloat(manualFuelRaw) : null;
            const orderTimeVal = document.getElementById('edit-form-ordertime').value;

            order.category = cat;
            order.platform = document.getElementById('edit-form-platform').value;
            order.orderIncome = parseFloat(document.getElementById('edit-form-income').value) || 0;
            order.manualFuelCost = (manualFuelVal !== null && !isNaN(manualFuelVal)) ? manualFuelVal : null;
            order.restoName = document.getElementById('edit-form-restoname').value;
            order.restoAddr = document.getElementById('edit-form-restoaddr').value;
            order.recipName = document.getElementById('edit-form-recipname').value;
            order.recipAddr = document.getElementById('edit-form-recipaddr').value;
            order.notes = document.getElementById('edit-form-notes').value || '-';
            order.cashAmount = cashVal;
            order.payment = cashVal > 0 ? 'Tunai' : 'Non-Tunai';
            order.orderTime = orderTimeVal;
            order.timestamp = new Date(orderTimeVal).getTime();

            if (cat === 'Food') {
                order.codeOrder = document.getElementById('edit-form-codeorder')?.value || '-';
                order.totalMenu = document.getElementById('edit-form-totalmenu')?.value || '-';
                order.orderNo = document.getElementById('edit-form-orderno')?.value || '-';
            } else if (cat === 'SPX') {
                order.codeOrder = document.getElementById('edit-form-codeorder')?.value || '-';
                order.weight = document.getElementById('edit-form-weight')?.value || '-';
                order.dimensions = document.getElementById('edit-form-dimensions')?.value || '-';
            } else if (cat === 'Instan') {
                order.orderNo = document.getElementById('edit-form-orderno')?.value || '-';
                order.itemCategory = document.getElementById('edit-form-itemcategory')?.value || 'Barang';
                order.weight = document.getElementById('edit-form-weight')?.value || '-';
            }

            saveToLocalStorage();
            closeEditModal();
            renderAllViews();
            showToast('Pesanan berhasil diperbarui!', 'emerald');
        }

        function showToast(message, color = "indigo") {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            
            const colorClasses = {
                emerald: "bg-emerald-600 text-white",
                rose: "bg-rose-600 text-white",
                amber: "bg-amber-500 text-slate-950",
                indigo: "bg-indigo-600 text-white"
            };

            toast.className = `p-3 rounded-2xl text-xs font-bold shadow-xl flex items-center justify-between gap-2 transform transition duration-300 opacity-0 translate-y-2 pointer-events-auto ${colorClasses[color] || colorClasses.indigo}`;
            toast.innerHTML = `<span><i class="fa-solid fa-circle-check mr-1.5"></i> ${message}</span>`;

            container.appendChild(toast);
            setTimeout(() => toast.classList.remove('opacity-0', 'translate-y-2'), 10);
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    
