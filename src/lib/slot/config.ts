export type Symbol =
  | "WILD"
  | "SCAT"
  | "SEVEN"
  | "BAR"
  | "BELL"
  | "CHERRY"
  | "LEMON"
  | "ORANGE"
  | "PLUM";

export const REELS = 5;
export const ROWS = 3;

// Per-reel weighted symbol distribution. Each entry is [symbol, weight].
// Reel 1 is tightest (fewer high-pay / wild); reel 3 is most generous.
export const REEL_STRIPS: Array<Array<[Symbol, number]>> = [
  [
    ["SEVEN", 1], ["BAR", 2], ["BELL", 3], ["CHERRY", 5],
    ["LEMON", 6], ["ORANGE", 7], ["PLUM", 8], ["WILD", 1], ["SCAT", 1],
  ],
  [
    ["SEVEN", 2], ["BAR", 3], ["BELL", 4], ["CHERRY", 5],
    ["LEMON", 6], ["ORANGE", 6], ["PLUM", 7], ["WILD", 2], ["SCAT", 1],
  ],
  [
    ["SEVEN", 2], ["BAR", 4], ["BELL", 5], ["CHERRY", 5],
    ["LEMON", 6], ["ORANGE", 6], ["PLUM", 6], ["WILD", 3], ["SCAT", 2],
  ],
  [
    ["SEVEN", 2], ["BAR", 3], ["BELL", 4], ["CHERRY", 5],
    ["LEMON", 6], ["ORANGE", 6], ["PLUM", 7], ["WILD", 2], ["SCAT", 1],
  ],
  [
    ["SEVEN", 1], ["BAR", 2], ["BELL", 3], ["CHERRY", 5],
    ["LEMON", 6], ["ORANGE", 7], ["PLUM", 8], ["WILD", 1], ["SCAT", 1],
  ],
];

// Pay for N-of-a-kind matches, keyed by symbol. Values are multipliers of the LINE bet.
export const LINE_PAY: Record<Symbol, [number, number, number]> = {
  SEVEN:  [42, 208, 850],
  WILD:   [85, 416, 1700],
  BAR:    [25, 123, 425],
  BELL:   [16, 80, 246],
  CHERRY: [12, 42, 160],
  LEMON:  [8.5, 32, 123],
  ORANGE: [4.7, 25, 85],
  PLUM:   [3.3, 17, 66],
  SCAT:   [0, 0, 0], // scatter pays per total bet below
};

// Scatter pays multiplier of TOTAL bet when N scatters appear anywhere.
export const SCATTER_PAY: Record<number, number> = {
  3: 2,
  4: 10,
  5: 50,
};

// Free spin trigger: N scatters → M free spins
export const FREE_SPIN_TRIGGER: Record<number, number> = {
  3: 10,
  4: 15,
  5: 25,
};

// Rows are indexed 0 (top) to ROWS-1 (bottom); each payline is one row index per reel.
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // middle
  [0, 0, 0, 0, 0], // top
  [2, 2, 2, 2, 2], // bottom
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // ^
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [0, 2, 1, 2, 0],
];

export const PAYLINE_COUNT = PAYLINES.length;
