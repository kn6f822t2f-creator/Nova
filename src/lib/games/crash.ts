import type { RNG } from "../rng";

export interface CrashOutcome {
  crashMult: number;
  autoCashout: number | null;
  won: boolean;
  cashedAt: number | null;
  payout: number;
}

const INSTANT_BUST_ODDS = 33; // 1-in-33 → ~3% house edge equivalent
const MAX_CRASH = 1_000_000;

export function crashPoint(rng: RNG): number {
  if (rng.nextFloat() < 1 / INSTANT_BUST_ODDS) return 1.0;
  let r = rng.nextFloat();
  if (r > 0.999999) r = 0.999999;
  const raw = (100 - r) / (1 - r);
  let crash = Math.floor(raw) / 100;
  if (crash < 1) crash = 1;
  if (crash > MAX_CRASH) crash = MAX_CRASH;
  return crash;
}

export function playCrash(rng: RNG, bet: number, autoCashout: number | null): CrashOutcome {
  const cm = crashPoint(rng);
  const target = autoCashout;
  if (target !== null && target > 1 && target <= cm) {
    const roundedTarget = Math.floor(target * 100) / 100;
    return {
      crashMult: cm,
      autoCashout: target,
      won: true,
      cashedAt: roundedTarget,
      payout: bet * roundedTarget,
    };
  }
  return {
    crashMult: cm,
    autoCashout: target,
    won: false,
    cashedAt: null,
    payout: 0,
  };
}
