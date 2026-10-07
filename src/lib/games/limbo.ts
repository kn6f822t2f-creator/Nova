import type { RNG } from "../rng";

export interface LimboOutcome {
  target: number;
  result: number;
  won: boolean;
  payout: number;
}

const HOUSE_RTP = 0.99;
const MAX_RESULT = 1_000_000;

export function playLimbo(rng: RNG, bet: number, target: number): LimboOutcome {
  let r = rng.nextFloat();
  if (r > 0.999999) r = 0.999999;
  let result = HOUSE_RTP / (1 - r);
  if (result < 1) result = 1;
  if (result > MAX_RESULT) result = MAX_RESULT;
  result = Math.floor(result * 100) / 100;
  const won = result >= target;
  const payout = won ? bet * target : 0;
  return { target, result, won, payout };
}
