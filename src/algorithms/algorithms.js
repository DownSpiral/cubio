/**
 * Algorithm Database
 * Stores algorithms with their notation, setup moves, and stickering types
 */

export const algorithms = [
    {
        name: 'Orient Edges',
        notation: "F R U R' U' F'",
        setup: 'x2 y2',
        stickeringType: 'OLL',
        category: 'Petrus'
    },
    {
        name: 'Orient Corners',
        notation: "L U' R' U L' U' R U2",
        setup: 'x2 y2',
        stickeringType: 'OLL',
        category: 'Petrus'
    },
    {
        name: 'Sune',
        notation: "R U R' U R U2 R'",
        setup: 'x2 y2',
        stickeringType: 'OLL',
        category: 'Petrus'
    },
    {
        name: 'Allen',
        notation: "R2 U' F B' R2 B F' U' R2",
        setup: 'x2 y2',
        stickeringType: 'PLL',
        category: 'Petrus'
    }
];

