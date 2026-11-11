import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef } from 'ag-grid-community';
import { Server, MapPin, AlertTriangle } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { SupplierNode } from '../types';

ModuleRegistry.registerModules([AllCommunityModule]);

interface SupplierRiskGridProps {
  suppliers: SupplierNode[];
}

export const SupplierRiskGrid: React.FC<SupplierRiskGridProps> = ({ suppliers }) => {
  const columnDefs = useMemo<ColDef<SupplierNode>[]>(() => [
    {
      field: 'supplier_code',
      headerName: 'Supplier Node',
      width: 155,
      cellRenderer: (p: any) => (
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
      flex: 1.4,
      minWidth: 160,
      cellRenderer: (p: any) => (
        <div className="flex flex-col justify-center h-full py-0.5">
          <span className="text-slate-100 font-semibold text-xs truncate">{p.value}</span>
        </div>
      ),
    },
    {
      field: 'region',
      headerName: 'Region',
      width: 95,
      cellRenderer: (p: any) => {
        const flag = p.value === 'US' ? '🇺🇸' : p.value === 'DE' ? '🇩🇪' : p.value === 'CN' ? '🇨🇳' : '🌐';
        return (
          <div className="flex items-center gap-1 h-full font-mono text-xs text-slate-300">
            <span>{flag}</span>
            <span>{p.value}</span>
          </div>
        );
      },
    },
    {
      field: 'on_time_rate',
      headerName: 'On-Time Rate',
      width: 120,
      cellRenderer: (p: any) => {
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
      headerName: 'Disruption Risk',
      width: 190,
      cellRenderer: (p: any) => (
        <RiskBadge
          probability={p.data?.composite_disruption_probability || 0}
          tier={p.data?.risk_tier || 'LOW'}
          delayDays={Math.round(p.data?.avg_delay_days || 0)}
        />
      ),
    },
    {
      field: 'port_congestion',
      headerName: 'Port Congestion',
      width: 135,
      cellRenderer: (p: any) => {
        const pct = Math.round((p.value || 0) * 100);
        return (
          <div className="flex items-center gap-1.5 h-full">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${pct > 50 ? 'bg-rose-500' : pct > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
          </div>
        );
      },
    },
    {
      field: 'sku_count',
      headerName: 'SKUs Mapped',
      width: 110,
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-center h-full">
          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
            {p.value} SKU{p.value === 1 ? '' : 's'}
          </span>
        </div>
      ),
      headerClass: 'text-center',
    },
  ], []);

  return (
    <div style={{ height: '240px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800 shadow-inner">
      <AgGridReact<SupplierNode>
        rowData={suppliers}
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
  );
};
