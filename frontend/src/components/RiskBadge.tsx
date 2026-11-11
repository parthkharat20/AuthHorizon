import React from 'react';

interface RiskBadgeProps {
  probability: number;  // 0.0 to 1.0
  tier: string;         // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  delayDays?: number;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ probability, tier, delayDays }) => {
  const pct = Math.round(probability * 100);
  
  const tierStyles: Record<string, string> = {
    LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    MEDIUM: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    HIGH: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    CRITICAL: 'bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse',
  };

  const barColor: Record<string, string> = {
    LOW: 'bg-emerald-500',
    MEDIUM: 'bg-amber-500',
    HIGH: 'bg-orange-500',
    CRITICAL: 'bg-rose-500',
  };

  return (
    <div className="flex items-center gap-2 h-full">
      {/* Mini risk bar (CSS-only sparkline alternative) */}
      <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden flex-shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor[tier] || 'bg-slate-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      
      {/* Tier badge */}
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${tierStyles[tier] || tierStyles.LOW}`}>
        {tier}
        {delayDays !== undefined && delayDays > 0 && (
          <span className="text-[8px] opacity-75">~{delayDays}d</span>
        )}
      </span>
      
      {/* Percentage */}
      <span className="text-[10px] font-mono text-slate-400">{pct}%</span>
    </div>
  );
};
