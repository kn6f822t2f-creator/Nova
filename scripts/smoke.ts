import { RNG, newServerSeed, newClientSeed } from "../src/lib/rng";
import { spin } from "../src/lib/slot/engine";

const N = 500_000;
const BET = 20;
let payout = 0;
let wins = 0;
let scatters = 0;
let freeSpins = 0;
const serverSeed = newServerSeed();
const clientSeed = newClientSeed();

for (let i = 0; i < N; i++) {
  const rng = new RNG({ serverSeed, clientSeed, nonce: i });
  const o = spin(rng, BET);
  payout += o.totalWin;
  if (o.totalWin > 0) wins++;
  if (o.scatterCount >= 3) scatters++;
  if (o.freeSpinsAwarded > 0) freeSpins++;
}

const wagered = N * BET;
console.log(`spins:          ${N}`);
console.log(`wagered:        ${wagered}`);
console.log(`total paid:     ${payout.toFixed(2)}`);
console.log(`RTP:            ${((payout / wagered) * 100).toFixed(2)}%`);
console.log(`hit rate:       ${((wins / N) * 100).toFixed(2)}%`);
console.log(`scatter 3+:     ${scatters} (${((scatters / N) * 100).toFixed(3)}%)`);
console.log(`free spin trg:  ${freeSpins}`);
