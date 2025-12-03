/**
 * Cube Notation Parser and Move Application
 * Handles standard Rubik's cube notation and applies moves to cube state
 */

import { 
    copyCube, 
    rotateFaceClockwise, 
    rotateFaceCounterClockwise,
    FACES 
} from './cubeState.js';

/**
 * Parse a notation string into individual moves
 * Handles: R, R', U, U', F, F', L, L', D, D', B, B', M, E, S, x, y, z
 */
export function parseNotation(notation) {
    const moves = [];
    const tokens = notation.trim().split(/\s+/);
    
    for (const token of tokens) {
        if (!token) continue;
        
        // Handle prime notation (')
        if (token.endsWith("'")) {
            const base = token.slice(0, -1);
            moves.push({ move: base, prime: true });
        } 
        // Handle 2 notation (double move)
        else if (token.endsWith('2')) {
            const base = token.slice(0, -1);
            moves.push({ move: base, double: true });
        }
        // Regular move
        else {
            moves.push({ move: token, prime: false });
        }
    }
    
    return moves;
}

/**
 * Apply a single move to the cube
 */
export function applyMove(cube, moveNotation) {
    const parsed = parseNotation(moveNotation);
    if (parsed.length !== 1) {
        throw new Error(`Expected single move, got: ${moveNotation}`);
    }
    
    const move = parsed[0];
    const newCube = copyCube(cube);
    
    if (move.double) {
        // Apply move twice
        applySingleMove(newCube, move.move, false);
        applySingleMove(newCube, move.move, false);
    } else {
        applySingleMove(newCube, move.move, move.prime);
    }
    
    return newCube;
}

/**
 * Apply a sequence of moves
 */
export function applySequence(cube, sequence) {
    const moves = parseNotation(sequence);
    let currentCube = copyCube(cube);
    
    for (const move of moves) {
        if (move.double) {
            applySingleMove(currentCube, move.move, false);
            applySingleMove(currentCube, move.move, false);
        } else {
            applySingleMove(currentCube, move.move, move.prime);
        }
    }
    
    return currentCube;
}

/**
 * Apply a single move (internal function)
 */
function applySingleMove(cube, move, prime) {
    switch (move.toUpperCase()) {
        case 'R':
            moveR(cube, prime);
            break;
        case 'L':
            moveL(cube, prime);
            break;
        case 'U':
            moveU(cube, prime);
            break;
        case 'D':
            moveD(cube, prime);
            break;
        case 'F':
            moveF(cube, prime);
            break;
        case 'B':
            moveB(cube, prime);
            break;
        case 'M':
            moveM(cube, prime);
            break;
        case 'E':
            moveE(cube, prime);
            break;
        case 'S':
            moveS(cube, prime);
            break;
        case 'X':
            rotateX(cube, prime);
            break;
        case 'Y':
            rotateY(cube, prime);
            break;
        case 'Z':
            rotateZ(cube, prime);
            break;
        default:
            console.warn(`Unknown move: ${move}`);
    }
}

/**
 * R move - Right face clockwise
 */
function moveR(cube, prime) {
    const face = FACES.RIGHT;
    cube[face] = prime ? rotateFaceCounterClockwise(cube[face]) : rotateFaceClockwise(cube[face]);
    
    // Rotate adjacent edges
    const temp = [
        cube[FACES.UP][2], cube[FACES.UP][5], cube[FACES.UP][8],
        cube[FACES.FRONT][2], cube[FACES.FRONT][5], cube[FACES.FRONT][8],
        cube[FACES.DOWN][2], cube[FACES.DOWN][5], cube[FACES.DOWN][8],
        cube[FACES.BACK][0], cube[FACES.BACK][3], cube[FACES.BACK][6]
    ];
    
    if (prime) {
        // Counter-clockwise
        cube[FACES.UP][2] = temp[3];
        cube[FACES.UP][5] = temp[4];
        cube[FACES.UP][8] = temp[5];
        cube[FACES.FRONT][2] = temp[6];
        cube[FACES.FRONT][5] = temp[7];
        cube[FACES.FRONT][8] = temp[8];
        cube[FACES.DOWN][2] = temp[9];
        cube[FACES.DOWN][5] = temp[10];
        cube[FACES.DOWN][8] = temp[11];
        cube[FACES.BACK][0] = temp[0];
        cube[FACES.BACK][3] = temp[1];
        cube[FACES.BACK][6] = temp[2];
    } else {
        // Clockwise
        cube[FACES.UP][2] = temp[9];
        cube[FACES.UP][5] = temp[10];
        cube[FACES.UP][8] = temp[11];
        cube[FACES.FRONT][2] = temp[0];
        cube[FACES.FRONT][5] = temp[1];
        cube[FACES.FRONT][8] = temp[2];
        cube[FACES.DOWN][2] = temp[3];
        cube[FACES.DOWN][5] = temp[4];
        cube[FACES.DOWN][8] = temp[5];
        cube[FACES.BACK][0] = temp[6];
        cube[FACES.BACK][3] = temp[7];
        cube[FACES.BACK][6] = temp[8];
    }
}

/**
 * L move - Left face clockwise
 */
function moveL(cube, prime) {
    const face = FACES.LEFT;
    cube[face] = prime ? rotateFaceCounterClockwise(cube[face]) : rotateFaceClockwise(cube[face]);
    
    const temp = [
        cube[FACES.UP][0], cube[FACES.UP][3], cube[FACES.UP][6],
        cube[FACES.FRONT][0], cube[FACES.FRONT][3], cube[FACES.FRONT][6],
        cube[FACES.DOWN][0], cube[FACES.DOWN][3], cube[FACES.DOWN][6],
        cube[FACES.BACK][2], cube[FACES.BACK][5], cube[FACES.BACK][8]
    ];
    
    if (prime) {
        cube[FACES.UP][0] = temp[9];
        cube[FACES.UP][3] = temp[10];
        cube[FACES.UP][6] = temp[11];
        cube[FACES.FRONT][0] = temp[0];
        cube[FACES.FRONT][3] = temp[1];
        cube[FACES.FRONT][6] = temp[2];
        cube[FACES.DOWN][0] = temp[3];
        cube[FACES.DOWN][3] = temp[4];
        cube[FACES.DOWN][6] = temp[5];
        cube[FACES.BACK][2] = temp[6];
        cube[FACES.BACK][5] = temp[7];
        cube[FACES.BACK][8] = temp[8];
    } else {
        cube[FACES.UP][0] = temp[3];
        cube[FACES.UP][3] = temp[4];
        cube[FACES.UP][6] = temp[5];
        cube[FACES.FRONT][0] = temp[6];
        cube[FACES.FRONT][3] = temp[7];
        cube[FACES.FRONT][6] = temp[8];
        cube[FACES.DOWN][0] = temp[9];
        cube[FACES.DOWN][3] = temp[10];
        cube[FACES.DOWN][6] = temp[11];
        cube[FACES.BACK][2] = temp[0];
        cube[FACES.BACK][5] = temp[1];
        cube[FACES.BACK][8] = temp[2];
    }
}

/**
 * U move - Up face clockwise
 */
function moveU(cube, prime) {
    const face = FACES.UP;
    cube[face] = prime ? rotateFaceCounterClockwise(cube[face]) : rotateFaceClockwise(cube[face]);
    
    const temp = [
        cube[FACES.FRONT][0], cube[FACES.FRONT][1], cube[FACES.FRONT][2],
        cube[FACES.RIGHT][0], cube[FACES.RIGHT][1], cube[FACES.RIGHT][2],
        cube[FACES.BACK][0], cube[FACES.BACK][1], cube[FACES.BACK][2],
        cube[FACES.LEFT][0], cube[FACES.LEFT][1], cube[FACES.LEFT][2]
    ];
    
    if (prime) {
        cube[FACES.FRONT][0] = temp[3];
        cube[FACES.FRONT][1] = temp[4];
        cube[FACES.FRONT][2] = temp[5];
        cube[FACES.RIGHT][0] = temp[6];
        cube[FACES.RIGHT][1] = temp[7];
        cube[FACES.RIGHT][2] = temp[8];
        cube[FACES.BACK][0] = temp[9];
        cube[FACES.BACK][1] = temp[10];
        cube[FACES.BACK][2] = temp[11];
        cube[FACES.LEFT][0] = temp[0];
        cube[FACES.LEFT][1] = temp[1];
        cube[FACES.LEFT][2] = temp[2];
    } else {
        cube[FACES.FRONT][0] = temp[9];
        cube[FACES.FRONT][1] = temp[10];
        cube[FACES.FRONT][2] = temp[11];
        cube[FACES.RIGHT][0] = temp[0];
        cube[FACES.RIGHT][1] = temp[1];
        cube[FACES.RIGHT][2] = temp[2];
        cube[FACES.BACK][0] = temp[3];
        cube[FACES.BACK][1] = temp[4];
        cube[FACES.BACK][2] = temp[5];
        cube[FACES.LEFT][0] = temp[6];
        cube[FACES.LEFT][1] = temp[7];
        cube[FACES.LEFT][2] = temp[8];
    }
}

/**
 * D move - Down face clockwise
 */
function moveD(cube, prime) {
    const face = FACES.DOWN;
    cube[face] = prime ? rotateFaceCounterClockwise(cube[face]) : rotateFaceClockwise(cube[face]);
    
    const temp = [
        cube[FACES.FRONT][6], cube[FACES.FRONT][7], cube[FACES.FRONT][8],
        cube[FACES.RIGHT][6], cube[FACES.RIGHT][7], cube[FACES.RIGHT][8],
        cube[FACES.BACK][6], cube[FACES.BACK][7], cube[FACES.BACK][8],
        cube[FACES.LEFT][6], cube[FACES.LEFT][7], cube[FACES.LEFT][8]
    ];
    
    if (prime) {
        cube[FACES.FRONT][6] = temp[9];
        cube[FACES.FRONT][7] = temp[10];
        cube[FACES.FRONT][8] = temp[11];
        cube[FACES.RIGHT][6] = temp[0];
        cube[FACES.RIGHT][7] = temp[1];
        cube[FACES.RIGHT][8] = temp[2];
        cube[FACES.BACK][6] = temp[3];
        cube[FACES.BACK][7] = temp[4];
        cube[FACES.BACK][8] = temp[5];
        cube[FACES.LEFT][6] = temp[6];
        cube[FACES.LEFT][7] = temp[7];
        cube[FACES.LEFT][8] = temp[8];
    } else {
        cube[FACES.FRONT][6] = temp[3];
        cube[FACES.FRONT][7] = temp[4];
        cube[FACES.FRONT][8] = temp[5];
        cube[FACES.RIGHT][6] = temp[6];
        cube[FACES.RIGHT][7] = temp[7];
        cube[FACES.RIGHT][8] = temp[8];
        cube[FACES.BACK][6] = temp[9];
        cube[FACES.BACK][7] = temp[10];
        cube[FACES.BACK][8] = temp[11];
        cube[FACES.LEFT][6] = temp[0];
        cube[FACES.LEFT][7] = temp[1];
        cube[FACES.LEFT][8] = temp[2];
    }
}

/**
 * F move - Front face clockwise
 */
function moveF(cube, prime) {
    const face = FACES.FRONT;
    cube[face] = prime ? rotateFaceCounterClockwise(cube[face]) : rotateFaceClockwise(cube[face]);
    
    const temp = [
        cube[FACES.UP][6], cube[FACES.UP][7], cube[FACES.UP][8],
        cube[FACES.RIGHT][0], cube[FACES.RIGHT][3], cube[FACES.RIGHT][6],
        cube[FACES.DOWN][0], cube[FACES.DOWN][1], cube[FACES.DOWN][2],
        cube[FACES.LEFT][2], cube[FACES.LEFT][5], cube[FACES.LEFT][8]
    ];
    
    if (prime) {
        cube[FACES.UP][6] = temp[3];
        cube[FACES.UP][7] = temp[4];
        cube[FACES.UP][8] = temp[5];
        cube[FACES.RIGHT][0] = temp[9];
        cube[FACES.RIGHT][3] = temp[10];
        cube[FACES.RIGHT][6] = temp[11];
        cube[FACES.DOWN][0] = temp[6];
        cube[FACES.DOWN][1] = temp[7];
        cube[FACES.DOWN][2] = temp[8];
        cube[FACES.LEFT][2] = temp[0];
        cube[FACES.LEFT][5] = temp[1];
        cube[FACES.LEFT][8] = temp[2];
    } else {
        cube[FACES.UP][6] = temp[9];
        cube[FACES.UP][7] = temp[10];
        cube[FACES.UP][8] = temp[11];
        cube[FACES.RIGHT][0] = temp[0];
        cube[FACES.RIGHT][3] = temp[1];
        cube[FACES.RIGHT][6] = temp[2];
        cube[FACES.DOWN][0] = temp[3];
        cube[FACES.DOWN][1] = temp[4];
        cube[FACES.DOWN][2] = temp[5];
        cube[FACES.LEFT][2] = temp[6];
        cube[FACES.LEFT][5] = temp[7];
        cube[FACES.LEFT][8] = temp[8];
    }
}

/**
 * B move - Back face clockwise
 */
function moveB(cube, prime) {
    const face = FACES.BACK;
    cube[face] = prime ? rotateFaceCounterClockwise(cube[face]) : rotateFaceClockwise(cube[face]);
    
    const temp = [
        cube[FACES.UP][0], cube[FACES.UP][1], cube[FACES.UP][2],
        cube[FACES.LEFT][0], cube[FACES.LEFT][3], cube[FACES.LEFT][6],
        cube[FACES.DOWN][6], cube[FACES.DOWN][7], cube[FACES.DOWN][8],
        cube[FACES.RIGHT][2], cube[FACES.RIGHT][5], cube[FACES.RIGHT][8]
    ];
    
    if (prime) {
        cube[FACES.UP][0] = temp[9];
        cube[FACES.UP][1] = temp[10];
        cube[FACES.UP][2] = temp[11];
        cube[FACES.LEFT][0] = temp[0];
        cube[FACES.LEFT][3] = temp[1];
        cube[FACES.LEFT][6] = temp[2];
        cube[FACES.DOWN][6] = temp[3];
        cube[FACES.DOWN][7] = temp[4];
        cube[FACES.DOWN][8] = temp[5];
        cube[FACES.RIGHT][2] = temp[6];
        cube[FACES.RIGHT][5] = temp[7];
        cube[FACES.RIGHT][8] = temp[8];
    } else {
        cube[FACES.UP][0] = temp[3];
        cube[FACES.UP][1] = temp[4];
        cube[FACES.UP][2] = temp[5];
        cube[FACES.LEFT][0] = temp[6];
        cube[FACES.LEFT][3] = temp[7];
        cube[FACES.LEFT][6] = temp[8];
        cube[FACES.DOWN][6] = temp[9];
        cube[FACES.DOWN][7] = temp[10];
        cube[FACES.DOWN][8] = temp[11];
        cube[FACES.RIGHT][2] = temp[0];
        cube[FACES.RIGHT][5] = temp[1];
        cube[FACES.RIGHT][8] = temp[2];
    }
}

/**
 * M, E, S moves (middle layer slices) - simplified implementations
 */
function moveM(cube, prime) {
    // Middle layer vertical (between R and L)
    // Simplified: rotate around Y axis
    if (prime) {
        moveR(cube, false);
        moveL(cube, true);
        moveX(cube, true);
    } else {
        moveR(cube, true);
        moveL(cube, false);
        moveX(cube, false);
    }
}

function moveE(cube, prime) {
    // Middle layer horizontal (between U and D)
    // Simplified implementation
    const temp = [
        cube[FACES.FRONT][3], cube[FACES.FRONT][4], cube[FACES.FRONT][5],
        cube[FACES.RIGHT][3], cube[FACES.RIGHT][4], cube[FACES.RIGHT][5],
        cube[FACES.BACK][3], cube[FACES.BACK][4], cube[FACES.BACK][5],
        cube[FACES.LEFT][3], cube[FACES.LEFT][4], cube[FACES.LEFT][5]
    ];
    
    if (prime) {
        cube[FACES.FRONT][3] = temp[9];
        cube[FACES.FRONT][4] = temp[10];
        cube[FACES.FRONT][5] = temp[11];
        cube[FACES.RIGHT][3] = temp[0];
        cube[FACES.RIGHT][4] = temp[1];
        cube[FACES.RIGHT][5] = temp[2];
        cube[FACES.BACK][3] = temp[3];
        cube[FACES.BACK][4] = temp[4];
        cube[FACES.BACK][5] = temp[5];
        cube[FACES.LEFT][3] = temp[6];
        cube[FACES.LEFT][4] = temp[7];
        cube[FACES.LEFT][5] = temp[8];
    } else {
        cube[FACES.FRONT][3] = temp[3];
        cube[FACES.FRONT][4] = temp[4];
        cube[FACES.FRONT][5] = temp[5];
        cube[FACES.RIGHT][3] = temp[6];
        cube[FACES.RIGHT][4] = temp[7];
        cube[FACES.RIGHT][5] = temp[8];
        cube[FACES.BACK][3] = temp[9];
        cube[FACES.BACK][4] = temp[10];
        cube[FACES.BACK][5] = temp[11];
        cube[FACES.LEFT][3] = temp[0];
        cube[FACES.LEFT][4] = temp[1];
        cube[FACES.LEFT][5] = temp[2];
    }
}

function moveS(cube, prime) {
    // Middle layer front-back (between F and B)
    // Simplified implementation
    const temp = [
        cube[FACES.UP][3], cube[FACES.UP][4], cube[FACES.UP][5],
        cube[FACES.RIGHT][1], cube[FACES.RIGHT][4], cube[FACES.RIGHT][7],
        cube[FACES.DOWN][3], cube[FACES.DOWN][4], cube[FACES.DOWN][5],
        cube[FACES.LEFT][1], cube[FACES.LEFT][4], cube[FACES.LEFT][7]
    ];
    
    if (prime) {
        cube[FACES.UP][3] = temp[9];
        cube[FACES.UP][4] = temp[10];
        cube[FACES.UP][5] = temp[11];
        cube[FACES.RIGHT][1] = temp[0];
        cube[FACES.RIGHT][4] = temp[1];
        cube[FACES.RIGHT][7] = temp[2];
        cube[FACES.DOWN][3] = temp[3];
        cube[FACES.DOWN][4] = temp[4];
        cube[FACES.DOWN][5] = temp[5];
        cube[FACES.LEFT][1] = temp[6];
        cube[FACES.LEFT][4] = temp[7];
        cube[FACES.LEFT][7] = temp[8];
    } else {
        cube[FACES.UP][3] = temp[3];
        cube[FACES.UP][4] = temp[4];
        cube[FACES.UP][5] = temp[5];
        cube[FACES.RIGHT][1] = temp[6];
        cube[FACES.RIGHT][4] = temp[7];
        cube[FACES.RIGHT][7] = temp[8];
        cube[FACES.DOWN][3] = temp[9];
        cube[FACES.DOWN][4] = temp[10];
        cube[FACES.DOWN][5] = temp[11];
        cube[FACES.LEFT][1] = temp[0];
        cube[FACES.LEFT][4] = temp[1];
        cube[FACES.LEFT][7] = temp[2];
    }
}

/**
 * Cube rotations (x, y, z)
 */
function rotateX(cube, prime) {
    // Rotate entire cube around X axis (R face)
    if (prime) {
        moveR(cube, true);
        moveL(cube, false);
    } else {
        moveR(cube, false);
        moveL(cube, true);
    }
    // Also need to rotate U, D, F, B faces
    const temp = copyCube(cube);
    if (prime) {
        cube[FACES.UP] = temp[FACES.BACK];
        cube[FACES.FRONT] = temp[FACES.UP];
        cube[FACES.DOWN] = temp[FACES.FRONT];
        cube[FACES.BACK] = temp[FACES.DOWN];
    } else {
        cube[FACES.UP] = temp[FACES.FRONT];
        cube[FACES.FRONT] = temp[FACES.DOWN];
        cube[FACES.DOWN] = temp[FACES.BACK];
        cube[FACES.BACK] = temp[FACES.UP];
    }
}

function rotateY(cube, prime) {
    // Rotate entire cube around Y axis (U face)
    const temp = copyCube(cube);
    if (prime) {
        cube[FACES.FRONT] = temp[FACES.LEFT];
        cube[FACES.RIGHT] = temp[FACES.FRONT];
        cube[FACES.BACK] = temp[FACES.RIGHT];
        cube[FACES.LEFT] = temp[FACES.BACK];
    } else {
        cube[FACES.FRONT] = temp[FACES.RIGHT];
        cube[FACES.RIGHT] = temp[FACES.BACK];
        cube[FACES.BACK] = temp[FACES.LEFT];
        cube[FACES.LEFT] = temp[FACES.FRONT];
    }
}

function rotateZ(cube, prime) {
    // Rotate entire cube around Z axis (F face)
    const temp = copyCube(cube);
    if (prime) {
        cube[FACES.UP] = temp[FACES.RIGHT];
        cube[FACES.RIGHT] = temp[FACES.DOWN];
        cube[FACES.DOWN] = temp[FACES.LEFT];
        cube[FACES.LEFT] = temp[FACES.UP];
    } else {
        cube[FACES.UP] = temp[FACES.LEFT];
        cube[FACES.LEFT] = temp[FACES.DOWN];
        cube[FACES.DOWN] = temp[FACES.RIGHT];
        cube[FACES.RIGHT] = temp[FACES.UP];
    }
}

/**
 * Calculate inverse of a move
 */
export function getInverseMove(moveNotation) {
    const parsed = parseNotation(moveNotation);
    if (parsed.length !== 1) {
        throw new Error(`Expected single move, got: ${moveNotation}`);
    }
    
    const move = parsed[0];
    let base = move.move.toUpperCase();
    
    // If it's a double move, inverse is the same
    if (move.double) {
        return `${base}2`;
    }
    
    // If it has prime, remove it; if not, add it
    if (move.prime) {
        return base;
    } else {
        return `${base}'`;
    }
}

/**
 * Format move notation for display
 */
export function formatMove(move) {
    if (typeof move === 'string') {
        return move;
    }
    let str = move.move.toUpperCase();
    if (move.double) {
        str += '2';
    } else if (move.prime) {
        str += "'";
    }
    return str;
}

