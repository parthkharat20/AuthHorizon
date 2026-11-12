import React from 'react';

interface RiskBadgeProps {
  probability: number;  // 0.0 to 1.0
  tier: string;         // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  delayDays?: number;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ probability, tier, delayDays }) => {
  const pct = Math.round(probability * 100);
  
  const tierStyles: Record<string, string> = {
    LOW: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-300',
    HIGH: 'bg-orange-50 text-orange-700 border-orange-300',
    CRITICAL: 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse',
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
      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor[tier] || 'bg-slate-400'}`}
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
      <span className="text-[10px] font-mono text-slate-500 font-semibold">{pct}%</span>
    </div>
  );
};

