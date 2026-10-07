import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { createSession, setSessionCookie, takeNonceCookie } from "@/lib/session";
import { getOrCreateUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { address, signature, message } = await req.json();
  if (!address || !signature || !message) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const nonce = await takeNonceCookie();
  if (!nonce) return NextResponse.json({ error: "no challenge" }, { status: 400 });
  if (!message.includes(nonce)) return NextResponse.json({ error: "nonce mismatch" }, { status: 400 });

  const valid = await verifyMessage({ address, message, signature });
  if (!valid) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const user = getOrCreateUser(address);
  const token = createSession(user.address);
  await setSessionCookie(token);
  return NextResponse.json({ ok: true, address: user.address });
}
