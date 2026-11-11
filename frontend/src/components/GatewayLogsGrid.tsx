import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef, ColGroupDef } from 'ag-grid-community';
import { ShieldCheck, AlertTriangle, Repeat, Server, Copy, Download, Search } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface GatewayLogItem {
  id: number;
  action: string;
  request_id: string;
  endpoint: string;
  status_code: number;
  reconciler_status: string;
  reconciler_message?: string;
  paypal_resource_id?: string;
  created_at: string;
}

interface GatewayLogsGridProps {
  logs: GatewayLogItem[];
}

export const GatewayLogsGrid: React.FC<GatewayLogsGridProps> = ({ logs }) => {
  const gridRef = useRef<AgGridReact<GatewayLogItem>>(null);
  const [quickFilter, setQuickFilter] = useState<string>('');

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `authhorizon-gateway-audit-${new Date().toISOString().split('T')[0]}.csv`,
    });
  }, []);

  const columnDefs = useMemo<(ColDef<GatewayLogItem> | ColGroupDef<GatewayLogItem>)[]>(() => [
    // Column Group 1: REST Call Telemetry
    {
      headerName: '🔌 PayPal REST API Call',
      children: [
        {
          field: 'action',
          headerName: 'PayPal Action',
          width: 155,
          pinned: 'left', // Column Pinning (left)
          cellRenderer: (p: any) => {
            const action = p.value || '';
            let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            let Icon = Server;

            if (action.includes('CAPTURE')) {
              badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            } else if (action === 'VOID') {
              badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            } else if (action === 'IDEMPOTENCY_REPLAY') {
              badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
              Icon = Repeat;
            }

            return (
              <div className="flex items-center gap-1.5 h-full">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${badgeColor}`}>
                  <Icon className="w-2.5 h-2.5 shrink-0" />
                  {action}
                </span>
              </div>
            );
          },
        },
        {
          field: 'status_code',
          headerName: 'HTTP',
          width: 85,
          cellRenderer: (p: any) => (
            <span className="font-mono text-xs text-slate-300">
              {p.value ? `HTTP ${p.value}` : '—'}
            </span>
          ),
        },
        {
          field: 'endpoint',
          headerName: 'REST Endpoint',
          flex: 1.4,
          minWidth: 180,
          cellRenderer: (p: any) => (
            <span className="font-mono text-[10px] text-slate-400 truncate block h-full flex items-center" title={p.value}>
              {p.value}
            </span>
          ),
        },
      ],
    },

    // Column Group 2: Reconciler Independent Verification
    {
      headerName: '🛡️ Reconciler Verification',
      children: [
        {
          field: 'reconciler_status',
          headerName: 'Verification',
          width: 150,
          cellRenderer: (p: any) => {
            const isVerified = p.value === 'VERIFIED';
            return (
              <div className="flex items-center h-full">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isVerified
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {isVerified ? (
                    <>
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      VERIFIED ✓
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      MISMATCH ⚠
                    </>
                  )}
                </span>
              </div>
            );
          },
        },
        {
          field: 'reconciler_message',
          headerName: 'Independent Balance Audit',
          flex: 1.8,
          minWidth: 200,
          cellRenderer: (p: any) => (
            <span className="text-[11px] text-slate-300 truncate block h-full flex items-center" title={p.value}>
              {p.value || '—'}
            </span>
          ),
        },
      ],
    },

    // Column Group 3: Idempotency Key
    {
      headerName: '🔑 Idempotency Replay Control',
      children: [
        {
          field: 'request_id',
          headerName: 'PayPal-Request-Id',
          flex: 1.4,
          minWidth: 170,
          cellRenderer: (p: any) => (
            <div className="flex items-center gap-1 h-full font-mono text-[11px] text-cyan-400/90 truncate">
              <span className="truncate" title={p.value}>{p.value}</span>
              {p.value && (
                <button
                  onClick={() => navigator.clipboard?.writeText(p.value)}
                  title="Copy Request ID"
                  className="p-0.5 hover:text-cyan-200 transition-colors"
                >
                  <Copy className="w-2.5 h-2.5 text-slate-500 hover:text-slate-300" />
                </button>
              )}
            </div>
          ),
        },
        {
          field: 'created_at',
          headerName: 'Timestamp',
          width: 95,
          valueFormatter: (p: any) => (p.value ? new Date(p.value).toLocaleTimeString() : '—'),
          cellClass: 'font-mono text-[10px] text-slate-500',
        },
      ],
    },
  ], []);

  return (
    <div className="w-full space-y-2">
      {/* Search and Export Sub-Toolbar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Search gateway calls..."
            className="w-full pl-7 pr-2 py-1 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <button
          onClick={handleExportCsv}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-all shrink-0"
          title="Export gateway audit log to CSV"
        >
          <Download className="w-3 h-3 text-cyan-400" />
          <span>Export CSV</span>
        </button>
      </div>

      <div style={{ height: '270px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800 shadow-inner">
        <AgGridReact<GatewayLogItem>
          ref={gridRef}
          rowData={logs}
          columnDefs={columnDefs}
          quickFilterText={quickFilter}
          getRowId={(p) => String(p.data?.id ?? p.data?.request_id ?? Math.random())}
          // AG Grid Community rowClassRules for action categorization
          rowClassRules={{
            'bg-emerald-500/5': (params) => Boolean(params.data?.action?.includes('CAPTURE')),
            'bg-rose-500/5': (params) => params.data?.action === 'VOID',
            'bg-purple-500/5': (params) => params.data?.action === 'IDEMPOTENCY_REPLAY',
          }}
          // Pagination in Community v33
          pagination={true}
          paginationPageSize={5}
          paginationPageSizeSelector={[5, 10, 25]}
          defaultColDef={{
            enableCellChangeFlash: true,
            sortable: true,
            filter: true,
            resizable: true,
          }}
          overlayNoRowsTemplate='<div class="ag-overlay-no-rows-center font-mono text-slate-500 text-xs">No PayPal REST gateway events recorded yet.</div>'
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
