import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getOrCreateUser } from "@/lib/db";
import { ensureDepositAddress } from "@/lib/wallet";

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = getOrCreateUser(s.address);
  try {
    const addr = ensureDepositAddress(user.id);
    return NextResponse.json(addr);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
