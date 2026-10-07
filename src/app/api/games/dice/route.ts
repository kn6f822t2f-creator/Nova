import { NextRequest, NextResponse } from "next/server";
import { parseBet, requireAuth, runGame } from "@/lib/games/runner";
import { playDice, type DiceMode } from "@/lib/games/dice";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const { bet, error } = parseBet(body.bet);
  if (error) return error;
  const mode: DiceMode = body.mode === "over" ? "over" : "under";
  const target = Number(body.target);
  if (!Number.isFinite(target) || target < 2 || target > 98) {
    return NextResponse.json({ error: "target must be in [2, 98]" }, { status: 400 });
  }
  const res = runGame(auth.user.id, bet!, "DICE", ({ rng, bet }) => {
    const o = playDice(rng, Number(bet), mode, target);
    return { outcome: o, payoutCredits: BigInt(Math.round(o.payout)) };
  });
  if (res.error) return res.error;
  return NextResponse.json(res.body);
}
