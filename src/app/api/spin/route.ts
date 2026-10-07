import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import {
  db,
  ensureActiveSeeds,
  getBalance,
  getOrCreateUser,
  incrementNonce,
  updateBalance,
} from "@/lib/db";
import { RNG } from "@/lib/rng";
import { spin } from "@/lib/slot/engine";

const MIN_BET = 1n;
const MAX_BET = 10_000n;

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const bet = (() => {
    try {
      return BigInt(body.bet);
    } catch {
      return 0n;
    }
  })();
  if (bet < MIN_BET || bet > MAX_BET) {
    return NextResponse.json({ error: "invalid bet" }, { status: 400 });
  }

  const user = getOrCreateUser(s.address);
  const balance = getBalance(user.id);
  if (balance < bet) return NextResponse.json({ error: "insufficient balance" }, { status: 400 });

  const seeds = ensureActiveSeeds(user.id);

  const tx = db.transaction(() => {
    updateBalance(user.id, -bet);
    const usedNonce = incrementNonce(seeds.id) - 1;
    const rng = new RNG({
      serverSeed: seeds.server_seed,
      clientSeed: seeds.client_seed,
      nonce: usedNonce,
    });
    const outcome = spin(rng, Number(bet));
    const winBig = BigInt(Math.round(outcome.totalWin));
    if (winBig > 0n) updateBalance(user.id, winBig);
    db.prepare(
      `INSERT INTO spins (user_id, seeds_id, nonce, bet, win, outcome, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      user.id,
      seeds.id,
      usedNonce,
      bet.toString(),
      winBig.toString(),
      JSON.stringify(outcome),
      Date.now(),
    );
    return { outcome, usedNonce, newBalance: getBalance(user.id) };
  });

  const { outcome, usedNonce, newBalance } = tx();

  return NextResponse.json({
    outcome,
    nonce: usedNonce,
    serverSeedHash: seeds.server_seed_hash,
    clientSeed: seeds.client_seed,
    balance: newBalance.toString(),
  });
}
