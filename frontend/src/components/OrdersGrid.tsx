import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, RowStyle, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';
import { 
  CheckCircle2, 
  Clock, 
  Lock, 
  ShieldCheck, 
  Eye, 
  Layers, 
  Download, 
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { OrderTooltip } from './OrderTooltip';

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
  loading?: boolean;
}

export const OrdersGrid: React.FC<OrdersGridProps> = ({
  orders,
  selectedOrderId,
  onSelectOrder,
  loading,
}) => {
  const gridRef = useRef<AgGridReact<OrderRow>>(null);
  const [quickFilter, setQuickFilter] = useState<string>('');
  const [savedLayoutNotice, setSavedLayoutNotice] = useState<string | null>(null);

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
      auth_days_remaining: null,
      risk_assessment: {
        disruption_probability: orders.reduce((s, o) => s + (o.risk_assessment?.disruption_probability || 0), 0) / Math.max(orders.length, 1),
        risk_tier: 'COMPOSITE',
        estimated_delay_days: 0,
      },
    }
  ], [orders, kpis]);

  // 1-Click CSV Audit Export (AG Grid Community API)
  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `authhorizon-ledger-audit-${new Date().toISOString().split('T')[0]}.csv`,
    });
  }, []);

  // Save Column State to localStorage (AG Grid Community API)
  const handleSaveLayout = useCallback(() => {
    if (!gridRef.current?.api) return;
    const state = gridRef.current.api.getColumnState();
    localStorage.setItem('authhorizon_orders_grid_state', JSON.stringify(state));
    setSavedLayoutNotice('Layout Saved ✓');
    setTimeout(() => setSavedLayoutNotice(null), 2500);
  }, []);

  // Restore Column State from localStorage (AG Grid Community API)
  const handleRestoreLayout = useCallback(() => {
    if (!gridRef.current?.api) return;
    const saved = localStorage.getItem('authhorizon_orders_grid_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        gridRef.current.api.applyColumnState({ state, applyOrder: true });
        setSavedLayoutNotice('Layout Restored ✓');
      } catch (e) {
        gridRef.current.api.resetColumnState();
        setSavedLayoutNotice('Layout Reset ✓');
      }
    } else {
      gridRef.current.api.resetColumnState();
      setSavedLayoutNotice('Default Reset ✓');
    }
    setTimeout(() => setSavedLayoutNotice(null), 2500);
  }, []);

  // Column Definitions with Column Groups (Hierarchical Headers in Community v33)
  const columnDefs = useMemo<(ColDef<OrderRow> | ColGroupDef<OrderRow>)[]>(() => [
    // Column Group 1: Order Identification
    {
      headerName: 'Order Identification',
      children: [
        {
          field: 'id',
          headerName: 'Order ID',
          width: 105,
          minWidth: 100,
          cellRenderer: (p: ICellRendererParams<OrderRow>) => {
            if (p.value === null) {
              return (
                <div className="flex items-center h-full font-mono text-xs font-extrabold text-[#0070BA]">
                  TOTALS
                </div>
              );
            }
            const isSelected = p.value === selectedOrderId;
            return (
              <div className="flex items-center gap-2 h-full">
                <span className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold ${
                  isSelected ? 'bg-blue-100 text-[#0070BA] ring-1 ring-blue-300' : 'bg-slate-100 text-slate-800'
                }`}>
                  #{p.value}
                </span>
                {isSelected && <span className="w-2 h-2 rounded-full bg-[#0070BA] animate-pulse" />}
              </div>
            );
          },
          sort: 'desc',
        },
        {
          field: 'paypal_order_id',
          headerName: 'PayPal Order / Auth ID',
          width: 230,
          minWidth: 210,
          tooltipField: 'paypal_order_id', // Custom Tooltip bound
          cellRenderer: (p: ICellRendererParams<OrderRow>) => {
            const authId = p.data?.auth_id;
            return (
              <div className="flex flex-col justify-center h-full py-1 font-mono text-xs leading-snug">
                <span className="text-slate-900 font-bold truncate hover:text-[#0070BA] cursor-pointer" title={p.value}>
                  {p.value}
                </span>
                {authId && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate mt-0.5" title={authId}>
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    {authId}
                  </span>
                )}
              </div>
            );
          },
        },
      ],
    },

    // Column Group 2: Split-Hold Allocation
    {
      headerName: 'Hold Allocation',
      children: [
        {
          headerName: 'Hold Allocation Ratio',
          width: 190,
          minWidth: 180,
          cellRenderer: (p: ICellRendererParams<OrderRow>) => {
            const total = p.data?.total_amount || 1;
            const captured = p.data?.captured_amount || 0;
            const held = p.data?.held_amount || 0;
            const capPct = Math.min(100, Math.round((captured / total) * 100));
            const heldPct = Math.min(100 - capPct, Math.round((held / total) * 100));

            return (
              <div className="flex flex-col justify-center h-full gap-1.5 w-full pr-2">
                <div className="flex justify-between text-xs font-mono font-bold leading-none">
                  <span className="text-emerald-700">{capPct}% Cap</span>
                  <span className="text-amber-700">{heldPct}% Hold</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${capPct}%` }}
                    className="h-full bg-emerald-500 transition-all duration-300"
                    title={`Captured: $${captured.toFixed(2)}`}
                  />
                  <div
                    style={{ width: `${heldPct}%` }}
                    className="h-full bg-amber-400 transition-all duration-300"
                    title={`Held: $${held.toFixed(2)}`}
                  />
                </div>
              </div>
            );
          },
        },
      ],
    },

    // Column Group 3: Financial Ledger
    {
      headerName: 'Financial Ledger (USD)',
      children: [
        {
          field: 'total_amount',
          headerName: 'Total USD',
          width: 115,
          minWidth: 110,
          valueFormatter: (p: ValueFormatterParams<OrderRow>) => p.value != null ? `$${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          cellClass: 'font-bold text-slate-900 text-right font-mono text-sm flex items-center justify-end',
          headerClass: 'text-right',
        },
        {
          field: 'captured_amount',
          headerName: 'Captured',
          width: 115,
          minWidth: 110,
          valueFormatter: (p: ValueFormatterParams<OrderRow>) => p.value != null ? `$${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          cellClass: 'text-emerald-700 font-bold text-right font-mono text-sm flex items-center justify-end',
          headerClass: 'text-right',
          cellStyle: (p) => (Number(p.value) > 0 ? { color: '#047857' } : undefined),
        },
        {
          field: 'held_amount',
          headerName: 'Contingency Held',
          width: 135,
          minWidth: 130,
          valueFormatter: (p: ValueFormatterParams<OrderRow>) => p.value != null ? `$${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          cellClass: 'text-amber-700 font-bold text-right font-mono text-sm flex items-center justify-end',
          headerClass: 'text-right',
          cellStyle: (p) => (Number(p.value) > 0 ? { color: '#b45309', fontWeight: 'bold' } : undefined),
        },
      ],
    },

    // Column Group 4: Compliance, Risk & Actions
    {
      headerName: 'Compliance & Risk Intelligence',
      children: [
        {
          field: 'status',
          headerName: 'Lifecycle Status & Window',
          width: 230,
          minWidth: 220,
          cellRenderer: (p: ICellRendererParams<OrderRow>) => {
            const val = p.value || 'CREATED';
            const daysLeft = p.data?.auth_days_remaining;
            let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
            let Icon = Clock;

            if (val === 'AUTHORIZED') {
              badgeColor = 'bg-blue-50 text-[#0070BA] border-blue-200';
              Icon = Lock;
            } else if (val === 'PARTIALLY_CAPTURED') {
              badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
              Icon = Layers;
            } else if (val === 'COMPLETED') {
              badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
              Icon = CheckCircle2;
            } else if (val === 'VOIDED') {
              badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
              Icon = ShieldCheck;
            }

            return (
              <div className="flex items-center gap-2 h-full">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${badgeColor}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {val}
                </span>
                {daysLeft !== undefined && daysLeft !== null && (
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                    daysLeft > 14
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : daysLeft >= 3
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`} title="PayPal 29-day authorization hold countdown">
                    {daysLeft}d left
                  </span>
                )}
              </div>
            );
          },
        },
        {
          field: 'risk_assessment',
          headerName: 'Supply Risk',
          width: 175,
          minWidth: 165,
          cellRenderer: (p: ICellRendererParams<OrderRow>) => {
            const riskData = p.data?.risk_assessment;
            if (!riskData || riskData.disruption_probability === undefined) {
              return (
                <div className="flex items-center h-full text-xs text-slate-500 font-mono italic">
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
          minWidth: 100,
          cellRenderer: (p: ICellRendererParams<OrderRow>) => {
            if (!p.data?.id) return null;
            const isSelected = p.data?.id === selectedOrderId;
            return (
              <div className="flex items-center justify-center h-full">
                <button
                  onClick={() => p.data?.id && onSelectOrder(p.data.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0070BA] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {isSelected ? 'Active' : 'Inspect'}
                </button>
              </div>
            );
          },
        },
      ],
    },
  ], [selectedOrderId, onSelectOrder]);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      {/* Grid Sub-Header & Live KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0070BA]" />
              Authorization Portfolio Ledger
            </h3>
            <span className="px-2.5 py-0.5 text-xs font-mono font-semibold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
              AG Grid v33 Enterprise Tier
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Real-time multi-currency split authorization ledger with deterministic hold tracking
          </p>
        </div>

        {/* Live Aggregation Badges - Expanded & High-Legibility */}
        <div className="flex items-center gap-2.5 overflow-x-auto text-xs font-mono">
          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[105px]">
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Total Volume</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">${kpis.totalVolume.toFixed(2)}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-center min-w-[105px]">
            <span className="text-[11px] text-emerald-800 font-medium uppercase tracking-wider block">Captured</span>
            <span className="text-sm font-bold text-emerald-700 tabular-nums">${kpis.totalCaptured.toFixed(2)}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center min-w-[105px]">
            <span className="text-[11px] text-amber-800 font-medium uppercase tracking-wider block">Active Held</span>
            <span className="text-sm font-bold text-amber-700 tabular-nums">${kpis.totalHeld.toFixed(2)}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[85px]">
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Orders</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">{orders.length}</span>
          </div>
        </div>
      </div>

      {/* Quick Filter, Layout Presets & CSV Export Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Search orders, PayPal Auth IDs, or statuses..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0070BA] focus:bg-white font-mono transition-all"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {savedLayoutNotice && (
            <span className="text-xs font-mono font-bold text-emerald-600 px-2">
              {savedLayoutNotice}
            </span>
          )}

          {/* Save / Restore Column State */}
          <button
            onClick={handleSaveLayout}
            className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Save custom column order and widths to browser localStorage"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0070BA]" />
            <span className="hidden sm:inline">Save Layout</span>
          </button>

          <button
            onClick={handleRestoreLayout}
            className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Restore saved column state or reset to default layout"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
            title="Export current grid records to canonical CSV via AG Grid API"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* The AG Grid React Table - Generous Row Height, Clear Text, No Forced Truncation */}
      <div style={{ height: '410px', width: '100%' }} className="ag-theme-quartz rounded-xl overflow-hidden border border-slate-200 shadow-xs">
        <AgGridReact<OrderRow>
          ref={gridRef}
          loading={loading}
          rowData={orders}
          columnDefs={columnDefs}
          pinnedBottomRowData={pinnedBottomRowData}
          quickFilterText={quickFilter}
          rowSelection="single"
          getRowId={(params) => String(params.data?.id ?? 'pinned-total')}
          // Dynamic Row Styling based on Risk and Hold state (AG Grid Community v33 getRowStyle)
          getRowStyle={(params): RowStyle | undefined => {
            if (!params.data) return undefined;
            if (params.data.id === null) {
              return { background: '#f8fafc', fontWeight: 'bold' };
            }
            if (params.data.risk_assessment?.risk_tier === 'CRITICAL') {
              return { background: '#fef2f2', borderLeft: '4px solid #ef4444' };
            }
            if (params.data.auth_days_remaining !== null && params.data.auth_days_remaining !== undefined && params.data.auth_days_remaining < 3) {
              return { background: '#fffbeb', borderLeft: '4px solid #f59e0b' };
            }
            if (params.data.status === 'COMPLETED') {
              return { background: '#f0fdf4' };
            }
            return undefined;
          }}
          // Tooltip configuration
          tooltipShowDelay={150}
          tooltipInteraction={true}
          // Default column definition
          defaultColDef={{
            enableCellChangeFlash: true,
            sortable: true,
            filter: true,
            resizable: true,
            tooltipComponent: OrderTooltip,
          }}
          // Overlay templates for empty and loading states
          overlayLoadingTemplate='<div class="ag-overlay-loading-center font-mono text-[#0070BA] text-sm font-semibold">⟳ Synchronizing authorization ledger...</div>'
          overlayNoRowsTemplate='<div class="ag-overlay-no-rows-center font-mono text-slate-500 text-sm">No orders recorded yet. Click "+ Create Order" to start.</div>'
          // Post-Sort Rows (bring CRITICAL risk or pinned to prioritized positions)
          postSortRows={(params) => {
            const rows = params.nodes;
            const critical = [];
            const standard = [];
            for (const r of rows) {
              if (r.data?.risk_assessment?.risk_tier === 'CRITICAL') {
                critical.push(r);
              } else {
                standard.push(r);
              }
            }
            rows.length = 0;
            rows.push(...critical, ...standard);
          }}
          onRowClicked={(e) => {
            if (e.data?.id) onSelectOrder(e.data.id);
          }}
          // CRITICAL: Do NOT call sizeColumnsToFit() here. Columns preserve their full readable widths.
          animateRows={true}
          rowHeight={58}
          headerHeight={44}
          groupHeaderHeight={36}
        />
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 font-mono">
        <span>Click any row to load order detail, line items & cryptographic audit chain</span>
        <span className="text-[#0070BA] font-bold">Active Selection: Order #{selectedOrderId || 'None'}</span>
      </div>
    </div>
  );
};
