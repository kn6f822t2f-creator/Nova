import { HDNodeWallet, JsonRpcProvider, Mnemonic, Wallet, formatEther, parseEther } from "ethers";
import { db } from "./db";

const MNEMONIC = process.env.HOT_WALLET_MNEMONIC;
const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const HOT_WALLET_PK = process.env.HOT_WALLET_PK; // optional explicit hot key for withdrawals

// 1 ETH on-chain = CREDIT_RATE casino credits.
export const CREDIT_RATE = BigInt(process.env.CREDIT_RATE || "100000");

export function provider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL);
}

export function deriveAddress(index: number): { address: string; privateKey: string } {
  if (!MNEMONIC) throw new Error("HOT_WALLET_MNEMONIC not set");
  const seed = Mnemonic.fromPhrase(MNEMONIC);
  const node = HDNodeWallet.fromMnemonic(seed, `m/44'/60'/0'/0/${index}`);
  return { address: node.address, privateKey: node.privateKey };
}

export function ensureDepositAddress(userId: number): { address: string; chain: string } {
  const existing = db
    .prepare("SELECT address, chain FROM deposit_addresses WHERE user_id = ?")
    .get(userId) as { address: string; chain: string } | undefined;
  if (existing) return existing;

  const row = db.prepare("SELECT COALESCE(MAX(derivation_index), -1) AS mx FROM deposit_addresses").get() as {
    mx: number;
  };
  const idx = row.mx + 1;
  const { address } = deriveAddress(idx);
  db.prepare(
    "INSERT INTO deposit_addresses (user_id, chain, address, derivation_index, created_at) VALUES (?, 'ETH', ?, ?, ?)",
  ).run(userId, address, idx, Date.now());
  return { address, chain: "ETH" };
}

// weiToCredits: 1 ETH → CREDIT_RATE credits; wei → wei * rate / 1e18
export function weiToCredits(wei: bigint): bigint {
  return (wei * CREDIT_RATE) / 10n ** 18n;
}

export function creditsToWei(credits: bigint): bigint {
  return (credits * 10n ** 18n) / CREDIT_RATE;
}

export async function scanAddressForDeposits(userId: number): Promise<{ credited: bigint; txs: number }> {
  const row = db
    .prepare("SELECT address, derivation_index FROM deposit_addresses WHERE user_id = ?")
    .get(userId) as { address: string; derivation_index: number } | undefined;
  if (!row) return { credited: 0n, txs: 0 };

  const p = provider();
  const latest = await p.getBlockNumber();
  const seen = db
    .prepare("SELECT tx_hash FROM deposits WHERE user_id = ?")
    .all(userId) as Array<{ tx_hash: string }>;
  const seenSet = new Set(seen.map((r) => r.tx_hash));

  // Scan a sliding window of recent blocks for incoming txs.
  // In production you'd index via an archive node, Alchemy getAssetTransfers, or a dedicated indexer.
  const windowSize = Number(process.env.SCAN_WINDOW_BLOCKS || "500");
  const from = Math.max(0, latest - windowSize);
  let credited = 0n;
  let found = 0;

  for (let b = from; b <= latest; b++) {
    const block = await p.getBlock(b, true);
    if (!block) continue;
    for (const tx of block.prefetchedTransactions ?? []) {
      if (!tx.to || tx.to.toLowerCase() !== row.address.toLowerCase()) continue;
      if (tx.value === 0n) continue;
      if (seenSet.has(tx.hash)) continue;
      const credits = weiToCredits(tx.value);
      db.prepare(
        `INSERT INTO deposits (user_id, address, chain, amount, credits, tx_hash, block_number, confirmed, created_at)
         VALUES (?, ?, 'ETH', ?, ?, ?, ?, 1, ?)`,
      ).run(userId, row.address, tx.value.toString(), credits.toString(), tx.hash, b, Date.now());
      db.prepare("UPDATE users SET balance = CAST((CAST(balance AS INTEGER) + ?) AS TEXT) WHERE id = ?").run(
        Number(credits),
        userId,
      );
      credited += credits;
      found++;
    }
  }
  return { credited, txs: found };
}

export async function sendWithdrawal(toAddress: string, wei: bigint): Promise<string> {
  if (!HOT_WALLET_PK && !MNEMONIC) throw new Error("no hot wallet key configured");
  const key = HOT_WALLET_PK || deriveAddress(0).privateKey;
  const wallet = new Wallet(key, provider());
  const tx = await wallet.sendTransaction({ to: toAddress, value: wei });
  return tx.hash;
}

export { formatEther, parseEther };
