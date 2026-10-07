"use client";
import { create } from "zustand";

export interface Seeds {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface SessionState {
  address: string | null;
  balance: bigint;
  seeds: Seeds | null;
  setMe: (m: { address: string; balance: string; seeds: Seeds } | null) => void;
  setBalance: (b: string | bigint) => void;
  setSeeds: (s: Seeds) => void;
}

export const useSession = create<SessionState>((set) => ({
  address: null,
  balance: 0n,
  seeds: null,
  setMe: (m) =>
    set(
      m
        ? { address: m.address, balance: BigInt(m.balance), seeds: m.seeds }
        : { address: null, balance: 0n, seeds: null },
    ),
  setBalance: (b) => set({ balance: typeof b === "bigint" ? b : BigInt(b) }),
  setSeeds: (s) => set({ seeds: s }),
}));
