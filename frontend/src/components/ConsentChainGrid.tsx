import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef, ColGroupDef, RowStyle } from 'ag-grid-community';
import { ShieldCheck, Link2, Copy, Globe2, Download, Search } from 'lucide-react';
import { HashHeaderComponent } from './HashHeaderComponent';

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
  const gridRef = useRef<AgGridReact<ConsentChainItem>>(null);
  const [quickFilter, setQuickFilter] = useState<string>('');

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `authhorizon-consent-chain-audit-${new Date().toISOString().split('T')[0]}.csv`,
    });
  }, []);

  const columnDefs = useMemo<(ColDef<ConsentChainItem> | ColGroupDef<ConsentChainItem>)[]>(() => [
    // Column Group 1: Buyer Action
    {
      headerName: '👤 Buyer Consent Selection',
      children: [
        {
          field: 'id',
          headerName: '#',
          width: 55,
          pinned: 'left', // Column Pinning (left)
          cellClass: 'font-mono text-xs font-bold text-slate-400',
        },
        {
          field: 'choice',
          headerName: 'Buyer Choice',
          width: 120,
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
          width: 80,
          cellRenderer: (p: any) => (
            <div className="flex items-center gap-1 h-full font-mono text-[11px] text-slate-300 uppercase">
              <Globe2 className="w-3 h-3 text-cyan-400" />
              {p.value || 'EN'}
            </div>
          ),
        },
      ],
    },

    // Column Group 2: Cryptographic Hash Linkage
    {
      headerName: '🔗 Cryptographic Hash Linkage',
      children: [
        {
          field: 'consent_hash',
          headerName: 'Consent Digest',
          flex: 1.8,
          minWidth: 190,
          headerComponent: HashHeaderComponent, // Custom Header Component
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
          minWidth: 190,
          cellRenderer: (p: any) => {
            const isGenesis = p.value?.startsWith('00000000');
            return (
              <div className="flex items-center gap-1 h-full font-mono text-[10px] text-slate-400 truncate">
                <Link2 className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                <span className="truncate font-semibold text-indigo-300" title={p.value}>
                  {isGenesis ? 'GENESIS_HASH (0000...)' : p.value}
                </span>
              </div>
            );
          },
        },
      ],
    },

    // Column Group 3: Attestation & Verification
    {
      headerName: '📜 Attestation & Verification',
      children: [
        {
          field: 'displayed_text',
          headerName: 'Exact Text Bound in Digest',
          flex: 2,
          minWidth: 200,
          cellRenderer: (p: any) => (
            <span className="text-[11px] text-slate-300 truncate block h-full flex items-center" title={p.value}>
              {p.value}
            </span>
          ),
        },
        {
          headerName: 'Integrity',
          width: 105,
          pinned: 'right', // Column Pinning (right)
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
          width: 95,
          valueFormatter: (p: any) => (p.value ? new Date(p.value).toLocaleTimeString() : '—'),
          cellClass: 'font-mono text-[10px] text-slate-500',
        },
      ],
    },
  ], []);

  return (
    <div className="w-full space-y-2">
      {/* Search and Export Toolbar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Search consent hashes..."
            className="w-full pl-7 pr-2 py-1 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <button
          onClick={handleExportCsv}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-all shrink-0"
          title="Export consent audit chain to CSV"
        >
          <Download className="w-3 h-3 text-cyan-400" />
          <span>Export Chain CSV</span>
        </button>
      </div>

      <div style={{ height: '240px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800 shadow-inner">
        <AgGridReact<ConsentChainItem>
          ref={gridRef}
          rowData={consents}
          columnDefs={columnDefs}
          quickFilterText={quickFilter}
          getRowId={(p) => String(p.data?.id ?? p.data?.consent_hash ?? Math.random())}
          // Highlight GENESIS block with distinct indigo left accent
          getRowStyle={(params): RowStyle | undefined => {
            if (params.data?.prev_hash?.startsWith('00000000')) {
              return { background: 'rgba(99, 102, 241, 0.08)', borderLeft: '3px solid #6366f1' };
            }
            return undefined;
          }}
          pagination={true}
          paginationPageSize={5}
          paginationPageSizeSelector={[5, 10, 20]}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            enableCellChangeFlash: true,
          }}
          overlayNoRowsTemplate='<div class="ag-overlay-no-rows-center font-mono text-slate-500 text-xs">No cryptographic consent records logged for this order.</div>'
          onFirstDataRendered={(params) => {
            params.api.sizeColumnsToFit();
          }}
          animateRows={true}
          rowHeight={38}
          headerHeight={32}
          groupHeaderHeight={28}
        />
      </div>
    </div>
  );
};
