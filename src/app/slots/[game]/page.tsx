"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { BalanceBar } from "@/components/BalanceBar";
import { SlotMachine } from "@/components/SlotMachine";
import { BetControls } from "@/components/BetControls";
import { VerifyPanel } from "@/components/VerifyPanel";
import { useSession } from "@/store";
import { LINE_PAY, SCATTER_PAY, FREE_SPIN_TRIGGER, type Symbol } from "@/lib/slot/config";
import type { SpinOutcome } from "@/lib/slot/engine";

export default function GamePage() {
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [spinning, setSpinning] = useState(false);
  const session = useSession();

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-glow">
            ← Lobby
          </Link>
          <h1 className="text-xl font-semibold">Nova Reels</h1>
        </div>
        <div className="flex items-center gap-3">
          <BalanceBar />
          <WalletButton />
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <SlotMachine outcome={outcome} spinning={spinning} />
          <BetControls onOutcome={setOutcome} spinning={spinning} setSpinning={setSpinning} />
        </div>
        <aside className="space-y-4">
          {session.address ? (
            <VerifyPanel />
          ) : (
            <div className="panel text-sm text-slate-400">
              Connect your wallet and sign in to spin. Your balance, seeds, and spin history are
              tied to your address.
            </div>
          )}
          <Paytable />
        </aside>
      </div>
    </main>
  );
}

const LABEL: Record<Symbol, string> = {
  WILD: "⭐ Wild",
  SCAT: "💎 Scatter",
  SEVEN: "7️⃣ Seven",
  BAR: "🅱️ Bar",
  BELL: "🔔 Bell",
  CHERRY: "🍒 Cherry",
  LEMON: "🍋 Lemon",
  ORANGE: "🍊 Orange",
  PLUM: "🍇 Plum",
};

const NOTE: Partial<Record<Symbol, string>> = {
  WILD: "substitutes any",
  SEVEN: "top line pay",
};

const ORDER: Symbol[] = ["WILD", "SEVEN", "BAR", "BELL", "CHERRY", "LEMON", "ORANGE", "PLUM"];

function Paytable() {
  return (
    <div className="panel text-xs">
      <h3 className="text-sm font-semibold mb-2">Paytable</h3>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1">
        <div className="text-slate-500">Symbol</div>
        <div className="text-slate-500">3</div>
        <div className="text-slate-500">4</div>
        <div className="text-slate-500">5</div>
        {ORDER.flatMap((sym, i) => {
          const [a, b, c] = LINE_PAY[sym];
          return [
            <div key={`s${i}`}>
              {LABEL[sym]}
              {NOTE[sym] && <div className="text-slate-500">{NOTE[sym]}</div>}
            </div>,
            <div key={`a${i}`} className="tabular-nums">
              {a}×
            </div>,
            <div key={`b${i}`} className="tabular-nums">
              {b}×
            </div>,
            <div key={`c${i}`} className="tabular-nums">
              {c}×
            </div>,
          ];
        })}
        <div>
          {LABEL.SCAT}
          <div className="text-slate-500">
            anywhere · +{Object.values(FREE_SPIN_TRIGGER).join("/")} free spins
          </div>
        </div>
        <div className="tabular-nums">{SCATTER_PAY[3]}× bet</div>
        <div className="tabular-nums">{SCATTER_PAY[4]}× bet</div>
        <div className="tabular-nums">{SCATTER_PAY[5]}× bet</div>
      </div>
      <p className="text-slate-500 mt-2">Line pays multiply the line bet (total bet / 20).</p>
    </div>
  );
}
