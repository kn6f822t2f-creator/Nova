import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getOrCreateUser, rotateSeeds, db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const user = getOrCreateUser(s.address);

  // Reveal the OLD active seed first.
  const old = db
    .prepare("SELECT server_seed, server_seed_hash, client_seed, nonce FROM seeds WHERE user_id = ? AND active = 1")
    .get(user.id) as
    | { server_seed: string; server_seed_hash: string; client_seed: string; nonce: number }
    | undefined;

  const next = rotateSeeds(user.id, body.clientSeed);
  return NextResponse.json({
    revealed: old,
    next: {
      serverSeedHash: next.server_seed_hash,
      clientSeed: next.client_seed,
      nonce: next.nonce,
    },
  });
}
