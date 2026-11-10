import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef } from 'ag-grid-community';
import { ShieldCheck, Link2, Copy, Globe2 } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface ConsentChainItem {
  id: number;
  choice: string;
  displayed_text: string;
  locale: string;
  prev_hash: string;
  consent_hash: string;
  timestamp: string;
}

interface ConsentChainGridProps {
  consents: ConsentChainItem[];
}

export const ConsentChainGrid: React.FC<ConsentChainGridProps> = ({ consents }) => {
  const columnDefs = useMemo<ColDef<ConsentChainItem>[]>(() => [
    {
      field: 'id',
      headerName: '#',
      width: 60,
      cellClass: 'font-mono text-xs font-bold text-slate-400',
    },
    {
      field: 'choice',
      headerName: 'Buyer Choice',
      width: 130,
      cellRenderer: (p: any) => {
        const choice = p.value || '';
        let badgeColor = 'bg-slate-700 text-slate-300 border-slate-600';
        if (choice === 'WAIT') badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
        if (choice === 'SWAP') badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
        if (choice === 'CANCEL') badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';

        return (
          <div className="flex items-center h-full">
            <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${badgeColor}`}>
              {choice}
            </span>
          </div>
        );
      },
    },
    {
      field: 'locale',
      headerName: 'Locale',
      width: 85,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-1 h-full font-mono text-[11px] text-slate-300 uppercase">
          <Globe2 className="w-3 h-3 text-cyan-400" />
          {p.value || 'EN'}
        </div>
      ),
    },
    {
      field: 'consent_hash',
      headerName: 'SHA-256 Consent Hash',
      flex: 1.8,
      minWidth: 200,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-1 h-full font-mono text-[10px] text-emerald-400/90 truncate">
          <span className="truncate" title={p.value}>{p.value}</span>
          {p.value && (
            <button
              onClick={() => navigator.clipboard?.writeText(p.value)}
              title="Copy Consent Hash"
              className="p-0.5 hover:text-emerald-200 transition-colors"
            >
              <Copy className="w-2.5 h-2.5 text-slate-500 hover:text-slate-300" />
            </button>
          )}
        </div>
      ),
    },
    {
      field: 'prev_hash',
      headerName: 'Previous Link (prev_hash)',
      flex: 1.8,
      minWidth: 200,
      cellRenderer: (p: any) => {
        const isGenesis = p.value?.startsWith('00000000');
        return (
          <div className="flex items-center gap-1 h-full font-mono text-[10px] text-slate-400 truncate">
            <Link2 className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
            <span className="truncate" title={p.value}>
              {isGenesis ? 'GENESIS_HASH (0000...)' : p.value}
            </span>
          </div>
        );
      },
    },
    {
      field: 'displayed_text',
      headerName: 'Exact Text Bound in Digest',
      flex: 2,
      minWidth: 220,
      cellRenderer: (p: any) => (
        <span className="text-[11px] text-slate-300 truncate block h-full flex items-center" title={p.value}>
          {p.value}
        </span>
      ),
    },
    {
      headerName: 'Integrity',
      width: 120,
      cellRenderer: () => (
        <div className="flex items-center h-full">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Intact ✓
          </span>
        </div>
      ),
    },
    {
      field: 'timestamp',
      headerName: 'UTC Time',
      width: 110,
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleTimeString() : '—'),
      cellClass: 'font-mono text-[10px] text-slate-500',
    },
  ], []);

  return (
    <div className="w-full">
      <div style={{ height: '220px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800 shadow-inner">
        <AgGridReact
          rowData={consents}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          animateRows={true}
          rowHeight={40}
          headerHeight={34}
        />
      </div>
    </div>
  );
};
