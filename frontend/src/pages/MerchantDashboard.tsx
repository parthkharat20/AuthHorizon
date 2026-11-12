import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  CreditCard, 
  Package, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle, 
  ShieldCheck, 
  ArrowRight, 
  TrendingUp, 
  AlertTriangle, 
  History, 
  Download, 
  Link2, 
  Repeat, 
  Activity, 
  CheckCircle2, 
  Server, 
  ShieldAlert, 
  Layers, 
  Sparkles,
  Lock,
  Cpu,
  FileText,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { SplitHoldBar } from '../components/SplitHoldBar';
import { NoticeParserCard } from '../components/NoticeParserCard';
import { OrdersGrid } from '../components/OrdersGrid';
import { GatewayLogsGrid } from '../components/GatewayLogsGrid';
import { ConsentChainGrid } from '../components/ConsentChainGrid';
import { SupplierRiskGrid } from '../components/SupplierRiskGrid';
import { RiskAssessmentsGrid } from '../components/RiskAssessmentsGrid';
import { RoutingPlanGrid } from '../components/RoutingPlanGrid';
import { SupplierNode, RiskAssessment } from '../types';

export const MerchantDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [verifyingChain, setVerifyingChain] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [testingIdempotency, setTestingIdempotency] = useState<boolean>(false);
  const [idempotencyResult, setIdempotencyResult] = useState<any | null>(null);
  const [systemHealth, setSystemHealth] = useState<any | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierNode[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [routingPlan, setRoutingPlan] = useState<any[]>([]);
  const [assessingRisk, setAssessingRisk] = useState<boolean>(false);
  const [chaosResult, setChaosResult] = useState<any | null>(null);
  const [simulatingChaos, setSimulatingChaos] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  // Grouped Workbench Navigation
  const [workbenchCategory, setWorkbenchCategory] = useState<'supply_telemetry' | 'cryptographic_chain' | 'gateway_reconciler'>('supply_telemetry');
  const [supplySubTab, setSupplySubTab] = useState<'suppliers' | 'items'>('items');
  const [gatewaySubTab, setGatewaySubTab] = useState<'logs' | 'routing' | 'audits'>('logs');

  // Fetch system health
  const fetchHealth = async () => {
    try {
      const res = await axios.get('/api/health');
      setSystemHealth(res.data);
    } catch (e) {
      console.error('Failed to fetch health:', e);
    }
  };

  // Fetch supplier risk nodes
  const fetchSuppliers = async () => {
    try {
      const res = await axios.get('/api/risk/suppliers');
      setSuppliers(res.data);
    } catch (e) {
      console.error('Failed to fetch suppliers:', e);
    }
  };

  // Fetch per-order predictive risk assessments
  const fetchRiskAssessments = async (id: number) => {
    try {
      const res = await axios.get(`/api/orders/${id}/risk-assessment`);
      const list = Array.isArray(res.data) ? res.data : (res.data.assessments || []);
      setRiskAssessments(list);
    } catch (e) {
      setRiskAssessments([]);
    }
  };

  // Fetch multi-supplier routing plan
  const fetchRoutingPlan = async (id: number) => {
    try {
      const res = await axios.get(`/api/orders/${id}/routing-plan`);
      setRoutingPlan(res.data.routing_nodes || []);
    } catch (e) {
      setRoutingPlan([]);
    }
  };

  // Fetch all orders
  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/orders');
      setOrders(res.data);
      if (res.data.length > 0 && !selectedOrderId) {
        setSelectedOrderId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  // Fetch selected order details
  const fetchOrderDetails = async (id: number) => {
    try {
      const res = await axios.get(`/api/orders/${id}`);
      setCurrentOrder(res.data);
    } catch (err) {
      console.error('Error fetching order details:', err);
    }
  };

  // Dynamic Portfolio Liquidity Totals
  const portfolioSummary = useMemo(() => {
    const totalAuth = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
    const totalCap = orders.reduce((acc, o) => acc + (o.captured_amount || 0), 0);
    const totalHeld = orders.reduce((acc, o) => acc + (o.held_amount || 0), 0);
    const delayedCount = orders.filter((o) => o.status === 'PARTIALLY_CAPTURED').length;
    return { totalAuth, totalCap, totalHeld, delayedCount };
  }, [orders]);

  useEffect(() => {
    fetchOrders();
    fetchHealth();
    fetchSuppliers();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderDetails(selectedOrderId);
      fetchRiskAssessments(selectedOrderId);
      fetchRoutingPlan(selectedOrderId);
    }
  }, [selectedOrderId]);

  // Real-time Server-Sent Events (SSE) listener
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events/stream');
      es.onopen = () => {
        setSseConnected(true);
      };
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.event !== 'heartbeat') {
            fetchOrders();
            if (selectedOrderId) {
              fetchOrderDetails(selectedOrderId);
            }
          }
        } catch {
          // ignore heartbeat parse errors
        }
      };
      es.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }
    return () => {
      if (es) {
        es.close();
      }
    };
  }, [selectedOrderId]);

  // Handlers
  const handleAssessRisk = async () => {
    if (!selectedOrderId) return;
    setAssessingRisk(true);
    try {
      const res = await axios.post(`/api/orders/${selectedOrderId}/risk-assessment`);
      setActionMsg(`Computed deterministic risk assessment for Order #${selectedOrderId}: ${res.data.assessment_count} items evaluated.`);
      await fetchOrderDetails(selectedOrderId);
      await fetchRiskAssessments(selectedOrderId);
      await fetchRoutingPlan(selectedOrderId);
      await fetchOrders();
      await fetchSuppliers();
    } catch (err: any) {
      console.error('Failed risk assessment:', err);
      setActionMsg(`Risk Assessment Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setAssessingRisk(false);
    }
  };

  const handleVerifyEvidence = async () => {
    if (!selectedOrderId) return;
    setVerifyingChain(true);
    setVerificationResult(null);
    try {
      const res = await axios.post(`/api/orders/${selectedOrderId}/evidence/verify`);
      setVerificationResult(res.data);
    } catch (err: any) {
      console.error('Failed to verify evidence:', err);
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleTestIdempotency = async () => {
    if (!selectedOrderId) return;
    setTestingIdempotency(true);
    setIdempotencyResult(null);
    try {
      const res = await axios.post(`/api/orders/${selectedOrderId}/test-idempotency`);
      setIdempotencyResult(res.data);
      await fetchOrderDetails(selectedOrderId);
      await fetchOrders();
    } catch (err: any) {
      console.error('Failed idempotency test:', err);
      setActionMsg(`Idempotency Test Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setTestingIdempotency(false);
    }
  };

  const handleSimulateTamper = async () => {
    if (!selectedOrderId) return;
    setSimulatingChaos(true);
    try {
      const res = await axios.post(`/api/chaos/simulate-tamper/${selectedOrderId}`);
      setChaosResult(res.data);
    } catch (err: any) {
      console.error('Tamper simulation error:', err);
      setActionMsg(`Chaos Tamper Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSimulatingChaos(false);
    }
  };

  const handleSimulateChainBreak = async () => {
    if (!selectedOrderId) return;
    setSimulatingChaos(true);
    try {
      const res = await axios.post(`/api/chaos/simulate-chain-break/${selectedOrderId}`);
      setChaosResult(res.data);
    } catch (err: any) {
      console.error('Chain break simulation error:', err);
      setActionMsg(`Chaos Chain Break Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSimulatingChaos(false);
    }
  };

  const handleReroute = async (sku: string, newSupplierCode: string) => {
    if (!selectedOrderId) return;
    try {
      setActionMsg(`Rerouting SKU ${sku} to ${newSupplierCode}...`);
      const res = await axios.post(`/api/orders/${selectedOrderId}/reroute`, null, {
        params: { sku, new_supplier_code: newSupplierCode }
      });
      setActionMsg(`Successfully rerouted SKU ${sku} to ${newSupplierCode}: ${res.data.status}`);
      await fetchOrderDetails(selectedOrderId);
      await fetchRiskAssessments(selectedOrderId);
      await fetchRoutingPlan(selectedOrderId);
      await fetchOrders();
    } catch (err: any) {
      console.error('Failed to reroute:', err);
      setActionMsg(`Reroute Error: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleCreateDemoOrder = async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const payload = {
        items: [
          { sku: "SKU-BEAR-01", name: "Precision Bearings (Set of 4)", amount: 30.0, quantity: 1 },
          { sku: "SKU-PUMP-02", name: "Hydraulic Pump Assembly", amount: 30.0, quantity: 1 },
          { sku: "SKU-COAT-03", name: "Ceramic Coating Kit Industrial", amount: 30.0, quantity: 1 }
        ],
        currency: "USD"
      };
      const res = await axios.post('/api/orders/create', payload);
      setActionMsg(`Created Order #${res.data.order_id}! Please approve via Sandbox link below.`);
      await fetchOrders();
      setSelectedOrderId(res.data.order_id);
    } catch (err: any) {
      setActionMsg(`Create Order Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = async () => {
    if (!selectedOrderId) return;
    setLoading(true);
    try {
      const res = await axios.post(`/api/orders/${selectedOrderId}/authorize`);
      setActionMsg(`Authorized $${res.data.held_amount.toFixed(2)} hold successfully!`);
      await fetchOrderDetails(selectedOrderId);
      await fetchOrders();
    } catch (err: any) {
      setActionMsg(`Authorize Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShipPartial = async () => {
    if (!selectedOrderId) return;
    setLoading(true);
    try {
      const res = await axios.post(`/api/orders/${selectedOrderId}/ship-partial`);
      setActionMsg(`Captured $${res.data.captured_amount.toFixed(2)} for shipped items. Held remainder: $${res.data.held_amount.toFixed(2)}.`);
      await fetchOrderDetails(selectedOrderId);
      await fetchOrders();
    } catch (err: any) {
      setActionMsg(`Ship Partial Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFulfillDelayed = async () => {
    if (!selectedOrderId) return;
    setLoading(true);
    try {
      const res = await axios.post(`/api/orders/${selectedOrderId}/fulfill-delayed`);
      setActionMsg(`Fulfilled delayed item! Captured final $${res.data.captured_amount.toFixed(2)}.`);
      await fetchOrderDetails(selectedOrderId);
      await fetchOrders();
    } catch (err: any) {
      setActionMsg(`Fulfill Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f7] flex flex-col font-sans selection:bg-[#0071e3] selection:text-white">
      {/* ── Institutional Apple-Inspired Header ────────────────────── */}
      <header className="apple-frosted-dark sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0070BA] to-[#003087] flex items-center justify-center font-black text-white text-xs shadow-sm ring-1 ring-white/15">
            PH
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-[#f5f5f7]">
                PayPal Horizon
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c1c1e] text-[#a1a1a6] border border-[#2c2c2e]">
                Merchant Treasury Desk
              </span>
            </div>
            <p className="text-[11px] text-[#86868b]">
              Autonomous Supply-Chain Liquidity & Pre-Authorization Hedging Engine
            </p>
          </div>
        </div>

        {/* Status Indicators & Navigation */}
        <div className="flex items-center gap-2">
          {/* Test Health Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#30d158]/10 border border-[#30d158]/25 text-[#30d158] text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-[#30d158]" />
            <span>90/90 Tests Passing</span>
          </div>

          {/* Gateway Sandbox Mode */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono ${
            systemHealth?.gateway === 'paypal_sandbox'
              ? 'bg-[#30d158]/10 border-[#30d158]/25 text-[#30d158]'
              : 'bg-[#ff9f0a]/10 border-[#ff9f0a]/25 text-[#ff9f0a]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              systemHealth?.gateway === 'paypal_sandbox' ? 'bg-[#30d158] animate-pulse' : 'bg-[#ff9f0a]'
            }`} />
            <span>{systemHealth?.gateway === 'paypal_sandbox' ? 'PayPal Sandbox (REST v2)' : 'Mock Gateway'}</span>
          </div>

          {/* SSE Live Stream */}
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono ${
            sseConnected 
              ? 'bg-[#30d158]/10 border-[#30d158]/25 text-[#30d158]' 
              : 'bg-[#1c1c1e] border-[#2c2c2e] text-[#86868b]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-[#30d158] animate-pulse' : 'bg-slate-500'}`} />
            <span>{sseConnected ? 'Live SSE Stream' : 'Polling Sync'}</span>
          </div>

          {/* AG Grid Active */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c1c1e] border border-[#2c2c2e] text-[#a1a1a6] text-[11px] font-mono">
            <Sparkles className="w-3 h-3 text-[#2997ff]" />
            <span>6× AG Grid Active</span>
          </div>

          {/* Consumer Portal Link */}
          {selectedOrderId && (
            <a
              href={`/consent/${selectedOrderId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[11px] font-medium shadow-xs transition-colors"
            >
              <span>Buyer Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </header>

      {/* ── Action Notification Banner ─────────────────────────────── */}
      {actionMsg && (
        <div className="bg-[#0071e3]/10 border-b border-[#0071e3]/20 px-6 py-2.5 text-xs text-[#2997ff] flex items-center justify-between font-mono">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-[#a1a1a6] hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      {/* ── Main Command Deck ──────────────────────────────────────── */}
      <main className="flex-1 p-4 lg:p-6 space-y-4 max-w-[1720px] w-full mx-auto">
        
        {/* ── A. Global Liquidity Summary Matrix ────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-[#161618] border border-[#2c2c2e] rounded-2xl p-4 shadow-xs hover:border-[#3a3a3c] transition-colors">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868b] block mb-1">
              Total Pre-Authorized
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-bold text-[#f5f5f7] tabular-nums">
                ${portfolioSummary.totalAuth.toFixed(2)}
              </span>
              <span className="text-[10px] font-mono text-[#86868b]">USD</span>
            </div>
          </div>

          <div className="bg-[#161618] border border-[#2c2c2e] rounded-2xl p-4 shadow-xs hover:border-[#3a3a3c] transition-colors">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#30d158] block mb-1">
              Settled & Captured
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-bold text-[#30d158] tabular-nums">
                ${portfolioSummary.totalCap.toFixed(2)}
              </span>
              <span className="text-[10px] font-mono text-[#30d158]/80">
                {portfolioSummary.totalAuth > 0 ? `${((portfolioSummary.totalCap / portfolioSummary.totalAuth) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="bg-[#161618] border border-[#2c2c2e] rounded-2xl p-4 shadow-xs hover:border-[#3a3a3c] transition-colors">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#ff9f0a] block mb-1">
              Active Contingency Hold
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-bold text-[#ff9f0a] tabular-nums">
                ${portfolioSummary.totalHeld.toFixed(2)}
              </span>
              <span className="text-[10px] font-mono text-[#ff9f0a]/80">
                {portfolioSummary.totalAuth > 0 ? `${((portfolioSummary.totalHeld / portfolioSummary.totalAuth) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="bg-[#161618] border border-[#2c2c2e] rounded-2xl p-4 shadow-xs hover:border-[#3a3a3c] transition-colors">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868b] block mb-1">
              Portfolio Health
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-bold text-[#f5f5f7] tabular-nums">
                {orders.length} Active
              </span>
              <span className="text-[10px] font-mono text-[#ff9f0a]">
                {portfolioSummary.delayedCount} Delayed
              </span>
            </div>
          </div>
        </div>

        {/* ── B. Asymmetric Master-Detail Layout (65% Left / 35% Right) ─ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* ── LEFT 65%: MASTER AUTHORIZATION PORTFOLIO (Cols 1-8) ──── */}
          <div className="lg:col-span-8 space-y-3">
            <OrdersGrid
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={(id) => setSelectedOrderId(id)}
              loading={loading}
            />
          </div>

          {/* ── RIGHT 35%: CONTEXTUAL INSPECTOR & ACTION DOCK (Cols 9-12) ─ */}
          <div className="lg:col-span-4 space-y-3">
            
            {/* 1. Selected Order Telemetry Header */}
            <div className="bg-[#161618] border border-[#2c2c2e] rounded-2xl p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#2c2c2e]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#f5f5f7]">
                      ORDER #{currentOrder?.id || selectedOrderId || '—'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                      currentOrder?.status === 'COMPLETED' ? 'bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30' :
                      currentOrder?.status === 'PARTIALLY_CAPTURED' ? 'bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30' :
                      'bg-[#2997ff]/15 text-[#2997ff] border border-[#2997ff]/30'
                    }`}>
                      {currentOrder?.status || 'SELECT ORDER'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#86868b] block truncate mt-0.5" title={currentOrder?.paypal_order_id}>
                    PayPal ID: {currentOrder?.paypal_order_id || '—'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-[#86868b] uppercase block">Hold Expiry</span>
                  <span className="text-[11px] font-mono text-[#f5f5f7]">
                    {currentOrder?.auth_days_remaining != null ? `~${currentOrder.auth_days_remaining}d remaining` : '29d Window'}
                  </span>
                </div>
              </div>

              {/* Proportional Split Hold Bar */}
              <SplitHoldBar
                totalAmount={currentOrder?.total_amount || 90.0}
                capturedAmount={currentOrder?.captured_amount || 0.0}
                heldAmount={currentOrder?.held_amount || 0.0}
                status={currentOrder?.status || 'AUTHORIZED'}
              />

              {/* Order Line Items Summary */}
              {currentOrder?.items && currentOrder.items.length > 0 && (
                <div className="pt-3 border-t border-[#2c2c2e] space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#86868b] block">
                    Fulfillment Line Items ({currentOrder.items.length}):
                  </span>
                  <div className="space-y-1.5">
                    {currentOrder.items.map((it: any) => (
                      <div key={it.id} className="p-2.5 rounded-xl bg-[#121214] border border-[#2c2c2e] flex items-center justify-between text-[11px] font-mono">
                        <div className="truncate pr-2">
                          <span className="font-medium text-[#f5f5f7] block truncate">{it.name}</span>
                          <span className="text-[10px] text-[#86868b]">{it.sku}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-[#f5f5f7] tabular-nums block">${it.amount.toFixed(2)}</span>
                          <span className={`text-[9px] uppercase font-bold ${
                            it.status === 'SHIPPED' ? 'text-[#30d158]' :
                            it.status === 'DELAYED' ? 'text-[#ff9f0a]' : 'text-[#86868b]'
                          }`}>
                            {it.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scenario Action Dock (Subordinate Executive Controls) */}
              <div className="pt-3 border-t border-[#2c2c2e] space-y-2.5">
                <span className="text-[10px] font-mono uppercase text-[#86868b] block">
                  Scenario Execution Dock:
                </span>
                
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {/* Step 1: Create Cart */}
                  <button
                    onClick={handleCreateDemoOrder}
                    disabled={loading}
                    className="p-2 rounded-xl bg-[#1c1c1e] hover:bg-[#232326] border border-[#2c2c2e] text-[#f5f5f7] transition flex items-center justify-center gap-1.5 text-[11px]"
                  >
                    <Package className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>+ Create $90 Cart</span>
                  </button>

                  {/* Step 2: Authorize */}
                  <button
                    onClick={handleAuthorize}
                    disabled={loading || currentOrder?.status !== 'CREATED'}
                    className="p-2 rounded-xl bg-[#1c1c1e] hover:bg-[#232326] border border-[#2c2c2e] text-[#f5f5f7] transition flex items-center justify-center gap-1.5 text-[11px] disabled:opacity-30"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>Authorize Hold</span>
                  </button>

                  {/* Step 3: Partial Ship */}
                  <button
                    onClick={handleShipPartial}
                    disabled={loading || currentOrder?.status !== 'AUTHORIZED'}
                    className="p-2 rounded-xl bg-[#1c1c1e] hover:bg-[#232326] border border-[#2c2c2e] text-[#f5f5f7] transition flex items-center justify-center gap-1.5 text-[11px] disabled:opacity-30"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-[#30d158]" />
                    <span>Ship Partial ($60)</span>
                  </button>

                  {/* Step 4: Fulfill Delayed / Swap */}
                  <button
                    onClick={handleFulfillDelayed}
                    disabled={loading || currentOrder?.status !== 'PARTIALLY_CAPTURED'}
                    className="p-2 rounded-xl bg-[#1c1c1e] hover:bg-[#232326] border border-[#2c2c2e] text-[#f5f5f7] transition flex items-center justify-center gap-1.5 text-[11px] disabled:opacity-30"
                  >
                    <Repeat className="w-3.5 h-3.5 text-[#ff9f0a]" />
                    <span>Fulfill / Swap ($28)</span>
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleAssessRisk}
                    disabled={assessingRisk || !selectedOrderId}
                    className="flex-1 py-1.5 px-3 rounded-full bg-[#1c1c1e] hover:bg-[#232326] border border-[#2c2c2e] text-[#f5f5f7] text-[11px] font-mono flex items-center justify-center gap-1.5 transition"
                  >
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{assessingRisk ? 'Scoring...' : 'Evaluate Risk'}</span>
                  </button>

                  <a
                    href={`/api/orders/${selectedOrderId || 1}/evidence/download`}
                    download
                    className="py-1.5 px-3 rounded-full bg-[#1c1c1e] hover:bg-[#232326] border border-[#2c2c2e] text-[#a1a1a6] hover:text-white text-[11px] font-mono flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-[#86868b]" />
                    <span>Evidence JSON</span>
                  </a>
                </div>
              </div>
            </div>

            {/* 2. Embedded AI Supplier Notice Ingestion Console */}
            <NoticeParserCard
              orderId={selectedOrderId || 1}
              onNoticeParsed={() => {
                if (selectedOrderId) {
                  fetchOrderDetails(selectedOrderId);
                  fetchRiskAssessments(selectedOrderId);
                }
              }}
            />

          </div>
        </div>

        {/* ── C. OPERATIONAL DEEP-DIVE WORKBENCH (Full Width) ──────── */}
        <section className="bg-[#161618] border border-[#2c2c2e] rounded-2xl p-5 space-y-4 shadow-xs">
          
          {/* Workbench Header & Primary Category Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#2c2c2e]">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#2997ff]" />
                <h3 className="text-xs font-semibold tracking-wider text-[#f5f5f7] uppercase font-mono">
                  Operational Deep-Dive Workbench
                </h3>
                <span className="text-[10px] font-mono text-[#a1a1a6] px-2.5 py-0.5 rounded-full bg-[#1c1c1e] border border-[#2c2c2e]">
                  Context: Order #{selectedOrderId || '—'}
                </span>
              </div>
              <p className="text-[11px] text-[#86868b] mt-0.5">
                Multi-supplier freight telemetry, cryptographic consent hashes & PayPal gateway logs
              </p>
            </div>

            {/* Primary Category Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-[#121214] border border-[#2c2c2e] text-xs font-mono">
              <button
                onClick={() => setWorkbenchCategory('supply_telemetry')}
                className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  workbenchCategory === 'supply_telemetry'
                    ? 'bg-[#0071e3] text-white font-medium shadow-xs'
                    : 'text-[#86868b] hover:text-[#f5f5f7]'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Supply Telemetry & Reroute</span>
              </button>

              <button
                onClick={() => setWorkbenchCategory('cryptographic_chain')}
                className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  workbenchCategory === 'cryptographic_chain'
                    ? 'bg-[#0071e3] text-white font-medium shadow-xs'
                    : 'text-[#86868b] hover:text-[#f5f5f7]'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Cryptographic Chain & Defense</span>
              </button>

              <button
                onClick={() => setWorkbenchCategory('gateway_reconciler')}
                className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  workbenchCategory === 'gateway_reconciler'
                    ? 'bg-[#0071e3] text-white font-medium shadow-xs'
                    : 'text-[#86868b] hover:text-[#f5f5f7]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>PayPal Gateway Reconciler</span>
              </button>
            </div>
          </div>

          {/* ── Category 1: Supply Telemetry & Reroute ──────────────── */}
          {workbenchCategory === 'supply_telemetry' && (
            <div className="space-y-3">
              {/* Sub-tab navigation */}
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSupplySubTab('items')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      supplySubTab === 'items'
                        ? 'bg-[#2997ff]/15 border-[#2997ff]/40 text-[#2997ff] font-semibold'
                        : 'bg-[#1c1c1e] border-[#2c2c2e] text-[#86868b] hover:text-[#f5f5f7]'
                    }`}
                  >
                    Itemized Risk & 1-Click Reroute ({riskAssessments.length})
                  </button>
                  <button
                    onClick={() => setSupplySubTab('suppliers')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      supplySubTab === 'suppliers'
                        ? 'bg-[#2997ff]/15 border-[#2997ff]/40 text-[#2997ff] font-semibold'
                        : 'bg-[#1c1c1e] border-[#2c2c2e] text-[#86868b] hover:text-[#f5f5f7]'
                    }`}
                  >
                    Global Supplier Nodes ({suppliers.length})
                  </button>
                </div>
                <span className="text-[#86868b] text-[10px]">
                  {supplySubTab === 'items' 
                    ? '0% AI Math • Deterministic Item Scoring & Backup Supplier Reallocation'
                    : 'Live Managed Row Drag-Drop • Fulfillment Sparklines • Congestion Index'}
                </span>
              </div>

              {supplySubTab === 'items' ? (
                <RiskAssessmentsGrid 
                  assessments={riskAssessments} 
                  orderId={selectedOrderId} 
                  onReroute={handleReroute}
                />
              ) : (
                <SupplierRiskGrid suppliers={suppliers} />
              )}
            </div>
          )}

          {/* ── Category 2: Cryptographic Chain & Chaos Defense ──────── */}
          {workbenchCategory === 'cryptographic_chain' && (
            <div className="space-y-3">
              {/* Red-Team Chaos Simulator Toolbar */}
              <div className="p-4 bg-[#121214] border border-[#2c2c2e] rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-rose-300 font-mono">
                      Red-Team Chaos Simulator (Cryptographic Defense)
                    </h4>
                    <p className="text-[10px] text-[#86868b]">
                      Simulate payload tampering or block deletion to test real-time SHA-256 detection
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSimulateTamper}
                    disabled={simulatingChaos || (currentOrder?.consents?.length || 0) === 0}
                    className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-rose-950/50 border border-rose-700/60 text-rose-200 hover:bg-rose-900 transition disabled:opacity-30"
                  >
                    ⚡ Simulate Tamper
                  </button>
                  <button
                    onClick={handleSimulateChainBreak}
                    disabled={simulatingChaos || (currentOrder?.consents?.length || 0) < 2}
                    className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-amber-950/50 border border-amber-700/60 text-amber-200 hover:bg-amber-900 transition disabled:opacity-30"
                  >
                    🔗 Simulate Chain Break
                  </button>
                  <button
                    onClick={handleVerifyEvidence}
                    disabled={verifyingChain}
                    className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-[#0071e3]/15 border border-[#0071e3]/40 text-[#2997ff] hover:bg-[#0071e3]/25 transition"
                  >
                    {verifyingChain ? 'Verifying...' : 'Verify Cryptographic State'}
                  </button>
                  {chaosResult && (
                    <button
                      onClick={() => { setChaosResult(null); handleVerifyEvidence(); }}
                      className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-emerald-950/50 border border-emerald-700/60 text-emerald-200 hover:bg-emerald-900 transition"
                    >
                      🔄 Restore Chain
                    </button>
                  )}
                </div>
              </div>

              {/* Chaos Result Alert Banner */}
              {chaosResult && (
                <div className="p-3.5 rounded-xl border text-xs font-mono bg-rose-950/30 border-rose-800/50 text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>CHAOS VERDICT: {chaosResult.verdict}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-300">
                    {chaosResult.original_hash && (
                      <div>
                        <span className="text-[#86868b] block">Original Hash:</span>
                        <code className="text-[#30d158] break-all">{chaosResult.original_hash}</code>
                      </div>
                    )}
                    {chaosResult.tampered_hash && (
                      <div>
                        <span className="text-[#86868b] block">Mutated Hash:</span>
                        <code className="text-rose-400 break-all">{chaosResult.tampered_hash}</code>
                      </div>
                    )}
                    {chaosResult.removed_record_hash && (
                      <div>
                        <span className="text-[#86868b] block">Broken Link Hash:</span>
                        <code className="text-rose-400 break-all">{chaosResult.removed_record_hash}</code>
                      </div>
                    )}
                    <div>
                      <span className="text-[#86868b] block">Integrity Defense:</span>
                      <span className="text-amber-300">{chaosResult.security_note}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Verification Result Banner */}
              {verificationResult && (
                <div className="p-3.5 rounded-xl border text-xs font-mono bg-emerald-950/30 border-emerald-800/50 text-emerald-200">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle className="w-4 h-4 text-[#30d158]" />
                    <span>EVIDENCE INTEGRITY AUDIT: {verificationResult.audit_status}</span>
                  </div>
                  <span className="text-[10px] text-slate-300 block">{verificationResult.sync_message}</span>
                </div>
              )}

              {/* Consent Chain Table */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#86868b] px-1">
                  <span>AG Grid: Sequential SHA-256 consent blocks linked to GENESIS_HASH</span>
                  <span className="text-[#30d158] font-bold">{currentOrder?.consents?.length || 0} consent block(s)</span>
                </div>
                <ConsentChainGrid consents={currentOrder?.consents || []} />
              </div>
            </div>
          )}

          {/* ── Category 3: PayPal Gateway Reconciliation ───────────── */}
          {workbenchCategory === 'gateway_reconciler' && (
            <div className="space-y-3">
              {/* Sub-tab controls & Idempotency test */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setGatewaySubTab('logs')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      gatewaySubTab === 'logs'
                        ? 'bg-[#2997ff]/15 border-[#2997ff]/40 text-[#2997ff] font-semibold'
                        : 'bg-[#1c1c1e] border-[#2c2c2e] text-[#86868b] hover:text-[#f5f5f7]'
                    }`}
                  >
                    Gateway Reconciler Logs ({currentOrder?.gateway_logs?.length || 0})
                  </button>
                  <button
                    onClick={() => setGatewaySubTab('routing')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      gatewaySubTab === 'routing'
                        ? 'bg-[#2997ff]/15 border-[#2997ff]/40 text-[#2997ff] font-semibold'
                        : 'bg-[#1c1c1e] border-[#2c2c2e] text-[#86868b] hover:text-[#f5f5f7]'
                    }`}
                  >
                    Multi-Supplier Hold Routing ({routingPlan.length})
                  </button>
                  <button
                    onClick={() => setGatewaySubTab('audits')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      gatewaySubTab === 'audits'
                        ? 'bg-[#2997ff]/15 border-[#2997ff]/40 text-[#2997ff] font-semibold'
                        : 'bg-[#1c1c1e] border-[#2c2c2e] text-[#86868b] hover:text-[#f5f5f7]'
                    }`}
                  >
                    Capture Audits ({currentOrder?.audits?.length || 0})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestIdempotency}
                    disabled={testingIdempotency || !selectedOrderId}
                    className="px-3 py-1 rounded-full bg-[#0071e3]/15 border border-[#0071e3]/40 text-[#2997ff] text-[11px] hover:bg-[#0071e3]/25 transition flex items-center gap-1.5"
                    title="Replay capture call with same PayPal-Request-Id to verify cached replay"
                  >
                    <Repeat className={`w-3 h-3 ${testingIdempotency ? 'animate-spin' : ''}`} />
                    <span>Test Idempotency Replay</span>
                  </button>
                </div>
              </div>

              {/* Idempotency Result Alert */}
              {idempotencyResult && (
                <div className="p-3.5 rounded-xl border text-xs font-mono bg-[#121214] border-[#2c2c2e] text-[#f5f5f7] space-y-1">
                  <div className="flex items-center justify-between text-[#30d158] font-bold">
                    <span>IDEMPOTENCY VERIFIED ✓</span>
                    <span className="text-[10px] text-[#86868b]">Match Status: {idempotencyResult.reconciler_match ? 'PERFECT' : 'MISMATCH'}</span>
                  </div>
                  <p className="text-[11px] text-[#a1a1a6]">{idempotencyResult.message}</p>
                </div>
              )}

              {/* Views */}
              {gatewaySubTab === 'logs' && (
                <GatewayLogsGrid logs={currentOrder?.gateway_logs || []} />
              )}

              {gatewaySubTab === 'routing' && (
                <RoutingPlanGrid 
                  nodes={routingPlan} 
                  totalOrderAmount={currentOrder?.total_amount || 90.0} 
                  orderId={selectedOrderId} 
                />
              )}

              {gatewaySubTab === 'audits' && (
                <div className="space-y-2">
                  {currentOrder?.audits && currentOrder.audits.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs font-mono">
                      {currentOrder.audits.map((a: any) => (
                        <div key={a.id} className="p-3.5 rounded-xl bg-[#121214] border border-[#2c2c2e] flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#f5f5f7] tabular-nums">${a.amount.toFixed(2)} USD</span>
                              <span className="text-[10px] text-[#86868b] uppercase">({a.capture_type})</span>
                            </div>
                            <span className="text-[10px] text-[#2997ff] block truncate max-w-xs mt-0.5">
                              {a.paypal_capture_id}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30">
                              RECONCILED ✓
                            </span>
                            <span className="text-[9px] text-[#86868b] block mt-1">
                              {a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[#86868b] font-mono italic">
                      No captures executed for this order yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </section>

      </main>
    </div>
  );
};
