import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef } from 'ag-grid-community';

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface OrderRow {
  id: number;
  paypal_order_id: string;
  auth_id?: string;
  total_amount: number;
  captured_amount: number;
  held_amount: number;
  status: string;
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
  const columnDefs: ColDef<OrderRow>[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 70,
      cellClass: 'font-mono text-xs font-bold text-slate-300',
    },
    {
      field: 'paypal_order_id',
      headerName: 'PayPal Order ID',
      flex: 2,
      cellClass: 'font-mono text-xs text-blue-400',
    },
    {
      field: 'total_amount',
      headerName: 'Total ($)',
      width: 110,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'font-semibold text-slate-200',
    },
    {
      field: 'captured_amount',
      headerName: 'Captured ($)',
      width: 120,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'text-emerald-400 font-bold',
    },
    {
      field: 'held_amount',
      headerName: 'Held ($)',
      width: 110,
      valueFormatter: (p) => `$${p.value?.toFixed(2) || '0.00'}`,
      cellClass: 'text-amber-400 font-bold',
    },
    {
      field: 'status',
      headerName: 'Lifecycle Status',
      width: 180,
      cellRenderer: (p: any) => {
        const val = p.value || 'CREATED';
        let badgeColor = 'bg-slate-700 text-slate-300';
        if (val === 'AUTHORIZED') badgeColor = 'bg-blue-600/30 text-blue-300 border-blue-500/40';
        if (val === 'PARTIALLY_CAPTURED') badgeColor = 'bg-amber-500/30 text-amber-300 border-amber-500/40';
        if (val === 'COMPLETED') badgeColor = 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40';
        if (val === 'VOIDED') badgeColor = 'bg-rose-600/30 text-rose-300 border-rose-500/40';

        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${badgeColor}`}>
            {val}
          </span>
        );
      },
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-100">AG Grid Transaction Ledger</h3>
          <p className="text-xs text-slate-400">Real-time orders, partial capture balances & status updates</p>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Showing {orders.length} order{orders.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ height: '240px', width: '100%' }} className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800">
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
        />
      </div>
    </div>
  );
};

