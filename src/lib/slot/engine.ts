import { RNG } from "../rng";
import {
  LINE_PAY,
  PAYLINES,
  PAYLINE_COUNT,
  REELS,
  REEL_STRIPS,
  ROWS,
  SCATTER_PAY,
  FREE_SPIN_TRIGGER,
  type Symbol,
} from "./config";

export interface LineWin {
  line: number;
  symbol: Symbol;
  count: number;
  pay: number;
  positions: Array<[number, number]>; // [reel, row]
}

export interface SpinOutcome {
  grid: Symbol[][]; // [reel][row]
  stops: number[]; // picked strip index per reel
  lineWins: LineWin[];
  scatterCount: number;
  scatterPay: number;
  totalWin: number;
  freeSpinsAwarded: number;
}

const MATERIALIZED: Symbol[][] = REEL_STRIPS.map((entries) => {
  const strip: Symbol[] = [];
  for (const [sym, weight] of entries) {
    for (let i = 0; i < weight; i++) strip.push(sym);
  }
  return strip;
});

export function strips(): readonly Symbol[][] {
  return MATERIALIZED;
}

function evalLine(
  lineIdx: number,
  grid: Symbol[][],
  lineBet: number,
): LineWin | null {
  const path = PAYLINES[lineIdx];
  const row0 = path[0];
  const first = grid[0][row0];
  if (first === "SCAT") return null;

  // Determine effective symbol: if first is WILD, we try matching the next non-wild.
  // We'll test the leftmost run against each candidate symbol and keep best pay.
  const candidates: Symbol[] =
    first === "WILD"
      ? (["SEVEN", "BAR", "BELL", "CHERRY", "LEMON", "ORANGE", "PLUM", "WILD"] as Symbol[])
      : [first];

  let best: LineWin | null = null;
  for (const sym of candidates) {
    let count = 0;
    const positions: Array<[number, number]> = [];
    for (let reel = 0; reel < REELS; reel++) {
      const s = grid[reel][path[reel]];
      if (s === sym || (s === "WILD" && sym !== "SCAT")) {
        count++;
        positions.push([reel, path[reel]]);
      } else {
        break;
      }
    }
    if (count < 3) continue;
    const payTable = LINE_PAY[sym];
    const pay = payTable[count - 3] * lineBet;
    if (!best || pay > best.pay) {
      best = { line: lineIdx, symbol: sym, count, pay, positions };
    }
  }
  return best;
}

export function spin(rng: RNG, totalBet: number): SpinOutcome {
  const stops: number[] = [];
  const grid: Symbol[][] = [];
  for (let reel = 0; reel < REELS; reel++) {
    const strip = MATERIALIZED[reel];
    const stop = rng.nextInt(strip.length);
    stops.push(stop);
    const col: Symbol[] = [];
    for (let row = 0; row < ROWS; row++) {
      col.push(strip[(stop + row) % strip.length]);
    }
    grid.push(col);
  }

  const lineBet = totalBet / PAYLINE_COUNT;
  const lineWins: LineWin[] = [];
  for (let i = 0; i < PAYLINE_COUNT; i++) {
    const win = evalLine(i, grid, lineBet);
    if (win) lineWins.push(win);
  }

  let scatterCount = 0;
  for (let reel = 0; reel < REELS; reel++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[reel][row] === "SCAT") scatterCount++;
    }
  }
  const scatterPay = (SCATTER_PAY[scatterCount] ?? 0) * totalBet;
  const freeSpinsAwarded = FREE_SPIN_TRIGGER[scatterCount] ?? 0;

  const totalWin =
    lineWins.reduce((a, w) => a + w.pay, 0) + scatterPay;

  return {
    grid,
    stops,
    lineWins,
    scatterCount,
    scatterPay,
    totalWin,
    freeSpinsAwarded,
  };
}
