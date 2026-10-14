        // ==========================================
        // DRIVERTRACK GPS & PERMISSIONS HELPER
        // Terintegrasi dengan @capacitor/geolocation (Native Android) & fallback Browser
        // ==========================================
        window.DriverGPS = {
            isNative() {
                return !!(window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Geolocation') && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation);
            },

            async checkPermission() {
                if (this.isNative()) {
                    try {
                        const status = await window.Capacitor.Plugins.Geolocation.checkPermissions();
                        if (status.location === 'granted' || status.coarseLocation === 'granted') return 'granted';
                        if (status.location === 'denied') return 'denied';
                        return 'prompt';
                    } catch (e) {
                        console.warn('Capacitor checkPermissions error:', e);
                    }
                }
                if (navigator.permissions && navigator.permissions.query) {
                    try {
                        const p = await navigator.permissions.query({ name: 'geolocation' });
                        return p.state;
                    } catch (e) {}
                }
                return 'prompt';
            },

            async requestNativePermission() {
                if (this.isNative()) {
                    try {
                        const res = await window.Capacitor.Plugins.Geolocation.requestPermissions();
                        if (res.location === 'granted' || res.coarseLocation === 'granted') return true;
                    } catch (e) {
                        console.warn('Capacitor requestPermissions error:', e);
                    }
                }
                return new Promise((resolve) => {
                    if (!navigator.geolocation) return resolve(false);
                    navigator.geolocation.getCurrentPosition(
                        () => resolve(true),
                        (err) => {
                            console.warn('Browser GPS permission error:', err);
                            resolve(false);
                        },
                        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                    );
                });
            },

            showPermissionModal(featureName, onConfirm, onCancel) {
                const modal = document.getElementById('gps-permission-modal');
                const titleEl = document.getElementById('gps-perm-title');
                const descEl = document.getElementById('gps-perm-desc');
                const confirmBtn = document.getElementById('gps-perm-confirm-btn');
                const cancelBtn = document.getElementById('gps-perm-cancel-btn');

                if (!modal) {
                    if (confirm(`Aplikasi DriverTrack memerlukan izin lokasi GPS untuk mengaktifkan: ${featureName}.\n\nApakah Anda ingin mengizinkan akses lokasi sekarang?`)) {
                        if (onConfirm) onConfirm();
                    } else {
                        if (onCancel) onCancel();
                    }
                    return;
                }

                if (titleEl) titleEl.innerText = 'Izinkan Akses Lokasi (GPS)';
                if (descEl) descEl.innerHTML = `Fitur <b>${featureName || 'Pelacakan'}</b> memerlukan izin lokasi GPS perangkat agar dapat bekerja secara akurat.`;

                const cleanup = () => {
                    modal.classList.add('hidden');
                    confirmBtn.onclick = null;
                    cancelBtn.onclick = null;
                };

                confirmBtn.onclick = () => {
                    cleanup();
                    if (onConfirm) onConfirm();
                };

                cancelBtn.onclick = () => {
                    cleanup();
                    if (onCancel) onCancel();
                };

                modal.classList.remove('hidden');
            },

            showDeniedModal() {
                const modal = document.getElementById('gps-denied-modal');
                if (modal) modal.classList.remove('hidden');
                else alert('Izin lokasi belum diberikan. Silakan aktifkan izin lokasi di Pengaturan HP > Aplikasi > DriverTrack > Izin > Lokasi.');
            },

            async ensurePermission(featureName = 'Fitur Lokasi') {
                const current = await this.checkPermission();
                if (current === 'granted') return true;

                return new Promise((resolve) => {
                    this.showPermissionModal(
                        featureName,
                        async () => {
                            const granted = await this.requestNativePermission();
                            if (granted) {
                                showToast('✓ Izin lokasi GPS berhasil diaktifkan', 'emerald');
                                resolve(true);
                            } else {
                                this.showDeniedModal();
                                resolve(false);
                            }
                        },
                        () => {
                            resolve(false);
                        }
                    );
                });
            },

            async getCurrentPosition(options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) {
                if (this.isNative()) {
                    try {
                        const pos = await window.Capacitor.Plugins.Geolocation.getCurrentPosition(options);
                        return {
                            coords: {
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude,
                                accuracy: pos.coords.accuracy || 15
                            },
                            timestamp: pos.timestamp || Date.now()
                        };
                    } catch (e) {
                        console.warn('Capacitor getCurrentPosition fallback to navigator:', e);
                    }
                }
                return new Promise((resolve, reject) => {
                    if (!navigator.geolocation) return reject(new Error('GPS tidak didukung'));
                    navigator.geolocation.getCurrentPosition(
                        (p) => resolve(p),
                        (e) => reject(e),
                        options
                    );
                });
            },

            async watchPosition(onSuccess, onError, options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }) {
                if (this.isNative()) {
                    try {
                        const watchId = await window.Capacitor.Plugins.Geolocation.watchPosition(options, (pos, err) => {
                            if (err) {
                                if (onError) onError(err);
                            } else if (pos) {
                                if (onSuccess) onSuccess({
                                    coords: {
                                        latitude: pos.coords.latitude,
                                        longitude: pos.coords.longitude,
                                        accuracy: pos.coords.accuracy || 15
                                    },
                                    timestamp: pos.timestamp || Date.now()
                                });
                            }
                        });
                        return { type: 'capacitor', id: watchId };
                    } catch (e) {
                        console.warn('Capacitor watchPosition fallback:', e);
                    }
                }
                if (navigator.geolocation) {
                    const id = navigator.geolocation.watchPosition(onSuccess, onError, options);
                    return { type: 'navigator', id };
                }
                return null;
            },

            async clearWatch(watchObj) {
                if (!watchObj) return;
                if (watchObj.type === 'capacitor' && this.isNative()) {
                    try {
                        await window.Capacitor.Plugins.Geolocation.clearWatch({ id: watchObj.id });
                    } catch (e) {}
                } else if (navigator.geolocation) {
                    navigator.geolocation.clearWatch(watchObj.id || watchObj);
                }
            }
        };
