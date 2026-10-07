import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { BalanceBar } from "@/components/BalanceBar";

const GAMES = [
  {
    slug: "nova",
    name: "Nova Reels",
    tagline: "5×3 reels · 20 lines · wilds, scatters, free spins",
    emoji: "⭐",
    rtp: "~96%",
  },
];

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-glow">Nova</span>
            <span className="text-slate-400 text-base ml-3">provably-fair crypto casino</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <BalanceBar />
          <WalletButton />
        </div>
      </header>

      <section>
        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-3">Slots</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {GAMES.map((g) => (
            <Link
              key={g.slug}
              href={`/slots/${g.slug}`}
              className="panel block hover:border-glow transition-colors group"
            >
              <div className="text-5xl mb-3">{g.emoji}</div>
              <div className="text-lg font-semibold group-hover:text-glow">{g.name}</div>
              <div className="text-slate-400 text-sm">{g.tagline}</div>
              <div className="chip mt-3 inline-block">RTP {g.rtp}</div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-16 text-slate-500 text-xs">
        <p>
          Every spin is HMAC-SHA256(serverSeed, `${"${clientSeed}:${nonce}:${cursor}"}`). The server seed is
          committed as a SHA-256 hash before any spin; rotate to reveal and verify.
        </p>
      </footer>
    </main>
  );
}
