"use client";

import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { useEffect, useState } from "react";
import { useSession } from "@/store";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const session = useSession();
  const [signingIn, setSigningIn] = useState(false);

  const refreshMe = async () => {
    const res = await fetch("/api/me");
    if (res.ok) {
      const data = await res.json();
      session.setMe(data);
    } else {
      session.setMe(null);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const siwe = async () => {
    if (!address) return;
    setSigningIn(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();
      const message = `Nova wants you to sign in with your wallet.\n\nAddress: ${address}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });
      if (verifyRes.ok) await refreshMe();
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    disconnect();
    session.setMe(null);
  };

  if (!isConnected) {
    const inj = connectors.find((c) => c.id === "injected" || c.id === "metaMaskSDK") || connectors[0];
    return (
      <button className="btn btn-primary" disabled={!inj || isPending} onClick={() => inj && connect({ connector: inj })}>
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  if (!session.address) {
    return (
      <div className="flex items-center gap-2">
        <span className="chip">{address!.slice(0, 6)}…{address!.slice(-4)}</span>
        <button className="btn btn-primary" disabled={signingIn} onClick={siwe}>
          {signingIn ? "Signing…" : "Sign in"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="chip">{session.address.slice(0, 6)}…{session.address.slice(-4)}</span>
      <button className="btn btn-ghost" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
