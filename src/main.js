/**
 * Main Application
 * Coordinates all components
 * Uses TwistyPlayer from cubing library (matching gan-cube-sample implementation)
 */

import { TwistyPlayer } from 'cubing/twisty';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import { GanConnection } from './bluetooth/ganConnection.js';
import { NotationTrainer } from './trainer/notationTrainer.js';
import { generateScramble } from './utils/scrambler.js';
import { faceletsToPattern, patternToFacelets } from './utils/faceletsUtils.js';
import { SolveTimer, TIMER_STATE } from './timer/solveTimer.js';
import confetti from 'canvas-confetti';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

/**
 * Trigger confetti animation
 * @param {string} type - Type of confetti: 'celebration', 'success', 'info'
 */
function triggerConfetti(type = 'celebration') {
    const defaults = {
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    };
    
    if (type === 'celebration') {
        // Big celebration confetti - multiple bursts for longer celebration
        const celebrationColors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
        
        // Initial big burst from both sides
        confetti({
            particleCount: 200,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.6 },
            colors: celebrationColors,
            ticks: 300,
            decay: 0.92
        });
        confetti({
            particleCount: 200,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.6 },
            colors: celebrationColors,
            ticks: 300,
            decay: 0.92
        });
        
        // Additional bursts after delays for extended celebration
        setTimeout(() => {
            confetti({
                particleCount: 100,
                angle: 60,
                spread: 70,
                origin: { x: 0, y: 0.6 },
                colors: celebrationColors,
                ticks: 250,
                decay: 0.93
            });
            confetti({
                particleCount: 100,
                angle: 120,
                spread: 70,
                origin: { x: 1, y: 0.6 },
                colors: celebrationColors,
                ticks: 250,
                decay: 0.93
            });
        }, 300);
        
        setTimeout(() => {
            confetti({
                particleCount: 80,
                angle: 90,
                spread: 60,
                origin: { x: 0.5, y: 0.5 },
                colors: celebrationColors,
                ticks: 200,
                decay: 0.94
            });
        }, 600);
    } else if (type === 'success') {
        // Success confetti (smaller, from center)
        confetti({
            ...defaults,
            particleCount: 50,
            spread: 50,
            origin: { y: 0.5 }
        });
    } else {
        // Info/neutral confetti
        confetti({
            ...defaults,
            particleCount: 30,
            spread: 30
        });
    }
}

/**
 * Transform a move from physical cube orientation to visual orientation
 * Since we use setup 'x2 y2', we need to map:
 * - U ↔ D (x2 swaps top/bottom)
 * - F and B stay the same (y2 swaps them but we want them to match)
 * - R ↔ L (y2 swaps right/left)
 */
function transformMoveForSetup(move) {
    // Handle wide moves, rotations, and slice moves
    // Parse the move (e.g., "U", "U'", "U2", "u", "u'", "Uw", "Uw'", "x", "x'", etc.)
    const match = move.match(/^([UDFBRLudfbrlMESxyz])(w)?(['2])?$/i);
    if (!match) {
        return move; // Return as-is if we can't parse it
    }
    
    const face = match[1].toUpperCase();
    const wide = match[2] || '';
    const modifier = match[3] || '';
    
    // Map faces according to x2 y2 transformation
    // Note: F and B should NOT be swapped - they're already correct
    const faceMap = {
        'U': 'D',
        'D': 'U',
        'F': 'F', // Keep F as F
        'B': 'B', // Keep B as B
        'R': 'L',
        'L': 'R',
        // Rotations: x2 y2 means x stays x, y stays y, z stays z (they're global)
        'X': 'X',
        'Y': 'Y',
        'Z': 'Z',
        // Slice moves: M, E, S need to be transformed
        'M': 'M', // M is L-R slice, with x2 y2 it stays the same
        'E': 'E', // E is U-D slice, with x2 y2 it stays the same
        'S': 'S'  // S is F-B slice, with y2 it stays the same
    };
    
    const transformedFace = faceMap[face] || face;
    return transformedFace + wide + modifier;
}

class CubePracticeApp {
    constructor() {
        this.twistyPlayer = null;
        this.ganConnection = null;
        this.trainer = null;
        this.timer = null;
        this.currentScramble = null;
        this.cubeStateInitialized = false;
        this.selectedScrambleMethod = 'random';
        this.pendingFaceletsPromise = null;
        this.pendingFaceletsResolver = null;
        this.cubeWasSolved = false; // Track if cube was in solved state before last move
        this.solveCheckTimeout = null; // Timeout for checking if cube is solved
        this.currentView = 'timer-view'; // Track current active view
        
        this.init();
    }
    
    init() {
        // Initialize TwistyPlayer (matching gan-cube-sample)
        const cubeContainer = document.getElementById('cube');
        
        // Get initial camera values from inputs
        const initialLatitude = parseFloat(document.getElementById('camera-latitude').value) || 40;
        const initialLongitude = parseFloat(document.getElementById('camera-longitude').value) || 30;
        const initialLatitudeLimit = parseFloat(document.getElementById('camera-latitude-limit').value) || 90;
        
        this.twistyPlayer = new TwistyPlayer({
            puzzle: '3x3x3',
            visualization: 'PG3D',
            alg: 'x2 y2',
            experimentalSetupAnchor: 'start',
            background: 'none',
            controlPanel: 'none',
            hintFacelets: 'none',
            experimentalDragInput: 'none',
            experimentalSetupAlg: '', // Rotate so Yellow=U, Green=F, Orange=R
            cameraLatitude: initialLatitude,
            cameraLongitude: initialLongitude,
            cameraLatitudeLimit: initialLatitudeLimit,
            tempoScale: 5
        });
        cubeContainer.appendChild(this.twistyPlayer);
        
        // Set up camera control listeners
        this.setupCameraControls();
        
        // Set up scramble method selection
        this.setupScrambleMethod();
        
        // Initialize GAN connection
        this.ganConnection = new GanConnection();
        this.ganConnection.onMove((move) => {
            this.handleCubeMove(move);
        });
        this.ganConnection.onFacelets((facelets) => {
            this.handleCubeFacelets(facelets);
        });
        this.ganConnection.onDisconnect(() => {
            this.handleDisconnect();
        });
        
        // Initialize trainer
        this.trainer = new NotationTrainer();
        this.trainer.onProgress((progress, sequence) => this.updateProgress(progress, sequence));
        this.trainer.onComplete(() => this.handleTrainerComplete());
        this.trainer.onError((error) => this.handleTrainerError(error));
        
        // Initialize timer
        this.timer = new SolveTimer();
        this.timer.onTimeUpdate((elapsed, isInspection) => this.updateTimerDisplay(elapsed, isInspection));
        this.timer.onSolveComplete((solve) => this.handleSolveComplete(solve));
        this.timer.onStateChange((state) => this.handleTimerStateChange(state));
        this.timer.onPhaseUpdate((phaseData, phaseInfo) => this.handlePhaseUpdate(phaseData, phaseInfo));
        
        // Set up solve method and cross face selection (after timer is initialized)
        this.setupSolveMethod();
        
        // Initialize timer UI
        this.updateTimerDisplay(0, false);
        this.updateTimerUI();
        
        // Set up UI event listeners
        this.setupEventListeners();
        
        // Initialize default view (Timer)
        this.switchContentView('timer-view');
        
        // Attempt auto-reconnect on page load
        this.attemptAutoReconnect();
    }
    
    /**
     * Check for previously paired device and attempt auto-reconnection
     */
    async attemptAutoReconnect() {
        const statusEl = document.getElementById('connection-status');
        const connectBtn = document.getElementById('connect-btn');
        const connectBtnCube = document.getElementById('connect-btn-cube');
        const disconnectBtn = document.getElementById('disconnect-btn');
        
        // Check if we have stored connection info
        const storedMac = localStorage.getItem('gan-cube-mac-GAN Cube') || 
                         localStorage.getItem('gan-cube-device-mac');
        
        if (!storedMac) {
            return;
        }
        
        // Check if we have a previously paired device
        const previouslyPairedDevice = await this.ganConnection.checkForPreviouslyPairedDevice();
        
        if (previouslyPairedDevice) {
            // Attempt automatic reconnection (no user gesture required)
            statusEl.textContent = 'Attempting to reconnect...';
            statusEl.className = 'status connecting';
            
            const reconnected = await this.ganConnection.autoReconnect();
            
            if (reconnected) {
                // Successfully reconnected
                statusEl.textContent = 'Connected';
                statusEl.className = 'status connected';
                connectBtn.style.display = 'none';
                connectBtnCube.style.display = 'none';
                disconnectBtn.style.display = 'block';
                
                // Send initial facelets request
                await this.ganConnection.requestFacelets();
                
                // Enable trainer button
                document.getElementById('start-trainer-btn').disabled = false;
                
                // Enable reset cube button
                document.getElementById('reset-cube-btn').disabled = false;
                
                // Update timer UI
                this.updateTimerUI();
            } else {
                // Reconnection failed, show reconnect button
                connectBtn.textContent = 'Reconnect to GAN Cube';
                connectBtn.style.background = '#48bb78'; // Green to indicate it's a reconnect
                connectBtnCube.textContent = 'Reconnect to GAN Cube';
                connectBtnCube.style.background = '#48bb78';
                statusEl.textContent = 'Click "Reconnect" to connect to your cube';
                statusEl.className = 'status disconnected';
            }
        } else {
            // No previously paired device found, but we have stored info
            connectBtn.textContent = 'Connect to GAN Cube';
            connectBtnCube.textContent = 'Connect to GAN Cube';
            statusEl.textContent = 'Disconnected (MAC address saved)';
            statusEl.className = 'status disconnected';
        }
    }
    
    async setupCameraControls() {
        // Update camera when inputs change
        const latitudeInput = document.getElementById('camera-latitude');
        const longitudeInput = document.getElementById('camera-longitude');
        const latitudeLimitInput = document.getElementById('camera-latitude-limit');
        
        const updateCamera = async () => {
            const latitude = parseFloat(latitudeInput.value) || 0;
            const longitude = parseFloat(longitudeInput.value) || 0;
            const latitudeLimit = parseFloat(latitudeLimitInput.value) || 0;
            
            // Try to update TwistyPlayer camera properties
            try {
                if (this.twistyPlayer) {
                    // Update camera angles using TwistyPlayer's API
                    this.twistyPlayer.cameraLatitude = latitude;
                    this.twistyPlayer.cameraLongitude = longitude;
                    this.twistyPlayer.cameraLatitudeLimit = latitudeLimit;
                    
                    // Force a render update
                    if (this.twistyPlayer.experimentalCurrentVantages) {
                        const vantages = await this.twistyPlayer.experimentalCurrentVantages();
                        if (vantages && vantages.length > 0) {
                            vantages[0].render();
                        }
                    }
                    
                }
            } catch (error) {
                console.error('Error updating camera:', error);
            }
        };
        
        latitudeInput.addEventListener('input', updateCamera);
        longitudeInput.addEventListener('input', updateCamera);
        latitudeLimitInput.addEventListener('input', updateCamera);
    }
    
    setupEventListeners() {
        // Navigation drawer
        this.setupNavigationDrawer();
        
        // Settings drawer
        this.setupSettingsDrawer();
        
        // Content view switching
        this.setupContentViewSwitching();
        
        // Connection buttons
        const connectBtn = document.getElementById('connect-btn');
        connectBtn.addEventListener('click', () => this.connectCube());
        
        const connectBtnCube = document.getElementById('connect-btn-cube');
        connectBtnCube.addEventListener('click', () => {
            this.connectCube();
        });
        
        // Disconnect button
        const disconnectBtn = document.getElementById('disconnect-btn');
        disconnectBtn.addEventListener('click', () => this.disconnectCube());
        
        // Clear MAC address button
        const clearMacBtn = document.getElementById('clear-mac-btn');
        clearMacBtn.addEventListener('click', () => this.clearMacAddress());
        
        // Start trainer button
        const startTrainerBtn = document.getElementById('start-trainer-btn');
        startTrainerBtn.addEventListener('click', () => this.startTrainer());
        
        // Reset trainer button
        const resetTrainerBtn = document.getElementById('reset-trainer-btn');
        resetTrainerBtn.addEventListener('click', () => this.resetTrainer());
        
        // Timer buttons
        const startTimerBtn = document.getElementById('start-timer-btn');
        if (startTimerBtn) {
            startTimerBtn.addEventListener('click', () => {
                console.log('Start timer button clicked');
                this.startTimer();
            });
        } else {
            console.error('Start timer button not found!');
        }
        
        const stopTimerBtn = document.getElementById('stop-timer-btn');
        stopTimerBtn.addEventListener('click', () => this.stopTimer());
        
        const resetTimerBtn = document.getElementById('reset-timer-btn');
        resetTimerBtn.addEventListener('click', () => this.resetTimer());
        
        // History buttons
        const clearHistoryBtn = document.getElementById('clear-history-btn');
        clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
        const closeHistoryModal = document.getElementById('close-history-modal');
        closeHistoryModal.addEventListener('click', () => this.closeHistoryModal());
        
        const historyModalOverlay = document.getElementById('history-modal-overlay');
        historyModalOverlay.addEventListener('click', (e) => {
            if (e.target === historyModalOverlay) {
                this.closeHistoryModal();
            }
        });
        
        // Reset cube button
        const resetCubeBtn = document.getElementById('reset-cube-btn');
        resetCubeBtn.addEventListener('click', () => this.resetCube());
    }
    
    setupNavigationDrawer() {
        const hamburgerToggle = document.getElementById('hamburger-toggle');
        const navDrawer = document.getElementById('nav-drawer');
        const navDrawerOverlay = document.getElementById('nav-drawer-overlay');
        const closeNavDrawer = document.getElementById('close-nav-drawer');
        
        hamburgerToggle.addEventListener('click', () => {
            this.openNavigationDrawer();
        });
        
        closeNavDrawer.addEventListener('click', () => {
            this.closeNavigationDrawer();
        });
        
        navDrawerOverlay.addEventListener('click', () => {
            this.closeNavigationDrawer();
        });
    }
    
    openNavigationDrawer() {
        const navDrawer = document.getElementById('nav-drawer');
        const navDrawerOverlay = document.getElementById('nav-drawer-overlay');
        navDrawer.classList.add('open');
        navDrawerOverlay.classList.add('show');
    }
    
    closeNavigationDrawer() {
        const navDrawer = document.getElementById('nav-drawer');
        const navDrawerOverlay = document.getElementById('nav-drawer-overlay');
        navDrawer.classList.remove('open');
        navDrawerOverlay.classList.remove('show');
    }
    
    setupSettingsDrawer() {
        const settingsToggle = document.getElementById('settings-toggle');
        const settingsDrawer = document.getElementById('settings-drawer');
        const settingsDrawerOverlay = document.getElementById('settings-drawer-overlay');
        const closeSettingsDrawer = document.getElementById('close-settings-drawer');
        
        settingsToggle.addEventListener('click', () => {
            this.openSettingsDrawer();
        });
        
        closeSettingsDrawer.addEventListener('click', () => {
            this.closeSettingsDrawer();
        });
        
        settingsDrawerOverlay.addEventListener('click', () => {
            this.closeSettingsDrawer();
        });
    }
    
    openSettingsDrawer() {
        const settingsDrawer = document.getElementById('settings-drawer');
        const settingsDrawerOverlay = document.getElementById('settings-drawer-overlay');
        settingsDrawer.classList.add('open');
        settingsDrawerOverlay.classList.add('show');
    }
    
    closeSettingsDrawer() {
        const settingsDrawer = document.getElementById('settings-drawer');
        const settingsDrawerOverlay = document.getElementById('settings-drawer-overlay');
        settingsDrawer.classList.remove('open');
        settingsDrawerOverlay.classList.remove('show');
    }
    
    setupContentViewSwitching() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewId = item.getAttribute('data-view');
                this.switchContentView(viewId);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Close navigation drawer
                this.closeNavigationDrawer();
            });
        });
    }
    
    switchContentView(viewId) {
        // Hide all views
        const views = document.querySelectorAll('.view-content');
        views.forEach(view => view.classList.remove('active'));
        
        // Update twisty player stickering based on view
        if (viewId === 'cross-practice-view') {
            // Set cross stickering and setup anchor for cross practice
            this.twistyPlayer.experimentalStickering = 'Cross';
            this.twistyPlayer.experimentalSetupAnchor = 'start';
        } else {
            // Remove stickering and reset setup anchor for other views
            this.twistyPlayer.experimentalStickering = null;
            this.twistyPlayer.experimentalSetupAnchor = 'start';
        }
        
        // Show selected view
        const selectedView = document.getElementById(viewId);
        if (selectedView) {
            selectedView.classList.add('active');
            this.currentView = viewId; // Update current view tracking
            
            // If switching to history view, refresh it
            if (viewId === 'history-view') {
                this.showHistoryInline();
            }
        }
    }
    
    setupScrambleMethod() {
        // Update selected method when dropdown changes
        const scrambleAlgorithm = document.getElementById('scramble-algorithm');
        if (scrambleAlgorithm) {
            this.selectedScrambleMethod = scrambleAlgorithm.value;
            scrambleAlgorithm.addEventListener('change', (e) => {
                this.selectedScrambleMethod = e.target.value;
            });
        }
    }
    
    /**
     * Convert color notation to face notation
     * W=White=D, Y=Yellow=U, G=Green=F, B=Blue=B, R=Red=R, O=Orange=L
     */
    colorToFace(color) {
        const colorMap = {
            'W': 'D', // White = Down
            'Y': 'U', // Yellow = Up
            'G': 'F', // Green = Front
            'B': 'B', // Blue = Back
            'R': 'R', // Red = Right
            'O': 'L'  // Orange = Left
        };
        return colorMap[color] || 'D';
    }
    
    /**
     * Convert face notation to color notation
     * D=Down=W, U=Up=Y, F=Front=G, B=Back=B, R=Right=R, L=Left=O
     */
    faceToColor(face) {
        const faceMap = {
            'D': 'W', // Down = White
            'U': 'Y', // Up = Yellow
            'F': 'G', // Front = Green
            'B': 'B', // Back = Blue
            'R': 'R', // Right = Red
            'L': 'O'  // Left = Orange
        };
        return faceMap[face] || 'W';
    }
    
    setupSolveMethod() {
        // Load solve method and cross face from localStorage
        const solveMethodSelect = document.getElementById('solve-method');
        const crossFaceSelect = document.getElementById('cross-face');
        
        if (solveMethodSelect) {
            const savedMethod = localStorage.getItem('solve-method') || 'CFOP';
            solveMethodSelect.value = savedMethod;
            solveMethodSelect.addEventListener('change', (e) => {
                localStorage.setItem('solve-method', e.target.value);
                const crossFaceColor = localStorage.getItem('cross-face') || 'W';
                const crossFace = this.colorToFace(crossFaceColor);
                this.timer.setSolveMethod(e.target.value, crossFace);
                console.log('Solve method updated:', e.target.value, 'crossFace:', crossFace, 'color:', crossFaceColor);
            });
        }
        
        if (crossFaceSelect) {
            // Handle migration from old face notation to new color notation
            let savedCrossFace = localStorage.getItem('cross-face');
            if (savedCrossFace && ['D', 'U', 'F', 'B', 'R', 'L'].includes(savedCrossFace)) {
                // Migrate old face notation to color notation
                const faceToColor = { 'D': 'W', 'U': 'Y', 'F': 'G', 'B': 'B', 'R': 'R', 'L': 'O' };
                savedCrossFace = faceToColor[savedCrossFace];
                localStorage.setItem('cross-face', savedCrossFace);
            }
            
            const crossFaceColor = savedCrossFace || 'W';
            crossFaceSelect.value = crossFaceColor;
            crossFaceSelect.addEventListener('change', (e) => {
                localStorage.setItem('cross-face', e.target.value);
                const solveMethod = localStorage.getItem('solve-method') || 'CFOP';
                const crossFace = this.colorToFace(e.target.value);
                this.timer.setSolveMethod(solveMethod, crossFace);
                console.log('Cross face updated:', e.target.value, 'face:', crossFace, 'solveMethod:', solveMethod);
            });
        }
        
        // Ensure timer has the current values
        const solveMethod = localStorage.getItem('solve-method') || 'CFOP';
        const crossFaceColor = localStorage.getItem('cross-face') || 'W';
        const crossFace = this.colorToFace(crossFaceColor);
        this.timer.setSolveMethod(solveMethod, crossFace);
        console.log('Initialized solve method:', solveMethod, 'crossFace:', crossFace, 'color:', crossFaceColor);
    }
    
    async connectCube() {
        const statusEl = document.getElementById('connection-status');
        const connectBtn = document.getElementById('connect-btn');
        const connectBtnCube = document.getElementById('connect-btn-cube');
        const disconnectBtn = document.getElementById('disconnect-btn');
        const macInputContainer = document.getElementById('mac-address-input-container');
        const macInput = document.getElementById('mac-address-input');
        
        // Reset button style in case it was set to reconnect style
        connectBtn.style.background = '';
        
        // If MAC input is visible, user is entering MAC address
        if (macInputContainer && macInputContainer.style.display !== 'none') {
            const macAddress = macInput.value.trim();
            if (!macAddress) {
                alert('Please enter a MAC address');
                macInput.focus();
                return;
            }
            if (!this.ganConnection.isValidMacAddress(macAddress)) {
                alert('Invalid MAC address format. Please use format: XX:XX:XX:XX:XX:XX\n\nExample: A1:B2:C3:D4:E5:F6');
                macInput.focus();
                return;
            }
            // Store MAC address with normalized format and hide input
            const normalizedMac = macAddress.trim().toUpperCase().replace(/[^0-9A-F:]/g, '');
            const deviceName = 'GAN Cube'; // We don't have device yet, use generic
            localStorage.setItem(`gan-cube-mac-${deviceName}`, normalizedMac);
            macInputContainer.style.display = 'none';
            macInput.value = ''; // Clear input for next time
        }
        
        try {
            statusEl.textContent = 'Connecting...';
            statusEl.className = 'status connecting';
            connectBtn.disabled = true;
            connectBtnCube.disabled = true;
            
            // Reset cube state initialization flag BEFORE connection
            // (matching gan-cube-sample pattern)
            this.cubeStateInitialized = false;
            
            await this.ganConnection.connect();
            
            statusEl.textContent = 'Connected';
            statusEl.className = 'status connected';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'block';
            connectBtn.textContent = 'Connect to GAN Cube'; // Reset text
            connectBtnCube.classList.add('hidden');
            
            // Close settings drawer if open
            this.closeSettingsDrawer();
            
            // Send REQUEST_FACELETS after connection to initialize cube state
            // (matching gan-cube-sample pattern - even though it's also sent in connect())
            await this.ganConnection.requestFacelets();
            
            // Enable trainer button
            document.getElementById('start-trainer-btn').disabled = false;
            
            // Enable reset cube button
            document.getElementById('reset-cube-btn').disabled = false;
            
            // Update timer UI (will enable/disable start button based on cube state)
            this.updateTimerUI();
        } catch (error) {
            statusEl.textContent = `Connection failed: ${error.message}`;
            statusEl.className = 'status disconnected';
            connectBtn.disabled = false;
            connectBtnCube.disabled = false;
            
            // If MAC address error, show input field instead of alert
            if (error.message && error.message.includes('MAC address')) {
                const macInputContainer = document.getElementById('mac-address-input-container');
                const macInput = document.getElementById('mac-address-input');
                if (macInputContainer && macInput) {
                    macInputContainer.style.display = 'block';
                    macInput.focus();
                    statusEl.textContent = 'Please enter MAC address and click Connect again';
                    connectBtn.textContent = 'Connect with MAC Address';
                } else {
                    alert(`Connection failed: ${error.message}\n\nPlease enter MAC address in the input field above.`);
                }
            } else {
                alert(`Failed to connect: ${error.message}`);
            }
        }
    }
    
    async disconnectCube() {
        const statusEl = document.getElementById('connection-status');
        const connectBtn = document.getElementById('connect-btn');
        const connectBtnCube = document.getElementById('connect-btn-cube');
        const disconnectBtn = document.getElementById('disconnect-btn');
        
        try {
            await this.ganConnection.disconnect();
            
            statusEl.textContent = 'Disconnected';
            statusEl.className = 'status disconnected';
            connectBtn.style.display = 'block';
            disconnectBtn.style.display = 'none';
            connectBtn.disabled = false;
            connectBtnCube.classList.remove('hidden');
            
            document.getElementById('start-trainer-btn').disabled = true;
            
            // Disable reset cube button
            document.getElementById('reset-cube-btn').disabled = true;
            
            // Reset cube visualization and timer
            this.twistyPlayer.alg = '';
            this.cubeStateInitialized = false;
            this.timer.reset();
            this.updateTimerDisplay(0);
            this.cubeWasSolved = false;
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    }
    
    clearMacAddress() {
        // Clear all stored MAC addresses from localStorage
        // Keys are stored as: gan-cube-mac-${device.id || device.name}
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('gan-cube-mac-')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        if (keysToRemove.length > 0) {
            alert(`Cleared ${keysToRemove.length} stored MAC address(es). You can now enter a new MAC address when connecting.`);
        } else {
            alert('No stored MAC addresses found.');
        }
        
        // Also clear the MAC input field if it's visible
        const macInput = document.getElementById('mac-address-input');
        if (macInput) {
            macInput.value = '';
        }
    }
    
    handleDisconnect() {
        const statusEl = document.getElementById('connection-status');
        const connectBtn = document.getElementById('connect-btn');
        const connectBtnCube = document.getElementById('connect-btn-cube');
        const disconnectBtn = document.getElementById('disconnect-btn');
        
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'status disconnected';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        connectBtn.disabled = false;
        connectBtnCube.classList.remove('hidden');
        
        document.getElementById('start-trainer-btn').disabled = true;
        
        // Disable reset cube button
        document.getElementById('reset-cube-btn').disabled = true;
        
        // Reset cube visualization and timer
        this.twistyPlayer.alg = '';
        this.cubeStateInitialized = false;
        this.timer.reset();
        this.updateTimerDisplay(0);
        this.cubeWasSolved = false;
    }
    
    /**
     * Handle MOVE events from the cube (matching gan-cube-sample pattern)
     */
    handleCubeMove(move) {
        // Update connection status to show activity
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            const originalText = statusEl.textContent;
            statusEl.textContent = `Connected - Move: ${move}`;
            setTimeout(() => {
                if (statusEl.textContent.includes('Move:')) {
                    statusEl.textContent = originalText;
                }
            }, 1000);
        }
        
        // Transform move from physical cube orientation to visual orientation
        const transformedMove = transformMoveForSetup(move);
        
        // Apply move directly to TwistyPlayer (matching gan-cube-sample)
        this.twistyPlayer.experimentalAddMove(transformedMove, { cancel: false });
        
        // If trainer is active, process the transformed move (trainer expects visual orientation)
        if (this.trainer && this.trainer.isActive) {
            this.trainer.processMove(transformedMove);
        }
        
        // Timer logic: Handle different states (only when on timer view)
        if (this.currentView === 'timer-view') {
            const timerState = this.timer.getState();
            
            // If timer is idle or complete, any move starts scrambling
            if (timerState === TIMER_STATE.IDLE || timerState === TIMER_STATE.COMPLETE) {
                // Reset timer if in COMPLETE state, then start scrambling
                if (timerState === TIMER_STATE.COMPLETE) {
                    this.timer.reset();
                }
                this.timer.startScrambling();
                this.updateTimerUI();
            }
            
            // If we're in scrambling phase, handle the move
            if (timerState === TIMER_STATE.SCRAMBLING) {
                this.timer.handleScrambleMove();
            }
            
            // Record move in timer if solving (only during actual solve)
            if (timerState === TIMER_STATE.SOLVING) {
                this.timer.recordMove(transformedMove);
                
                // Check if cube is solved after a short delay (debounce)
                // Clear any existing timeout
                if (this.solveCheckTimeout) {
                    clearTimeout(this.solveCheckTimeout);
                }
                
                // Check for solved state after 500ms (allows move to complete)
                this.solveCheckTimeout = setTimeout(() => {
                    if (this.timer.getState() === TIMER_STATE.SOLVING && this.ganConnection && this.ganConnection.isConnected) {
                        this.ganConnection.requestFacelets();
                    }
                }, 500);
            }
        }
    }
    
    /**
     * Handle FACELETS events from the cube (matching gan-cube-sample pattern exactly)
     */
    async handleCubeFacelets(facelets) {
        // Check if there's a pending promise waiting for facelets (for trainer)
        if (this.pendingFaceletsResolver) {
            this.pendingFaceletsResolver(facelets);
            this.pendingFaceletsResolver = null;
            this.pendingFaceletsPromise = null;
            return;
        }
        
        // Check if cube is solved (for timer)
        const isSolved = this.timer.isSolved(facelets);
        const wasSolvedBefore = this.cubeWasSolved;
        this.cubeWasSolved = isSolved; // Always update the flag for state tracking
        
        // Timer logic: only process when on timer view
        if (this.currentView === 'timer-view') {
            const timerState = this.timer.getState();
            
            // Check phase completion during solving
            if (timerState === TIMER_STATE.SOLVING) {
                console.log('Received facelets during solving, checking phases...');
                await this.timer.checkPhaseCompletion(facelets);
            }
            
            if (isSolved && timerState === TIMER_STATE.SOLVING) {
                // Cube is solved during solving phase - complete the solve
                this.timer.completeSolve();
                this.updateTimerUI();
            }
            
            // Update timer UI if solved state changed (to enable/disable start button)
            if (wasSolvedBefore !== isSolved && timerState === TIMER_STATE.IDLE) {
                this.updateTimerUI();
            }
        }
        
        // Only initialize once (matching gan-cube-sample pattern)
        if (this.cubeStateInitialized) {
            return;
        }
        
        // facelets is a Kociemba notation string (54 characters)
        if (typeof facelets === 'string' && facelets.length === 54) {
            try {
                // Match gan-cube-sample pattern: check if solved first
                if (facelets != SOLVED_STATE) {
                    // Process facelets through the solver to account for setup algorithm
                    const kpattern = await faceletsToPattern(facelets);
                    const solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
                    const scramble = solution.invert();
                    this.twistyPlayer.alg = scramble;
                    console.log('Scramble:', scramble);

                } else {
                    // Solved state - set empty algorithm
                    this.twistyPlayer.alg = '';
                }
                this.twistyPlayer.experimentalAddMove('x2', { cancel: false });
                this.twistyPlayer.experimentalAddMove('y2', { cancel: false });
                this.cubeStateInitialized = true;
                // Check if solved for timer (after initialization)
                this.cubeWasSolved = facelets === SOLVED_STATE;
            } catch (error) {
                console.error('Error processing facelets:', error);
                // If there's an error, check if it's the solved state as fallback
                if (facelets === SOLVED_STATE) {
                    this.twistyPlayer.alg = '';
                    this.cubeStateInitialized = true;
                    this.cubeWasSolved = true;
                }
            }
        } else {
            console.warn('Invalid facelets received:', facelets);
        }
    }
    
    async startTrainer() {
        // Check if cube is solved by requesting facelets from the cube
        let scramble;
        
        try {
            // Check if cube is connected
            if (this.ganConnection && this.ganConnection.isConnected) {
                // Request facelets from the cube and wait for them
                this.pendingFaceletsPromise = new Promise((resolve, reject) => {
                    this.pendingFaceletsResolver = resolve;
                    // Timeout after 2 seconds
                    setTimeout(() => {
                        if (this.pendingFaceletsResolver) {
                            this.pendingFaceletsResolver = null;
                            this.pendingFaceletsPromise = null;
                            reject(new Error('Timeout waiting for facelets'));
                        }
                    }, 2000);
                });
                
                await this.ganConnection.requestFacelets();
                const facelets = await this.pendingFaceletsPromise;
                
                if (facelets === SOLVED_STATE) {
                    // Cube is solved, generate a random scramble
                    scramble = generateScramble(25, this.selectedScrambleMethod);
                } else {
                    // Cube is not solved, generate a solution sequence
                    const kpattern = await faceletsToPattern(facelets);
                    const solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
                    const solutionString = solution.toString();
                    
                    // Transform each move in the solution to account for x2 y2 setup
                    const solutionMoves = solutionString.split(' ').filter(m => m.trim());
                    const transformedMoves = solutionMoves.map(move => transformMoveForSetup(move));
                    scramble = transformedMoves.join(' ');
                    
                    console.log('Cube not solved, generating solution:', scramble);
                }
            } else {
                // Cube not connected, generate a random scramble
                scramble = generateScramble(25, this.selectedScrambleMethod);
            }
        } catch (error) {
            console.error('Error checking cube state, using random scramble:', error);
            // Fallback to random scramble if there's an error
            scramble = generateScramble(25, this.selectedScrambleMethod);
        } finally {
            // Clean up pending promise
            this.pendingFaceletsPromise = null;
            this.pendingFaceletsResolver = null;
        }
        
        this.currentScramble = scramble;
        
        // Display scramble
        this.displaySequence(scramble.split(' '), []);
        
        // Start trainer with scramble sequence
        // Don't reset the cube visualization - it should always reflect the current state
        this.trainer.start(this.currentScramble, null);
        
        // Update UI
        document.getElementById('start-trainer-btn').style.display = 'none';
        document.getElementById('reset-trainer-btn').style.display = 'block';
        document.querySelector('.progress-bar').style.display = 'block';
    }
    
    resetTrainer() {
        this.trainer.reset();
        
        // Update UI
        document.getElementById('start-trainer-btn').style.display = 'block';
        document.getElementById('reset-trainer-btn').style.display = 'none';
        document.querySelector('.progress-bar').style.display = 'none';
        
        if (this.currentScramble) {
            console.log('Current scramble:', this.currentScramble);
            this.displaySequence(this.currentScramble.split(' '), []);
        } else {
            document.getElementById('sequence-display').innerHTML = 
                '<div style="color: #64748b; text-align: center; padding: 20px;">Start trainer to see moves</div>';
        }
    }
    
    updateProgress(progress, sequence) {
        // Update progress bar
        const progressFill = document.getElementById('progress-fill');
        progressFill.style.width = `${progress.percentage}%`;
        
        // Update sequence display
        this.displaySequence(
            sequence.map(s => s.move),
            sequence.map(s => s.status)
        );
    }
    
    displaySequence(moves, statuses) {
        const displayEl = document.getElementById('sequence-display');
        
        if (moves.length === 0) {
            displayEl.innerHTML = '<div style="color: #64748b; text-align: center; padding: 20px;">No moves to display</div>';
            return;
        }
        
        displayEl.innerHTML = moves.map((move, index) => {
            const status = statuses[index] || 'pending';
            return `<span class="move ${status}">${move}</span>`;
        }).join('');
    }
    
    handleTrainerComplete() {
        triggerConfetti('celebration');
    }
    
    handleTrainerError(error) {
        // Error is already handled in processMove
    }
    
    /**
     * Timer methods
     */
    startTimer() {
        // Manual start - works regardless of cube state
        const state = this.timer.getState();
        console.log('Start timer clicked. State:', state, 'cubeWasSolved:', this.cubeWasSolved, 'isConnected:', this.ganConnection?.isConnected);
        
        // Check if cube is connected
        if (!this.ganConnection || !this.ganConnection.isConnected) {
            alert('Please connect your cube first.');
            return;
        }
        
        if (state === TIMER_STATE.IDLE) {
            console.log('Starting scrambling phase...');
            this.timer.startScrambling();
            this.updateTimerUI();
        } else {
            console.log('Timer cannot start. Current state:', state);
            alert(`Timer cannot start. Current state: ${state}`);
        }
    }
    
    stopTimer() {
        this.timer.stop();
        this.updateTimerUI();
    }
    
    resetTimer() {
        this.timer.reset();
        this.updateTimerDisplay(0, false);
        this.updateTimerUI();
    }
    
    updateTimerDisplay(milliseconds, isInspection = false) {
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            if (isInspection) {
                // Show inspection countdown
                const seconds = Math.ceil(milliseconds / 1000);
                timerDisplay.textContent = seconds > 0 ? seconds.toString() : 'GO!';
                timerDisplay.style.color = seconds <= 3 ? '#f56565' : '#fcd34d';
            } else {
                // Show solve time
                timerDisplay.textContent = this.timer.formatTime(milliseconds);
                timerDisplay.style.color = '#667eea';
            }
        }
    }
    
    handleTimerStateChange(state) {
        this.updateTimerUI();
        
        // Update display based on state
        if (state === TIMER_STATE.IDLE) {
            this.updateTimerDisplay(0, false);
            this.hidePhaseDisplay();
        } else if (state === TIMER_STATE.INSPECTION) {
            // Inspection countdown will be handled by updateTimerDisplay
            this.hidePhaseDisplay();
        } else if (state === TIMER_STATE.SOLVING) {
            this.updateTimerDisplay(0, false);
            this.showPhaseDisplay();
            
            // Request facelets when solving starts to check initial phase state
            if (this.ganConnection && this.ganConnection.isConnected) {
                console.log('Solving started, requesting initial facelets for phase detection');
                setTimeout(() => {
                    if (this.timer.getState() === TIMER_STATE.SOLVING) {
                        this.ganConnection.requestFacelets();
                    }
                }, 100);
            }
        } else if (state === TIMER_STATE.COMPLETE) {
            // Keep showing the final time - it should already be set in handleSolveComplete
            // But if for some reason it's not, try to get it from currentSolve
            const currentSolve = this.timer.currentSolve;
            if (currentSolve && currentSolve.totalTime) {
                this.updateTimerDisplay(currentSolve.totalTime, false);
            }
            // Keep phase display visible to show final phase breakdown
        }
    }
    
    handlePhaseUpdate(phaseData, phaseInfo) {
        this.updatePhaseDisplay(phaseInfo);
    }
    
    showPhaseDisplay() {
        const phaseDisplay = document.getElementById('phase-display');
        if (phaseDisplay) {
            phaseDisplay.style.display = 'block';
        }
    }
    
    hidePhaseDisplay() {
        const phaseDisplay = document.getElementById('phase-display');
        if (phaseDisplay) {
            phaseDisplay.style.display = 'none';
        }
    }
    
    updatePhaseDisplay(phaseInfo) {
        if (!phaseInfo) {
            phaseInfo = this.timer.getPhaseInfo();
        }
        
        const currentPhaseName = document.getElementById('current-phase-name');
        const currentPhaseTime = document.getElementById('current-phase-time');
        const completedPhasesList = document.getElementById('completed-phases-list');
        
        if (currentPhaseName) {
            currentPhaseName.textContent = phaseInfo.currentPhase || '-';
        }
        
        if (currentPhaseTime) {
            currentPhaseTime.textContent = this.timer.formatTime(phaseInfo.phaseElapsed || 0);
        }
        
        if (completedPhasesList) {
            if (phaseInfo.completedPhases && phaseInfo.completedPhases.length > 0) {
                const currentSolve = this.timer.currentSolve;
                const phases = currentSolve?.phases || [];
                
                completedPhasesList.innerHTML = phaseInfo.completedPhases.map(phaseName => {
                    const phase = phases.find(p => p.name === phaseName);
                    if (phase) {
                        return `<div style="margin-bottom: 4px;">
                            <span style="color: #6ee7b7; font-weight: 600;">${phaseName}</span>
                            <span style="color: #94a3b8; margin-left: 8px;">${this.timer.formatTime(phase.duration)}</span>
                            <span style="color: #64748b; margin-left: 8px;">(${phase.moveCount} moves, ${phase.tps.toFixed(2)} TPS)</span>
                        </div>`;
                    } else {
                        return `<div style="margin-bottom: 4px;">
                            <span style="color: #6ee7b7; font-weight: 600;">${phaseName}</span>
                        </div>`;
                    }
                }).join('');
            } else {
                completedPhasesList.innerHTML = '<div style="color: #64748b; font-style: italic;">No phases completed yet</div>';
            }
        }
    }
    
    updateTimerUI() {
        const startBtn = document.getElementById('start-timer-btn');
        const stopBtn = document.getElementById('stop-timer-btn');
        const resetBtn = document.getElementById('reset-timer-btn');
        const timerDisplay = document.getElementById('timer-display');
        
        const state = this.timer.getState();
        
        if (state === TIMER_STATE.IDLE) {
            startBtn.style.display = 'block';
            // Don't disable the button - let user click it and we'll check state
            // This allows the button to work even if state hasn't been checked yet
            startBtn.disabled = false;
            stopBtn.style.display = 'none';
            resetBtn.style.display = 'none';
            if (timerDisplay) {
                timerDisplay.style.color = '#667eea';
            }
        } else if (state === TIMER_STATE.SCRAMBLING) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            resetBtn.style.display = 'block';
            if (timerDisplay) {
                timerDisplay.textContent = 'Scrambling...';
                timerDisplay.style.color = '#94a3b8';
            }
        } else if (state === TIMER_STATE.INSPECTION) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            resetBtn.style.display = 'block';
        } else if (state === TIMER_STATE.SOLVING) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            resetBtn.style.display = 'none';
            if (timerDisplay) {
                timerDisplay.style.color = '#667eea';
            }
        } else if (state === TIMER_STATE.COMPLETE) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'none';
            resetBtn.style.display = 'block';
            // Keep showing the solve time - it's already set in handleTimerStateChange
            if (timerDisplay) {
                timerDisplay.style.color = '#667eea';
            }
        }
    }
    
    handleSolveComplete(solve) {
        // Show notification or update UI
        console.log('Solve completed:', solve);
        
        // Celebrate with confetti!
        triggerConfetti('celebration');
        
        // Update display to show final time
        if (solve && solve.totalTime) {
            this.updateTimerDisplay(solve.totalTime, false);
        }
        
        // If history modal is open, refresh it
        const modalOverlay = document.getElementById('history-modal-overlay');
        if (modalOverlay && modalOverlay.style.display !== 'none') {
            this.showHistory();
        }
        
        // If history view is active, refresh inline history
        const historyView = document.getElementById('history-view');
        if (historyView && historyView.classList.contains('active')) {
            this.showHistoryInline();
        }
    }
    
    /**
     * History methods
     */
    showHistory() {
        const history = this.timer.getHistory();
        const historyContent = document.getElementById('history-content');
        const modalOverlay = document.getElementById('history-modal-overlay');
        
        if (history.length === 0) {
            historyContent.innerHTML = '<div class="empty-history">No solve history yet. Complete a solve to see it here!</div>';
        } else {
            historyContent.innerHTML = this.renderHistorySummary(history) + this.renderHistoryItems(history);
        }
        
        modalOverlay.style.display = 'flex';
    }
    
    showHistoryInline() {
        const history = this.timer.getHistory();
        const historyContentInline = document.getElementById('history-content-inline');
        
        if (history.length === 0) {
            historyContentInline.innerHTML = '<div class="empty-history">No solve history yet. Complete a solve to see it here!</div>';
        } else {
            historyContentInline.innerHTML = this.renderHistorySummary(history) + this.renderHistoryItems(history);
        }
    }
    
    renderHistorySummary(history) {
        if (!history || history.length === 0) {
            return '';
        }

        const ordered = [...history].reverse(); // Oldest to newest for chart
        const times = ordered.map(solve => solve.totalTime || 0);
        const bestTime = Math.min(...times);
        const worstTime = Math.max(...times);
        const averageTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        const lastFive = times.slice(-5);
        const lastFiveAvg = lastFive.reduce((sum, t) => sum + t, 0) / lastFive.length;
        const latest = times[times.length - 1];

        return `
            <div class="history-summary">
                <div class="history-summary-top">
                    <div>
                        <div class="history-summary-title">Progress overview</div>
                        <div class="history-summary-subtitle">${history.length} solve${history.length === 1 ? '' : 's'} logged</div>
                    </div>
                    <div class="history-summary-latest">
                        <div class="history-summary-label">Latest</div>
                        <div class="history-summary-value">${this.timer.formatTime(latest)}</div>
                    </div>
                </div>
                <div class="history-summary-grid">
                    <div class="history-stat-card">
                        <div class="history-summary-label">Best</div>
                        <div class="history-summary-value">${this.timer.formatTime(bestTime)}</div>
                        <div class="history-summary-hint">Solve #${times.indexOf(bestTime) + 1}</div>
                    </div>
                    <div class="history-stat-card">
                        <div class="history-summary-label">Average</div>
                        <div class="history-summary-value">${this.timer.formatTime(averageTime)}</div>
                        <div class="history-summary-hint">Across all solves</div>
                    </div>
                    <div class="history-stat-card">
                        <div class="history-summary-label">Last ${lastFive.length < 5 ? lastFive.length : 5}</div>
                        <div class="history-summary-value">${this.timer.formatTime(lastFiveAvg)}</div>
                        <div class="history-summary-hint">Recent pace</div>
                    </div>
                    <div class="history-stat-card">
                        <div class="history-summary-label">Slowest</div>
                        <div class="history-summary-value">${this.timer.formatTime(worstTime)}</div>
                        <div class="history-summary-hint">Room to improve</div>
                    </div>
                </div>
                ${this.renderHistoryTrend(times)}
            </div>
        `;
    }

    renderHistoryTrend(times) {
        if (!times || times.length === 0) {
            return '';
        }

        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const range = Math.max(maxTime - minTime, 1);
        const padding = 14;
        const height = 140;
        const width = Math.max(240, (times.length - 1) * 26 + padding * 2);
        const gradientId = `history-gradient-${Math.random().toString(36).slice(2, 8)}`;

        const points = times.map((time, idx) => {
            const ratio = times.length === 1 ? 0.5 : idx / (times.length - 1);
            const x = padding + ratio * (width - padding * 2);
            const y = padding + (1 - ((time - minTime) / range)) * (height - padding * 2);
            return { x, y, time };
        });

        const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
        const areaPath = [
            `M${points[0].x.toFixed(2)},${height - padding}`,
            ...points.map(p => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`),
            `L${points[points.length - 1].x.toFixed(2)},${height - padding}`,
            'Z'
        ].join(' ');

        const bestPoint = points.reduce((best, p) => p.time < best.time ? p : best, points[0]);
        const lastPoint = points[points.length - 1];

        return `
            <div class="history-trend">
                <div class="history-trend-header">
                    <div class="history-summary-label">Time trend</div>
                    <div class="history-trend-legend">
                        <span class="legend-dot best"></span>Best
                        <span class="legend-dot latest"></span>Latest
                    </div>
                </div>
                <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="history-trend-chart">
                    <defs>
                        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#667eea" stop-opacity="0.4" />
                            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.1" />
                        </linearGradient>
                    </defs>
                    <path d="${areaPath}" class="history-trend-area" fill="url(#${gradientId})"></path>
                    <path d="${linePath}" class="history-trend-line"></path>
                    <circle cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="4" class="history-trend-point latest"></circle>
                    <circle cx="${bestPoint.x.toFixed(2)}" cy="${bestPoint.y.toFixed(2)}" r="4" class="history-trend-point best"></circle>
                </svg>
                <div class="history-trend-footer">
                    <span>Oldest</span>
                    <span>Newest</span>
                </div>
            </div>
        `;
    }

    renderHistoryItems(history) {
        return history.map((solve, index) => {
                const movesHtml = solve.moves.map((move, moveIndex) => {
                    const moveTime = this.timer.formatTime(move.timeSinceLastMove);
                    return `<span class="move-item">${move.move}<span class="move-item-time">+${moveTime}</span></span>`;
                }).join('');
                
                // Generate phase breakdown HTML
                let phasesHtml = '';
                if (solve.phases && solve.phases.length > 0) {
                    const phasesList = solve.phases.map(phase => {
                        return `<div style="margin-bottom: 6px; padding: 6px; background: #0f172a; border-radius: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="color: #6ee7b7; font-weight: 600;">${phase.name}</span>
                                <span style="color: #e2e8f0; font-family: 'Courier New', monospace;">${this.timer.formatTime(phase.duration)}</span>
                            </div>
                            <div style="font-size: 0.85em; color: #94a3b8;">
                                ${phase.moveCount} moves • ${phase.tps.toFixed(2)} TPS
                            </div>
                        </div>`;
                    }).join('');
                    
                    phasesHtml = `
                        <div class="history-item-moves">
                            <div class="history-item-moves-title" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('expanded')">
                                <span>▶</span> View Phases (${solve.phases.length})
                            </div>
                            <div class="history-item-moves-list">
                                ${phasesList}
                            </div>
                        </div>
                    `;
                }
                
                return `
                    <div class="history-item">
                        <div class="history-item-header">
                            <div class="history-item-time">${this.timer.formatTime(solve.totalTime)}</div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="history-item-date">${this.timer.formatDate(solve.date)}</div>
                                <button class="btn-delete-solve" onclick="app.deleteSolveFromHistory(${index})" title="Delete solve">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="history-item-stats">
                            <span>Moves: ${solve.moveCount}</span>
                            <span>Avg: ${solve.moveCount > 0 ? this.timer.formatTime(solve.totalTime / solve.moveCount) : '0.00'}</span>
                            ${solve.solveMethod ? `<span>Method: ${solve.solveMethod}</span>` : ''}
                            ${solve.crossFace ? `<span>Cross: ${this.faceToColor(solve.crossFace)}</span>` : ''}
                        </div>
                        ${phasesHtml}
                        ${solve.moves.length > 0 ? `
                            <div class="history-item-moves">
                                <div class="history-item-moves-title" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('expanded')">
                                    <span>▶</span> View Moves (${solve.moves.length})
                                </div>
                                <div class="history-item-moves-list">
                                    ${movesHtml}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
        }).join('');
    }
    
    deleteSolveFromHistory(index) {
        const history = this.timer.getHistory();
        if (index >= 0 && index < history.length) {
            const solve = history[index];
            const time = this.timer.formatTime(solve.totalTime);
            const date = this.timer.formatDate(solve.date);
            
            if (confirm(`Are you sure you want to delete this solve?\n\nTime: ${time}\nDate: ${date}\n\nThis cannot be undone.`)) {
                if (this.timer.deleteSolve(index)) {
                    // Refresh history views
                    this.showHistory();
                    this.showHistoryInline();
                } else {
                    alert('Failed to delete solve.');
                }
            }
        }
    }
    
    closeHistoryModal() {
        const modalOverlay = document.getElementById('history-modal-overlay');
        modalOverlay.style.display = 'none';
    }
    
    clearHistory() {
        if (confirm('Are you sure you want to clear all solve history? This cannot be undone.')) {
            if (this.timer.clearHistory()) {
                alert('History cleared successfully.');
                this.closeHistoryModal();
                // Refresh inline history if history view is active
                const historyView = document.getElementById('history-view');
                if (historyView && historyView.classList.contains('active')) {
                    this.showHistoryInline();
                }
            } else {
                alert('Failed to clear history.');
            }
        }
    }
    
    /**
     * Reset cube to default state
     * Asks user to confirm that cube is currently solved before proceeding
     */
    async resetCube() {
        // Check if cube is connected
        if (!this.ganConnection || !this.ganConnection.isConnected) {
            alert('Please connect your cube first.');
            return;
        }
        
        // Show confirmation dialog asking user to confirm cube is solved
        const confirmed = confirm(
            'Please make sure your cube is currently in a solved state.\n\n' +
            'Are you sure you want to reset the cube to its default state?\n\n' +
            'This action cannot be undone.'
        );
        
        if (!confirmed) {
            return;
        }
        
        // Send reset command
        try {
            await this.ganConnection.resetCube();
            alert('Cube reset successfully.');
            
            // Request facelets to update visualization
            await this.ganConnection.requestFacelets();
        } catch (error) {
            console.error('Error resetting cube:', error);
            alert(`Failed to reset cube: ${error.message}`);
        }
    }
}

// Initialize app when DOM is ready
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new CubePracticeApp();
        window.app = app; // Make app globally accessible for delete buttons
    });
} else {
    app = new CubePracticeApp();
    window.app = app; // Make app globally accessible for delete buttons
}
