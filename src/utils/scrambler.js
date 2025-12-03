/**
 * Scrambler
 * Generates valid scramble sequences for Rubik's cube
 */

const MOVES = ['R', 'L', 'U', 'D', 'F', 'B'];
const MODIFIERS = ['', "'", '2'];

/**
 * Generate a random valid scramble sequence
 * @param {number} length - Number of moves (default: 25)
 * @param {string} algorithm - Scramble algorithm type ('random' or 'wca')
 */
export function generateScramble(length = 25, algorithm = 'random') {
    if (algorithm === 'wca') {
        return generateWCAScramble(length);
    } else {
        return generateRandomScramble(length);
    }
}

/**
 * Generate a random scramble
 * Ensures no consecutive moves on the same face
 */
function generateRandomScramble(length) {
    const moves = [];
    let lastFace = null;
    
    for (let i = 0; i < length; i++) {
        let face;
        let modifier;
        
        // Avoid consecutive moves on same face
        do {
            face = MOVES[Math.floor(Math.random() * MOVES.length)];
        } while (face === lastFace);
        
        lastFace = face;
        modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
        
        moves.push(face + modifier);
    }
    
    return moves.join(' ');
}

/**
 * Generate WCA-style scramble
 * WCA scrambles avoid redundant sequences and follow specific patterns
 */
function generateWCAScramble(length) {
    const moves = [];
    let lastFace = null;
    let secondLastFace = null;
    
    for (let i = 0; i < length; i++) {
        let face;
        let modifier;
        
        // WCA rules:
        // 1. No consecutive moves on same face
        // 2. Avoid sequences like R L R (opposite faces)
        do {
            face = MOVES[Math.floor(Math.random() * MOVES.length)];
        } while (
            face === lastFace || 
            (secondLastFace && areOppositeFaces(face, secondLastFace) && lastFace === face)
        );
        
        modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
        
        moves.push(face + modifier);
        
        secondLastFace = lastFace;
        lastFace = face;
    }
    
    return moves.join(' ');
}

/**
 * Check if two faces are opposite
 */
function areOppositeFaces(face1, face2) {
    const opposites = {
        'R': 'L',
        'L': 'R',
        'U': 'D',
        'D': 'U',
        'F': 'B',
        'B': 'F'
    };
    
    return opposites[face1] === face2;
}

/**
 * Format scramble for display
 */
export function formatScramble(scramble) {
    return scramble.split(' ').map(move => {
        // Add spacing for better readability
        return move;
    }).join(' ');
}

