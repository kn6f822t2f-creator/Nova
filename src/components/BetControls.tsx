"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/store";
import type { SpinOutcome } from "@/lib/slot/engine";

const BET_STEPS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

export function BetControls({
  onOutcome,
  spinning,
  setSpinning,
}: {
  onOutcome: (o: SpinOutcome) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
}) {
  const session = useSession();
  const [betIdx, setBetIdx] = useState(2);
  const [autoCount, setAutoCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const bet = BET_STEPS[betIdx];

  const canSpin = !!session.address && session.balance >= BigInt(bet) && !spinning;
  const autoActiveRef = useRef(false);

  const spin = async (fromAuto = false) => {
    setError(null);
    setSpinning(true);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: bet.toString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Spin failed");
        setSpinning(false);
        setAutoCount(0);
        return;
      }
      onOutcome(data.outcome);
      session.setBalance(data.balance);
      session.setSeeds({
        serverSeedHash: data.serverSeedHash,
        clientSeed: data.clientSeed,
        nonce: data.nonce + 1,
      });
      window.setTimeout(() => {
        setSpinning(false);
        if (fromAuto) setAutoCount((c) => Math.max(0, c - 1));
      }, 400 + 4 * 200 + 700);
    } catch (e: any) {
      setError(e.message);
      setSpinning(false);
      setAutoCount(0);
    }
  };

  useEffect(() => {
    if (autoCount > 0 && !spinning && canSpin && !autoActiveRef.current) {
      autoActiveRef.current = true;
      void (async () => {
        try {
          await spin(true);
        } finally {
          autoActiveRef.current = false;
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCount, spinning, canSpin]);

  return (
    <div className="panel flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost" disabled={betIdx === 0 || spinning} onClick={() => setBetIdx((i) => i - 1)}>
          −
        </button>
        <div className="chip text-gold font-semibold min-w-[72px] text-center">{bet}</div>
        <button
          className="btn btn-ghost"
          disabled={betIdx === BET_STEPS.length - 1 || spinning}
          onClick={() => setBetIdx((i) => i + 1)}
        >
          +
        </button>
      </div>
      <button className="btn btn-primary" disabled={!canSpin} onClick={() => spin(false)}>
        {spinning ? "Spinning…" : "Spin"}
      </button>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-slate-400 text-sm">Auto</span>
        {[10, 25, 100].map((n) => (
          <button
            key={n}
            className="btn btn-ghost text-xs"
            disabled={!canSpin}
            onClick={() => setAutoCount(n)}
          >
            {n}×
          </button>
        ))}
        {autoCount > 0 && (
          <button className="btn text-xs" onClick={() => setAutoCount(0)}>
            Stop ({autoCount})
          </button>
        )}
      </div>
      {error && <p className="text-crimson text-sm w-full">{error}</p>}
    </div>
  );
}
