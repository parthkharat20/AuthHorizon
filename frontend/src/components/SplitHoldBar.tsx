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
    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
      {/* Header Metric Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#0070BA]" />
          <span className="font-semibold text-slate-800 text-xs">PayPal Split Authorization Hold</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 font-medium">
            intent=AUTHORIZE
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1.5">Total:</span>
          <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">${total.toFixed(2)} USD</span>
        </div>
      </div>

      {/* High-Precision Multi-Track Segmented Bar */}
      <div className="relative w-full h-8 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex">
        {/* Full Authorized State */}
        {isAuthorized && (
          <div className="h-full w-full bg-blue-50 border-r border-blue-200 flex items-center justify-between px-3 text-[11px] font-mono text-blue-900">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
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
              className="h-full bg-emerald-500 flex items-center px-2.5 text-[11px] font-mono text-white font-semibold overflow-hidden transition-all duration-500"
              title={`Captured: $${capturedAmount.toFixed(2)} (${capturedPct.toFixed(1)}%)`}
            >
              <span className="truncate tabular-nums">✓ ${capturedAmount.toFixed(2)}</span>
            </div>
            <div
              style={{ width: `${heldPct}%` }}
              className="h-full bg-amber-400 flex items-center px-2.5 text-[11px] font-mono text-slate-900 font-semibold overflow-hidden transition-all duration-500"
              title={`Held: $${heldAmount.toFixed(2)} (${heldPct.toFixed(1)}%)`}
            >
              <span className="truncate tabular-nums">⏳ ${heldAmount.toFixed(2)} HELD</span>
            </div>
          </>
        )}

        {/* Completed State */}
        {isCompleted && (
          <div className="h-full w-full bg-emerald-500 flex items-center justify-between px-3 text-[11px] font-mono text-white font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-white" />
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
                className="h-full bg-emerald-500 flex items-center px-2 text-[11px] font-mono text-white font-semibold"
              >
                <span className="truncate tabular-nums">${capturedAmount.toFixed(2)}</span>
              </div>
            )}
            <div
              style={{ width: `${releasedPct > 0 ? releasedPct : 100 - capturedPct}%` }}
              className="h-full bg-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-600 font-medium"
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
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-500">Captured:</span>
          <span className="font-bold text-emerald-700 tabular-nums">${capturedAmount.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-slate-500">On Hold:</span>
          <span className="font-bold text-amber-700 tabular-nums">${heldAmount.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-right">
          <span className="text-slate-500">Status:</span>
          <span className="font-bold text-slate-800 uppercase tracking-tight">{status}</span>
        </div>
      </div>
    </div>
  );
};
