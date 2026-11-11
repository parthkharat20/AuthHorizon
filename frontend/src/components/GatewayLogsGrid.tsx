import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef } from 'ag-grid-community';
import { ShieldCheck, AlertTriangle, Repeat, Server, Copy } from 'lucide-react';

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
  const columnDefs = useMemo<ColDef<GatewayLogItem>[]>(() => [
    {
      field: 'action',
      headerName: 'PayPal Action',
      width: 160,
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
      width: 90,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs text-slate-300">
          {p.value ? `HTTP ${p.value}` : '—'}
        </span>
      ),
    },
    {
      field: 'reconciler_status',
      headerName: 'Reconciler Verification',
      width: 170,
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
      field: 'request_id',
      headerName: 'PayPal-Request-Id (Idempotency Key)',
      flex: 1.5,
      minWidth: 180,
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
      field: 'endpoint',
      headerName: 'REST Endpoint',
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (p: any) => (
        <span className="font-mono text-[10px] text-slate-400 truncate block h-full flex items-center" title={p.value}>
          {p.value}
        </span>
      ),
    },
    {
      field: 'reconciler_message',
      headerName: 'Independent Balance Audit',
      flex: 2,
      minWidth: 220,
      cellRenderer: (p: any) => (
        <span className="text-[11px] text-slate-300 truncate block h-full flex items-center" title={p.value}>
          {p.value || '—'}
        </span>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Timestamp',
      width: 110,
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleTimeString() : '—'),
      cellClass: 'font-mono text-[10px] text-slate-500',
    },
  ], []);

  return (
    <div className="w-full">
      <div style={{ height: '260px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800 shadow-inner">
        <AgGridReact
          rowData={logs}
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

