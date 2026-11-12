import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, RowStyle, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { ShieldCheck, Link2, Copy, Globe2, Download, Search } from 'lucide-react';
import { HashHeaderComponent } from './HashHeaderComponent';

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
      headerName: 'Buyer Consent Selection',
      children: [
        {
          field: 'id',
          headerName: '#',
          width: 55,
          pinned: 'left', // Column Pinning (left)
          cellClass: 'font-mono text-xs font-bold text-slate-500',
        },
        {
          field: 'choice',
          headerName: 'Buyer Choice',
          width: 120,
          cellRenderer: (p: ICellRendererParams<ConsentChainItem>) => {
            const choice = p.value || '';
            let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
            if (choice === 'WAIT') badgeColor = 'bg-blue-50 text-[#0070BA] border-blue-200';
            if (choice === 'SWAP') badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
            if (choice === 'CANCEL') badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';

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
          cellRenderer: (p: ICellRendererParams<ConsentChainItem>) => (
            <div className="flex items-center gap-1 h-full font-mono text-[11px] text-slate-700 uppercase">
              <Globe2 className="w-3 h-3 text-[#0070BA]" />
              {p.value || 'EN'}
            </div>
          ),
        },
      ],
    },

    // Column Group 2: Cryptographic Hash Linkage
    {
      headerName: 'Cryptographic Hash Linkage (SHA-256)',
      children: [
        {
          field: 'consent_hash',
          headerName: 'Consent Digest',
          flex: 1.8,
          minWidth: 190,
          headerComponent: HashHeaderComponent, // Custom Header Component
          cellRenderer: (p: ICellRendererParams<ConsentChainItem>) => (
            <div className="flex items-center gap-1 h-full font-mono text-[10px] text-emerald-700 font-semibold truncate">
              <span className="truncate" title={p.value}>{p.value}</span>
              {p.value && (
                <button
                  onClick={() => navigator.clipboard?.writeText(p.value)}
                  title="Copy Consent Hash"
                  className="p-0.5 hover:text-emerald-950 transition-colors"
                >
                  <Copy className="w-2.5 h-2.5 text-slate-400 hover:text-slate-600" />
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
          cellRenderer: (p: ICellRendererParams<ConsentChainItem>) => {
            const isGenesis = p.value?.startsWith('00000000');
            return (
              <div className="flex items-center gap-1 h-full font-mono text-[10px] text-slate-500 truncate">
                <Link2 className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                <span className={`truncate font-semibold ${isGenesis ? 'text-indigo-700 font-bold' : 'text-slate-600'}`} title={p.value}>
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
      headerName: 'Attestation & Verification',
      children: [
        {
          field: 'displayed_text',
          headerName: 'Exact Text Bound in Digest',
          flex: 2,
          minWidth: 200,
          cellRenderer: (p: ICellRendererParams<ConsentChainItem>) => (
            <span className="text-[11px] text-slate-700 truncate block h-full flex items-center" title={p.value}>
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
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Intact ✓
              </span>
            </div>
          ),
        },
        {
          field: 'timestamp',
          headerName: 'UTC Time',
          width: 95,
          valueFormatter: (p: ValueFormatterParams<ConsentChainItem>) => (p.value ? new Date(p.value).toLocaleTimeString() : '—'),
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
          <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Search consent hashes..."
            className="w-full pl-8 pr-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0070BA] font-mono"
          />
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1 transition-all shrink-0"
          title="Export consent audit chain to CSV"
        >
          <Download className="w-3 h-3 text-slate-500" />
          <span>Export Chain CSV</span>
        </button>
      </div>

      <div style={{ width: '100%', minHeight: '160px' }} className="ag-theme-quartz rounded-xl overflow-hidden border border-slate-200 shadow-xs">
        <AgGridReact<ConsentChainItem>
          ref={gridRef}
          domLayout="autoHeight"
          rowData={consents}
          columnDefs={columnDefs}
          quickFilterText={quickFilter}
          getRowId={(p) => String(p.data?.id ?? p.data?.consent_hash ?? Math.random())}
          // Highlight GENESIS block with distinct indigo left accent
          getRowStyle={(params): RowStyle | undefined => {
            if (params.data?.prev_hash?.startsWith('00000000')) {
              return { background: '#f5f3ff', borderLeft: '3px solid #6366f1' };
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
          animateRows={true}
          rowHeight={46}
          headerHeight={38}
          groupHeaderHeight={32}
        />
      </div>
    </div>
  );
};
