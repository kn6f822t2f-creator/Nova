"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { BalanceBar } from "@/components/BalanceBar";
import { VerifyPanel } from "@/components/VerifyPanel";
import { BetStepper, useBet } from "@/components/BetStepper";
import { useSession } from "@/store";
import type { CrashOutcome } from "@/lib/games/crash";

const K = 0.0001; // growth rate per ms

export default function CrashPage() {
  const bet = useBet();
  const session = useSession();
  const [autoCashout, setAutoCashout] = useState("2.00");
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState("1.00");
  const [status, setStatus] = useState<"idle" | "running" | "cashed" | "busted">("idle");
  const [outcome, setOutcome] = useState<CrashOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const autoNum = (() => {
    const n = Number(autoCashout);
    return Number.isFinite(n) && n >= 1.01 ? n : null;
  })();

  const launch = async () => {
    setError(null);
    setRunning(true);
    setStatus("running");
    setDisplay("1.00");
    try {
      const res = await fetch("/api/games/crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bet: bet.value.toString(),
          autoCashout: autoNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Crash failed");
        setStatus("idle");
        setRunning(false);
        return;
      }
      const o = data.outcome as CrashOutcome;
      setOutcome(o);
      session.setBalance(data.balance);
      session.setSeeds({
        serverSeedHash: data.serverSeedHash,
        clientSeed: data.clientSeed,
        nonce: data.nonce + 1,
      });
      // Animate climb to crash (or to auto-cashout if won)
      const endMult = o.won && o.cashedAt ? o.cashedAt : o.crashMult;
      const endTime = Math.log(endMult) / K;
      const t0 = performance.now();
      const tick = (now: number) => {
        const elapsed = now - t0;
        if (elapsed >= endTime) {
          setDisplay(endMult.toFixed(2));
          setStatus(o.won ? "cashed" : "busted");
          setRunning(false);
          return;
        }
        const m = Math.exp(K * elapsed);
        setDisplay(m.toFixed(2));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: unknown) {
      setError((e as Error).message || "Crash failed");
      setStatus("idle");
      setRunning(false);
    }
  };

  const color =
    status === "running" ? "text-glow" :
    status === "cashed" ? "text-gold" :
    status === "busted" ? "text-crimson" : "text-slate-400";
  const glow =
    status === "running" ? "0 0 24px #4ade80" :
    status === "cashed" ? "0 0 32px #fbbf24" :
    status === "busted" ? "0 0 32px #ef4444" : "none";

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-glow">← Lobby</Link>
          <h1 className="text-xl font-semibold">Crash</h1>
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
              className={`relative h-48 rounded-lg bg-abyss border border-reef flex items-center justify-center ${color}`}
              style={{ textShadow: glow, transition: "color 200ms, text-shadow 200ms" }}
            >
              <div className="font-mono font-bold text-7xl tabular-nums">{display}×</div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Readout k="Auto-cashout" v={autoNum ? autoNum.toFixed(2) + "×" : "manual"} tone="neon" />
              <Readout k="Potential" v={autoNum ? "×" + autoNum.toFixed(2) : "—"} tone="gold" />
              <Readout
                k="Status"
                v={status === "cashed" ? "Cashed" : status === "busted" ? "Busted" : status === "running" ? "Running" : "Idle"}
              />
            </div>
            <label className="block text-xs text-slate-400 uppercase tracking-widest mt-3 mb-1">
              Auto-cashout multiplier
            </label>
            <input
              type="number"
              min="1.01"
              step="0.01"
              value={autoCashout}
              onChange={(e) => setAutoCashout(e.target.value)}
              disabled={running}
              placeholder="Leave empty to always ride to crash"
              className="input font-mono tabular-nums"
            />
            {outcome && status !== "running" && (
              <div className="mt-4 text-sm">
                <span className="text-slate-400">Crash point: </span>
                <span className="font-mono tabular-nums text-lg">{outcome.crashMult.toFixed(2)}×</span>
                <span className={`ml-3 font-semibold ${outcome.won ? "text-gold" : "text-crimson"}`}>
                  {outcome.won
                    ? `CASHED ${outcome.cashedAt?.toFixed(2)}× · +${Math.round(outcome.payout).toLocaleString()}`
                    : "BUSTED"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BetStepper {...bet} disabled={running} />
            <button className="btn btn-primary flex-1 h-14" disabled={running || !session.address} onClick={launch}>
              {running ? "Running…" : "Launch"}
            </button>
          </div>
          {error && <p className="text-crimson text-sm">{error}</p>}
          <p className="text-xs text-slate-500 leading-relaxed">
            Auto-cashout only. Set your target before launch — the server commits the crash point via HMAC and settles instantly.
            The display replays the climb from the sealed result.
          </p>
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
