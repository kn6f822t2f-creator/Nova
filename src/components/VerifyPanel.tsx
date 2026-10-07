"use client";

import { useState } from "react";
import { useSession } from "@/store";

export function VerifyPanel() {
  const session = useSession();
  const [editingClient, setEditingClient] = useState("");
  const [revealed, setRevealed] = useState<{
    server_seed: string;
    server_seed_hash: string;
    client_seed: string;
    nonce: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session.seeds) return null;

  const saveClient = async () => {
    if (!editingClient) return;
    setBusy(true);
    const res = await fetch("/api/seed/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSeed: editingClient }),
    });
    if (res.ok) {
      const data = await res.json();
      session.setSeeds(data);
      setEditingClient("");
    }
    setBusy(false);
  };

  const rotate = async () => {
    setBusy(true);
    const res = await fetch("/api/seed/rotate", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setRevealed(data.revealed);
      session.setSeeds(data.next);
    }
    setBusy(false);
  };

  return (
    <div className="panel">
      <h3 className="text-lg font-semibold mb-3">Provably Fair</h3>
      <div className="space-y-2 text-sm">
        <Row label="Server seed (hashed)" value={session.seeds.serverSeedHash} mono />
        <Row label="Client seed" value={session.seeds.clientSeed} mono />
        <Row label="Next nonce" value={String(session.seeds.nonce)} />
      </div>
      <div className="flex items-center gap-2 mt-4">
        <input
          className="input"
          placeholder="New client seed"
          value={editingClient}
          onChange={(e) => setEditingClient(e.target.value)}
        />
        <button className="btn" disabled={busy || !editingClient} onClick={saveClient}>
          Save
        </button>
      </div>
      <button className="btn btn-ghost mt-3" disabled={busy} onClick={rotate}>
        Rotate server seed (reveals old)
      </button>
      {revealed && (
        <div className="mt-4 p-3 rounded-lg bg-void border border-reef text-xs space-y-1">
          <div className="text-glow mb-1 font-semibold">Revealed previous server seed — verify any spin:</div>
          <div className="break-all">
            <span className="text-slate-400">server:</span> {revealed.server_seed}
          </div>
          <div className="break-all">
            <span className="text-slate-400">hash:</span> {revealed.server_seed_hash}
          </div>
          <div className="break-all">
            <span className="text-slate-400">client:</span> {revealed.client_seed}
          </div>
          <div>
            <span className="text-slate-400">total nonces used:</span> {revealed.nonce}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-400 min-w-[160px]">{label}</span>
      <span className={`break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
