import type { RNG } from "../rng";

export type DiceMode = "under" | "over";

export interface DiceOutcome {
  mode: DiceMode;
  target: number;
  roll: number;
  multiplier: number;
  winChance: number;
  won: boolean;
  payout: number;
}

const HOUSE_RTP = 99;

export function diceMultiplier(mode: DiceMode, target: number): number {
  const wc = mode === "under" ? target : 100 - target;
  if (wc <= 0 || wc >= 100) return 0;
  return HOUSE_RTP / wc;
}

export function playDice(
  rng: RNG,
  bet: number,
  mode: DiceMode,
  target: number,
): DiceOutcome {
  const roll = Math.floor(rng.nextFloat() * 10000) / 100;
  const won = mode === "under" ? roll < target : roll > target;
  const multiplier = diceMultiplier(mode, target);
  const winChance = mode === "under" ? target : 100 - target;
  const payout = won ? bet * multiplier : 0;
  return { mode, target, roll, multiplier, winChance, won, payout };
}
