import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { putNonceCookie } from "@/lib/session";

export async function GET() {
  const nonce = randomBytes(16).toString("hex");
  await putNonceCookie(nonce);
  return NextResponse.json({ nonce });
}
