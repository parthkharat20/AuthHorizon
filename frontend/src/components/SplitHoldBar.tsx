import React from 'react';
import { ShieldCheck, Lock, CheckCircle, Clock } from 'lucide-react';

interface SplitHoldBarProps {
  totalAmount: number;
  capturedAmount: number;
  heldAmount: number;
  status: string;
}

export const SplitHoldBar: React.FC<SplitHoldBarProps> = ({
  totalAmount,
  capturedAmount,
  heldAmount,
  status,
}) => {
  const total = totalAmount > 0 ? totalAmount : 90.0;
  const capturedPct = Math.min(100, Math.max(0, (capturedAmount / total) * 100));
  const heldPct = Math.min(100, Math.max(0, (heldAmount / total) * 100));
  const releasedAmount = Math.max(0, total - (capturedAmount + heldAmount));
  const releasedPct = Math.min(100, Math.max(0, (releasedAmount / total) * 100));

  const isAuthorized = status === 'AUTHORIZED';
  const isPartiallyCaptured = status === 'PARTIALLY_CAPTURED';
  const isCompleted = status === 'COMPLETED';
  const isVoided = status === 'VOIDED';

  return (
    <div className="w-full bg-[#121214] border border-[#2c2c2e] rounded-xl p-3.5 space-y-2.5">
      {/* Header Metric Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#2997ff]" />
          <span className="font-semibold text-[#f5f5f7] text-xs">PayPal Authorization Split-Hold</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c1c1e] text-[#a1a1a6] border border-[#2c2c2e]">
            intent=AUTHORIZE
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-[#86868b] uppercase tracking-wider mr-1.5">Total:</span>
          <span className="text-xs font-mono font-bold text-[#f5f5f7] tabular-nums">${total.toFixed(2)} USD</span>
        </div>
      </div>

      {/* High-Precision Multi-Track Segmented Bar */}
      <div className="relative w-full h-8 bg-[#0a0a0c] rounded-lg overflow-hidden border border-[#2c2c2e] flex">
        {/* Full Authorized State */}
        {isAuthorized && (
          <div className="h-full w-full bg-[#0071e3]/20 border-r border-[#0071e3]/40 flex items-center justify-between px-3 text-[11px] font-mono text-[#f5f5f7]">
            <span className="flex items-center gap-1.5 text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2997ff] animate-pulse" />
              100% Pre-Authorized Reserve
            </span>
            <span className="font-bold tabular-nums">${total.toFixed(2)}</span>
          </div>
        )}

        {/* Partial Capture State */}
        {isPartiallyCaptured && (
          <>
            <div
              style={{ width: `${capturedPct}%` }}
              className="h-full bg-[#34c759]/20 border-r border-[#34c759]/50 flex items-center px-2.5 text-[11px] font-mono text-emerald-300 overflow-hidden transition-all duration-500"
              title={`Captured: $${capturedAmount.toFixed(2)} (${capturedPct.toFixed(1)}%)`}
            >
              <span className="truncate tabular-nums">✓ ${capturedAmount.toFixed(2)}</span>
            </div>
            <div
              style={{ width: `${heldPct}%` }}
              className="h-full bg-[#ff9f0a]/20 border-r border-[#ff9f0a]/50 flex items-center px-2.5 text-[11px] font-mono text-amber-300 overflow-hidden transition-all duration-500"
              title={`Held: $${heldAmount.toFixed(2)} (${heldPct.toFixed(1)}%)`}
            >
              <span className="truncate tabular-nums">⏳ ${heldAmount.toFixed(2)} HELD</span>
            </div>
          </>
        )}

        {/* Completed State */}
        {isCompleted && (
          <div className="h-full w-full bg-[#34c759]/20 flex items-center justify-between px-3 text-[11px] font-mono text-emerald-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#34c759]" />
              100% Settled & Captured
            </span>
            <span className="font-bold tabular-nums">${capturedAmount.toFixed(2)}</span>
          </div>
        )}

        {/* Voided State */}
        {isVoided && (
          <>
            {capturedPct > 0 && (
              <div
                style={{ width: `${capturedPct}%` }}
                className="h-full bg-[#34c759]/20 border-r border-[#34c759]/50 flex items-center px-2 text-[11px] font-mono text-emerald-300"
              >
                <span className="truncate tabular-nums">${capturedAmount.toFixed(2)}</span>
              </div>
            )}
            <div
              style={{ width: `${releasedPct > 0 ? releasedPct : 100 - capturedPct}%` }}
              className="h-full bg-slate-800/40 flex items-center justify-center text-[10px] font-mono text-slate-400"
            >
              <span className="tabular-nums">RELEASED: ${(total - capturedAmount).toFixed(2)}</span>
            </div>
          </>
        )}

        {status === 'CREATED' && (
          <div className="h-full w-full flex items-center justify-center text-[11px] font-mono text-slate-500 italic">
            Awaiting Buyer Authorization Approval...
          </div>
        )}
      </div>

      {/* Proportional Ledger Breakdown */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#34c759]" />
          <span className="text-[#86868b]">Captured:</span>
          <span className="font-bold text-emerald-400 tabular-nums">${capturedAmount.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#ff9f0a]" />
          <span className="text-[#86868b]">On Hold:</span>
          <span className="font-bold text-amber-400 tabular-nums">${heldAmount.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-right">
          <span className="text-[#86868b]">Status:</span>
          <span className="font-bold text-[#f5f5f7] uppercase tracking-tight">{status}</span>
        </div>
      </div>
    </div>
  );
};
