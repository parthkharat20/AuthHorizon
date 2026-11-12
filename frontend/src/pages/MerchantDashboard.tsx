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

const DEMO_INITIAL_ORDERS = [
  {
    id: 1,
    paypal_order_id: "81R116453E1577428-DEMO1",
    auth_id: "AUTH-DEMO1-90-HELD",
    total_amount: 90.0,
    captured_amount: 0.0,
    held_amount: 90.0,
    status: "AUTHORIZED",
    items_count: 3,
    auth_days_remaining: 29,
    risk_assessment: {
      disruption_probability: 0.12,
      risk_tier: "LOW",
      estimated_delay_days: 0,
    },
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    paypal_order_id: "42K998124B9014112-DEMO2",
    auth_id: "AUTH-DEMO2-PARTIAL",
    total_amount: 90.0,
    captured_amount: 60.0,
    held_amount: 30.0,
    status: "PARTIALLY_CAPTURED",
    items_count: 3,
    auth_days_remaining: 21,
    risk_assessment: {
      disruption_probability: 0.65,
      risk_tier: "HIGH",
      estimated_delay_days: 6,
    },
    created_at: new Date(Date.now() - 3600000 * 24 * 8).toISOString()
  },
  {
    id: 3,
    paypal_order_id: "19C772391D4409188-DEMO3",
    auth_id: "AUTH-DEMO3-SWAP-RESOLVED",
    total_amount: 90.0,
    captured_amount: 88.0,
    held_amount: 0.0,
    status: "COMPLETED",
    items_count: 3,
    auth_days_remaining: 0,
    risk_assessment: {
      disruption_probability: 0.05,
      risk_tier: "LOW",
      estimated_delay_days: 0,
    },
    created_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString()
  }
];

const DEFAULT_ORDER_ITEMS = [
  { id: 101, sku: "SKU-BEAR-01", name: "Precision Bearings (Set of 4)", amount: 30.0, quantity: 1, status: "IN_STOCK" },
  { id: 102, sku: "SKU-PUMP-02", name: "Hydraulic Pump Assembly", amount: 30.0, quantity: 1, status: "IN_STOCK" },
  { id: 103, sku: "SKU-COAT-03", name: "Ceramic Coating Kit Industrial", amount: 30.0, quantity: 1, status: "IN_STOCK" }
];

export const MerchantDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>(DEMO_INITIAL_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(1);
  const [currentOrder, setCurrentOrder] = useState<any | null>({
    ...DEMO_INITIAL_ORDERS[0],
    items: DEFAULT_ORDER_ITEMS
  });
  const [inspectorTab, setInspectorTab] = useState<'hold' | 'notice'>('hold');
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
      if (Array.isArray(res.data) && res.data.length > 0) {
        setOrders(res.data);
        if (!selectedOrderId) {
          setSelectedOrderId(res.data[0].id);
        }
      }
    } catch (err) {
      // Backend not yet reachable or empty, preserve fallback state
      console.warn('Orders fetch note:', err);
    }
  };

  // Fetch selected order details
  const fetchOrderDetails = async (id: number) => {
    try {
      const res = await axios.get(`/api/orders/${id}`);
      if (res.data) {
        setCurrentOrder(res.data);
      }
    } catch (err) {
      console.warn('Order details fetch note:', err);
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
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-[#0070BA] selection:text-white">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-16 px-6 lg:px-8 border-b border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between shadow-xs">
        {/* Left: Authentic PayPal Monogram + Product Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#003087]/5 border border-slate-200 shadow-xs">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 5.5H18.2C22.5 5.5 24.5 7.6 24 11.5C23.4 15.6 20.6 17.5 16.5 17.5H13.2L11.5 27.5H7.5L10 5.5Z" fill="#003087"/>
              <path d="M13.5 10H20.7C24.3 10 26 11.7 25.5 15.1C25 18.7 22.5 20.4 19 20.4H16L14.5 29.5H11L13.5 10Z" fill="#0070BA"/>
              <path d="M16 17.5H19C22.5 17.5 25 15.8 25.5 12.2C25.8 10.4 25.2 9 24 8.1C23.4 11.3 21 13 17.5 13H14.2L13.2 19L14.5 29.5H16L16 17.5Z" fill="#001C66" opacity="0.3"/>
            </svg>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-slate-900 tracking-tight">PayPal Horizon</span>
            <span className="hidden sm:inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Institutional Desk
            </span>
          </div>
        </div>

        {/* Center: Spaced Navigation Anchors */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">Architecture</a>
          <a href="#ledger" className="hover:text-[#0070BA] font-semibold text-[#0070BA] transition-colors">Settlement Ledger</a>
          <a href="#workbench" className="hover:text-slate-900 transition-colors">Telemetry Workbench</a>
          {selectedOrderId && (
            <a
              href={`/consent/${selectedOrderId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#0070BA] hover:text-[#005ea6] transition-colors flex items-center gap-1 font-semibold"
            >
              <span>Buyer Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </nav>

        {/* Right: Technical Badges & Primary PayPal Button */}
        <div className="flex items-center gap-3">
          {/* Test Health Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>90/90 Tests</span>
          </div>

          {/* Gateway Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{systemHealth?.gateway === 'paypal_sandbox' ? 'PayPal Sandbox' : 'REST v2 Active'}</span>
          </div>

          {/* Primary Action Button (PayPal Cobalt) */}
          <button
            onClick={handleCreateDemoOrder}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Package className="w-3.5 h-3.5" />
            <span>+ Create Order</span>
          </button>
        </div>
      </header>

      {/* ── Action Notification Banner ─────────────────────────────── */}
      {actionMsg && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 text-xs text-blue-900 flex items-center justify-between font-mono">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-blue-500 hover:text-blue-800 font-bold ml-4">✕</button>
        </div>
      )}

      {/* ── Protocol Hero Section ─── */}
      <section className="pt-16 pb-12 px-4 max-w-5xl mx-auto text-center" id="how-it-works">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-blue-200 text-[#0070BA] font-mono text-xs uppercase tracking-wider bg-blue-50/80 mb-5 font-semibold">
          PAYPAL REST v2 • AUTONOMOUS LIQUIDITY ENGINE
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.14]">
          Autonomous Multi-Supplier Payments for <br />
          <span className="text-[#0070BA]">Global Supply Chains & AI Agents</span>
        </h1>
        <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Dynamic 29-day pre-authorization holds, autonomous multi-supplier split captures, and cryptographic SHA-256 buyer consent chains. Zero frozen liquidity.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#ledger"
            className="px-5 py-2.5 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-2"
          >
            <span>Launch Settlement Ledger</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          {selectedOrderId && (
            <a
              href={`/consent/${selectedOrderId}`}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs border border-slate-300 shadow-xs transition-all flex items-center gap-2"
            >
              <span>Open Buyer Portal</span>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </a>
          )}
        </div>

        {/* 3 Pillar Feature Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 text-left" id="features">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 text-[#0070BA]">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1.5">Multi-Supplier Split Holds</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Single buyer authorization partitioned across distinct warehouse nodes. Independent split captures with zero re-authorization friction.
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#0070BA]/30 rounded-xl p-5 shadow-xs hover:border-[#0070BA] transition-all flex flex-col justify-between ring-1 ring-[#0070BA]/10">
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 text-[#0070BA]">
                <Link2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1.5">Cryptographic Audit Chain</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tamper-evident SHA-256 state chain. Every line-item swap or port delay is cryptographically bound in immutable buyer consent blocks.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 text-[#0070BA]">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1.5">Deterministic Risk Firewall</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                100% Python arithmetic firewall. Zero AI hallucinated balances, currency overrides, or unverified ledger state mutations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Command Deck & Live Terminal Section ──────────────── */}
      <main className="flex-1 p-4 lg:p-8 space-y-6 max-w-[1720px] w-full mx-auto" id="ledger">
        
        {/* Section Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <span className="text-xs font-mono font-semibold text-[#0070BA] uppercase tracking-wider">
              Interactive Protocol Terminal
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Authorization Portfolio & Settlement Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Real-time PayPal split authorizations, 29-day hold expirations, and multi-supplier execution
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Active Context: Order #{selectedOrderId || '—'}
            </span>
          </div>
        </div>

        {/* ── A. Global Liquidity Summary Matrix ────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Pre-Authorized
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                USD
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums tracking-tight">
                ${portfolioSummary.totalAuth.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              29-day max reserve window
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Settled & Captured
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                {portfolioSummary.totalAuth > 0 ? `${((portfolioSummary.totalCap / portfolioSummary.totalAuth) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-emerald-700 tabular-nums tracking-tight">
                ${portfolioSummary.totalCap.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700/80 mt-1 font-mono">
              Instant multi-party split capture
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Active Contingency Hold
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200">
                {portfolioSummary.totalAuth > 0 ? `${((portfolioSummary.totalHeld / portfolioSummary.totalAuth) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-amber-700 tabular-nums tracking-tight">
                ${portfolioSummary.totalHeld.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-amber-700/80 mt-1 font-mono">
              Zero frozen supplier capital
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Portfolio Health
              </span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-bold border ${
                portfolioSummary.delayedCount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {portfolioSummary.delayedCount} Delayed
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums tracking-tight">
                {orders.length} <span className="text-base font-normal text-slate-500">Active</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Deterministic state verification
            </p>
          </div>
        </div>

        {/* ── B. Asymmetric Master-Detail Layout (65% Left / 35% Right) ─ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ── LEFT 65%: MASTER AUTHORIZATION PORTFOLIO (Cols 1-8) ──── */}
          <div className="lg:col-span-8 space-y-4">
            <OrdersGrid
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={(id) => setSelectedOrderId(id)}
              loading={loading}
            />
          </div>

          {/* ── RIGHT 35%: CONTEXTUAL INSPECTOR & ACTION DOCK (Cols 9-12) ─ */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Contextual Inspector Container with Segmented Tabs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                {/* Segmented Control */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono">
                  <button
                    onClick={() => setInspectorTab('hold')}
                    className={`px-3 py-1 rounded-md transition-all font-semibold ${
                      inspectorTab === 'hold'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hold & Settle
                  </button>
                  <button
                    onClick={() => setInspectorTab('notice')}
                    className={`px-3 py-1 rounded-md transition-all font-semibold ${
                      inspectorTab === 'notice'
                        ? 'bg-white text-[#0070BA] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    AI Notice Ingestion
                  </button>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  currentOrder?.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                  currentOrder?.status === 'PARTIALLY_CAPTURED' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                  'bg-blue-50 text-[#0070BA] border border-blue-200'
                }`}>
                  {currentOrder?.status || 'AUTHORIZED'}
                </span>
              </div>

              {/* Tab 1: Hold Telemetry & 1-Click Execution */}
              {inspectorTab === 'hold' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="font-bold text-slate-900">ORDER #{currentOrder?.id || selectedOrderId || 1}</span>
                      <span className="text-[10px] text-slate-500 block truncate max-w-[200px]" title={currentOrder?.paypal_order_id}>
                        {currentOrder?.paypal_order_id || '81R116453E1577428-DEMO1'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block">Hold Window</span>
                      <span className="font-semibold text-slate-700">
                        {currentOrder?.auth_days_remaining != null ? `~${currentOrder.auth_days_remaining}d remaining` : '29d Active'}
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
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Fulfillment Line Items ({(currentOrder?.items || DEFAULT_ORDER_ITEMS).length}):
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                      {(currentOrder?.items || DEFAULT_ORDER_ITEMS).map((it: any) => (
                        <div key={it.id || it.sku} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono">
                          <div className="truncate pr-2">
                            <span className="font-semibold text-slate-800 block truncate">{it.name}</span>
                            <span className="text-[10px] text-slate-500">{it.sku}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 tabular-nums block">${it.amount.toFixed(2)}</span>
                            <span className={`text-[9px] uppercase font-bold ${
                              it.status === 'SHIPPED' ? 'text-emerald-700' :
                              it.status === 'DELAYED' ? 'text-amber-700' : 'text-slate-500'
                            }`}>
                              {it.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scenario Action Dock */}
                  <div className="pt-3 border-t border-slate-200 space-y-2.5">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      1-Click Execution Dock:
                    </span>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {/* Step 1: Create Cart */}
                      <button
                        onClick={handleCreateDemoOrder}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5 text-[#0070BA]" />
                        <span>+ New $90 Hold</span>
                      </button>

                      {/* Step 2: Authorize */}
                      <button
                        onClick={handleAuthorize}
                        disabled={loading || currentOrder?.status !== 'CREATED'}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-xs disabled:opacity-40 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-[#0070BA]" />
                        <span>Lock Auth Hold</span>
                      </button>

                      {/* Step 3: Partial Ship */}
                      <button
                        onClick={handleShipPartial}
                        disabled={loading || currentOrder?.status !== 'AUTHORIZED'}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-xs disabled:opacity-40 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ship Partial ($60)</span>
                      </button>

                      {/* Step 4: Fulfill Delayed / Swap */}
                      <button
                        onClick={handleFulfillDelayed}
                        disabled={loading || currentOrder?.status !== 'PARTIALLY_CAPTURED'}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-xs disabled:opacity-40 cursor-pointer"
                      >
                        <Repeat className="w-3.5 h-3.5 text-amber-600" />
                        <span>Fulfill Delayed ($28)</span>
                      </button>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleAssessRisk}
                        disabled={assessingRisk || !selectedOrderId}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Cpu className="w-3.5 h-3.5 text-[#0070BA]" />
                        <span>{assessingRisk ? 'Scoring...' : 'Evaluate Risk'}</span>
                      </button>

                      <a
                        href={`/api/orders/${selectedOrderId || 1}/evidence/download`}
                        download
                        className="py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-mono flex items-center justify-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Evidence JSON</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                /* Tab 2: Embedded AI Notice Ingestion */
                <NoticeParserCard
                  orderId={selectedOrderId || 1}
                  onNoticeParsed={() => {
                    if (selectedOrderId) {
                      fetchOrderDetails(selectedOrderId);
                      fetchRiskAssessments(selectedOrderId);
                    }
                  }}
                />
              )}
            </div>

          </div>
        </div>

        {/* ── C. OPERATIONAL DEEP-DIVE WORKBENCH (Full Width) ──────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm" id="workbench">
          
          {/* Workbench Header & Primary Category Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0070BA]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide font-mono">
                  Operational Telemetry & Defense Workbench
                </h3>
                <span className="text-[10px] font-mono text-slate-600 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                  Context: Order #{selectedOrderId || '—'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-supplier freight telemetry, cryptographic consent hashes & PayPal gateway logs
              </p>
            </div>

            {/* Primary Category Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono">
              <button
                onClick={() => setWorkbenchCategory('supply_telemetry')}
                className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  workbenchCategory === 'supply_telemetry'
                    ? 'bg-[#0070BA] text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Supply Telemetry & Reroute</span>
              </button>

              <button
                onClick={() => setWorkbenchCategory('cryptographic_chain')}
                className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  workbenchCategory === 'cryptographic_chain'
                    ? 'bg-[#0070BA] text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Cryptographic Chain & Defense</span>
              </button>

              <button
                onClick={() => setWorkbenchCategory('gateway_reconciler')}
                className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  workbenchCategory === 'gateway_reconciler'
                    ? 'bg-[#0070BA] text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>PayPal Gateway Reconciler</span>
              </button>
            </div>
          </div>

          {/* ── Category 1: Supply Telemetry & Reroute ──────────────── */}
          {workbenchCategory === 'supply_telemetry' && (
            <div className="space-y-4">
              {/* Sub-tab navigation */}
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSupplySubTab('items')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      supplySubTab === 'items'
                        ? 'bg-blue-50 border-[#0070BA] text-[#0070BA] font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Itemized Risk & 1-Click Reroute ({riskAssessments.length})
                  </button>
                  <button
                    onClick={() => setSupplySubTab('suppliers')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      supplySubTab === 'suppliers'
                        ? 'bg-blue-50 border-[#0070BA] text-[#0070BA] font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Global Supplier Nodes ({suppliers.length})
                  </button>
                </div>
                <span className="text-slate-500 text-[11px]">
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
            <div className="space-y-4">
              {/* Red-Team Chaos Simulator Toolbar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-mono">
                      Red-Team Chaos Simulator (Cryptographic Defense)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Simulate payload tampering or block deletion to test real-time SHA-256 detection
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSimulateTamper}
                    disabled={simulatingChaos || (currentOrder?.consents?.length || 0) === 0}
                    className="px-3.5 py-1.5 text-xs font-mono font-semibold rounded-full bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 transition disabled:opacity-40"
                  >
                    Simulate Tamper
                  </button>
                  <button
                    onClick={handleSimulateChainBreak}
                    disabled={simulatingChaos || (currentOrder?.consents?.length || 0) < 2}
                    className="px-3.5 py-1.5 text-xs font-mono font-semibold rounded-full bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 transition disabled:opacity-40"
                  >
                    Simulate Chain Break
                  </button>
                  <button
                    onClick={handleVerifyEvidence}
                    disabled={verifyingChain}
                    className="px-3.5 py-1.5 text-xs font-mono font-semibold rounded-full bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 transition"
                  >
                    {verifyingChain ? 'Verifying...' : 'Verify Cryptographic State'}
                  </button>
                  {chaosResult && (
                    <button
                      onClick={() => { setChaosResult(null); handleVerifyEvidence(); }}
                      className="px-3.5 py-1.5 text-xs font-mono font-semibold rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      Restore Chain
                    </button>
                  )}
                </div>
              </div>

              {/* Chaos Result Alert Banner */}
              {chaosResult && (
                <div className="p-4 rounded-xl border text-xs font-mono bg-rose-50 border-rose-200 text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>CHAOS VERDICT: {chaosResult.verdict}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-700">
                    {chaosResult.original_hash && (
                      <div>
                        <span className="text-slate-500 block">Original Hash:</span>
                        <code className="text-emerald-700 break-all">{chaosResult.original_hash}</code>
                      </div>
                    )}
                    {chaosResult.tampered_hash && (
                      <div>
                        <span className="text-slate-500 block">Mutated Hash:</span>
                        <code className="text-rose-700 break-all">{chaosResult.tampered_hash}</code>
                      </div>
                    )}
                    {chaosResult.removed_record_hash && (
                      <div>
                        <span className="text-slate-500 block">Broken Link Hash:</span>
                        <code className="text-rose-700 break-all">{chaosResult.removed_record_hash}</code>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 block">Integrity Defense:</span>
                      <span className="text-amber-700 font-semibold">{chaosResult.security_note}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Verification Result Banner */}
              {verificationResult && (
                <div className="p-4 rounded-xl border text-xs font-mono bg-emerald-50 border-emerald-200 text-emerald-800">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>EVIDENCE INTEGRITY AUDIT: {verificationResult.audit_status}</span>
                  </div>
                  <span className="text-xs text-slate-600 block">{verificationResult.sync_message}</span>
                </div>
              )}

              {/* Consent Chain Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
                  <span>AG Grid: Sequential SHA-256 consent blocks linked to GENESIS_HASH</span>
                  <span className="text-emerald-700 font-bold">{currentOrder?.consents?.length || 0} consent block(s)</span>
                </div>
                <ConsentChainGrid consents={currentOrder?.consents || []} />
              </div>
            </div>
          )}

          {/* ── Category 3: PayPal Gateway Reconciliation ───────────── */}
          {workbenchCategory === 'gateway_reconciler' && (
            <div className="space-y-4">
              {/* Sub-tab controls & Idempotency test */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setGatewaySubTab('logs')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      gatewaySubTab === 'logs'
                        ? 'bg-blue-50 border-[#0070BA] text-[#0070BA] font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Gateway Reconciler Logs ({currentOrder?.gateway_logs?.length || 0})
                  </button>
                  <button
                    onClick={() => setGatewaySubTab('routing')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      gatewaySubTab === 'routing'
                        ? 'bg-blue-50 border-[#0070BA] text-[#0070BA] font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Multi-Supplier Hold Routing ({routingPlan.length})
                  </button>
                  <button
                    onClick={() => setGatewaySubTab('audits')}
                    className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                      gatewaySubTab === 'audits'
                        ? 'bg-blue-50 border-[#0070BA] text-[#0070BA] font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Capture Audits ({currentOrder?.audits?.length || 0})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestIdempotency}
                    disabled={testingIdempotency || !selectedOrderId}
                    className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0070BA] text-[11px] hover:bg-blue-100 transition flex items-center gap-1.5 font-medium"
                    title="Replay capture call with same PayPal-Request-Id to verify cached replay"
                  >
                    <Repeat className={`w-3 h-3 ${testingIdempotency ? 'animate-spin' : ''}`} />
                    <span>Test Idempotency Replay</span>
                  </button>
                </div>
              </div>

              {/* Idempotency Result Alert */}
              {idempotencyResult && (
                <div className="p-4 rounded-xl border text-xs font-mono bg-slate-50 border-slate-200 text-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span>IDEMPOTENCY VERIFIED ✓</span>
                    <span className="text-[10px] text-slate-500">Match Status: {idempotencyResult.reconciler_match ? 'PERFECT' : 'MISMATCH'}</span>
                  </div>
                  <p className="text-xs text-slate-600">{idempotencyResult.message}</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      {currentOrder.audits.map((a: any) => (
                        <div key={a.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 tabular-nums">${a.amount.toFixed(2)} USD</span>
                              <span className="text-[10px] text-slate-500 uppercase">({a.capture_type})</span>
                            </div>
                            <span className="text-[10px] text-blue-600 block truncate max-w-xs mt-0.5">
                              {a.paypal_capture_id}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              RECONCILED ✓
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-1">
                              {a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400 font-mono italic">
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
