// ============================================================
// DRIVERTRACK ONBOARDING 2 LANGKAH & GOOGLE SIGN-IN (CLIENT-SIDE)
// ============================================================

(function() {
    const ONBOARDED_KEY = 'drivertrack_onboarded';
    const GOOGLE_CLIENT_ID_KEY = 'drivertrack_google_client_id';

    let onboardingTempPhoto = null;
    let onboardingSelectedTypes = ['ShopeeFood'];

    const ONBOARDING_TYPES = [
        'ShopeeFood',
        'SPX',
        'SPX Instan',
        'Grab',
        'Gojek',
        'Lainnya'
    ];

    // Helper JWT Parser Client-Side
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            if (!base64Url) return null;
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch(e) {
            console.warn('[Onboarding] Gagal decode JWT:', e);
            return null;
        }
    }

    // Inisialisasi Google Identity Services jika SDK siap & Client ID ada
    function initGoogleIdentitySDK() {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
        const clientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
        if (!clientId) return;

        try {
            window.google.accounts.id.initialize({
                client_id: clientId.trim(),
                callback: handleGoogleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true
            });

            const hiddenBtn = document.getElementById('g-signin-hidden-btn');
            if (hiddenBtn) {
                hiddenBtn.innerHTML = '';
                window.google.accounts.id.renderButton(hiddenBtn, {
                    theme: 'outline',
                    size: 'large',
                    width: 280,
                    text: 'continue_with'
                });
            }
        } catch (e) {
            console.warn('[Onboarding] Init Google Identity error:', e);
        }
    }

    function handleGoogleCredentialResponse(response) {
        if (!response || !response.credential) return;
        const data = parseJwt(response.credential);
        if (!data) {
            if (typeof showToast === 'function') showToast('Token Google tidak valid.', 'rose');
            return;
        }

        const nameInput = document.getElementById('onboarding-name');
        const emailInput = document.getElementById('onboarding-email');
        const avatarPreview = document.getElementById('onboarding-avatar-preview');

        if (data.name && nameInput) nameInput.value = data.name.substring(0, 30);
        if (data.email && emailInput) emailInput.value = data.email;
        if (data.picture) {
            onboardingTempPhoto = data.picture;
            if (avatarPreview) {
                avatarPreview.innerHTML = `<img src="${data.picture}" alt="Foto Google" class="w-full h-full object-cover">`;
            }
        }

        // Tampilkan badge terhubung
        const gBadge = document.getElementById('onboarding-google-connected-badge');
        if (gBadge) {
            gBadge.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-500"></i> Terhubung: <span class="font-bold text-slate-800">${data.email || data.name}</span>`;
            gBadge.classList.remove('hidden');
        }

        if (typeof showToast === 'function') {
            showToast('Akun Google berhasil dihubungkan!', 'emerald');
        }
    }

    function handleGoogleSignInClick() {
        const clientId = (localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '').trim();

        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            if (typeof showToast === 'function') {
                showToast('Layanan Google SDK belum siap/offline. Silakan isi form manual.', 'amber');
            }
            const nameInput = document.getElementById('onboarding-name');
            if (nameInput) nameInput.focus();
            return;
        }

        if (!clientId) {
            const promptId = prompt(
                'Masukkan Google OAuth 2.0 Web Client ID kamu:\n\n' +
                '(Dapat dibuat gratis di Google Cloud Console -> Credentials -> OAuth 2.0 Client IDs -> Web application).\n\n' +
                'Atau klik "Batal" untuk langsung isi formulir secara manual tanpa Google Login:',
                ''
            );

            if (promptId && promptId.trim()) {
                localStorage.setItem(GOOGLE_CLIENT_ID_KEY, promptId.trim());
                updateProfileGoogleClientIdUI();
                initGoogleIdentitySDK();
                if (typeof showToast === 'function') showToast('Client ID tersimpan. Membuka login Google...', 'indigo');
                setTimeout(() => {
                    triggerGooglePrompt();
                }, 400);
            } else {
                if (typeof showToast === 'function') showToast('Silakan isi nama dan profilmu secara manual.', 'slate');
                const nameInput = document.getElementById('onboarding-name');
                if (nameInput) nameInput.focus();
            }
            return;
        }

        triggerGooglePrompt();
    }

    function triggerGooglePrompt() {
        try {
            initGoogleIdentitySDK();
            // Coba trigger tombol ter-render jika ada
            const hiddenBtn = document.getElementById('g-signin-hidden-btn');
            const innerBtn = hiddenBtn ? hiddenBtn.querySelector('div[role="button"]') : null;
            if (innerBtn) {
                innerBtn.click();
            } else if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        console.warn('[Onboarding] Google prompt skipped/not displayed:', notification);
                    }
                });
            }
        } catch (e) {
            console.warn('[Onboarding] Gagal memanggil Google Prompt:', e);
            if (typeof showToast === 'function') showToast('Silakan isi profil secara manual di bawah.', 'amber');
        }
    }

    function renderOnboardingChips() {
        const container = document.getElementById('onboarding-types-chips');
        if (!container) return;

        container.innerHTML = ONBOARDING_TYPES.map(t => {
            const isActive = onboardingSelectedTypes.includes(t);
            const activeClass = isActive
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300';
            return `<button type="button" onclick="toggleOnboardingDriverType('${t}')" class="text-[11px] font-bold px-3 py-1.5 rounded-full border transition active:scale-95 ${activeClass}">${t}</button>`;
        }).join('');

        const customWrap = document.getElementById('onboarding-custom-type-wrap');
        if (customWrap) {
            customWrap.classList.toggle('hidden', !onboardingSelectedTypes.includes('Lainnya'));
        }
    }

    function toggleOnboardingDriverType(type) {
        const idx = onboardingSelectedTypes.indexOf(type);
        if (idx > -1) {
            if (onboardingSelectedTypes.length > 1) {
                onboardingSelectedTypes.splice(idx, 1);
            } else {
                if (typeof showToast === 'function') showToast('Pilih minimal satu platform.', 'amber');
                return;
            }
        } else {
            onboardingSelectedTypes.push(type);
        }
        renderOnboardingChips();
    }

    function handleOnboardingPhotoSelect(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        if (typeof processProfileImage === 'function') {
            processProfileImage(file, function(base64) {
                onboardingTempPhoto = base64;
                const preview = document.getElementById('onboarding-avatar-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${base64}" alt="Foto Profil" class="w-full h-full object-cover">`;
                }
            });
        }
    }

    function goToOnboardingStep(step) {
        const step1 = document.getElementById('onboarding-step-1');
        const step2 = document.getElementById('onboarding-step-2');
        if (!step1 || !step2) return;

        if (step === 1) {
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
        } else {
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
        }
    }

    function saveOnboardingStep1AndNext() {
        const nameInput = document.getElementById('onboarding-name');
        const emailInput = document.getElementById('onboarding-email');
        const customTypeInput = document.getElementById('onboarding-custom-type');
        const fuelRateInput = document.getElementById('onboarding-fuel-rate');

        const name = (nameInput?.value || '').trim();
        if (!name) {
            if (typeof showToast === 'function') showToast('Nama Lengkap wajib diisi.', 'amber');
            if (nameInput) nameInput.focus();
            return;
        }

        const email = (emailInput?.value || '').trim();
        const customType = (customTypeInput?.value || '').trim();
        const fuelRate = parseFloat(fuelRateInput?.value) || 1500;

        // Simpan ke state global userProfile & localStorage
        const updatedProfile = {
            name: name,
            email: email,
            photo: onboardingTempPhoto || (typeof userProfile !== 'undefined' ? userProfile.photo : null),
            driverTypes: [...onboardingSelectedTypes],
            otherType: customType
        };

        if (typeof saveUserProfile === 'function') {
            saveUserProfile(updatedProfile);
        } else {
            localStorage.setItem('drivertrack_profile', JSON.stringify(updatedProfile));
        }

        // Simpan tarif BBM
        localStorage.setItem('drivertrack_fuel_rate', String(fuelRate));
        const settingFuelInput = document.getElementById('setting-fuel-rate');
        if (settingFuelInput) settingFuelInput.value = fuelRate;

        // Update UI profil
        if (typeof renderProfileUI === 'function') renderProfileUI();

        // Lanjut ke Step 2
        goToOnboardingStep(2);
    }

    async function handleOnboardingAllowLocation() {
        let granted = false;
        try {
            if (window.DriverGPS && typeof window.DriverGPS.requestNativePermission === 'function') {
                granted = await window.DriverGPS.requestNativePermission();
            }
        } catch (e) {
            console.warn('[Onboarding] Error request location:', e);
        }
        finishOnboarding(granted);
    }

    function finishOnboarding(grantedLocation) {
        localStorage.setItem(ONBOARDED_KEY, 'true');
        const modal = document.getElementById('onboarding-screen');
        if (modal) {
            modal.classList.add('opacity-0', 'pointer-events-none', 'transition-opacity', 'duration-300');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('opacity-0', 'pointer-events-none');
            }, 300);
        }
        document.body.style.overflow = '';

        if (typeof renderProfileUI === 'function') renderProfileUI();
        if (typeof renderAllViews === 'function') renderAllViews();

        if (typeof showToast === 'function') {
            showToast(
                grantedLocation 
                    ? '🎉 Profil siap & GPS aktif! Selamat mengaspal.' 
                    : '🎉 Profil driver berhasil disimpan! Selamat mengaspal.',
                'emerald'
            );
        }

        setTimeout(() => {
            if (typeof maybeStartFirstTimeTour === 'function') {
                maybeStartFirstTimeTour();
            }
        }, 600);
    }

    function checkAndTriggerOnboarding() {
        const onboarded = localStorage.getItem(ONBOARDED_KEY);
        const hasName = typeof userProfile !== 'undefined' && userProfile.name && userProfile.name.trim().length > 0;

        if (onboarded !== 'true' && !hasName) {
            openOnboardingModal(false);
        }
    }

    function openOnboardingModal(force) {
        const modal = document.getElementById('onboarding-screen');
        if (!modal) return;

        // Reset form data dari profil yang ada
        const currentProfile = (typeof userProfile !== 'undefined') ? userProfile : { name: '', email: '', photo: null, driverTypes: [] };
        
        const nameInput = document.getElementById('onboarding-name');
        const emailInput = document.getElementById('onboarding-email');
        const customTypeInput = document.getElementById('onboarding-custom-type');
        const fuelRateInput = document.getElementById('onboarding-fuel-rate');
        const avatarPreview = document.getElementById('onboarding-avatar-preview');

        if (nameInput) nameInput.value = currentProfile.name || '';
        if (emailInput) emailInput.value = currentProfile.email || '';
        if (customTypeInput) customTypeInput.value = currentProfile.otherType || '';
        
        const currentFuel = parseFloat(localStorage.getItem('drivertrack_fuel_rate')) || 1500;
        if (fuelRateInput) fuelRateInput.value = currentFuel;

        onboardingTempPhoto = currentProfile.photo || null;
        if (avatarPreview) {
            if (onboardingTempPhoto) {
                avatarPreview.innerHTML = `<img src="${onboardingTempPhoto}" alt="Foto Profil" class="w-full h-full object-cover">`;
            } else {
                avatarPreview.innerHTML = `<i class="fa-solid fa-user text-3xl text-indigo-300"></i>`;
            }
        }

        onboardingSelectedTypes = (currentProfile.driverTypes && currentProfile.driverTypes.length > 0)
            ? [...currentProfile.driverTypes]
            : ['ShopeeFood'];

        renderOnboardingChips();
        goToOnboardingStep(1);

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Inisialisasi Google SDK
        initGoogleIdentitySDK();
    }

    function updateProfileGoogleClientIdUI() {
        const input = document.getElementById('setting-google-client-id');
        const badge = document.getElementById('profile-google-status-badge');
        const clientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '';

        if (input) input.value = clientId;
        if (badge) {
            if (clientId) {
                badge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
                badge.innerText = 'Terkonfigurasi';
            } else {
                badge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500';
                badge.innerText = 'Belum Diatur';
            }
        }
    }

    function saveGoogleClientIdFromProfile() {
        const input = document.getElementById('setting-google-client-id');
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            localStorage.setItem(GOOGLE_CLIENT_ID_KEY, val);
            if (typeof showToast === 'function') showToast('Google Client ID berhasil disimpan.', 'emerald');
        } else {
            localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
            if (typeof showToast === 'function') showToast('Google Client ID dihapus.', 'slate');
        }
        updateProfileGoogleClientIdUI();
        initGoogleIdentitySDK();
    }

    // Expose ke global window
    window.checkAndTriggerOnboarding = checkAndTriggerOnboarding;
    window.openOnboardingModal = openOnboardingModal;
    window.goToOnboardingStep = goToOnboardingStep;
    window.toggleOnboardingDriverType = toggleOnboardingDriverType;
    window.handleOnboardingPhotoSelect = handleOnboardingPhotoSelect;
    window.handleGoogleSignInClick = handleGoogleSignInClick;
    window.saveOnboardingStep1AndNext = saveOnboardingStep1AndNext;
    window.handleOnboardingAllowLocation = handleOnboardingAllowLocation;
    window.finishOnboarding = finishOnboarding;
    window.updateProfileGoogleClientIdUI = updateProfileGoogleClientIdUI;
    window.saveGoogleClientIdFromProfile = saveGoogleClientIdFromProfile;

    // Load GSI saat script siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initGoogleIdentitySDK();
            updateProfileGoogleClientIdUI();
        });
    } else {
        initGoogleIdentitySDK();
        updateProfileGoogleClientIdUI();
    }
})();
