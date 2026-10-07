// Dev helper: credit a given address with starter chips.
// Usage: tsx scripts/seed.ts 0x1234... 10000
import { getOrCreateUser, updateBalance } from "../src/lib/db";

const addr = process.argv[2];
const amount = BigInt(process.argv[3] || "10000");
if (!addr) {
  console.error("usage: tsx scripts/seed.ts <address> <credits>");
  process.exit(1);
}
const user = getOrCreateUser(addr);
updateBalance(user.id, amount);
console.log(`credited ${amount} credits to ${user.address}`);
