"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { BalanceBar } from "@/components/BalanceBar";
import { VerifyPanel } from "@/components/VerifyPanel";
import { BetStepper, useBet } from "@/components/BetStepper";
import { useSession } from "@/store";
import type { LimboOutcome } from "@/lib/games/limbo";

export default function LimboPage() {
  const bet = useBet();
  const session = useSession();
  const [target, setTarget] = useState("2.00");
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState("1.00");
  const [state, setState] = useState<"idle" | "rolling" | "won" | "lost">("idle");
  const [last, setLast] = useState<LimboOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const targetNum = Math.max(1.01, Math.min(1_000_000, Number(target) || 1.01));
  const chance = 99 / targetNum;

  const launch = async () => {
    setError(null);
    setRolling(true);
    setState("rolling");
    setDisplay("1.00");
    try {
      const res = await fetch("/api/games/limbo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: bet.value.toString(), target: targetNum }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Limbo failed");
        setState("idle");
        return;
      }
      const o = data.outcome as LimboOutcome;
      setLast(o);
      session.setBalance(data.balance);
      session.setSeeds({
        serverSeedHash: data.serverSeedHash,
        clientSeed: data.clientSeed,
        nonce: data.nonce + 1,
      });
      // Animate climb to result
      const targetDisplay = Math.min(o.result, 1000);
      const duration = 1400;
      const t0 = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - dt, 3);
        const m = 1 + (targetDisplay - 1) * eased;
        setDisplay(m.toFixed(2));
        if (dt < 1) rafRef.current = requestAnimationFrame(tick);
        else {
          setDisplay(o.result.toFixed(2));
          setState(o.won ? "won" : "lost");
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } finally {
      setRolling(false);
    }
  };

  const color =
    state === "rolling" ? "text-glow" :
    state === "won" ? "text-gold" :
    state === "lost" ? "text-crimson" : "text-slate-500";
  const glow =
    state === "rolling" ? "0 0 24px #4ade80" :
    state === "won" ? "0 0 24px #fbbf24" :
    state === "lost" ? "0 0 24px #ef4444" : "none";

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-glow">← Lobby</Link>
          <h1 className="text-xl font-semibold">Limbo</h1>
        </div>
        <div className="flex items-center gap-3">
          <BalanceBar />
          <WalletButton />
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <div className="panel">
            <div
              className={`text-center py-10 rounded-lg bg-abyss border border-reef font-mono font-bold text-6xl tabular-nums ${color}`}
              style={{ textShadow: glow, transition: "color 200ms ease, text-shadow 200ms ease" }}
            >
              {display}×
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Readout k="Target" v={targetNum.toFixed(2) + "×"} tone="neon" />
              <Readout k="Payout" v={"×" + targetNum.toFixed(2)} tone="gold" />
              <Readout k="Win chance" v={chance.toFixed(2) + "%"} />
            </div>
            <label className="block text-xs text-slate-400 uppercase tracking-widest mt-3 mb-1">Target multiplier</label>
            <input
              type="number"
              min="1.01"
              max="1000000"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onBlur={() => setTarget(targetNum.toFixed(2))}
              disabled={rolling}
              className="input font-mono tabular-nums"
            />
            {last && state !== "rolling" && (
              <div className="mt-4 text-sm">
                <span className="text-slate-400">Result: </span>
                <span className="font-mono tabular-nums text-lg text-gold">{last.result.toFixed(2)}×</span>
                <span className={`ml-3 font-semibold ${last.won ? "text-glow" : "text-crimson"}`}>
                  {last.won ? `WIN +${Math.round(last.payout).toLocaleString()}` : "LOSE"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BetStepper {...bet} disabled={rolling} />
            <button className="btn btn-primary flex-1 h-14" disabled={rolling || !session.address} onClick={launch}>
              {rolling ? "Launching…" : "Launch"}
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
