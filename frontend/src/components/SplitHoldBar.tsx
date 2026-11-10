import React from 'react';

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
  // Safe percentages
  const total = totalAmount > 0 ? totalAmount : 90.0;
  const capturedPct = Math.min(100, Math.max(0, (capturedAmount / total) * 100));
  const heldPct = Math.min(100, Math.max(0, (heldAmount / total) * 100));

  const isPartiallyCaptured = status === 'PARTIALLY_CAPTURED';
  const isCompleted = status === 'COMPLETED';
  const isVoided = status === 'VOIDED';
  const isAuthorized = status === 'AUTHORIZED';

  return (
    <div className="w-full bg-slate-900/90 border border-slate-700/60 rounded-xl p-6 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
            Live Authorization Split-Hold Bar
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time visualization of PayPal authorization & partial capture lifecycle
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Authorized</span>
          <p className="text-xl font-extrabold text-slate-100">${total.toFixed(2)} USD</p>
        </div>
      </div>

      {/* The Dynamic Split Bar Container */}
      <div className="relative w-full h-14 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 flex shadow-inner">
        {/* State 1: Authorized (Solid $90 Hold) */}
        {isAuthorized && (
          <div
            className="h-full w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold tracking-wide transition-all duration-700 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>${total.toFixed(2)} FULLY AUTHORIZED (FUNDS HELD)</span>
            </div>
          </div>
        )}

        {/* State 2: Partially Captured (Splits into Captured Green + Held Amber) */}
        {isPartiallyCaptured && (
          <>
            {/* Captured Segment (Green) */}
            <div
              style={{ width: `${capturedPct}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold transition-all duration-1000 ease-out border-r border-emerald-400/40 relative group"
            >
              <div className="flex items-center gap-1.5 px-3 whitespace-nowrap overflow-hidden">
                <span className="text-emerald-200">✓</span>
                <span className="text-sm font-semibold tracking-wide">${capturedAmount.toFixed(2)} CAPTURED</span>
              </div>
            </div>

            {/* Held Segment (Amber with Pulsing Glow) */}
            <div
              style={{ width: `${heldPct}%` }}
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 flex items-center justify-center text-slate-900 font-extrabold transition-all duration-1000 ease-out relative animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.5)]"
            >
              <div className="flex items-center gap-1.5 px-3 whitespace-nowrap overflow-hidden">
                <span className="text-amber-950">⏳</span>
                <span className="text-sm font-bold tracking-wide text-amber-950">${heldAmount.toFixed(2)} HELD (DELAYED)</span>
              </div>
            </div>
          </>
        )}

        {/* State 3: Completed (100% Green) */}
        {isCompleted && (
          <div className="h-full w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 flex items-center justify-center text-white font-extrabold tracking-wide transition-all duration-1000">
            <div className="flex items-center gap-2">
              <span className="text-xl">✓</span>
              <span>${capturedAmount.toFixed(2)} 100% FULFILLED & CAPTURED</span>
            </div>
          </div>
        )}

        {/* State 4: Cancelled / Voided (Captured stays green, remainder released) */}
        {isVoided && (
          <>
            <div
              style={{ width: `${capturedPct}%` }}
              className="h-full bg-emerald-600 flex items-center justify-center text-white font-semibold text-sm transition-all duration-700"
            >
              <span>${capturedAmount.toFixed(2)} CAPTURED</span>
            </div>
            <div
              style={{ width: `${100 - capturedPct}%` }}
              className="h-full bg-slate-800/80 flex items-center justify-center text-slate-400 font-medium text-xs tracking-wider border-l border-slate-700 transition-all duration-700"
            >
              <span>${(total - capturedAmount).toFixed(2)} RELEASED (VOIDED)</span>
            </div>
          </>
        )}

        {/* Default / Uninitialized */}
        {status === 'CREATED' && (
          <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm italic font-mono">
            Awaiting Sandbox Buyer Approval...
          </div>
        )}
      </div>

      {/* Legend & Stats Footer */}
      <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-500 flex-shrink-0" />
          <span className="text-slate-300">
            Captured: <strong className="text-emerald-400">${capturedAmount.toFixed(2)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500 flex-shrink-0 animate-pulse" />
          <span className="text-slate-300">
            On Hold: <strong className="text-amber-400">${heldAmount.toFixed(2)}</strong>
          </span>
        </div>
        <div className="flex items-center justify-end gap-1.5 font-mono text-slate-400">
          <span>Status:</span>
          <span className="font-bold text-slate-200 uppercase">{status}</span>
        </div>
      </div>
    </div>
  );
};

