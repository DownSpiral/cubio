/**
 * GAN Cube Bluetooth Connection
 * Handles connection to GAN Smart Cube via gan-web-bluetooth
 * Based on the working gan-cube-sample example
 */

import { connectGanCube } from 'gan-web-bluetooth';

export class GanConnection {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.onMoveCallback = null;
        this.onFaceletsCallback = null;
        this.onDisconnectCallback = null;
        this.eventSubscription = null;
        this.lastDeviceId = null;
        this.reconnectToastInterval = null;
        this.reconnectToastTimeout = null;
        this.connectGanCubeFromDevice = null; // Lazy-loaded to avoid build errors if not exported
    }
    
    /**
     * Show reconnect toast with progress timer
     * @param {number} durationSeconds - Total duration in seconds
     */
    showReconnectToast(durationSeconds = 15) {
        const toast = document.getElementById('reconnect-toast');
        const progressCircle = document.querySelector('.reconnect-timer-progress');
        
        if (!toast || !progressCircle) return;
        
        toast.style.display = 'block';
        
        const circumference = 94.25; // 2 * π * 15 (radius for smaller circle)
        const totalDuration = durationSeconds * 1000;
        const startTime = Date.now();
        
        // Update progress
        const updateTimer = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);
            
            // Update circle progress (stroke-dashoffset goes from circumference to 0)
            const offset = circumference * (1 - progress);
            progressCircle.style.strokeDashoffset = offset;
            
            if (progress >= 1) {
                this.hideReconnectToast();
            }
        };
        
        // Update every 100ms for smooth animation
        this.reconnectToastInterval = setInterval(updateTimer, 100);
        updateTimer(); // Initial update
    }
    
    /**
     * Hide reconnect toast
     */
    hideReconnectToast() {
        const toast = document.getElementById('reconnect-toast');
        if (toast) {
            toast.style.display = 'none';
        }
        
        if (this.reconnectToastInterval) {
            clearInterval(this.reconnectToastInterval);
            this.reconnectToastInterval = null;
        }
        
        if (this.reconnectToastTimeout) {
            clearTimeout(this.reconnectToastTimeout);
            this.reconnectToastTimeout = null;
        }
        
        // Reset progress circle
        const progressCircle = document.querySelector('.reconnect-timer-progress');
        if (progressCircle) {
            progressCircle.style.strokeDashoffset = '94.25';
        }
    }
    
    /**
     * Connect to GAN cube
     * Matches the exact pattern from gan-cube-sample, but uses UI input instead of prompt()
     */
    async connect() {
        // MAC address provider - uses UI input instead of prompt() to avoid Chrome suppression
        const customMacAddressProvider = async (device, isFallbackCall) => {
            // Store device ID for auto-reconnect
            if (device && device.id) {
                this.lastDeviceId = device.id;
                localStorage.setItem('gan-cube-device-id', device.id);
            }
            
            // Always check generic key first (works even if device is null/undefined)
            const genericKey = 'gan-cube-mac-GAN Cube';
            let storedMac = localStorage.getItem(genericKey);
            
            // Also check device-specific key if device info is available
            if (!storedMac && device && (device.id || device.name)) {
                const deviceKey = `gan-cube-mac-${device.id || device.name}`;
                storedMac = localStorage.getItem(deviceKey);
            }
            
            if (storedMac) {
                // Also store with device-specific key for future use if device info is available
                if (device && (device.id || device.name)) {
                    const deviceKey = `gan-cube-mac-${device.id || device.name}`;
                    localStorage.setItem(deviceKey, storedMac);
                }
                return storedMac;
            }
            
            // If fallback call or browser doesn't support watchAdvertisements, show UI input
            if (isFallbackCall || !device || typeof device.watchAdvertisements != 'function') {
                const macAddress = await this.promptForMacAddressUI(device);
                if (macAddress) {
                    // Store with both keys to ensure it's found next time
                    const normalizedMac = macAddress.trim().toUpperCase();
                    localStorage.setItem(genericKey, normalizedMac);
                    if (device && (device.id || device.name)) {
                        const deviceKey = `gan-cube-mac-${device.id || device.name}`;
                        localStorage.setItem(deviceKey, normalizedMac);
                    }
                    return normalizedMac;
                }
            }
            
            // Return null to let library try automatic retrieval
            return null;
        };
        
        try {
            // Connect (exact pattern from working example)
            this.connection = await connectGanCube(customMacAddressProvider);
            this.isConnected = true;
            
            // Store connection info for auto-reconnect
            if (this.connection.deviceName) {
                localStorage.setItem('gan-cube-device-name', this.connection.deviceName);
            }
            if (this.connection.deviceMAC) {
                localStorage.setItem('gan-cube-device-mac', this.connection.deviceMAC);
            }
            
            // Subscribe to events (exact pattern from working example - simple function subscription)
            this.eventSubscription = this.connection.events$.subscribe((event) => {
                // Handle events
                if (event.type === 'MOVE') {
                    if (this.onMoveCallback) {
                        this.onMoveCallback(event.move);
                    }
                } else if (event.type === 'FACELETS') {
                    // Pass raw facelets string (Kociemba notation) to match gan-cube-sample
                    if (this.onFaceletsCallback) {
                        this.onFaceletsCallback(event.facelets);
                    }
                } else if (event.type === 'DISCONNECT') {
                    this.isConnected = false;
                    if (this.onDisconnectCallback) {
                        this.onDisconnectCallback();
                    }
                }
            });
            
            // Send initial commands (exact order from working example)
            await this.connection.sendCubeCommand({ type: 'REQUEST_HARDWARE' });
            await this.connection.sendCubeCommand({ type: 'REQUEST_FACELETS' });
            await this.connection.sendCubeCommand({ type: 'REQUEST_BATTERY' });
            
            return true;
        } catch (error) {
            console.error('Failed to connect to GAN cube:', error);
            this.isConnected = false;
            throw error;
        }
    }
    
    /**
     * Disconnect from GAN cube
     */
    async disconnect() {
        if (this.eventSubscription) {
            this.eventSubscription.unsubscribe();
            this.eventSubscription = null;
        }
        if (this.connection) {
            try {
                if (typeof this.connection.disconnect === 'function') {
                    await this.connection.disconnect();
                }
                this.connection = null;
                this.isConnected = false;
            } catch (error) {
                console.error('Error disconnecting:', error);
            }
        }
    }
    
    /**
     * Check if we have a previously paired device that matches our stored info
     * Returns the device if found, null otherwise
     */
    async checkForPreviouslyPairedDevice() {
        if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
            return null;
        }
        
        try {
            const devices = await navigator.bluetooth.getDevices();
            const storedDeviceId = localStorage.getItem('gan-cube-device-id');
            const storedMac = localStorage.getItem('gan-cube-mac-GAN Cube') || 
                             localStorage.getItem('gan-cube-device-mac');
            
            if (!storedDeviceId && !storedMac) {
                return null;
            }
            
            // Try to find a matching device
            for (const device of devices) {
                // Check if device ID matches (most reliable)
                if (storedDeviceId && device.id === storedDeviceId) {
                    return device;
                }
                
                // Check if device name suggests it's a GAN cube (fallback)
                if (device.name && device.name.toLowerCase().includes('gan')) {
                    return device;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error checking for previously paired device:', error);
            return null;
        }
    }
    
    /**
     * Watch for advertisements and connect GATT when device is available
     * This is needed for auto-reconnection when the device is not already connected
     */
    async watchAndConnectGatt(device) {
        // If already connected, return immediately
        if (device.gatt && device.gatt.connected) {
            return device.gatt;
        }
        
        if (!device.gatt) {
            throw new Error('Device GATT not available');
        }
        
        // If device supports watchAdvertisements, use it first (more reliable for reconnection)
        // The device might appear "not in range" to GATT even though it's advertising
        if (typeof device.watchAdvertisements === 'function') {
            return new Promise((resolve, reject) => {
                let resolved = false;
                let watchStarted = false;
                
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        if (watchStarted) {
                            device.removeEventListener('advertisementreceived', onAdv);
                        }
                        // Final attempt: try direct connect
                        device.gatt.connect()
                            .then((gatt) => {
                                if (!resolved) {
                                    resolved = true;
                                    resolve(gatt);
                                }
                            })
                            .catch(() => {
                                if (!resolved) {
                                    resolved = true;
                                    reject(new Error('Timeout waiting for device - ensure cube is powered on and in range'));
                                }
                            });
                    }
                }, 15000); // 15 second timeout for auto-reconnect
                
                const onAdv = async () => {
                    if (resolved) return;
                    // Device is advertising, so it's definitely in range - now try GATT connect
                    device.removeEventListener('advertisementreceived', onAdv);
                    clearTimeout(timeout);
                    try {
                        // Small delay to ensure device is ready after advertisement
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const gatt = await device.gatt.connect();
                        if (!resolved) {
                            resolved = true;
                            resolve(gatt);
                        }
                    } catch (error) {
                        if (!resolved) {
                            resolved = true;
                            reject(error);
                        }
                    }
                };
                
                // Start watching advertisements
                device.addEventListener('advertisementreceived', onAdv);
                device.watchAdvertisements()
                    .then(() => {
                        watchStarted = true;
                        // Also try immediate connect in parallel (might work if device is ready)
                        device.gatt.connect()
                            .then((gatt) => {
                                if (!resolved) {
                                    resolved = true;
                                    device.removeEventListener('advertisementreceived', onAdv);
                                    clearTimeout(timeout);
                                    resolve(gatt);
                                }
                            })
                            .catch(() => {
                                // Expected to fail, will wait for advertisement
                            });
                    })
                    .catch((error) => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            // If watchAdvertisements fails, try direct connect
                            device.gatt.connect()
                                .then(resolve)
                                .catch(() => reject(error));
                        }
                    });
            });
        } else {
            // No watchAdvertisements support, try direct connect with timeout
            try {
                const gatt = await Promise.race([
                    device.gatt.connect(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), 15000)
                    )
                ]);
                return gatt;
            } catch (error) {
                throw new Error('Device not available - ensure cube is powered on and in range');
            }
        }
    }
    
    /**
     * Attempt to auto-reconnect to the previously connected cube
     * This does NOT require a user gesture and can be called automatically
     * Returns true if reconnection was successful, false otherwise
     */
    async autoReconnect() {
        // Check if we have stored connection info
        const storedDeviceId = localStorage.getItem('gan-cube-device-id');
        const storedMac = localStorage.getItem('gan-cube-mac-GAN Cube') || 
                         localStorage.getItem('gan-cube-device-mac');
        
        if (!storedMac && !storedDeviceId) {
            return false;
        }
        
        // Show reconnect toast
        this.showReconnectToast(15);
        
        try {
            // Lazy-load connectGanCubeFromDevice since some builds of gan-web-bluetooth don't export it statically
            if (!this.connectGanCubeFromDevice) {
                const mod = await import('gan-web-bluetooth');
                this.connectGanCubeFromDevice = mod.connectGanCubeFromDevice || null;
            }
            
            if (!this.connectGanCubeFromDevice) {
                console.log('Auto-reconnect: connectGanCubeFromDevice not available; skipping auto-reconnect');
                this.hideReconnectToast();
                return false;
            }
            
            // Find the previously paired device
            const device = await this.checkForPreviouslyPairedDevice();
            if (!device) {
                console.log('Auto-reconnect: No previously paired device found');
                this.hideReconnectToast();
                return false;
            }
            
            // Watch for advertisements and connect GATT
            try {
                await this.watchAndConnectGatt(device);
            } catch (gattError) {
                // GATT connection failed - device might not be in range
                console.log('Auto-reconnect: GATT connection failed:', gattError.message);
                this.hideReconnectToast();
                return false;
            }
            
            // Set MAC address on device if we have it stored
            if (storedMac && !device.mac) {
                device.mac = storedMac;
            }
            
            // Connect using the new function (no user gesture required)
            this.connection = await this.connectGanCubeFromDevice(device, storedMac);
            this.isConnected = true;
            
            // Store connection info for future reconnects
            if (this.connection.deviceName) {
                localStorage.setItem('gan-cube-device-name', this.connection.deviceName);
            }
            if (this.connection.deviceMAC) {
                localStorage.setItem('gan-cube-device-mac', this.connection.deviceMAC);
            }
            if (device.id) {
                this.lastDeviceId = device.id;
                localStorage.setItem('gan-cube-device-id', device.id);
            }
            
            // Subscribe to events
            this.eventSubscription = this.connection.events$.subscribe((event) => {
                // Handle events
                if (event.type === 'MOVE') {
                    if (this.onMoveCallback) {
                        this.onMoveCallback(event.move);
                    }
                } else if (event.type === 'FACELETS') {
                    // Pass raw facelets string (Kociemba notation) to match gan-cube-sample
                    if (this.onFaceletsCallback) {
                        this.onFaceletsCallback(event.facelets);
                    }
                } else if (event.type === 'DISCONNECT') {
                    this.isConnected = false;
                    if (this.onDisconnectCallback) {
                        this.onDisconnectCallback();
                    }
                }
            });
            
            // Send initial commands
            await this.connection.sendCubeCommand({ type: 'REQUEST_HARDWARE' });
            await this.connection.sendCubeCommand({ type: 'REQUEST_FACELETS' });
            await this.connection.sendCubeCommand({ type: 'REQUEST_BATTERY' });
            
            // Hide toast on success
            this.hideReconnectToast();
            
            return true;
        } catch (error) {
            // Hide toast on error
            this.hideReconnectToast();
            
            // Log error but don't throw - auto-reconnect failures are expected
            if (error.message && error.message.includes('Timeout')) {
                console.log('Auto-reconnect: Device not responding - ensure cube is powered on and in range');
            } else {
                console.log('Auto-reconnect failed:', error.message || error);
            }
            this.isConnected = false;
            return false;
        }
    }
    
    /**
     * Convert GAN facelets (Kociemba notation string) to our cube state format
     * Kociemba notation: 54-character string representing 6 faces × 9 stickers
     * Order: U, R, F, D, L, B (each face has 9 characters)
     * Example: "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
     */
    convertGanFaceletsToState(ganFacelets) {
        // GAN facelets are in Kociemba notation: 54-character string
        // Order: U (9), R (9), F (9), D (9), L (9), B (9)
        
        if (!ganFacelets || typeof ganFacelets !== 'string' || ganFacelets.length !== 54) {
            console.warn('Invalid facelets string:', ganFacelets);
            return null;
        }
        
        // Map Kociemba notation colors to our color constants
        // Kociemba uses: U=Up (Yellow), R=Right, F=Front, D=Down (White), L=Left (Blue), B=Back
        // Our mapping: U=Yellow, F=Green, R=Orange, B=Red, L=Blue, D=White
        const colorMap = {
            'U': 1, // Yellow (Up)
            'R': 3, // Orange (Right)
            'F': 4, // Green (Front)
            'D': 0, // White (Down)
            'L': 5, // Blue (Left)
            'B': 2  // Red (Back)
        };
        
        const cubeState = [];
        
        // Kociemba order: U, R, F, D, L, B
        // Our order: U, D, F, B, R, L
        const kociembaOrder = ['U', 'R', 'F', 'D', 'L', 'B'];
        
        // Map Kociemba face order to our face order
        const faceOrderMap = {
            'U': 0, // U -> U (index 0)
            'D': 1, // D -> D (index 1)
            'F': 2, // F -> F (index 2)
            'B': 3, // B -> B (index 3)
            'R': 4, // R -> R (index 4)
            'L': 5  // L -> L (index 5)
        };
        
        // Initialize cube state with empty arrays
        for (let i = 0; i < 6; i++) {
            cubeState.push([]);
        }
        
        // Parse each face (9 characters per face)
        for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
            const kociembaFace = kociembaOrder[faceIdx];
            const ourFaceIdx = faceOrderMap[kociembaFace];
            const faceStart = faceIdx * 9;
            
            for (let i = 0; i < 9; i++) {
                const colorChar = ganFacelets[faceStart + i];
                const color = colorMap[colorChar] !== undefined ? colorMap[colorChar] : 0;
                cubeState[ourFaceIdx].push(color);
            }
        }
        
        return cubeState;
    }
    
    /**
     * Request current facelets from cube
     */
    async requestFacelets() {
        if (this.connection && this.isConnected) {
            try {
                await this.connection.sendCubeCommand({ type: 'REQUEST_FACELETS' });
            } catch (error) {
                console.error('Failed to request facelets:', error);
            }
        }
    }
    
    /**
     * Reset the cube to its default state
     */
    async resetCube() {
        if (this.connection && this.isConnected) {
            try {
                await this.connection.sendCubeCommand({ type: 'REQUEST_RESET' });
            } catch (error) {
                console.error('Failed to reset cube:', error);
                throw error;
            }
        } else {
            throw new Error('Cube is not connected');
        }
    }
    
    /**
     * Set callback for move events
     */
    onMove(callback) {
        this.onMoveCallback = callback;
    }
    
    /**
     * Set callback for facelets events
     */
    onFacelets(callback) {
        this.onFaceletsCallback = callback;
    }
    
    /**
     * Set callback for disconnect events
     */
    onDisconnect(callback) {
        this.onDisconnectCallback = callback;
    }
    
    /**
     * Prompt user for MAC address using UI input (avoids Chrome prompt suppression)
     * Returns null to trigger error, which will show the input field
     */
    async promptForMacAddressUI(device) {
        // Return null to trigger the MAC address error
        // The main.js will catch the error and show the input field
        return null;
    }
    
    /**
     * Prompt user for MAC address (fallback using prompt)
     */
    async promptForMacAddress(device) {
        return new Promise((resolve) => {
            const deviceName = device.name || 'GAN Cube';
            const message = `Unable to automatically detect MAC address for ${deviceName}.\n\n` +
                `Please enter the MAC address manually.\n\n` +
                `To find your cube's MAC address:\n` +
                `• Chrome: Go to chrome://bluetooth-internals/#devices\n` +
                `• macOS: Hold Option and click Bluetooth icon in menu bar\n` +
                `• Android: Use nRF Connect app\n\n` +
                `MAC address format: XX:XX:XX:XX:XX:XX (e.g., A1:B2:C3:D4:E5:F6)`;
            
            let macAddress = prompt(message, '');
            
            // Keep prompting until valid MAC or user cancels
            while (macAddress && !this.isValidMacAddress(macAddress)) {
                alert('Invalid MAC address format. Please use format: XX:XX:XX:XX:XX:XX\n\nExample: A1:B2:C3:D4:E5:F6');
                macAddress = prompt(message, '');
            }
            
            if (macAddress && this.isValidMacAddress(macAddress)) {
                resolve(macAddress.trim().toUpperCase());
            } else {
                resolve(null);
            }
        });
    }
    
    /**
     * Validate MAC address format
     */
    isValidMacAddress(mac) {
        // MAC address format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        return macRegex.test(mac.trim());
    }
}
