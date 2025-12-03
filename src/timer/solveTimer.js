/**
 * Solve Timer
 * Tracks solve times, records moves with timestamps, and manages solve history
 */

import { detectCFOPPhases } from '../cube/phaseDetector.js';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
const STORAGE_KEY = 'cube-solve-history';
const INSPECTION_TIME = 3000; // 15 seconds in milliseconds
const MOVE_STOP_DELAY = 2000; // 2 seconds of no moves before starting inspection

// CFOP phase order
const CFOP_PHASES = ['Cross', 'F2L-1', 'F2L-2', 'F2L-3', 'F2L-4', 'OLL', 'PLL'];

// Timer states
export const TIMER_STATE = {
    IDLE: 'idle',
    SCRAMBLING: 'scrambling',
    INSPECTION: 'inspection',
    SOLVING: 'solving',
    COMPLETE: 'complete'
};

export class SolveTimer {
    constructor() {
        this.state = TIMER_STATE.IDLE;
        this.startTime = null;
        this.inspectionStartTime = null;
        this.currentSolve = null;
        this.moves = [];
        this.onSolveCompleteCallback = null;
        this.onTimeUpdateCallback = null;
        this.onStateChangeCallback = null;
        this.onPhaseUpdateCallback = null;
        this.updateInterval = null;
        this.inspectionInterval = null;
        this.moveStopTimeout = null;
        this.lastMoveTime = null;
        this.currentPhase = null;
        this.completedPhases = new Set();
        this.phaseStartTimes = new Map();
        this.solveMethod = 'CFOP';
        this.crossFace = 'D';
    }

    /**
     * Start scrambling phase (when cube is solved and user starts moving)
     */
    startScrambling() {
        if (this.state !== TIMER_STATE.IDLE) {
            return; // Already in a phase
        }

        this.state = TIMER_STATE.SCRAMBLING;
        this.lastMoveTime = Date.now();
        this.currentSolve = {
            date: new Date().toISOString(),
            scrambleStartTime: Date.now(),
            moves: [],
            totalTime: 0
        };
        this.notifyStateChange();
    }

    /**
     * Handle a move during scrambling - resets the move stop timer
     */
    handleScrambleMove() {
        if (this.state === TIMER_STATE.SCRAMBLING) {
            this.lastMoveTime = Date.now();
            
            // Clear existing timeout
            if (this.moveStopTimeout) {
                clearTimeout(this.moveStopTimeout);
            }
            
            // Set new timeout to start inspection after moves stop
            this.moveStopTimeout = setTimeout(() => {
                this.startInspection();
            }, MOVE_STOP_DELAY);
        }
    }

    /**
     * Start inspection phase (15 seconds)
     */
    startInspection() {
        if (this.state !== TIMER_STATE.SCRAMBLING) {
            return;
        }

        this.state = TIMER_STATE.INSPECTION;
        this.inspectionStartTime = Date.now();
        this.notifyStateChange();

        // Start inspection countdown
        this.inspectionInterval = setInterval(() => {
            const elapsed = Date.now() - this.inspectionStartTime;
            const remaining = INSPECTION_TIME - elapsed;
            
            if (remaining <= 0) {
                this.startSolving();
            } else if (this.onTimeUpdateCallback) {
                // Show countdown during inspection
                this.onTimeUpdateCallback(remaining, true);
            }
        }, 10);
    }

    /**
     * Start solving phase (after inspection)
     */
    startSolving() {
        if (this.state !== TIMER_STATE.INSPECTION) {
            return;
        }

        this.state = TIMER_STATE.SOLVING;
        this.startTime = Date.now();
        this.moves = [];
        this.currentPhase = null;
        this.completedPhases = new Set();
        this.phaseStartTimes = new Map();
        
        // Initialize phases array in currentSolve
        if (this.currentSolve) {
            this.currentSolve.phases = [];
        }
        
        // Set initial phase (before Cross)
        this.currentPhase = 'Pre-Cross';
        this.phaseStartTimes.set('Pre-Cross', this.startTime);
        
        this.notifyStateChange();

        // Clear inspection interval
        if (this.inspectionInterval) {
            clearInterval(this.inspectionInterval);
            this.inspectionInterval = null;
        }

        // Start solve timer update interval
        this.updateInterval = setInterval(() => {
            if (this.state === TIMER_STATE.SOLVING) {
                if (this.onTimeUpdateCallback) {
                    const elapsed = Date.now() - this.startTime;
                    this.onTimeUpdateCallback(elapsed, false);
                }
                // Also update phase display periodically
                if (this.onPhaseUpdateCallback) {
                    this.onPhaseUpdateCallback(null, this.getPhaseInfo());
                }
            }
        }, 10); // Update every 10ms for smooth display
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Check if timer is running (in solving phase)
     */
    get isRunning() {
        return this.state === TIMER_STATE.SOLVING;
    }

    /**
     * Record a move with timestamp (only during solving phase)
     */
    recordMove(move) {
        // Only record moves during solving phase
        if (this.state !== TIMER_STATE.SOLVING) {
            return;
        }

        const timestamp = Date.now();
        const timeSinceStart = timestamp - this.startTime;
        
        const moveRecord = {
            move: move,
            timestamp: timestamp,
            timeSinceStart: timeSinceStart,
            timeSinceLastMove: this.moves.length > 0 
                ? timestamp - this.moves[this.moves.length - 1].timestamp 
                : timeSinceStart
        };

        this.moves.push(moveRecord);
        if (this.currentSolve) {
            this.currentSolve.moves.push(moveRecord);
        }
    }
    
    /**
     * Check phase completion using facelets
     * Should be called after receiving facelets from the cube
     */
    async checkPhaseCompletion(facelets) {
        if (this.state !== TIMER_STATE.SOLVING || !this.currentSolve) {
            return;
        }
        
        try {
            // Detect completed phases
            const completed = await detectCFOPPhases(facelets, this.crossFace);
            
            // Check for new phase completions
            for (const phaseName of completed) {
                if (!this.completedPhases.has(phaseName)) {
                    // Phase just completed
                    this.completePhase(phaseName);
                }
            }
            
            // Update current phase (next uncompleted phase)
            this.updateCurrentPhase();
            
        } catch (error) {
            console.error('Error checking phase completion:', error);
        }
    }
    
    /**
     * Complete a phase and record its data
     */
    completePhase(phaseName) {
        const now = Date.now();
        // Get the start time for this specific phase
        const phaseStartTime = this.phaseStartTimes.get(phaseName) || this.startTime;
        const phaseDuration = now - phaseStartTime;
        
        // Find moves that occurred during this phase
        const phaseMoves = this.moves.filter(move => {
            return move.timestamp >= phaseStartTime && move.timestamp <= now;
        });
        
        const moveCount = phaseMoves.length;
        const tps = phaseDuration > 0 ? (moveCount / (phaseDuration / 1000)) : 0;
        
        // Record phase data
        const phaseData = {
            name: phaseName,
            startTime: phaseStartTime,
            endTime: now,
            duration: phaseDuration,
            moves: phaseMoves.map(m => m.move),
            moveCount: moveCount,
            tps: tps
        };
        
        if (this.currentSolve) {
            this.currentSolve.phases = this.currentSolve.phases || [];
            this.currentSolve.phases.push(phaseData);
        }
        
        this.completedPhases.add(phaseName);
        this.phaseStartTimes.set(phaseName, phaseStartTime);
        
        // Set start time for next phase (if not already set)
        const nextPhaseIndex = CFOP_PHASES.indexOf(phaseName) + 1;
        if (nextPhaseIndex < CFOP_PHASES.length) {
            const nextPhase = CFOP_PHASES[nextPhaseIndex];
            if (!this.phaseStartTimes.has(nextPhase)) {
                this.phaseStartTimes.set(nextPhase, now);
            }
        }
        
        // Notify phase update
        if (this.onPhaseUpdateCallback) {
            this.onPhaseUpdateCallback(phaseData, this.getPhaseInfo());
        }
    }
    
    /**
     * Update current phase based on completed phases
     */
    updateCurrentPhase() {
        // Find the next uncompleted phase
        for (const phase of CFOP_PHASES) {
            if (!this.completedPhases.has(phase)) {
                if (this.currentPhase !== phase) {
                    // Phase transition - record when we enter this phase
                    const now = Date.now();
                    const previousPhase = this.currentPhase;
                    this.currentPhase = phase;
                    
                    // Set start time for this phase (use previous phase end time if available, otherwise now)
                    if (!this.phaseStartTimes.has(phase)) {
                        // If we have a previous phase that was completed, use its end time
                        // Otherwise use the solve start time or now
                        const previousPhaseEnd = previousPhase && this.currentSolve?.phases?.find(p => p.name === previousPhase)?.endTime;
                        this.phaseStartTimes.set(phase, previousPhaseEnd || this.startTime || now);
                    }
                    
                    // Notify phase update
                    if (this.onPhaseUpdateCallback) {
                        this.onPhaseUpdateCallback(null, this.getPhaseInfo());
                    }
                }
                return;
            }
        }
        
        // All phases complete, should be solved
        this.currentPhase = 'Complete';
    }
    
    /**
     * Get current phase information
     */
    getPhaseInfo() {
        const now = Date.now();
        const phaseStartTime = this.phaseStartTimes.get(this.currentPhase) || this.startTime;
        const phaseElapsed = now - phaseStartTime;
        
        return {
            currentPhase: this.currentPhase,
            completedPhases: Array.from(this.completedPhases),
            phaseElapsed: phaseElapsed,
            phaseStartTime: phaseStartTime
        };
    }
    
    /**
     * Set solve method and cross face
     */
    setSolveMethod(method, crossFace) {
        this.solveMethod = method || 'CFOP';
        this.crossFace = crossFace || 'D';
    }

    /**
     * Complete the solve (cube is solved) - save the solve
     */
    completeSolve() {
        if (this.state !== TIMER_STATE.SOLVING) {
            return;
        }

        this.state = TIMER_STATE.COMPLETE;
        const endTime = Date.now();
        const totalTime = endTime - this.startTime;

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.currentSolve) {
            // Finalize any remaining phase
            if (this.currentPhase && !this.completedPhases.has('PLL')) {
                // Check if PLL should be marked complete
                if (this.completedPhases.has('OLL')) {
                    this.completePhase('PLL');
                }
            }
            
            this.currentSolve.endTime = endTime;
            this.currentSolve.totalTime = totalTime;
            this.currentSolve.moveCount = this.moves.length;
            this.currentSolve.solveStartTime = this.startTime;
            this.currentSolve.solveMethod = this.solveMethod;
            this.currentSolve.crossFace = this.crossFace;

            // Save to localStorage
            this.saveSolve(this.currentSolve);

            // Notify callback
            if (this.onSolveCompleteCallback) {
                this.onSolveCompleteCallback(this.currentSolve);
            }
        }

        this.notifyStateChange();
        
        // Don't automatically reset - wait for a move to start next scramble
    }

    /**
     * Stop the timer without saving (manual stop)
     */
    stop() {
        if (this.state === TIMER_STATE.IDLE || this.state === TIMER_STATE.COMPLETE) {
            return;
        }

        // Clear all intervals and timeouts
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.inspectionInterval) {
            clearInterval(this.inspectionInterval);
            this.inspectionInterval = null;
        }
        if (this.moveStopTimeout) {
            clearTimeout(this.moveStopTimeout);
            this.moveStopTimeout = null;
        }

        this.reset();
    }

    /**
     * Reset the timer without saving
     */
    reset() {
        this.state = TIMER_STATE.IDLE;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.inspectionInterval) {
            clearInterval(this.inspectionInterval);
            this.inspectionInterval = null;
        }
        if (this.moveStopTimeout) {
            clearTimeout(this.moveStopTimeout);
            this.moveStopTimeout = null;
        }
        this.currentSolve = null;
        this.moves = [];
        this.startTime = null;
        this.inspectionStartTime = null;
        this.lastMoveTime = null;
        this.currentPhase = null;
        this.completedPhases = new Set();
        this.phaseStartTimes = new Map();
        this.notifyStateChange();
    }

    /**
     * Get current elapsed time
     */
    getElapsedTime() {
        if (this.state === TIMER_STATE.SOLVING && this.startTime) {
            return Date.now() - this.startTime;
        }
        if (this.state === TIMER_STATE.INSPECTION && this.inspectionStartTime) {
            return INSPECTION_TIME - (Date.now() - this.inspectionStartTime);
        }
        return 0;
    }

    /**
     * Check if cube is in solved state
     */
    isSolved(facelets) {
        return facelets === SOLVED_STATE;
    }

    /**
     * Save solve to localStorage
     */
    saveSolve(solve) {
        try {
            const history = this.getHistory();
            history.unshift(solve); // Add to beginning
            
            // Keep only last 1000 solves to prevent storage issues
            if (history.length > 1000) {
                history.splice(1000);
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (error) {
            console.error('Failed to save solve:', error);
        }
    }

    /**
     * Get solve history from localStorage
     */
    getHistory() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load solve history:', error);
        }
        return [];
    }

    /**
     * Clear all solve history
     */
    clearHistory() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Failed to clear history:', error);
            return false;
        }
    }

    /**
     * Delete a specific solve by index
     */
    deleteSolve(index) {
        try {
            const history = this.getHistory();
            if (index >= 0 && index < history.length) {
                history.splice(index, 1);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                return true;
            }
        } catch (error) {
            console.error('Failed to delete solve:', error);
        }
        return false;
    }

    /**
     * Format time in MM:SS.mmm format
     */
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10); // Show centiseconds
        
        if (minutes > 0) {
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        } else {
            return `${seconds}.${ms.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const solveDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        if (solveDate.getTime() === today.getTime()) {
            return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (solveDate.getTime() === yesterday.getTime()) {
            return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Set callback for solve completion
     */
    onSolveComplete(callback) {
        this.onSolveCompleteCallback = callback;
    }

    /**
     * Set callback for time updates
     */
    onTimeUpdate(callback) {
        this.onTimeUpdateCallback = callback;
    }

    /**
     * Set callback for state changes
     */
    onStateChange(callback) {
        this.onStateChangeCallback = callback;
    }
    
    /**
     * Set callback for phase updates
     */
    onPhaseUpdate(callback) {
        this.onPhaseUpdateCallback = callback;
    }

    /**
     * Notify state change
     */
    notifyStateChange() {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback(this.state);
        }
    }
}

