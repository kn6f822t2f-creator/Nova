"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/store";

export function DepositModal({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const [address, setAddress] = useState<string | null>(null);
  const [chain, setChain] = useState<string>("ETH");
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/wallet/deposit");
      if (res.ok) {
        const data = await res.json();
        setAddress(data.address);
        setChain(data.chain);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load deposit address");
      }
    })();
  }, []);

  const scan = async () => {
    setScanning(true);
    setStatus("");
    try {
      const res = await fetch("/api/wallet/scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        session.setBalance(data.balance);
        setStatus(`Scanned. Credited: ${data.credited} (${data.txs} tx).`);
      } else {
        setStatus(data.error || "Scan failed");
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="panel w-[min(520px,92vw)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Deposit {chain}</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? (
          <p className="text-crimson">{error}</p>
        ) : address ? (
          <>
            <p className="text-slate-400 text-sm mb-2">
              Send {chain} to this address. Each confirmed tx credits your balance.
            </p>
            <div className="bg-void border border-reef rounded-lg p-3 break-all font-mono text-sm select-all">
              {address}
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button className="btn btn-primary" disabled={scanning} onClick={scan}>
                {scanning ? "Scanning…" : "Scan for deposits"}
              </button>
              <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(address)}>
                Copy
              </button>
            </div>
            {status && <p className="text-slate-300 text-sm mt-3">{status}</p>}
          </>
        ) : (
          <p className="text-slate-400">Loading…</p>
        )}
      </div>
    </div>
  );
}
