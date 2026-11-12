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
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xl text-xs max-w-xs text-slate-800 z-50 pointer-events-auto">
      {/* Tooltip Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-[#0070BA] font-mono text-sm">
          <span>Order #{data.id || 'N/A'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-[#0070BA] border border-blue-200 font-semibold">
            Ledger Inspector
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          {data.items_count || 3} items
        </span>
      </div>

      {/* Identifiers */}
      <div className="space-y-1.5 font-mono text-[11px]">
        <div>
          <span className="text-slate-400 text-[10px] uppercase block">PayPal Order ID:</span>
          <span className="text-slate-900 font-semibold break-all">{data.paypal_order_id}</span>
        </div>
        {data.auth_id && (
          <div>
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-slate-400" />
              PayPal Auth ID:
            </span>
            <span className="text-slate-700 break-all">{data.auth_id}</span>
          </div>
        )}
      </div>

      {/* Financial Split Breakdown */}
      <div className="mt-2.5 pt-2 border-t border-slate-100">
        <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Authorization Hold Split:</span>
        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="bg-slate-50 p-1 rounded border border-slate-200">
            <span className="text-[9px] text-slate-500 block">Total</span>
            <span className="text-slate-900 font-bold">${data.total_amount?.toFixed(2)}</span>
          </div>
          <div className="bg-emerald-50 p-1 rounded border border-emerald-200">
            <span className="text-[9px] text-emerald-700 block">Captured</span>
            <span className="text-emerald-700 font-bold">${data.captured_amount?.toFixed(2)}</span>
          </div>
          <div className="bg-amber-50 p-1 rounded border border-amber-200">
            <span className="text-[9px] text-amber-700 block">Held</span>
            <span className="text-amber-700 font-bold">${data.held_amount?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Risk Alert if present */}
      {risk && (
        <div className={`mt-2.5 p-2 rounded-lg border text-[11px] ${
          isCritical 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1">
              {isCritical ? <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
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
        <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#0070BA]" />
            29-Day Hold Window:
          </span>
          <span className={`font-bold ${isExpiringSoon ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
            {data.auth_days_remaining}d remaining
          </span>
        </div>
      )}
    </div>
  );
};

