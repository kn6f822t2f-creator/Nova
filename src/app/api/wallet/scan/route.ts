import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getOrCreateUser, getBalance } from "@/lib/db";
import { scanAddressForDeposits } from "@/lib/wallet";

export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = getOrCreateUser(s.address);
  try {
    const { credited, txs } = await scanAddressForDeposits(user.id);
    return NextResponse.json({
      credited: credited.toString(),
      txs,
      balance: getBalance(user.id).toString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
