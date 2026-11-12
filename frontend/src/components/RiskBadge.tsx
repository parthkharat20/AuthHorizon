import React from 'react';

interface RiskBadgeProps {
  probability: number;  // 0.0 to 1.0
  tier: string;         // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  delayDays?: number;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ probability, tier, delayDays }) => {
  const pct = Math.round(probability * 100);
  
  const tierStyles: Record<string, string> = {
    LOW: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
    HIGH: 'bg-amber-100 text-amber-900 border-amber-300',
    CRITICAL: 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse',
  };

  const barColor: Record<string, string> = {
    LOW: 'bg-emerald-500',
    MEDIUM: 'bg-amber-500',
    HIGH: 'bg-amber-600',
    CRITICAL: 'bg-rose-600',
  };

  return (
    <div className="flex items-center gap-2 h-full">
      {/* Mini risk bar */}
      <div className="w-14 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor[tier] || 'bg-slate-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      
      {/* Tier badge */}
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase border ${tierStyles[tier] || tierStyles.LOW}`}>
        {tier}
        {delayDays !== undefined && delayDays > 0 && (
          <span className="text-[10px] opacity-80">~{delayDays}d</span>
        )}
      </span>
      
      {/* Percentage */}
      <span className="text-xs font-mono text-slate-600 font-semibold">{pct}%</span>
    </div>
  );
};

