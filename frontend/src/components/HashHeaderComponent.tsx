import React from 'react';
import type { CustomHeaderProps } from 'ag-grid-react';
import { ShieldCheck } from 'lucide-react';

export const HashHeaderComponent: React.FC<CustomHeaderProps> = (props) => {
  return (
    <div className="flex items-center gap-1.5 h-full text-emerald-400">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span className="text-xs font-semibold text-slate-200">{props.displayName}</span>
      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
        HMAC
      </span>
    </div>
  );
};

