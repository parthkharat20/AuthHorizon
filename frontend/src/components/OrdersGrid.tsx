import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef } from 'ag-grid-community';
import { CheckCircle2, Clock, Lock, ShieldCheck, Eye, Layers, Download, Search } from 'lucide-react';
import { RiskBadge } from './RiskBadge';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface OrderRow {
  id: number | null;
  paypal_order_id: string;
  auth_id?: string;
  total_amount: number;
  captured_amount: number;
  held_amount: number;
  status: string;
  items_count?: number;
  auth_expires_at?: string;
  auth_days_remaining?: number | null;
  risk_assessment?: {
    disruption_probability: number;
    risk_tier: string;
    estimated_delay_days: number;
  };
  created_at?: string;
}

interface OrdersGridProps {
  orders: OrderRow[];
  selectedOrderId: number | null;
  onSelectOrder: (orderId: number) => void;
}

export const OrdersGrid: React.FC<OrdersGridProps> = ({
  orders,
  selectedOrderId,
  onSelectOrder,
}) => {
  const gridRef = useRef<AgGridReact<OrderRow>>(null);
  const [quickFilter, setQuickFilter] = useState<string>('');

  // Aggregate KPIs for the AG Grid Command Center
  const kpis = useMemo(() => {
    const totalVolume = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
    const totalCaptured = orders.reduce((acc, o) => acc + (o.captured_amount || 0), 0);
    const totalHeld = orders.reduce((acc, o) => acc + (o.held_amount || 0), 0);
    const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
    const partialCount = orders.filter((o) => o.status === 'PARTIALLY_CAPTURED').length;
    return { totalVolume, totalCaptured, totalHeld, completedCount, partialCount };
  }, [orders]);

  // Pinned Bottom Summary Row (Community feature)
  const pinnedBottomRowData = useMemo<OrderRow[]>(() => [
    {
      id: null,
      paypal_order_id: `LEDGER AGGREGATE (${orders.length} orders)`,
      total_amount: kpis.totalVolume,
      captured_amount: kpis.totalCaptured,
      held_amount: kpis.totalHeld,
      status: `${kpis.completedCount} Complete • ${kpis.partialCount} Split`,
    }
  ], [orders.length, kpis]);

  // 1-Click CSV Audit Export
  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `authhorizon-ledger-audit-${new Date().toISOString().split('T')[0]}.csv`,
    });
  }, []);

  const columnDefs = useMemo<ColDef<OrderRow>[]>(() => [
    {
      field: 'id',
      headerName: 'Order',
      width: 95,
      cellRenderer: (p: any) => {
        if (p.value === null) {
          return (
            <div className="flex items-center h-full font-mono text-[10px] font-extrabold text-cyan-400">
              TOTALS
            </div>
          );
        }
        const isSelected = p.value === selectedOrderId;
        return (
          <div className="flex items-center gap-1.5 h-full">
            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
              isSelected ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-300'
            }`}>
              #{p.value}
            </span>
            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
          </div>
        );
      },
      sort: 'desc',
    },
    {
      field: 'paypal_order_id',
      headerName: 'PayPal Order / Auth ID',
      flex: 1.6,
      minWidth: 190,
      cellRenderer: (p: any) => {
        const authId = p.data?.auth_id;
        return (
          <div className="flex flex-col justify-center h-full py-0.5 font-mono text-xs leading-tight">
            <span className="text-blue-400 font-semibold truncate hover:underline cursor-pointer" title={p.value}>
              {p.value}
            </span>
            {authId && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate" title={authId}>
                <Lock className="w-2.5 h-2.5 text-indigo-400 inline shrink-0" />
                {authId}
              </span>
            )}
          </div>
        );
      },
    },
    {
      headerName: 'Split-Hold Ratio',
      width: 175,
      cellRenderer: (p: any) => {
        const total = p.data?.total_amount || 1;
        const captured = p.data?.captured_amount || 0;
        const held = p.data?.held_amount || 0;
        const capPct = Math.min(100, Math.round((captured / total) * 100));
        const heldPct = Math.min(100 - capPct, Math.round((held / total) * 100));

        return (
          <div className="flex flex-col justify-center h-full gap-1">
            <div className="flex justify-between text-[10px] font-mono leading-none">
              <span className="text-emerald-400 font-bold">{capPct}% Cap</span>
              <span className="text-amber-400 font-bold">{heldPct}% Hold</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${capPct}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                title={`Captured: $${captured.toFixed(2)}`}
              />
              <div
                style={{ width: `${heldPct}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300 animate-pulse"
                title={`Held: $${held.toFixed(2)}`}
              />
            </div>
          </div>
        );
      },
    },
    {
      field: 'total_amount',
      headerName: 'Total',
      width: 95,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'font-semibold text-slate-200 text-right font-mono',
      headerClass: 'text-right',
    },
    {
      field: 'captured_amount',
      headerName: 'Captured',
      width: 105,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'text-emerald-400 font-bold text-right font-mono',
      headerClass: 'text-right',
    },
    {
      field: 'held_amount',
      headerName: 'Held',
      width: 95,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'text-amber-400 font-bold text-right font-mono',
      headerClass: 'text-right',
    },
    {
      field: 'status',
      headerName: 'Lifecycle Status & Hold Window',
      width: 215,
      cellRenderer: (p: any) => {
        const val = p.value || 'CREATED';
        const daysLeft = p.data?.auth_days_remaining;
        let badgeColor = 'bg-slate-700/60 text-slate-300 border-slate-600/50';
        let Icon = Clock;

        if (val === 'AUTHORIZED') {
          badgeColor = 'bg-blue-500/15 text-blue-300 border-blue-500/40';
          Icon = Lock;
        } else if (val === 'PARTIALLY_CAPTURED') {
          badgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/40';
          Icon = Layers;
        } else if (val === 'COMPLETED') {
          badgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
          Icon = CheckCircle2;
        } else if (val === 'VOIDED') {
          badgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/40';
          Icon = ShieldCheck;
        }

        return (
          <div className="flex items-center gap-1.5 h-full">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${badgeColor}`}>
              <Icon className="w-3 h-3 shrink-0" />
              {val}
            </span>
            {daysLeft !== undefined && daysLeft !== null && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                daysLeft > 14
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : daysLeft >= 3
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
              }`} title="PayPal 29-day authorization hold countdown">
                {daysLeft}d left
              </span>
            )}
          </div>
        );
      },
    },
    {
      headerName: 'Supply Risk',
      width: 190,
      cellRenderer: (p: any) => {
        const riskData = p.data?.risk_assessment;
        if (!riskData || riskData.disruption_probability === undefined) {
          return (
            <div className="flex items-center h-full text-[10px] text-slate-500 font-mono italic">
              Unassessed
            </div>
          );
        }
        return (
          <RiskBadge
            probability={riskData.disruption_probability}
            tier={riskData.risk_tier || 'LOW'}
            delayDays={riskData.estimated_delay_days}
          />
        );
      },
    },
    {
      headerName: 'Action',
      width: 105,
      cellRenderer: (p: any) => {
        if (!p.data?.id) return null;
        const isSelected = p.data?.id === selectedOrderId;
        return (
          <div className="flex items-center justify-center h-full">
            <button
              onClick={() => p.data?.id && onSelectOrder(p.data.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                isSelected
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Eye className="w-3 h-3" />
              {isSelected ? 'Active' : 'Inspect'}
            </button>
          </div>
        );
      },
    },
  ], [selectedOrderId, onSelectOrder]);

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* AG Grid Header & KPI Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              AG Grid Merchant Command Center
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              AG Grid Community v33
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-currency split authorization ledger, in-cell ratio visualizer & predictive risk telemetry
          </p>
        </div>

        {/* Live Aggregation Badges */}
        <div className="flex items-center gap-3 overflow-x-auto text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase block">Total Volume</span>
            <span className="font-bold text-slate-100">${kpis.totalVolume.toFixed(2)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-emerald-400 uppercase block">Captured</span>
            <span className="font-bold text-emerald-400">${kpis.totalCaptured.toFixed(2)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-amber-400 uppercase block">Active Held</span>
            <span className="font-bold text-amber-400">${kpis.totalHeld.toFixed(2)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-cyan-400 uppercase block">Orders</span>
            <span className="font-bold text-cyan-400">{orders.length}</span>
          </div>
        </div>
      </div>

      {/* Quick Filter & CSV Export Toolbar (AG Grid Community v33 features) */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Quick search orders, auth IDs, or status across all grid columns..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
          />
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
          title="Export current grid records to canonical CSV via AG Grid API"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* The AG Grid React Table */}
      <div style={{ height: '300px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800 shadow-inner">
        <AgGridReact<OrderRow>
          ref={gridRef}
          rowData={orders}
          columnDefs={columnDefs}
          pinnedBottomRowData={pinnedBottomRowData}
          quickFilterText={quickFilter}
          rowSelection="single"
          onRowClicked={(e) => {
            if (e.data?.id) onSelectOrder(e.data.id);
          }}
          defaultColDef={{
            enableCellChangeFlash: true,
            sortable: true,
            filter: true,
            resizable: true,
          }}
          animateRows={true}
          rowHeight={46}
          headerHeight={38}
        />
      </div>

      <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400 font-mono">
        <span>Click any row to load order detail, line items & cryptographic audit chain</span>
        <span className="text-cyan-400/90 font-semibold">Active Selection: Order #{selectedOrderId || 'None'}</span>
      </div>
    </div>
  );
};
