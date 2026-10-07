import { db, ensureActiveSeeds, getBalance, getOrCreateUser, incrementNonce, updateBalance } from "../db";
import { RNG } from "../rng";
import { readSession } from "../session";
import { NextResponse } from "next/server";

export interface RoundContext {
  userId: number;
  bet: bigint;
  rng: RNG;
  seedsId: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
}

const MIN_BET = 1n;
const MAX_BET = 10_000n;

export async function requireAuth() {
  const s = await readSession();
  if (!s) return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  const user = getOrCreateUser(s.address);
  return { user };
}

export function parseBet(raw: unknown): { bet?: bigint; error?: ReturnType<typeof NextResponse.json> } {
  try {
    const bet = BigInt(raw as string);
    if (bet < MIN_BET || bet > MAX_BET) {
      return { error: NextResponse.json({ error: "invalid bet" }, { status: 400 }) };
    }
    return { bet };
  } catch {
    return { error: NextResponse.json({ error: "invalid bet" }, { status: 400 }) };
  }
}

export function runGame<T>(
  userId: number,
  bet: bigint,
  game: string,
  compute: (ctx: RoundContext) => { outcome: T; payoutCredits: bigint },
) {
  const balance = getBalance(userId);
  if (balance < bet) {
    return { error: NextResponse.json({ error: "insufficient balance" }, { status: 400 }) };
  }
  const seeds = ensureActiveSeeds(userId);

  const tx = db.transaction(() => {
    updateBalance(userId, -bet);
    const usedNonce = incrementNonce(seeds.id) - 1;
    const rng = new RNG({
      serverSeed: seeds.server_seed,
      clientSeed: seeds.client_seed,
      nonce: usedNonce,
    });
    const { outcome, payoutCredits } = compute({
      userId,
      bet,
      rng,
      seedsId: seeds.id,
      nonce: usedNonce,
      serverSeedHash: seeds.server_seed_hash,
      clientSeed: seeds.client_seed,
    });
    if (payoutCredits > 0n) updateBalance(userId, payoutCredits);
    db.prepare(
      `INSERT INTO spins (user_id, seeds_id, nonce, bet, win, outcome, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      seeds.id,
      usedNonce,
      bet.toString(),
      payoutCredits.toString(),
      JSON.stringify({ game, ...outcome }),
      Date.now(),
    );
    return { outcome, usedNonce, newBalance: getBalance(userId) };
  });

  const { outcome, usedNonce, newBalance } = tx();
  return {
    body: {
      outcome,
      nonce: usedNonce,
      serverSeedHash: seeds.server_seed_hash,
      clientSeed: seeds.client_seed,
      balance: newBalance.toString(),
    },
  };
}
