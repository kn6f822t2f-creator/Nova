import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { db, getOrCreateUser, updateBalance } from "@/lib/db";
import { creditsToWei, sendWithdrawal } from "@/lib/wallet";
import { isAddress } from "viem";

const MIN_CREDITS = 100n;

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { to, credits } = await req.json();
  if (!isAddress(to)) return NextResponse.json({ error: "bad address" }, { status: 400 });
  const amt = BigInt(credits);
  if (amt < MIN_CREDITS) return NextResponse.json({ error: "below minimum" }, { status: 400 });

  const user = getOrCreateUser(s.address);
  const wei = creditsToWei(amt);

  // Debit first; if the tx fails, we re-credit.
  const row = db.prepare("SELECT balance FROM users WHERE id = ?").get(user.id) as { balance: string };
  if (BigInt(row.balance) < amt) {
    return NextResponse.json({ error: "insufficient balance" }, { status: 400 });
  }
  updateBalance(user.id, -amt);
  const wInfo = db
    .prepare(
      `INSERT INTO withdrawals (user_id, to_address, chain, amount, credits_debited, status, created_at)
       VALUES (?, ?, 'ETH', ?, ?, 'pending', ?)`,
    )
    .run(user.id, to.toLowerCase(), wei.toString(), amt.toString(), Date.now());

  try {
    const hash = await sendWithdrawal(to, wei);
    db.prepare("UPDATE withdrawals SET tx_hash = ?, status = 'broadcast' WHERE id = ?").run(
      hash,
      wInfo.lastInsertRowid as number,
    );
    return NextResponse.json({ txHash: hash });
  } catch (e: any) {
    updateBalance(user.id, amt); // refund
    db.prepare("UPDATE withdrawals SET status = 'failed' WHERE id = ?").run(wInfo.lastInsertRowid as number);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
