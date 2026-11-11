import React from 'react';
import type { CustomTooltipProps } from 'ag-grid-react';
import { Lock, ShieldAlert, CheckCircle2, AlertTriangle, Layers, Clock } from 'lucide-react';

export const OrderTooltip: React.FC<CustomTooltipProps> = (props) => {
  const data = props.data;
  if (!data) return null;

  const risk = data.risk_assessment;
  const isCritical = risk?.risk_tier === 'CRITICAL';
  const isExpiringSoon = data.auth_days_remaining !== null && data.auth_days_remaining !== undefined && data.auth_days_remaining < 3;

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs max-w-xs text-slate-200 z-50 pointer-events-auto">
      {/* Tooltip Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-cyan-400 font-mono text-sm">
          <span>Order #{data.id || 'N/A'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            AG Grid Tooltip
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          {data.items_count || 3} items
        </span>
      </div>

      {/* Identifiers */}
      <div className="space-y-1.5 font-mono text-[11px]">
        <div>
          <span className="text-slate-400 text-[10px] uppercase block">PayPal Order ID:</span>
          <span className="text-blue-400 font-semibold break-all">{data.paypal_order_id}</span>
        </div>
        {data.auth_id && (
          <div>
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-indigo-400" />
              PayPal Auth ID:
            </span>
            <span className="text-indigo-300 break-all">{data.auth_id}</span>
          </div>
        )}
      </div>

      {/* Financial Split Breakdown */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80">
        <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Authorization Hold Split:</span>
        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="bg-slate-950/60 p-1 rounded border border-slate-800">
            <span className="text-[9px] text-slate-400 block">Total</span>
            <span className="text-slate-100 font-bold">${data.total_amount?.toFixed(2)}</span>
          </div>
          <div className="bg-slate-950/60 p-1 rounded border border-slate-800">
            <span className="text-[9px] text-emerald-400 block">Captured</span>
            <span className="text-emerald-400 font-bold">${data.captured_amount?.toFixed(2)}</span>
          </div>
          <div className="bg-slate-950/60 p-1 rounded border border-slate-800">
            <span className="text-[9px] text-amber-400 block">Held</span>
            <span className="text-amber-400 font-bold">${data.held_amount?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Risk Alert if present */}
      {risk && (
        <div className={`mt-2.5 p-2 rounded-lg border text-[11px] ${
          isCritical 
            ? 'bg-rose-950/40 border-rose-700/50 text-rose-300' 
            : 'bg-slate-950/50 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1">
              {isCritical ? <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              Supply Risk: {risk.risk_tier}
            </span>
            <span className="font-mono">{Math.round(risk.disruption_probability * 100)}%</span>
          </div>
          {risk.estimated_delay_days > 0 && (
            <p className="text-[10px] opacity-80 mt-0.5">Est. Disruption Delay: ~{risk.estimated_delay_days} days</p>
          )}
        </div>
      )}

      {/* 29-Day Hold Alert */}
      {data.auth_days_remaining !== undefined && data.auth_days_remaining !== null && (
        <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-400" />
            29-Day Hold Window:
          </span>
          <span className={`font-bold ${isExpiringSoon ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
            {data.auth_days_remaining}d remaining
          </span>
        </div>
      )}
    </div>
  );
};

