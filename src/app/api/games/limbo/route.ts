import { NextRequest, NextResponse } from "next/server";
import { parseBet, requireAuth, runGame } from "@/lib/games/runner";
import { playLimbo } from "@/lib/games/limbo";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const { bet, error } = parseBet(body.bet);
  if (error) return error;
  const target = Number(body.target);
  if (!Number.isFinite(target) || target < 1.01 || target > 1_000_000) {
    return NextResponse.json({ error: "target must be in [1.01, 1000000]" }, { status: 400 });
  }
  const res = runGame(auth.user.id, bet!, "LIMBO", ({ rng, bet }) => {
    const o = playLimbo(rng, Number(bet), target);
    return { outcome: o, payoutCredits: BigInt(Math.round(o.payout)) };
  });
  if (res.error) return res.error;
  return NextResponse.json(res.body);
}
