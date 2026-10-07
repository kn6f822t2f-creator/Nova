"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { BalanceBar } from "@/components/BalanceBar";
import { VerifyPanel } from "@/components/VerifyPanel";
import { BetStepper, useBet } from "@/components/BetStepper";
import { useSession } from "@/store";
import { diceMultiplier, type DiceMode, type DiceOutcome } from "@/lib/games/dice";

export default function DicePage() {
  const bet = useBet();
  const session = useSession();
  const [mode, setMode] = useState<DiceMode>("under");
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [last, setLast] = useState<DiceOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mult = diceMultiplier(mode, target);
  const chance = mode === "under" ? target : 100 - target;

  const roll = async () => {
    setError(null);
    setRolling(true);
    try {
      const res = await fetch("/api/games/dice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: bet.value.toString(), mode, target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Dice failed");
        return;
      }
      setLast(data.outcome);
      session.setBalance(data.balance);
      session.setSeeds({
        serverSeedHash: data.serverSeedHash,
        clientSeed: data.clientSeed,
        nonce: data.nonce + 1,
      });
    } finally {
      setRolling(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-glow">← Lobby</Link>
          <h1 className="text-xl font-semibold">Dice</h1>
        </div>
        <div className="flex items-center gap-3">
          <BalanceBar />
          <WalletButton />
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <div className="panel">
            <div className="flex gap-2 mb-4">
              <button
                className={`flex-1 py-2 rounded-lg border ${mode === "under" ? "border-glow text-glow bg-glow/10" : "border-reef text-slate-400"}`}
                onClick={() => setMode("under")}
                disabled={rolling}
              >
                Roll Under
              </button>
              <button
                className={`flex-1 py-2 rounded-lg border ${mode === "over" ? "border-glow text-glow bg-glow/10" : "border-reef text-slate-400"}`}
                onClick={() => setMode("over")}
                disabled={rolling}
              >
                Roll Over
              </button>
            </div>
            <div className="relative h-14 rounded-lg overflow-hidden border border-reef mb-4"
              style={{ background: "linear-gradient(90deg, #a01e2c, #0f6b35)" }}>
              <div
                className="absolute top-0 bottom-0 bg-glow/30 border-l-2 border-r-2 border-glow"
                style={{
                  left: mode === "under" ? 0 : `${target}%`,
                  width: mode === "under" ? `${target}%` : `${100 - target}%`,
                }}
              />
              {last && (
                <div
                  className="absolute top-[-4px] bottom-[-4px] w-[3px] transition-all duration-700"
                  style={{
                    left: `${last.roll}%`,
                    background: last.won ? "#fbbf24" : "#ef4444",
                    boxShadow: `0 0 14px ${last.won ? "#fbbf24" : "#ef4444"}`,
                  }}
                />
              )}
            </div>
            <label className="block text-xs text-slate-400 uppercase tracking-widest mb-2">Target</label>
            <input
              type="range"
              min="2"
              max="98"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              disabled={rolling}
              className="w-full accent-glow"
            />
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Readout k="Target" v={target.toFixed(2)} tone="neon" />
              <Readout k="Multiplier" v={mult.toFixed(4) + "×"} tone="gold" />
              <Readout k="Win chance" v={chance.toFixed(2) + "%"} />
            </div>
            {last && (
              <div className="mt-4 text-sm">
                <span className="text-slate-400">Roll: </span>
                <span className="font-mono text-lg tabular-nums text-gold">{last.roll.toFixed(2)}</span>
                <span className={`ml-3 font-semibold ${last.won ? "text-glow" : "text-crimson"}`}>
                  {last.won ? `WIN +${Math.round(last.payout).toLocaleString()}` : "LOSE"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BetStepper {...bet} disabled={rolling} />
            <button className="btn btn-primary flex-1 h-14" disabled={rolling || !session.address} onClick={roll}>
              {rolling ? "Rolling…" : "Roll Dice"}
            </button>
          </div>
          {error && <p className="text-crimson text-sm">{error}</p>}
        </div>
        <aside className="space-y-4">
          {session.address ? <VerifyPanel /> : <div className="panel text-sm text-slate-400">Connect and sign in to play.</div>}
        </aside>
      </div>
    </main>
  );
}

function Readout({ k, v, tone }: { k: string; v: string; tone?: "gold" | "neon" }) {
  const color = tone === "gold" ? "text-gold" : tone === "neon" ? "text-glow" : "text-white";
  return (
    <div className="bg-abyss border border-reef rounded-lg p-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-widest">{k}</div>
      <div className={`font-mono tabular-nums ${color}`}>{v}</div>
    </div>
  );
}
