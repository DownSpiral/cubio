/**
 * Cube State Management
 * Represents a 3x3x3 Rubik's cube with 54 facelets (6 faces × 9 stickers each)
 */

// Face colors (standard Rubik's cube colors)
export const COLORS = {
    WHITE: 0,
    YELLOW: 1,
    RED: 2,
    ORANGE: 3,
    GREEN: 4,
    BLUE: 5
};

// Face indices
export const FACES = {
    UP: 0,      // Yellow (top)
    DOWN: 1,    // White (bottom)
    FRONT: 2,   // Green
    BACK: 3,    // Red
    RIGHT: 4,   // Orange
    LEFT: 5     // Blue
};

/**
 * Create a solved cube state
 * Face order: U, D, F, B, R, L
 * Color mapping: U=Yellow, D=White, F=Green, B=Red, R=Orange, L=Blue
 */
export function createSolvedCube() {
    return [
        Array(9).fill(COLORS.YELLOW),  // U (Up/Yellow)
        Array(9).fill(COLORS.WHITE),   // D (Down/White)
        Array(9).fill(COLORS.GREEN),   // F (Front/Green)
        Array(9).fill(COLORS.RED),     // B (Back/Red)
        Array(9).fill(COLORS.ORANGE),  // R (Right/Orange)
        Array(9).fill(COLORS.BLUE)     // L (Left/Blue)
    ];
}

/**
 * Create a copy of a cube state
 */
export function copyCube(cube) {
    return cube.map(face => [...face]);
}

/**
 * Get facelet color at specific position
 * @param {Array} cube - Cube state
 * @param {number} face - Face index (0-5)
 * @param {number} position - Position on face (0-8, row-major order)
 */
export function getFacelet(cube, face, position) {
    return cube[face][position];
}

/**
 * Set facelet color at specific position
 */
export function setFacelet(cube, face, position, color) {
    cube[face][position] = color;
}

/**
 * Rotate a face clockwise
 * Face positions: 0 1 2
 *                 3 4 5
 *                 6 7 8
 */
export function rotateFaceClockwise(face) {
    const newFace = [...face];
    // Rotate corners
    [newFace[0], newFace[2], newFace[8], newFace[6]] = 
        [face[6], face[0], face[2], face[8]];
    // Rotate edges
    [newFace[1], newFace[5], newFace[7], newFace[3]] = 
        [face[3], face[1], face[5], face[7]];
    return newFace;
}

/**
 * Rotate a face counter-clockwise
 */
export function rotateFaceCounterClockwise(face) {
    const newFace = [...face];
    // Rotate corners
    [newFace[0], newFace[2], newFace[8], newFace[6]] = 
        [face[2], face[8], face[6], face[0]];
    // Rotate edges
    [newFace[1], newFace[5], newFace[7], newFace[3]] = 
        [face[5], face[7], face[3], face[1]];
    return newFace;
}

/**
 * Compare two cube states
 * Returns true if they are identical
 */
export function compareCubes(cube1, cube2) {
    for (let face = 0; face < 6; face++) {
        for (let pos = 0; pos < 9; pos++) {
            if (cube1[face][pos] !== cube2[face][pos]) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Get a string representation of the cube state (for debugging)
 */
export function cubeToString(cube) {
    const colorMap = ['W', 'Y', 'R', 'O', 'G', 'B'];
    let str = '';
    for (let face = 0; face < 6; face++) {
        str += `Face ${face}: `;
        for (let pos = 0; pos < 9; pos++) {
            str += colorMap[cube[face][pos]] + ' ';
        }
        str += '\n';
    }
    return str;
}

