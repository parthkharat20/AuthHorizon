import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef } from 'ag-grid-community';
import { CheckCircle2, Clock, Lock, ShieldCheck, Eye, Layers } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface OrderRow {
  id: number;
  paypal_order_id: string;
  auth_id?: string;
  total_amount: number;
  captured_amount: number;
  held_amount: number;
  status: string;
  items_count?: number;
  created_at: string;
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
  // Aggregate KPIs for the AG Grid Command Center
  const kpis = useMemo(() => {
    const totalVolume = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
    const totalCaptured = orders.reduce((acc, o) => acc + (o.captured_amount || 0), 0);
    const totalHeld = orders.reduce((acc, o) => acc + (o.held_amount || 0), 0);
    const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
    const partialCount = orders.filter((o) => o.status === 'PARTIALLY_CAPTURED').length;
    return { totalVolume, totalCaptured, totalHeld, completedCount, partialCount };
  }, [orders]);

  const columnDefs = useMemo<ColDef<OrderRow>[]>(() => [
    {
      field: 'id',
      headerName: 'Order',
      width: 100,
      cellRenderer: (p: any) => {
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
      flex: 1.8,
      minWidth: 200,
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
      width: 190,
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
      width: 100,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'font-semibold text-slate-200 text-right font-mono',
      headerClass: 'text-right',
    },
    {
      field: 'captured_amount',
      headerName: 'Captured',
      width: 110,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'text-emerald-400 font-bold text-right font-mono',
      headerClass: 'text-right',
    },
    {
      field: 'held_amount',
      headerName: 'Held',
      width: 100,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'text-amber-400 font-bold text-right font-mono',
      headerClass: 'text-right',
    },
    {
      field: 'status',
      headerName: 'Lifecycle Status',
      width: 180,
      cellRenderer: (p: any) => {
        const val = p.value || 'CREATED';
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
          <div className="flex items-center h-full">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${badgeColor}`}>
              <Icon className="w-3 h-3 shrink-0" />
              {val}
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Action',
      width: 110,
      cellRenderer: (p: any) => {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
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
            Real-time multi-currency split authorization ledger, in-cell ratio visualizer & idempotency verification
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

      {/* The AG Grid React Table */}
      <div style={{ height: '290px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800 shadow-inner">
        <AgGridReact
          rowData={orders}
          columnDefs={columnDefs}
          rowSelection="single"
          onRowClicked={(e) => {
            if (e.data?.id) onSelectOrder(e.data.id);
          }}
          defaultColDef={{
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
