import { NextRequest, NextResponse } from "next/server";
import { RNG, hashSeed } from "@/lib/rng";
import { spin } from "@/lib/slot/engine";

// Public verification endpoint — anyone can replay a spin given the revealed seed set.
export async function POST(req: NextRequest) {
  const { serverSeed, clientSeed, nonce, bet } = await req.json();
  if (!serverSeed || !clientSeed || nonce === undefined || !bet) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const rng = new RNG({ serverSeed, clientSeed, nonce: Number(nonce) });
  const outcome = spin(rng, Number(bet));
  return NextResponse.json({
    serverSeedHash: hashSeed(serverSeed),
    outcome,
  });
}
