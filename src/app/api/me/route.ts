import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getOrCreateUser, ensureActiveSeeds, getBalance } from "@/lib/db";

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = getOrCreateUser(s.address);
  const seeds = ensureActiveSeeds(user.id);
  const balance = getBalance(user.id);
  return NextResponse.json({
    address: user.address,
    balance: balance.toString(),
    seeds: {
      serverSeedHash: seeds.server_seed_hash,
      clientSeed: seeds.client_seed,
      nonce: seeds.nonce,
    },
  });
}
