import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, RowStyle, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { Download, Search, ShieldAlert, Cpu, ArrowRight, Repeat } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { RiskAssessment } from '../types';

interface RiskAssessmentsGridProps {
  assessments: RiskAssessment[];
  orderId?: number | null;
  onReroute?: (sku: string, supplierCode: string) => void;
}

export const RiskAssessmentsGrid: React.FC<RiskAssessmentsGridProps> = ({
  assessments,
  orderId,
  onReroute,
}) => {
  const gridRef = useRef<AgGridReact<RiskAssessment>>(null);
  const [quickFilter, setQuickFilter] = useState<string>('');

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `authhorizon-order-${orderId || 'all'}-risk-assessment.csv`,
    });
  }, [orderId]);

  // Aggregate averages for pinned bottom row in AG Grid Community v33
  const pinnedBottomRowData = useMemo<Partial<RiskAssessment>[]>(() => {
    if (assessments.length === 0) return [];
    const avgProb = assessments.reduce((acc, a) => acc + (a.disruption_probability || 0), 0) / assessments.length;
    const avgDelay = assessments.reduce((acc, a) => acc + (a.estimated_delay_days || 0), 0) / assessments.length;
    const tier = avgProb >= 0.70 ? 'CRITICAL' : avgProb >= 0.50 ? 'HIGH' : avgProb >= 0.30 ? 'MEDIUM' : 'LOW';

    return [
      {
        sku: 'ORDER COMPOSITE',
        item_name: `Composite Average (${assessments.length} Line Items)`,
        supplier: 'Multi-Node Weighted Average',
        supplier_region: 'GLOBAL',
        fulfillment_reliability: assessments.reduce((acc, a) => acc + (a.fulfillment_reliability || 0), 0) / assessments.length,
        geographic_risk: assessments.reduce((acc, a) => acc + (a.geographic_risk || 0), 0) / assessments.length,
        disruption_probability: avgProb,
        risk_tier: tier,
        estimated_delay_days: Math.round(avgDelay),
        recommendation: 'Autonomous composite calculated via deterministic Python arithmetic (0% LLM math).',
      }
    ];
  }, [assessments]);

  const columnDefs = useMemo<(ColDef<RiskAssessment> | ColGroupDef<RiskAssessment>)[]>(() => [
    // Column Group 1: Item Identification
    {
      headerName: '📦 Line Item Identification',
      children: [
        {
          field: 'sku',
          headerName: 'SKU',
          width: 125,
          pinned: 'left', // Column Pinning (left)
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => {
            const isAggregate = p.value === 'ORDER COMPOSITE';
            return (
              <span className={`font-mono text-xs font-bold ${
                isAggregate ? 'text-cyan-400' : 'text-slate-200'
              }`}>
                {p.value}
              </span>
            );
          },
        },
        {
          field: 'item_name',
          headerName: 'Component Description',
          flex: 1.3,
          minWidth: 160,
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => (
            <span className="text-xs font-semibold text-slate-100 truncate block h-full flex items-center" title={p.value}>
              {p.value}
            </span>
          ),
        },
      ],
    },

    // Column Group 2: Supply Chain Telemetry Node
    {
      headerName: '🏭 Fulfillment Node Mapping',
      children: [
        {
          field: 'supplier',
          headerName: 'Primary Supplier',
          flex: 1.1,
          minWidth: 150,
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => (
            <span className="text-xs font-mono text-orange-300 truncate block h-full flex items-center" title={p.value}>
              {p.value}
            </span>
          ),
        },
        {
          field: 'supplier_region',
          headerName: 'Region',
          width: 85,
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => {
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
          field: 'alternative_supplier',
          headerName: 'Backup Node',
          flex: 1.1,
          minWidth: 140,
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => (
            <span className="text-xs font-mono text-cyan-400 truncate block h-full flex items-center" title={p.value || 'None available'}>
              {p.value ? `↳ ${p.value}` : '— (Sole Source)'}
            </span>
          ),
        },
      ],
    },

    // Column Group 3: Deterministic Scoring
    {
      headerName: '📊 Deterministic Risk Scoring (0% AI Math)',
      children: [
        {
          field: 'fulfillment_reliability',
          headerName: 'Reliability',
          width: 95,
          valueFormatter: (p: ValueFormatterParams<RiskAssessment>) => `${Math.round((p.value || 0) * 100)}%`,
          cellClass: 'font-mono text-xs text-right text-emerald-400 font-semibold',
          headerClass: 'text-right',
        },
        {
          field: 'geographic_risk',
          headerName: 'Geo Factor',
          width: 95,
          valueFormatter: (p: ValueFormatterParams<RiskAssessment>) => `${Math.round((p.value || 0) * 100)}%`,
          cellClass: 'font-mono text-xs text-right text-amber-400',
          headerClass: 'text-right',
        },
        {
          field: 'disruption_probability',
          headerName: 'Disruption Risk',
          width: 185,
          valueFormatter: (p: ValueFormatterParams<RiskAssessment>) => p.value != null ? `${(Number(p.value) * 100).toFixed(1)}%` : '—',
          comparator: (a: number, b: number) => (a || 0) - (b || 0),
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => (
            <RiskBadge
              probability={p.data?.disruption_probability || 0}
              tier={p.data?.risk_tier || 'LOW'}
              delayDays={Math.round(p.data?.estimated_delay_days || 0)}
            />
          ),
        },
        {
          field: 'estimated_delay_days',
          headerName: 'Est. Delay',
          width: 90,
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => (
            <span className={`font-mono text-xs font-bold ${
              p.value > 7 ? 'text-rose-400' : p.value > 0 ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {p.value > 0 ? `~${p.value}d` : '0d (On-Time)'}
            </span>
          ),
        },
      ],
    },

    // Column Group 4: Autonomous Mitigation Recommendation
    {
      headerName: '🔄 Autonomous Mitigation Recommendation',
      children: [
        {
          field: 'recommendation',
          headerName: 'Mitigation Action',
          flex: 2,
          minWidth: 240,
          tooltipField: 'recommendation',
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => (
            <div className="flex items-center gap-1.5 h-full text-xs text-slate-300 truncate" title={p.value}>
              <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">{p.value}</span>
            </div>
          ),
        },
        {
          headerName: '1-Click Mitigation',
          width: 155,
          cellRenderer: (p: ICellRendererParams<RiskAssessment>) => {
            if (!p.data?.alternative_supplier_code || !onReroute || (p.data?.disruption_probability ?? 0) < 0.3) {
              return null;
            }
            return (
              <button
                onClick={() => onReroute(p.data!.sku, p.data!.alternative_supplier_code!)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0070BA]/20 text-blue-300 border border-[#0070BA]/60 hover:bg-[#0070BA] hover:text-white transition-all flex items-center gap-1 shadow-sm mt-1"
                title={`Reroute SKU ${p.data.sku} to ${p.data.alternative_supplier || p.data.alternative_supplier_code}`}
              >
                <Repeat className="w-3 h-3 text-[#0070BA]" />
                <span>Reroute &rarr; {p.data.alternative_supplier_code}</span>
              </button>
            );
          },
        },
      ],
    },
  ], [onReroute]);

  return (
    <div className="w-full space-y-2">
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-[#86868b] pointer-events-none" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search SKUs, suppliers, or recommendations..."
              className="w-full pl-8 pr-3 py-1 rounded-full bg-[#121214] border border-[#2c2c2e] text-[11px] text-[#f5f5f7] placeholder:text-[#86868b] focus:outline-none focus:border-[#0071e3] font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#86868b] hidden sm:inline">
            Order #{orderId || '—'} Items: <strong className="text-[#f5f5f7]">{assessments.length}</strong>
          </span>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1 rounded-full bg-[#1c1c1e] hover:bg-[#232326] text-[#a1a1a6] hover:text-white border border-[#2c2c2e] text-[11px] font-medium flex items-center gap-1 transition-all shrink-0"
            title="Export predictive risk assessments to CSV"
          >
            <Download className="w-3 h-3 text-[#86868b]" />
            <span>Export Risk CSV</span>
          </button>
        </div>
      </div>

      <div style={{ height: '260px', width: '100%' }} className="ag-theme-quartz-dark rounded-xl overflow-hidden">
        <AgGridReact<RiskAssessment>
          ref={gridRef}
          rowData={assessments}
          columnDefs={columnDefs}
          pinnedBottomRowData={pinnedBottomRowData}
          quickFilterText={quickFilter}
          getRowId={(p) => p.data?.sku || String(Math.random())}
          // Row Styling by Risk Tier (AG Grid Community getRowStyle)
          getRowStyle={(params): RowStyle | undefined => {
            if (!params.data) return undefined;
            if (params.data.sku === 'ORDER COMPOSITE') {
              return { background: 'rgba(15, 23, 42, 0.95)', fontWeight: 'bold' };
            }
            if (params.data.risk_tier === 'CRITICAL') {
              return { background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444' };
            }
            if (params.data.risk_tier === 'HIGH') {
              return { background: 'rgba(249, 115, 22, 0.07)', borderLeft: '3px solid #f97316' };
            }
            if (params.data.risk_tier === 'MEDIUM') {
              return { background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b' };
            }
            return undefined;
          }}
          defaultColDef={{
            enableCellChangeFlash: true,
            sortable: true,
            filter: true,
            resizable: true,
          }}
          overlayNoRowsTemplate='<div class="ag-overlay-no-rows-center font-mono text-slate-500 text-xs">No risk assessments computed yet for this order. Click "Assess Risk" above.</div>'
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
