import { NextRequest, NextResponse } from "next/server";
import { parseBet, requireAuth, runGame } from "@/lib/games/runner";
import { playCrash } from "@/lib/games/crash";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const { bet, error } = parseBet(body.bet);
  if (error) return error;
  let autoCashout: number | null = null;
  if (body.autoCashout !== undefined && body.autoCashout !== null && body.autoCashout !== "") {
    const n = Number(body.autoCashout);
    if (!Number.isFinite(n) || n < 1.01 || n > 1_000_000) {
      return NextResponse.json({ error: "autoCashout must be in [1.01, 1000000]" }, { status: 400 });
    }
    autoCashout = n;
  }
  const res = runGame(auth.user.id, bet!, "CRASH", ({ rng, bet }) => {
    const o = playCrash(rng, Number(bet), autoCashout);
    return { outcome: o, payoutCredits: BigInt(Math.round(o.payout)) };
  });
  if (res.error) return res.error;
  return NextResponse.json(res.body);
}
