"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { Symbol } from "@/lib/slot/config";
import type { SpinOutcome } from "@/lib/slot/engine";

const GLYPH: Record<Symbol, string> = {
  SEVEN: "7️⃣",
  WILD: "⭐",
  SCAT: "💎",
  BAR: "🅱️",
  BELL: "🔔",
  CHERRY: "🍒",
  LEMON: "🍋",
  ORANGE: "🍊",
  PLUM: "🍇",
};

const STRIP_LEN = 24;
const BASE_SYMS: Symbol[] = ["SEVEN", "BAR", "BELL", "CHERRY", "LEMON", "ORANGE", "PLUM", "WILD", "SCAT"];

function randomStrip(final: Symbol[]): Symbol[] {
  const s: Symbol[] = [];
  for (let i = 0; i < STRIP_LEN; i++) s.push(BASE_SYMS[Math.floor(Math.random() * BASE_SYMS.length)]);
  s[STRIP_LEN - 3] = final[0];
  s[STRIP_LEN - 2] = final[1];
  s[STRIP_LEN - 1] = final[2];
  return s;
}

export function SlotMachine({
  outcome,
  spinning,
}: {
  outcome: SpinOutcome | null;
  spinning: boolean;
}) {
  const [strips, setStrips] = useState<Symbol[][]>(() =>
    Array(5)
      .fill(0)
      .map(() => BASE_SYMS.slice(0, 3)),
  );
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<"idle" | "spinning" | "settled">("idle");

  useEffect(() => {
    if (spinning && outcome) {
      // Build long random strips ending in the final 3 symbols for each reel.
      const newStrips = outcome.grid.map((col) => randomStrip(col));
      setStrips(newStrips);
      setWinCells(new Set());
      setStage("spinning");
      // After the longest reel settles, highlight winning cells.
      const settleMs = 400 + (5 - 1) * 200 + 600;
      const t = window.setTimeout(() => {
        const cells = new Set<string>();
        for (const w of outcome.lineWins) for (const [r, c] of w.positions) cells.add(`${r}:${c}`);
        setWinCells(cells);
        setStage("settled");
      }, settleMs);
      return () => window.clearTimeout(t);
    }
  }, [spinning, outcome]);

  return (
    <div className="panel">
      <div className="grid grid-cols-5 gap-2 md:gap-3">
        {Array.from({ length: 5 }).map((_, reel) => (
          <ReelColumn
            key={reel}
            reel={reel}
            strip={strips[reel]}
            spinning={stage === "spinning"}
            winCells={winCells}
          />
        ))}
      </div>
      {outcome && stage === "settled" && (
        <div className="mt-4 text-sm text-slate-300 flex flex-wrap gap-x-6 gap-y-2">
          <span>
            Wins: <strong className="text-gold">{outcome.lineWins.length}</strong>
          </span>
          <span>
            Scatters: <strong>{outcome.scatterCount}</strong>
            {outcome.scatterPay > 0 && (
              <span className="text-glow"> (+{outcome.scatterPay})</span>
            )}
          </span>
          <span>
            Total win:{" "}
            <strong className={outcome.totalWin > 0 ? "text-gold" : "text-slate-400"}>
              {outcome.totalWin}
            </strong>
          </span>
          {outcome.freeSpinsAwarded > 0 && (
            <span className="text-glow">🎉 {outcome.freeSpinsAwarded} free spins!</span>
          )}
        </div>
      )}
    </div>
  );
}

function ReelColumn({
  reel,
  strip,
  spinning,
  winCells,
}: {
  reel: number;
  strip: Symbol[];
  spinning: boolean;
  winCells: Set<string>;
}) {
  // Translate the strip so the final 3 symbols land in the 3 visible rows.
  // Cell height = 20% of the container (strip has STRIP_LEN cells).
  const finalOffset = -(STRIP_LEN - 3);
  return (
    <div className="relative overflow-hidden rounded-xl bg-abyss border border-reef" style={{ aspectRatio: "1 / 3" }}>
      <AnimatePresence>
        <motion.div
          key={strip.join("|")}
          className="absolute inset-x-0 flex flex-col"
          initial={{ y: 0 }}
          animate={
            spinning
              ? {
                  y: [`0%`, `${(finalOffset / STRIP_LEN) * 100}%`],
                }
              : { y: `${(finalOffset / STRIP_LEN) * 100}%` }
          }
          transition={{
            duration: 0.6 + reel * 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ height: `${(STRIP_LEN / 3) * 100}%` }}
        >
          {strip.map((sym, i) => {
            const visibleRow = i - (STRIP_LEN - 3);
            const key = `${reel}:${visibleRow}`;
            const isWin = winCells.has(key);
            return (
              <div
                key={i}
                className={`reel-cell ${isWin ? "win" : ""}`}
                style={{ height: `${100 / STRIP_LEN}%` }}
              >
                <span>{GLYPH[sym]}</span>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
