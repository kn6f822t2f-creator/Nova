import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { BalanceBar } from "@/components/BalanceBar";

const SLOTS = [
  {
    href: "/slots/nova",
    name: "Nova Reels",
    tagline: "5×3 reels · 20 lines · wilds, scatters, free spins",
    emoji: "🎰",
    rtp: "96%",
  },
];

const ORIGINALS = [
  {
    href: "/games/dice",
    name: "Dice",
    tagline: "Roll under or over · 99% RTP · tune your edge",
    emoji: "🎲",
    rtp: "99%",
  },
  {
    href: "/games/limbo",
    name: "Limbo",
    tagline: "Pick a target · land above it · long-tail payouts",
    emoji: "🚀",
    rtp: "99%",
  },
  {
    href: "/games/crash",
    name: "Crash",
    tagline: "Auto-cashout before the rocket blows",
    emoji: "📈",
    rtp: "~97%",
  },
];

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-10 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-glow">Nova</span>
            <span className="text-slate-400 text-base ml-3">provably-fair crypto casino</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BalanceBar />
          <WalletButton />
        </div>
      </header>

      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-3">Originals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ORIGINALS.map((g) => (
            <GameCard key={g.href} {...g} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-3">Slots</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SLOTS.map((g) => (
            <GameCard key={g.href} {...g} />
          ))}
        </div>
      </section>

      <footer className="mt-16 text-slate-500 text-xs">
        <p>
          Every outcome derives from HMAC-SHA256(serverSeed,{" "}
          <code className="font-mono text-slate-400">{"${clientSeed}:${nonce}:${cursor}"}</code>
          ). The server seed is committed as a SHA-256 hash before any play; rotate to reveal and verify.
        </p>
      </footer>
    </main>
  );
}

function GameCard({ href, name, tagline, emoji, rtp }: {
  href: string; name: string; tagline: string; emoji: string; rtp: string;
}) {
  return (
    <Link href={href} className="panel block hover:border-glow transition-colors group">
      <div className="text-5xl mb-3">{emoji}</div>
      <div className="text-lg font-semibold group-hover:text-glow">{name}</div>
      <div className="text-slate-400 text-sm">{tagline}</div>
      <div className="chip mt-3 inline-block">RTP {rtp}</div>
    </Link>
  );
}
