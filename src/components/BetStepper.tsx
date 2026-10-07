"use client";

import { useState } from "react";

const BET_STEPS = [1, 5, 10, 20, 50, 100, 250, 500, 1000];

export function useBet(initial = 3) {
  const [idx, setIdx] = useState(initial);
  return {
    value: BET_STEPS[idx],
    idx,
    canDown: idx > 0,
    canUp: idx < BET_STEPS.length - 1,
    down: () => setIdx((i) => Math.max(0, i - 1)),
    up: () => setIdx((i) => Math.min(BET_STEPS.length - 1, i + 1)),
  };
}

export function BetStepper({
  value, canDown, canUp, down, up, disabled,
}: {
  value: number; canDown: boolean; canUp: boolean;
  down: () => void; up: () => void; disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-abyss border border-reef rounded-full p-1">
      <button
        className="w-9 h-9 rounded-full text-white text-lg font-bold disabled:opacity-30"
        disabled={disabled || !canDown}
        onClick={down}
        aria-label="Decrease bet"
      >
        −
      </button>
      <div className="min-w-[68px] text-center font-mono text-gold font-semibold px-2 tabular-nums">
        {value}
      </div>
      <button
        className="w-9 h-9 rounded-full text-white text-lg font-bold disabled:opacity-30"
        disabled={disabled || !canUp}
        onClick={up}
        aria-label="Increase bet"
      >
        +
      </button>
    </div>
  );
}
