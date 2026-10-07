# Nova

Provably-fair crypto casino. One game shipped — Nova Reels, 5×3 slot with 20 paylines, wilds, scatters, free spins. Wallet-signed auth, server-authoritative RNG, SQLite persistence, HD-wallet deposit addresses, on-chain withdrawals.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + Framer Motion for the reels
- wagmi + viem for wallet connect and signature verification
- ethers v6 for HD derivation and withdrawal signing
- better-sqlite3 for state (balances, seeds, spins, deposits, withdrawals)

## Provably-fair model

Each user has one active seed set at a time:

- `server_seed` — 32 random bytes, generated server-side, never revealed while active
- `server_seed_hash` — SHA-256 of the server seed, shown to the user as a commitment
- `client_seed` — generated server-side initially, user can change
- `nonce` — incremented per spin

Every spin's RNG stream is `HMAC-SHA256(server_seed, "${client_seed}:${nonce}:${cursor}")`. Four-byte chunks of the HMAC output are consumed as `uint32`s, divided by 2³² for `[0,1)` floats, which drive reel-stop selection on the materialized reel strips.

To verify: rotate the server seed (`POST /api/seed/rotate`) which marks the old one revealed. Replay any past spin with `POST /api/verify` passing `{serverSeed, clientSeed, nonce, bet}` — the response must match the stored outcome for that nonce.

## Setup

```bash
cp .env.example .env
# edit .env — HOT_WALLET_MNEMONIC and SESSION_SECRET at minimum
npm install
npm run dev
```

Visit http://localhost:3000.

## Flows

- **Connect & sign in.** Click Connect Wallet (MetaMask or any injected provider). The frontend fetches `/api/auth/nonce`, has the wallet sign a SIWE-style message, and `POST`s to `/api/auth/verify`. The server verifies with viem's `verifyMessage`, mints a signed-cookie session, and returns the user record.

- **Deposit.** `GET /api/wallet/deposit` returns the user's deposit address, derived from `HOT_WALLET_MNEMONIC` at path `m/44'/60'/0'/0/N` where N is the user's derivation index. Send ETH to that address. `POST /api/wallet/scan` sweeps recent blocks on `RPC_URL` for incoming txs and credits the balance at `CREDIT_RATE` credits per 1 ETH.

- **Spin.** `POST /api/spin {bet}`. The server loads the active seed, increments the nonce atomically in a SQLite transaction, instantiates the RNG, calls the slot engine, debits the bet, credits any wins, and persists the full outcome (grid, line wins, scatter, free spins) with the nonce used. The client animates the reels; the authoritative outcome is already determined.

- **Withdraw.** `POST /api/wallet/withdraw {to, credits}`. Debits the user's balance, inserts a `withdrawals` row, broadcasts a tx from the hot wallet (`HOT_WALLET_PK` or derivation index 0), and records the tx hash. On broadcast failure the balance is refunded.

## Slot math

Reel strips are weighted per `src/lib/slot/config.ts`. Each reel materializes to a sequence (e.g. `[SEVEN, BAR, BAR, BELL, …]`) and the RNG picks a stop index `[0, len)`; the three visible symbols are `strip[(stop + 0..2) % len]`.

Paylines are evaluated left-to-right. Wild substitutes for any non-scatter and takes the best match. Scatters pay anywhere on screen and 3+ triggers free spins (`FREE_SPIN_TRIGGER`).

The paytable targets ~96% RTP. Monte-Carlo validate it with:

```ts
import { RNG, newServerSeed, newClientSeed } from "./src/lib/rng";
import { spin } from "./src/lib/slot/engine";

const N = 1_000_000, bet = 20;
let payout = 0;
for (let i = 0; i < N; i++) {
  const rng = new RNG({ serverSeed: newServerSeed(), clientSeed: newClientSeed(), nonce: i });
  payout += spin(rng, bet).totalWin;
}
console.log("RTP:", payout / (N * bet));
```

Tune the strip weights or `LINE_PAY` to shift it.

## API

| route | method | purpose |
|---|---|---|
| `/api/auth/nonce` | GET | issue SIWE nonce |
| `/api/auth/verify` | POST | verify signature, mint session |
| `/api/auth/logout` | POST | clear session |
| `/api/me` | GET | current user, balance, seed hash |
| `/api/spin` | POST | execute a spin |
| `/api/seed/rotate` | POST | reveal old server seed, issue new |
| `/api/seed/client` | POST | set client seed |
| `/api/verify` | POST | replay a spin from revealed seeds |
| `/api/wallet/deposit` | GET | user's deposit address |
| `/api/wallet/scan` | POST | sweep recent blocks for incoming deposits |
| `/api/wallet/withdraw` | POST | debit balance, broadcast withdrawal tx |

## Dev helpers

```bash
# credit a connected wallet address with starter chips
npx tsx scripts/seed.ts 0xYourAddress 10000

npm run typecheck
```

## Extending

Drop a new game module under `src/lib/<game>/` with its own `engine.ts` exposing `spin(rng, bet)` and a config. Add a `src/app/games/<slug>/page.tsx`. The RNG, seed management, balance debits, and provably-fair replay all work out of the box for anything that consumes a `RNG` stream.

For multi-chain: add a derivation function per chain (`deriveBtcAddress`, `deriveSolAddress`), extend `deposit_addresses.chain`, and plug chain-specific scanners into `/api/wallet/scan`.
