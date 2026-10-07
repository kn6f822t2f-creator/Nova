import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getOrCreateUser, setClientSeed } from "@/lib/db";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { clientSeed } = await req.json();
  if (typeof clientSeed !== "string" || clientSeed.length < 4 || clientSeed.length > 128) {
    return NextResponse.json({ error: "invalid clientSeed" }, { status: 400 });
  }
  const user = getOrCreateUser(s.address);
  const seeds = setClientSeed(user.id, clientSeed);
  return NextResponse.json({
    serverSeedHash: seeds.server_seed_hash,
    clientSeed: seeds.client_seed,
    nonce: seeds.nonce,
  });
}
