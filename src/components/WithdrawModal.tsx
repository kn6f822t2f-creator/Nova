"use client";

import { useState } from "react";
import { useSession } from "@/store";

export function WithdrawModal({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const [to, setTo] = useState("");
  const [credits, setCredits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, credits }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Withdrawal failed");
      } else {
        setStatus(`Broadcast: ${data.txHash}`);
        const me = await fetch("/api/me").then((r) => r.json());
        session.setBalance(me.balance);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="panel w-[min(520px,92vw)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Withdraw ETH</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="block text-sm text-slate-400 mb-1">Destination address</label>
        <input className="input mb-3" placeholder="0x…" value={to} onChange={(e) => setTo(e.target.value)} />
        <label className="block text-sm text-slate-400 mb-1">Amount (credits)</label>
        <input
          className="input mb-4"
          type="number"
          placeholder="100"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
        <button className="btn btn-primary w-full" disabled={submitting || !to || !credits} onClick={submit}>
          {submitting ? "Broadcasting…" : "Withdraw"}
        </button>
        {status && <p className="text-slate-300 text-sm mt-3 break-all">{status}</p>}
        {error && <p className="text-crimson text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}
