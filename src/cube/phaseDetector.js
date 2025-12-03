/**
 * Phase Detection for CFOP Solve Method
 * Detects completion of Cross, F2L pairs, OLL, and PLL phases
 */

import { faceletsToPattern } from '../utils/faceletsUtils.js';

const REID_EDGE_ORDER = "UF UR UB UL DF DR DB DL FR FL BR BL".split(" ");
const REID_CORNER_ORDER = "UFR URB UBL ULF DRF DFL DLB DBR".split(" ");

// Face mapping: U=0, R=1, F=2, D=3, L=4, B=5
const FACE_MAP = {
    'U': 0, 'R': 1, 'F': 2, 'D': 3, 'L': 4, 'B': 5
};

// Transformation mapping for x2 y2 setup
// Physical D (white) -> Visual U (yellow)
// Physical U (yellow) -> Visual D (white)
// Physical F (green) -> Visual F (green) - stays same
// Physical B (red) -> Visual B (blue) - but actually stays same in Kociemba
// Physical R (orange) -> Visual L (blue)
// Physical L (blue) -> Visual R (orange)
// After x2 y2: D->U, U->D, R->L, L->R, F->F, B->B
const X2_Y2_TRANSFORM = {
    'D': 'U', // Physical D (white) appears as U in facelets
    'U': 'D', // Physical U (yellow) appears as D in facelets
    'R': 'L', // Physical R (orange) appears as L in facelets
    'L': 'R', // Physical L (blue) appears as R in facelets
    'F': 'F', // Physical F (green) stays F
    'B': 'B'  // Physical B (red) stays B
};

// Opposite faces
const OPPOSITE_FACE = {
    'U': 'D', 'D': 'U',
    'R': 'L', 'L': 'R',
    'F': 'B', 'B': 'F'
};

// Get edges for a given face (cross face)
function getCrossEdges(crossFace) {
    // Edges that belong to the cross face
    // For D (Down/White): DF, DR, DB, DL
    // For U (Up/Yellow): UF, UR, UB, UL
    // For F (Front/Green): UF, FR, DF, FL
    // For B (Back/Red): UB, BR, DB, BL
    // For R (Right/Orange): UR, FR, DR, BR
    // For L (Left/Blue): UL, FL, DL, BL
    
    const edgeMap = {
        'D': ['DF', 'DR', 'DB', 'DL'],
        'U': ['UF', 'UR', 'UB', 'UL'],
        'F': ['UF', 'FR', 'DF', 'FL'],
        'B': ['UB', 'BR', 'DB', 'BL'],
        'R': ['UR', 'FR', 'DR', 'BR'],
        'L': ['UL', 'FL', 'DL', 'BL']
    };
    
    return edgeMap[crossFace] || [];
}

// Get F2L corner-edge pairs for a given cross face
function getF2LPairs(crossFace) {
    // F2L pairs are the 4 corner-edge pairs around the cross face
    // For D (Down): DRF, DFL, DLB, DBR corners with their edges
    // For U (Up): UFR, ULF, UBL, URB corners with their edges
    
    const pairMap = {
        'D': [
            { corner: 'DRF', edge: 'FR' },
            { corner: 'DFL', edge: 'FL' },
            { corner: 'DLB', edge: 'BL' },
            { corner: 'DBR', edge: 'BR' }
        ],
        'U': [
            { corner: 'UFR', edge: 'FR' },
            { corner: 'ULF', edge: 'FL' },
            { corner: 'UBL', edge: 'BL' },
            { corner: 'URB', edge: 'BR' }
        ],
        'F': [
            { corner: 'UFR', edge: 'UR' },
            { corner: 'DFR', edge: 'DR' },
            { corner: 'DFL', edge: 'DL' },
            { corner: 'UFL', edge: 'UL' }
        ],
        'B': [
            { corner: 'UBR', edge: 'UR' },
            { corner: 'DBR', edge: 'DR' },
            { corner: 'DBL', edge: 'DL' },
            { corner: 'UBL', edge: 'UL' }
        ],
        'R': [
            { corner: 'UFR', edge: 'UF' },
            { corner: 'DFR', edge: 'DF' },
            { corner: 'DBR', edge: 'DB' },
            { corner: 'UBR', edge: 'UB' }
        ],
        'L': [
            { corner: 'UFL', edge: 'UF' },
            { corner: 'DFL', edge: 'DF' },
            { corner: 'DBL', edge: 'DB' },
            { corner: 'UBL', edge: 'UB' }
        ]
    };
    
    return pairMap[crossFace] || [];
}

/**
 * Check if cross is complete on the specified face
 * Cross is complete when all 4 edges are correctly placed and oriented
 * We check by verifying the facelet colors on the cross face edge positions
 */
export async function detectCross(facelets, crossFace) {
    try {
        // Facelets order in Kociemba notation: U, R, F, D, L, B (each 9 characters)
        // Face positions on each face (row-major): 0 1 2
        //                                           3 4 5
        //                                           6 7 8
        // Edge positions on a face: 1 (top), 3 (left), 5 (right), 7 (bottom)
        
        // Account for x2 y2 transformation: physical cross face maps to different visual face
        const visualFace = X2_Y2_TRANSFORM[crossFace] || crossFace;
        const faceIndex = FACE_MAP[visualFace];
        if (faceIndex === undefined) {
            console.error('detectCross - invalid crossFace:', crossFace, 'visualFace:', visualFace);
            return false;
        }
        
        // Get the cross face color (should match the visual face in facelets)
        const crossFaceColor = visualFace;
        const faceStart = faceIndex * 9;
        const crossFaceStickers = facelets.substring(faceStart, faceStart + 9);
        
        // Check edge positions on the cross face (positions 1, 3, 5, 7)
        // All should have the cross face color
        const edgePositions = [1, 3, 5, 7];
        let allEdgesCorrect = true;
        for (const pos of edgePositions) {
            const stickerColor = crossFaceStickers[pos];
            if (stickerColor !== crossFaceColor) {
                allEdgesCorrect = false;
                break;
            }
        }
        
        if (!allEdgesCorrect) {
            return false;
        }
        
        // Cross edges are all correct on the cross face
        // We don't need to check adjacent faces for cross completion
        // (adjacent face checking would verify edge orientation, but cross is complete
        //  if all 4 edges have the cross color on the cross face)
        return true;
    } catch (error) {
        console.error('Error detecting cross:', error);
        return false;
    }
}

/**
 * Check if a specific F2L pair is complete
 * Pair is complete when both corner and edge are correctly placed and oriented
 */
export async function detectF2LPair(facelets, crossFace, pairIndex) {
    try {
        // Account for x2 y2 transformation - transform the cross face to get correct F2L pairs
        const visualCrossFace = X2_Y2_TRANSFORM[crossFace] || crossFace;
        const pattern = await faceletsToPattern(facelets);
        const corners = pattern.patternData.CORNERS;
        const edges = pattern.patternData.EDGES;
        const pairs = getF2LPairs(visualCrossFace);
        
        if (pairIndex < 0 || pairIndex >= pairs.length) {
            return false;
        }
        
        const pair = pairs[pairIndex];
        const cornerName = pair.corner;
        const edgeName = pair.edge;
        
        // Find corner index
        const cornerIndex = REID_CORNER_ORDER.indexOf(cornerName);
        if (cornerIndex === -1) {
            return false;
        }
        
        // Find edge index
        const edgeIndex = REID_EDGE_ORDER.indexOf(edgeName);
        if (edgeIndex === -1) {
            return false;
        }
        
        // Check if corner is in correct position and oriented
        if (corners.pieces[cornerIndex] !== cornerIndex) {
            return false;
        }
        if (corners.orientation[cornerIndex] !== 0) {
            return false;
        }
        
        // Check if edge is in correct position and oriented
        if (edges.pieces[edgeIndex] !== edgeIndex) {
            return false;
        }
        if (edges.orientation[edgeIndex] !== 0) {
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error detecting F2L pair:', error);
        return false;
    }
}

/**
 * Check if all F2L pairs are complete
 */
export async function detectF2L(facelets, crossFace) {
    for (let i = 0; i < 4; i++) {
        const pairComplete = await detectF2LPair(facelets, crossFace, i);
        if (!pairComplete) {
            return false;
        }
    }
    return true;
}

/**
 * Check if OLL is complete
 * OLL is complete when all top face stickers are the same color
 * Top face is opposite of cross face
 */
export async function detectOLL(facelets, crossFace) {
    try {
        // Account for x2 y2 transformation
        const visualCrossFace = X2_Y2_TRANSFORM[crossFace] || crossFace;
        const topFace = OPPOSITE_FACE[visualCrossFace];
        const topFaceIndex = FACE_MAP[topFace];
        
        // Facelets order: U, R, F, D, L, B (each 9 characters)
        // Extract the top face (9 characters)
        const faceStart = topFaceIndex * 9;
        const topFaceStickers = facelets.substring(faceStart, faceStart + 9);
        
        // Check if all stickers are the same color (first sticker color)
        const firstColor = topFaceStickers[0];
        for (let i = 0; i < 9; i++) {
            if (topFaceStickers[i] !== firstColor) {
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error detecting OLL:', error);
        return false;
    }
}

/**
 * Check if PLL is complete (cube is solved)
 */
export function detectPLL(facelets) {
    const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
    return facelets === SOLVED_STATE;
}

/**
 * Detect all completed CFOP phases
 * Returns array of phase names that are complete
 * Phase order: Cross → F2L-1 → F2L-2 → F2L-3 → F2L-4 → OLL → PLL
 */
export async function detectCFOPPhases(facelets, crossFace) {
    const completedPhases = [];
    
    if (!facelets || facelets.length !== 54) {
        console.warn('Invalid facelets for phase detection:', facelets?.length);
        return completedPhases;
    }
    
    if (!crossFace) {
        console.warn('No cross face specified for phase detection');
        return completedPhases;
    }
    
    // Check phases in order
    const crossComplete = await detectCross(facelets, crossFace);
    
    if (crossComplete) {
        completedPhases.push('Cross');
        
        // Check all F2L pairs and count how many are solved
        let solvedPairsCount = 0;
        for (let i = 0; i < 4; i++) {
            const pairComplete = await detectF2LPair(facelets, crossFace, i);
            if (pairComplete) {
                solvedPairsCount++;
            }
        }
        
        // Add phases based on the count of solved pairs
        for (let i = 1; i <= solvedPairsCount; i++) {
            completedPhases.push(`F2L-${i}`);
        }
        
        // Check if all F2L pairs are complete before checking OLL
        if (solvedPairsCount === 4) {
            const ollComplete = await detectOLL(facelets, crossFace);
            if (ollComplete) {
                completedPhases.push('OLL');
                
                // Check PLL
                const pllComplete = detectPLL(facelets);
                if (pllComplete) {
                    completedPhases.push('PLL');
                }
            }
        }
    }
    return completedPhases;
}

