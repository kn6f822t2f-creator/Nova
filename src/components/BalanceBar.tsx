"use client";

import { useState } from "react";
import { useSession } from "@/store";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "./WithdrawModal";

export function BalanceBar() {
  const { balance, address } = useSession();
  const [modal, setModal] = useState<null | "deposit" | "withdraw">(null);

  if (!address) return null;

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="chip">
          <span className="text-slate-400 mr-2">Balance</span>
          <span className="text-gold font-semibold">{balance.toString()}</span>
          <span className="text-slate-500 ml-1">credits</span>
        </span>
        <button className="btn" onClick={() => setModal("deposit")}>
          Deposit
        </button>
        <button className="btn btn-ghost" onClick={() => setModal("withdraw")}>
          Withdraw
        </button>
      </div>
      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} />}
      {modal === "withdraw" && <WithdrawModal onClose={() => setModal(null)} />}
    </>
  );
}
