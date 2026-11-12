import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { ShieldCheck, AlertTriangle, Repeat, Server, Copy, Download, Search } from 'lucide-react';

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
      headerName: 'PayPal REST API Call',
      children: [
        {
          field: 'action',
          headerName: 'PayPal Action',
          width: 155,
          pinned: 'left', // Column Pinning (left)
          cellRenderer: (p: ICellRendererParams<GatewayLogItem>) => {
            const action = p.value || '';
            let badgeColor = 'bg-blue-50 text-[#0070BA] border-blue-200';
            let Icon = Server;

            if (action.includes('CAPTURE')) {
              badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            } else if (action === 'VOID') {
              badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
            } else if (action === 'IDEMPOTENCY_REPLAY') {
              badgeColor = 'bg-blue-50 text-[#0070BA] border-blue-200';
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
          cellRenderer: (p: ICellRendererParams<GatewayLogItem>) => (
            <span className="font-mono text-xs text-slate-700 font-semibold">
              {p.value ? `HTTP ${p.value}` : '—'}
            </span>
          ),
        },
        {
          field: 'endpoint',
          headerName: 'REST Endpoint',
          flex: 1.4,
          minWidth: 180,
          cellRenderer: (p: ICellRendererParams<GatewayLogItem>) => (
            <span className="font-mono text-[10px] text-slate-600 truncate block h-full flex items-center" title={p.value}>
              {p.value}
            </span>
          ),
        },
      ],
    },

    // Column Group 2: Reconciler Independent Verification
    {
      headerName: 'Reconciler Verification',
      children: [
        {
          field: 'reconciler_status',
          headerName: 'Verification',
          width: 150,
          cellRenderer: (p: ICellRendererParams<GatewayLogItem>) => {
            const isVerified = p.value === 'VERIFIED';
            return (
              <div className="flex items-center h-full">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isVerified
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {isVerified ? (
                    <>
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      VERIFIED ✓
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
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
          cellRenderer: (p: ICellRendererParams<GatewayLogItem>) => (
            <span className="text-[11px] text-slate-700 truncate block h-full flex items-center" title={p.value}>
              {p.value || '—'}
            </span>
          ),
        },
      ],
    },

    // Column Group 3: Idempotency Key
    {
      headerName: 'Idempotency Replay Control',
      children: [
        {
          field: 'request_id',
          headerName: 'PayPal-Request-Id',
          flex: 1.4,
          minWidth: 170,
          cellRenderer: (p: ICellRendererParams<GatewayLogItem>) => (
            <div className="flex items-center gap-1 h-full font-mono text-[11px] text-[#0070BA] font-semibold truncate">
              <span className="truncate" title={p.value}>{p.value}</span>
              {p.value && (
                <button
                  onClick={() => navigator.clipboard?.writeText(p.value)}
                  title="Copy Request ID"
                  className="p-0.5 hover:text-blue-900 transition-colors"
                >
                  <Copy className="w-2.5 h-2.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          ),
        },
        {
          field: 'created_at',
          headerName: 'Timestamp',
          width: 95,
          valueFormatter: (p: ValueFormatterParams<GatewayLogItem>) => (p.value ? new Date(p.value).toLocaleTimeString() : '—'),
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
          <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Search gateway calls..."
            className="w-full pl-8 pr-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0070BA] font-mono"
          />
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1 transition-all shrink-0"
          title="Export gateway audit log to CSV"
        >
          <Download className="w-3 h-3 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      <div style={{ height: '300px', width: '100%' }} className="ag-theme-quartz rounded-xl overflow-hidden border border-slate-200 shadow-xs">
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
          animateRows={true}
          rowHeight={46}
          headerHeight={38}
          groupHeaderHeight={32}
        />
      </div>
    </div>
  );
};
