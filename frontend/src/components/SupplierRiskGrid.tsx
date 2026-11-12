import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, RowStyle, ICellRendererParams } from 'ag-grid-community';
import { Server, Download, Search, Edit3, CheckSquare } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { SupplierNode } from '../types';

interface SupplierRiskGridProps {
  suppliers: SupplierNode[];
}

export const SupplierRiskGrid: React.FC<SupplierRiskGridProps> = ({ suppliers: initialSuppliers }) => {
  const gridRef = useRef<AgGridReact<SupplierNode>>(null);
  const [suppliers, setSuppliers] = useState<SupplierNode[]>(initialSuppliers);
  const [quickFilter, setQuickFilter] = useState<string>('');
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  // Sync state if props update
  React.useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `authhorizon-suppliers-telemetry-${new Date().toISOString().split('T')[0]}.csv`,
    });
  }, []);

  const columnDefs = useMemo<(ColDef<SupplierNode> | ColGroupDef<SupplierNode>)[]>(() => [
    // Column Group 1: Node Identification
    {
      headerName: '🏭 Node Identification',
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
          headerName: 'Supplier Node',
          width: 145,
          pinned: 'left',
          rowDrag: true, // AG Grid Community Row Drag & Drop
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => (
            <div className="flex items-center gap-1.5 h-full">
              <Server className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="font-mono text-xs font-bold text-orange-300">
                {p.value}
              </span>
            </div>
          ),
        },
        {
          field: 'name',
          headerName: 'Warehouse / Supplier Name',
          flex: 1.3,
          minWidth: 160,
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => (
            <div className="flex flex-col justify-center h-full py-0.5">
              <span className="text-slate-100 font-semibold text-xs truncate">{p.value}</span>
            </div>
          ),
        },
        {
          field: 'region',
          headerName: 'Region',
          width: 90,
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => {
            const flag = p.value === 'US' ? '🇺🇸' : p.value === 'DE' ? '🇩🇪' : p.value === 'CN' ? '🇨🇳' : '🌐';
            return (
              <div className="flex items-center gap-1 h-full font-mono text-xs text-slate-300">
                <span>{flag}</span>
                <span>{p.value}</span>
              </div>
            );
          },
        },
      ],
    },

    // Column Group 2: Telemetry & In-Cell Simulation
    {
      headerName: '📊 Telemetry & In-Cell Simulation',
      children: [
        {
          field: 'on_time_rate',
          headerName: 'On-Time Rate',
          width: 115,
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => {
            const pct = Math.round((p.value || 0) * 100);
            const color = pct >= 90 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-rose-400';
            return (
              <div className="flex items-center justify-end h-full font-mono text-xs font-bold">
                <span className={color}>{pct}%</span>
              </div>
            );
          },
          headerClass: 'text-right',
        },
        {
          headerName: 'Fulfillment Sparkline',
          width: 140,
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => {
            const rate = p.data?.on_time_rate || 0;
            const pct = Math.round(rate * 100);
            const barBg = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-rose-500';
            const textColor = pct >= 90 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-rose-400';
            return (
              <div className="flex items-center gap-2 h-full w-full pr-1">
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full ${barBg} rounded-full transition-all duration-300`}
                  />
                </div>
                <span className={`text-[10px] font-mono font-bold ${textColor} shrink-0`}>
                  {pct}%
                </span>
              </div>
            );
          },
        },
        {
          headerName: 'Disruption Risk',
          width: 185,
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => (
            <RiskBadge
              probability={p.data?.composite_disruption_probability || 0}
              tier={p.data?.risk_tier || 'LOW'}
              delayDays={Math.round(p.data?.avg_delay_days || 0)}
            />
          ),
        },
        {
          field: 'port_congestion',
          headerName: 'Port Congestion (Edit %)',
          width: 160,
          // AG Grid Cell Editing in Community v33
          editable: true,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { min: 0, max: 1, step: 0.05 },
          cellClass: 'cursor-pointer hover:bg-slate-800/80 transition-colors',
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => {
            const pct = Math.round((p.value || 0) * 100);
            return (
              <div className="flex items-center gap-1.5 h-full" title="Double click to edit and simulate what-if risk">
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
                  <div
                    className={`h-full ${pct > 50 ? 'bg-rose-500' : pct > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-300 font-bold">{pct}%</span>
                <Edit3 className="w-2.5 h-2.5 text-cyan-400/70 ml-auto shrink-0" />
              </div>
            );
          },
        },
        {
          field: 'sku_count',
          headerName: 'SKUs Mapped',
          width: 105,
          cellRenderer: (p: ICellRendererParams<SupplierNode>) => (
            <div className="flex items-center justify-center h-full">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                {p.value} SKU{p.value === 1 ? '' : 's'}
              </span>
            </div>
          ),
          headerClass: 'text-center',
        },
      ],
    },
  ], []);

  return (
    <div className="w-full space-y-2">
      {/* Sub-toolbar with search, CSV export, and What-if alert */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search supplier nodes & regions..."
              className="w-full pl-7 pr-2 py-1 rounded bg-[#0D111A] border border-[#1E2638] text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#0070BA] font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {simulationNotice && (
            <span className="text-[11px] font-mono text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded animate-pulse">
              {simulationNotice}
            </span>
          )}

          {selectedCount > 0 && (
            <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-amber-400" />
              {selectedCount} Selected
            </span>
          )}

          <button
            onClick={handleExportCsv}
            className="px-2 py-1 rounded bg-[#0D111A] hover:bg-[#141B29] text-slate-300 border border-[#1E2638] text-[11px] font-medium flex items-center gap-1 transition-all shrink-0"
            title="Export supplier nodes to CSV"
          >
            <Download className="w-3 h-3 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div style={{ height: '260px', width: '100%' }} className="ag-theme-quartz-dark rounded overflow-hidden">
        <AgGridReact<SupplierNode>
          ref={gridRef}
          rowData={suppliers}
          columnDefs={columnDefs}
          quickFilterText={quickFilter}
          rowDragManaged={true}
          rowSelection="multiple"
          getRowId={(p) => p.data?.supplier_code || String(p.data?.id || Math.random())}
          // Highlight high-risk supplier nodes with getRowStyle
          getRowStyle={(params): RowStyle | undefined => {
            if (params.data?.composite_disruption_probability && params.data.composite_disruption_probability >= 0.50) {
              return { background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid #f97316' };
            }
            return undefined;
          }}
          onSelectionChanged={(e) => {
            setSelectedCount(e.api.getSelectedRows().length);
          }}
          // Interactive What-If Simulation via Cell Editing
          onCellValueChanged={(event) => {
            const d = event.data;
            if (!d) return;
            const newCongestion = Number(event.newValue) || 0;
            // Bound between 0 and 1
            const clampedCongestion = Math.min(1, Math.max(0, newCongestion > 1 ? newCongestion / 100 : newCongestion));
            d.port_congestion = clampedCongestion;

            // Deterministic arithmetic recalculation
            const fulfillReliability = d.on_time_rate || 0.8;
            const fulfillRisk = 1.0 - fulfillReliability;
            const weather = d.weather_risk || 0.1;
            const geo = d.geopolitical_risk || 0.1;
            const composite = Math.min(1.0, Math.max(0.0,
              (fulfillRisk * 0.50) + (clampedCongestion * 0.20) + (weather * 0.15) + (geo * 0.15)
            ));
            d.composite_disruption_probability = Math.round(composite * 1000) / 1000;
            d.risk_tier = composite >= 0.70 ? 'CRITICAL' : composite >= 0.50 ? 'HIGH' : composite >= 0.30 ? 'MEDIUM' : 'LOW';

            event.api.refreshCells({ rowNodes: [event.node], force: true });
            setSimulationNotice(`Simulated ${d.supplier_code} Port Congestion: ${(clampedCongestion * 100).toFixed(0)}% → Risk: ${d.risk_tier} (${(composite * 100).toFixed(1)}%)`);
            setTimeout(() => setSimulationNotice(null), 4000);
          }}
          defaultColDef={{
            enableCellChangeFlash: true,
            sortable: true,
            filter: true,
            resizable: true,
          }}
          overlayNoRowsTemplate='<div class="ag-overlay-no-rows-center font-mono text-slate-500 text-xs">No supplier nodes active.</div>'
          onFirstDataRendered={(params) => {
            params.api.sizeColumnsToFit();
          }}
          animateRows={true}
          rowHeight={40}
          headerHeight={34}
          groupHeaderHeight={28}
        />
      </div>
    </div>
  );
};
