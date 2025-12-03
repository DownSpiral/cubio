/**
 * Notation Trainer
 * Tracks move sequences and detects correct/incorrect moves
 */

import { parseNotation, getInverseMove, applySequence, formatMove } from '../cube/cubeNotation.js';
import { createSolvedCube, compareCubes } from '../cube/cubeState.js';

export class NotationTrainer {
    constructor() {
        this.sequence = [];
        this.currentIndex = 0;
        this.expectedCubeState = null;
        this.isActive = false;
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        this.onErrorCallback = null;
        this.pendingHalfMove = null; // Track when we're in the middle of a double move
    }
    
    /**
     * Start training with a sequence
     */
    start(sequenceString, initialCubeState = null) {
        this.sequence = parseNotation(sequenceString);
        this.currentIndex = 0;
        this.isActive = true;
        
        // Calculate expected cube state after each move
        const baseState = initialCubeState || createSolvedCube();
        this.expectedCubeState = this.calculateExpectedStates(baseState);
        
        this.notifyProgress();
    }
    
    /**
     * Calculate expected cube state after each move in sequence
     */
    calculateExpectedStates(baseState) {
        const states = [baseState];
        let currentState = baseState;
        
        for (let i = 0; i < this.sequence.length; i++) {
            const move = this.sequence[i];
            const moveStr = formatMove(move);
            currentState = applySequence(currentState, moveStr);
            states.push(currentState);
        }
        
        return states;
    }
    
    /**
     * Process a move from the cube
     */
    processMove(moveNotation) {
        if (!this.isActive) {
            return { success: false, message: 'Trainer not active' };
        }
        
        if (this.currentIndex >= this.sequence.length) {
            return { success: false, message: 'Sequence already completed' };
        }
        
        const expectedMove = this.sequence[this.currentIndex];
        const expectedMoveStr = formatMove(expectedMove);
        
        // Normalize move notation for comparison
        const normalizedMove = this.normalizeMove(moveNotation);
        const normalizedExpected = this.normalizeMove(expectedMoveStr);
        
        // Check if we're in a half-state (waiting for second part of double move)
        if (this.pendingHalfMove) {
            return this.handleHalfMoveCompletion(moveNotation, normalizedMove);
        }
        
        // Check if expected move is a double move and performed move is the first half
        if (expectedMove.double) {
            const expectedBase = expectedMove.move.toUpperCase();
            const performedBase = this.getMoveBase(normalizedMove);
            
            // Check if this is the first half of the expected double move
            // The performed move must match the base (L, R, U, etc.) but not be a double move itself
            if (performedBase === expectedBase && !this.isDoubleMove(normalizedMove)) {
                // This is the first half - store it and wait for the second half
                this.pendingHalfMove = {
                    firstMove: normalizedMove,
                    expectedMove: normalizedExpected,
                    expectedMoveObj: expectedMove
                };
                
                // Return a pending state (don't mark as correct or incorrect yet)
                return {
                    success: true,
                    correct: true,
                    move: moveNotation,
                    expectedMove: expectedMoveStr,
                    progress: this.getProgress(),
                    isComplete: false,
                    isHalfMove: true
                };
            }
        }
        
        if (normalizedMove === normalizedExpected) {
            // Correct move
            this.currentIndex++;
            const result = {
                success: true,
                correct: true,
                move: moveNotation,
                expectedMove: expectedMoveStr,
                progress: this.getProgress(),
                isComplete: this.currentIndex >= this.sequence.length
            };
            
            this.notifyProgress();
            
            if (result.isComplete && this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            
            return result;
        } else {
            // Incorrect move - calculate inverse
            const inverseMove = getInverseMove(moveNotation);
            const correction = {
                success: false,
                correct: false,
                move: moveNotation,
                expectedMove: expectedMoveStr,
                inverseMove: inverseMove,
                progress: this.getProgress()
            };
            
            // Insert inverse move into sequence to correct state
            this.insertCorrection(inverseMove);
            
            if (this.onErrorCallback) {
                this.onErrorCallback(correction);
            }
            
            this.notifyProgress();
            
            return correction;
        }
    }
    
    /**
     * Handle completion of a half move (second part of double move)
     */
    handleHalfMoveCompletion(moveNotation, normalizedMove) {
        const { firstMove, expectedMove, expectedMoveObj } = this.pendingHalfMove;
        this.pendingHalfMove = null; // Clear pending state
        
        const performedBase = this.getMoveBase(normalizedMove);
        const firstBase = this.getMoveBase(firstMove);
        const expectedBase = expectedMoveObj.move.toUpperCase();
        
        // Check if this is the second half of the double move
        // Both moves must have the same base (L, R, U, etc.)
        // The direction (prime or not) should match for consistency
        if (performedBase === expectedBase && performedBase === firstBase) {
            // Both moves match the expected base - this is a correct double move
            // The direction of both moves should be the same (both prime or both not prime)
            const firstIsPrime = this.isPrimeMove(firstMove);
            const secondIsPrime = this.isPrimeMove(normalizedMove);
            
            // For a double move, both halves should be in the same direction
            // If they match, this is a valid L2 (or similar)
            if (firstIsPrime === secondIsPrime) {
                // Both moves match - this is a correct L2 (or similar)
                // Combine the two moves to form the double move
                const combinedMove = `${performedBase}2`;
                
                this.currentIndex++;
                const result = {
                    success: true,
                    correct: true,
                    move: combinedMove,
                    expectedMove: expectedMove,
                    progress: this.getProgress(),
                    isComplete: this.currentIndex >= this.sequence.length
                };
                
                this.notifyProgress();
                
                if (result.isComplete && this.onCompleteCallback) {
                    this.onCompleteCallback();
                }
                
                return result;
            }
        }
        
        // The second move doesn't match - treat first move as incorrect
        // Insert inverse of first move
        const firstInverse = getInverseMove(firstMove);
        this.insertCorrection(firstInverse);
        
        // Now process the second move normally
        const currentExpectedMove = this.sequence[this.currentIndex];
        const expectedMoveStr = formatMove(currentExpectedMove);
        const normalizedExpected = this.normalizeMove(expectedMoveStr);
        
        if (normalizedMove === normalizedExpected) {
            // Second move is correct
            this.currentIndex++;
            const result = {
                success: true,
                correct: true,
                move: moveNotation,
                expectedMove: expectedMoveStr,
                progress: this.getProgress(),
                isComplete: this.currentIndex >= this.sequence.length
            };
            
            this.notifyProgress();
            
            if (result.isComplete && this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            
            return result;
        } else {
            // Second move is also incorrect
            const inverseMove = getInverseMove(moveNotation);
            this.insertCorrection(inverseMove);
            
            const correction = {
                success: false,
                correct: false,
                move: moveNotation,
                expectedMove: expectedMoveStr,
                inverseMove: inverseMove,
                progress: this.getProgress()
            };
            
            if (this.onErrorCallback) {
                this.onErrorCallback(correction);
            }
            
            this.notifyProgress();
            
            return correction;
        }
    }
    
    /**
     * Check if a move has prime notation
     */
    isPrimeMove(move) {
        const normalized = move.trim().toUpperCase();
        return normalized.includes("'");
    }
    
    /**
     * Get the base move (without prime or double notation)
     */
    getMoveBase(move) {
        let base = move.trim().toUpperCase();
        // Remove prime notation
        base = base.replace(/[''`]/g, '');
        // Remove double notation
        base = base.replace(/2$/, '');
        return base;
    }
    
    /**
     * Check if a move is a double move
     */
    isDoubleMove(move) {
        const normalized = move.trim().toUpperCase();
        return normalized.endsWith('2');
    }
    
    /**
     * Insert correction move (inverse) into sequence
     */
    insertCorrection(inverseMove) {
        // Insert the inverse move right after current position
        // This will undo the incorrect move
        const inverseParsed = parseNotation(inverseMove);
        this.sequence.splice(this.currentIndex, 0, ...inverseParsed);
        
        // Recalculate expected states
        const baseState = this.expectedCubeState[0];
        this.expectedCubeState = this.calculateExpectedStates(baseState);
    }
    
    /**
     * Normalize move notation for comparison
     */
    normalizeMove(move) {
        // Remove whitespace and convert to uppercase
        let normalized = move.trim().toUpperCase();
        
        // Handle prime notation variations
        normalized = normalized.replace(/[''`]/g, "'");
        
        return normalized;
    }
    
    /**
     * Get current progress
     */
    getProgress() {
        if (this.sequence.length === 0) {
            return { current: 0, total: 0, percentage: 0 };
        }
        
        return {
            current: this.currentIndex,
            total: this.sequence.length,
            percentage: (this.currentIndex / this.sequence.length) * 100
        };
    }
    
    /**
     * Get sequence with status for each move
     */
    getSequenceWithStatus() {
        return this.sequence.map((move, index) => {
            let status = 'pending';
            if (index < this.currentIndex) {
                status = 'completed';
            } else if (index === this.currentIndex) {
                status = 'current';
            }
            
            return {
                move: formatMove(move),
                status: status,
                index: index
            };
        });
    }
    
    /**
     * Reset trainer
     */
    reset() {
        this.sequence = [];
        this.currentIndex = 0;
        this.isActive = false;
        this.expectedCubeState = null;
        this.pendingHalfMove = null;
        this.notifyProgress();
    }
    
    /**
     * Notify progress callback
     */
    notifyProgress() {
        if (this.onProgressCallback) {
            this.onProgressCallback(this.getProgress(), this.getSequenceWithStatus());
        }
    }
    
    /**
     * Set progress callback
     */
    onProgress(callback) {
        this.onProgressCallback = callback;
    }
    
    /**
     * Set complete callback
     */
    onComplete(callback) {
        this.onCompleteCallback = callback;
    }
    
    /**
     * Set error callback
     */
    onError(callback) {
        this.onErrorCallback = callback;
    }
}

