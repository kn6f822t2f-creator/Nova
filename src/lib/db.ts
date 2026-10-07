import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { newServerSeed, hashSeed, newClientSeed } from "./rng";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "nova.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT UNIQUE NOT NULL,
  balance TEXT NOT NULL DEFAULT '0',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  server_seed TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  client_seed TEXT NOT NULL,
  nonce INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  revealed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS seeds_user_active ON seeds(user_id, active);

CREATE TABLE IF NOT EXISTS spins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  seeds_id INTEGER NOT NULL REFERENCES seeds(id),
  nonce INTEGER NOT NULL,
  bet TEXT NOT NULL,
  win TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS spins_user ON spins(user_id, created_at);

CREATE TABLE IF NOT EXISTS deposit_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  derivation_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  amount TEXT NOT NULL,
  credits TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  block_number INTEGER,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  to_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  amount TEXT NOT NULL,
  credits_debited TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
`);

export interface UserRow {
  id: number;
  address: string;
  balance: string;
  created_at: number;
}

export interface SeedsRow {
  id: number;
  user_id: number;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  active: number;
  revealed_at: number | null;
  created_at: number;
}

export function getOrCreateUser(address: string): UserRow {
  const addr = address.toLowerCase();
  const existing = db
    .prepare("SELECT * FROM users WHERE address = ?")
    .get(addr) as UserRow | undefined;
  if (existing) return existing;
  const now = Date.now();
  const info = db
    .prepare("INSERT INTO users (address, balance, created_at) VALUES (?, '0', ?)")
    .run(addr, now);
  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(info.lastInsertRowid as number) as UserRow;
  ensureActiveSeeds(user.id);
  return user;
}

export function ensureActiveSeeds(userId: number): SeedsRow {
  const active = db
    .prepare("SELECT * FROM seeds WHERE user_id = ? AND active = 1")
    .get(userId) as SeedsRow | undefined;
  if (active) return active;
  const serverSeed = newServerSeed();
  const info = db
    .prepare(
      `INSERT INTO seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, active, created_at)
       VALUES (?, ?, ?, ?, 0, 1, ?)`,
    )
    .run(userId, serverSeed, hashSeed(serverSeed), newClientSeed(), Date.now());
  return db
    .prepare("SELECT * FROM seeds WHERE id = ?")
    .get(info.lastInsertRowid as number) as SeedsRow;
}

export function rotateSeeds(userId: number, newClient?: string): SeedsRow {
  const now = Date.now();
  db.prepare(
    "UPDATE seeds SET active = 0, revealed_at = ? WHERE user_id = ? AND active = 1",
  ).run(now, userId);
  const serverSeed = newServerSeed();
  const info = db
    .prepare(
      `INSERT INTO seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, active, created_at)
       VALUES (?, ?, ?, ?, 0, 1, ?)`,
    )
    .run(userId, serverSeed, hashSeed(serverSeed), newClient || newClientSeed(), now);
  return db
    .prepare("SELECT * FROM seeds WHERE id = ?")
    .get(info.lastInsertRowid as number) as SeedsRow;
}

export function setClientSeed(userId: number, clientSeed: string): SeedsRow {
  db.prepare("UPDATE seeds SET client_seed = ? WHERE user_id = ? AND active = 1").run(
    clientSeed,
    userId,
  );
  return ensureActiveSeeds(userId);
}

export function incrementNonce(seedsId: number): number {
  const row = db
    .prepare("UPDATE seeds SET nonce = nonce + 1 WHERE id = ? RETURNING nonce")
    .get(seedsId) as { nonce: number };
  return row.nonce;
}

export function updateBalance(userId: number, delta: bigint): bigint {
  const row = db.prepare("SELECT balance FROM users WHERE id = ?").get(userId) as
    | { balance: string }
    | undefined;
  if (!row) throw new Error("user not found");
  const next = BigInt(row.balance) + delta;
  if (next < 0n) throw new Error("insufficient balance");
  db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(next.toString(), userId);
  return next;
}

export function getBalance(userId: number): bigint {
  const row = db.prepare("SELECT balance FROM users WHERE id = ?").get(userId) as
    | { balance: string }
    | undefined;
  return row ? BigInt(row.balance) : 0n;
}
