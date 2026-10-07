import { createHmac, createHash, randomBytes } from "crypto";

export interface Seeds {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

export function newServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

export function newClientSeed(): string {
  return randomBytes(16).toString("hex");
}

export function hmacBytes(seeds: Seeds, cursor: number): Buffer {
  const message = `${seeds.clientSeed}:${seeds.nonce}:${cursor}`;
  return createHmac("sha256", seeds.serverSeed).update(message).digest();
}

export class RNG {
  private seeds: Seeds;
  private cursor = 0;
  private buffer: Buffer | null = null;
  private offset = 0;

  constructor(seeds: Seeds) {
    this.seeds = seeds;
  }

  private refill() {
    this.buffer = hmacBytes(this.seeds, this.cursor);
    this.cursor += 1;
    this.offset = 0;
  }

  nextFloat(): number {
    if (!this.buffer || this.offset + 4 > this.buffer.length) this.refill();
    const b = this.buffer!;
    const n =
      ((b[this.offset] << 24) >>> 0) +
      ((b[this.offset + 1] << 16) >>> 0) +
      ((b[this.offset + 2] << 8) >>> 0) +
      (b[this.offset + 3] >>> 0);
    this.offset += 4;
    return n / 0x100000000;
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  nextIndexWeighted(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.nextFloat() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}
