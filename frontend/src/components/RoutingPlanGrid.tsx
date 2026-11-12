import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, RowStyle, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';
import { Server, Download, Search, CheckSquare, Layers, Lock } from 'lucide-react';

export interface RoutingNodeItem {
  supplier_code: string;
  supplier_name: string;
  region?: string;
  items?: Array<{
    sku: string;
    name: string;
    amount: number;
    status: string;
  }>;
  items_list?: string;
  segment_total: number;
  item_count: number;
}

interface RoutingPlanGridProps {
  nodes: RoutingNodeItem[];
  totalOrderAmount?: number;
  orderId?: number | null;
}

export const RoutingPlanGrid: React.FC<RoutingPlanGridProps> = ({
  nodes,
  totalOrderAmount = 90.0,
  orderId,
}) => {
  const gridRef = useRef<AgGridReact<RoutingNodeItem>>(null);
  const [quickFilter, setQuickFilter] = useState<string>('');
  const [selectedCount, setSelectedCount] = useState<number>(0);

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `authhorizon-order-${orderId || 'all'}-routing-plan.csv`,
    });
  }, [orderId]);

  const columnDefs = useMemo<(ColDef<RoutingNodeItem> | ColGroupDef<RoutingNodeItem>)[]>(() => [
    // Column Group 1: Fulfillment Node
    {
      headerName: 'Fulfillment Warehouse Node',
      children: [
        {
          headerCheckboxSelection: true,
          checkboxSelection: true,
          width: 48,
          pinned: 'left', // Column Pinning (left)
          headerName: '',
          cellClass: 'flex items-center justify-center',
        },
        {
          field: 'supplier_code',
          headerName: 'Node Code',
          width: 145,
          pinned: 'left',
          cellRenderer: (p: ICellRendererParams<RoutingNodeItem>) => (
            <div className="flex items-center gap-1.5 h-full">
              <Server className="w-3.5 h-3.5 text-[#0070BA] shrink-0" />
              <span className="font-mono text-xs font-bold text-[#0070BA]">
                {p.value}
              </span>
            </div>
          ),
        },
        {
          field: 'supplier_name',
          headerName: 'Warehouse / Facility Name',
          flex: 1.3,
          minWidth: 160,
          cellRenderer: (p: ICellRendererParams<RoutingNodeItem>) => (
            <span className="text-slate-900 font-semibold text-xs truncate block h-full flex items-center" title={p.value}>
              {p.value}
            </span>
          ),
        },
        {
          field: 'region',
          headerName: 'Region',
          width: 90,
          cellRenderer: (p: ICellRendererParams<RoutingNodeItem>) => {
            const flag = p.value === 'US' ? '🇺🇸' : p.value === 'DE' ? '🇩🇪' : p.value === 'CN' ? '🇨🇳' : '🌐';
            return (
              <div className="flex items-center gap-1 h-full font-mono text-xs text-slate-600">
                <span>{flag}</span>
                <span>{p.value || 'US'}</span>
              </div>
            );
          },
        },
      ],
    },

    // Column Group 2: Hold Allocation
    {
      headerName: 'Hold Allocation Partition',
      children: [
        {
          field: 'segment_total',
          headerName: 'Hold Segment',
          width: 120,
          valueFormatter: (p: ValueFormatterParams<RoutingNodeItem>) => p.value != null ? `$${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          cellClass: 'font-mono text-xs text-right font-bold text-emerald-700',
          headerClass: 'text-right',
        },
        {
          headerName: 'Hold Share %',
          width: 110,
          // AG Grid valueGetter using context.totalAmount
          valueGetter: (p: ValueGetterParams<RoutingNodeItem>) => {
            const total = p.context?.totalAmount || 90.0;
            if (total <= 0) return 0;
            return Math.round(((p.data?.segment_total || 0) / total) * 100);
          },
          comparator: (a: number, b: number) => (a || 0) - (b || 0),
          cellRenderer: (p: ICellRendererParams<RoutingNodeItem>) => {
            const pct = p.value || 0;
            return (
              <div className="flex items-center justify-end gap-1.5 h-full font-mono text-xs">
                <div className="w-10 h-1.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0070BA]" style={{ width: `${pct}%` }} />
                </div>
                <span className="font-bold text-slate-800">{pct}%</span>
              </div>
            );
          },
          headerClass: 'text-right',
        },
      ],
    },

    // Column Group 3: Assigned Line Items
    {
      headerName: 'Logical Item Routing',
      children: [
        {
          field: 'item_count',
          headerName: 'Items',
          width: 85,
          cellRenderer: (p: ICellRendererParams<RoutingNodeItem>) => (
            <div className="flex items-center justify-center h-full">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                {p.value} item{p.value === 1 ? '' : 's'}
              </span>
            </div>
          ),
          headerClass: 'text-center',
        },
        {
          headerName: 'Routed SKUs',
          flex: 1.8,
          minWidth: 180,
          // Extract SKUs from item array or items_list string
          valueGetter: (p: ValueGetterParams<RoutingNodeItem>) => {
            if (p.data?.items_list) return p.data.items_list;
            if (p.data?.items && Array.isArray(p.data.items)) {
              return p.data.items.map((it: any) => it.sku).join(', ');
            }
            return '—';
          },
          tooltipField: 'items_list',
          cellRenderer: (p: ICellRendererParams<RoutingNodeItem>) => (
            <div className="flex items-center gap-1.5 h-full font-mono text-[11px] text-slate-800 truncate" title={p.value}>
              <Layers className="w-3 h-3 text-[#0070BA] shrink-0" />
              <span className="truncate">{p.value}</span>
            </div>
          ),
        },
      ],
    },
  ], []);

  return (
    <div className="w-full space-y-2">
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search routing nodes & SKUs..."
              className="w-full pl-8 pr-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0070BA] font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="text-[11px] font-mono text-[#0070BA] bg-blue-50 border border-blue-200 px-3 py-0.5 rounded-full flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-[#0070BA]" />
              {selectedCount} Nodes Selected
            </span>
          )}

          <button
            onClick={handleExportCsv}
            className="px-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1 transition-all shrink-0"
            title="Export routing plan to CSV"
          >
            <Download className="w-3 h-3 text-slate-500" />
            <span>Export Routing CSV</span>
          </button>
        </div>
      </div>

      <div style={{ height: '300px', width: '100%' }} className="ag-theme-quartz rounded-xl overflow-hidden border border-slate-200 shadow-xs">
        <AgGridReact<RoutingNodeItem>
          ref={gridRef}
          rowData={nodes}
          columnDefs={columnDefs}
          quickFilterText={quickFilter}
          // AG Grid Context Parameter passed to valueGetter
          context={{ totalAmount: totalOrderAmount }}
          rowSelection="multiple"
          getRowId={(p) => p.data?.supplier_code || String(Math.random())}
          onSelectionChanged={(e) => {
            setSelectedCount(e.api.getSelectedRows().length);
          }}
          pagination={true}
          paginationPageSize={5}
          paginationPageSizeSelector={[5, 10, 20]}
          defaultColDef={{
            enableCellChangeFlash: true,
            sortable: true,
            filter: true,
            resizable: true,
          }}
          overlayNoRowsTemplate='<div class="ag-overlay-no-rows-center font-mono text-slate-500 text-xs">No multi-supplier routing plan computed for this order yet.</div>'
          animateRows={true}
          rowHeight={48}
          headerHeight={38}
          groupHeaderHeight={32}
        />
      </div>
    </div>
  );
};
