import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const COOKIE = "nova_session";
const SECRET = process.env.SESSION_SECRET || "dev-insecure-change-me";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(payload: string): string {
  const mac = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  try {
    if (
      mac.length === expected.length &&
      timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))
    ) {
      return payload;
    }
  } catch {
    return null;
  }
  return null;
}

export function createSession(address: string): string {
  const payload = `${address.toLowerCase()}:${Date.now()}:${randomBytes(8).toString("hex")}`;
  return sign(payload);
}

export async function readSession(): Promise<{ address: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  const [address] = payload.split(":");
  return { address };
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function putNonceCookie(nonce: string) {
  const jar = await cookies();
  jar.set("nova_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
}

export async function takeNonceCookie(): Promise<string | null> {
  const jar = await cookies();
  const n = jar.get("nova_nonce")?.value;
  if (n) jar.delete("nova_nonce");
  return n ?? null;
}
