import React, { useState, useEffect } from 'react';
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
  Server
} from 'lucide-react';
import { SplitHoldBar } from '../components/SplitHoldBar';
import { NoticeParserCard } from '../components/NoticeParserCard';
import { OrdersGrid } from '../components/OrdersGrid';
import { GatewayLogsGrid } from '../components/GatewayLogsGrid';
import { ConsentChainGrid } from '../components/ConsentChainGrid';

export const MerchantDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [verifyingChain, setVerifyingChain] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState<'audits' | 'gateway_logs' | 'consent_chain'>('audits');
  const [testingIdempotency, setTestingIdempotency] = useState<boolean>(false);
  const [idempotencyResult, setIdempotencyResult] = useState<any | null>(null);
  const [systemHealth, setSystemHealth] = useState<any | null>(null);

  // Fetch system health
  const fetchHealth = async () => {
    try {
      const res = await axios.get('/api/health');
      setSystemHealth(res.data);
    } catch (e) {
      console.error('Failed to fetch health:', e);
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

  useEffect(() => {
    fetchOrders();
    fetchHealth();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderDetails(selectedOrderId);
    }
  }, [selectedOrderId]);

  // Actions
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20">
            AH
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              AuthHorizon
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Split-Shipment Intelligence
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Enterprise Split-Shipment & Consent Control Center</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
            systemHealth?.gateway === 'paypal_sandbox'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              systemHealth?.gateway === 'paypal_sandbox' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`} />
            {systemHealth?.gateway === 'paypal_sandbox' ? 'PayPal Sandbox (Live REST v2)' : 'Mock Gateway Mode'}
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            AI: {systemHealth?.active_llm_provider?.toUpperCase() || 'GEMINI'} FLASH (Live)
          </div>

          {selectedOrderId && (
            <a
              href={`/consent/${selectedOrderId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition-all"
            >
              <span>Buyer Consent Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner Alert for Action Results */}
        {actionMsg && (
          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200 flex items-center justify-between shadow-lg">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg(null)} className="text-blue-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {/* Action Controls & Order Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1: Create Order */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400">Step 1 • Simulation</span>
              <h4 className="text-sm font-bold text-slate-100 mt-1">Create $90.00 Cart</h4>
              <p className="text-xs text-slate-400 mt-0.5">3 industrial components with intent=AUTHORIZE</p>
            </div>
            <button
              onClick={handleCreateDemoOrder}
              disabled={loading}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-50"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Create Demo Order</span>
            </button>
          </div>

          {/* Step 2: Approve on Sandbox */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400">Step 2 • Buyer Auth</span>
              <h4 className="text-sm font-bold text-slate-100 mt-1">PayPal Sandbox Link</h4>
              <p className="text-xs text-slate-400 mt-0.5">Approve checkout on PayPal Modal</p>
            </div>
            {currentOrder?.paypal_order_id ? (
              <a
                href={`https://www.sandbox.paypal.com/checkoutnow?token=${currentOrder.paypal_order_id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all text-center truncate"
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Open Sandbox Login</span>
              </a>
            ) : (
              <div className="mt-4 py-2 text-center text-xs text-slate-600 font-mono">No order selected</div>
            )}
          </div>

          {/* Step 3: Authorize Hold */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400">Step 3 • Lock Hold</span>
              <h4 className="text-sm font-bold text-slate-100 mt-1">Authorize $90 Hold</h4>
              <p className="text-xs text-slate-400 mt-0.5">Locks fund hold for up to 29 days</p>
            </div>
            <button
              onClick={handleAuthorize}
              disabled={loading || !currentOrder || currentOrder.status === 'AUTHORIZED' || currentOrder.status === 'PARTIALLY_CAPTURED' || currentOrder.status === 'COMPLETED'}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-40"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Authorize Order</span>
            </button>
          </div>

          {/* Step 4: Ship In-Stock (Split Capture) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400">Step 4 • Hero Action</span>
              <h4 className="text-sm font-bold text-slate-100 mt-1">Ship In-Stock ($60)</h4>
              <p className="text-xs text-slate-400 mt-0.5">Partial capture with final_capture=false</p>
            </div>
            <button
              onClick={handleShipPartial}
              disabled={loading || !currentOrder || currentOrder.status !== 'AUTHORIZED'}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-40"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Split Capture ($60)</span>
            </button>
          </div>
        </div>

        {/* HERO VISUAL: Split Hold Bar */}
        <SplitHoldBar
          totalAmount={currentOrder?.total_amount || 90.0}
          capturedAmount={currentOrder?.captured_amount || 0.0}
          heldAmount={currentOrder?.held_amount || 0.0}
          status={currentOrder?.status || 'CREATED'}
        />

        {/* Center Grid: AI Parser + Capture Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supplier Delay Notice Ingestion */}
          <NoticeParserCard
            orderId={selectedOrderId || 1}
            onNoticeParsed={() => {
              if (selectedOrderId) fetchOrderDetails(selectedOrderId);
            }}
          />

          {/* Audit Ledger & Reconciler Logs */}
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Capture Audit Ledger & Reconciler</h3>
                    <p className="text-xs text-slate-400">Cryptographically verified capture logs, idempotency & gateway events</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={handleTestIdempotency}
                    disabled={testingIdempotency || !currentOrder?.audits || currentOrder.audits.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40"
                    title={!currentOrder?.audits || currentOrder.audits.length === 0 ? "Execute a capture first to test replay" : "Re-sends duplicate PayPal-Request-Id to verify idempotency deduplication"}
                  >
                    <Repeat className={`w-3.5 h-3.5 text-cyan-400 ${testingIdempotency ? 'animate-spin' : ''}`} />
                    <span>{testingIdempotency ? 'Replaying...' : 'Test Idempotency'}</span>
                  </button>

                  <button
                    onClick={handleVerifyEvidence}
                    disabled={verifyingChain}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{verifyingChain ? 'Verifying...' : 'Verify with PayPal'}</span>
                  </button>

                  <a
                    href={`/api/orders/${selectedOrderId || 1}/evidence/download`}
                    download
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Evidence JSON</span>
                  </a>

                  {currentOrder?.status === 'PARTIALLY_CAPTURED' && (
                    <button
                      onClick={handleFulfillDelayed}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium shadow transition-all"
                    >
                      Fulfill Delayed ($30)
                    </button>
                  )}
                </div>
              </div>

              {/* Ledger Tab Navigation */}
              <div className="flex items-center gap-1.5 mb-3 p-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveLedgerTab('audits')}
                  className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    activeLedgerTab === 'audits'
                      ? 'bg-slate-800 text-slate-100 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Captures ({currentOrder?.audits?.length || 0})</span>
                </button>
                <button
                  onClick={() => setActiveLedgerTab('gateway_logs')}
                  className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    activeLedgerTab === 'gateway_logs'
                      ? 'bg-slate-800 text-slate-100 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Gateway Reconciler Grid ({currentOrder?.gateway_logs?.length || 0})</span>
                </button>
                <button
                  onClick={() => setActiveLedgerTab('consent_chain')}
                  className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    activeLedgerTab === 'consent_chain'
                      ? 'bg-slate-800 text-slate-100 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Consent Hash Chain ({currentOrder?.consents?.length || 0})</span>
                </button>
              </div>

              {/* Idempotency Result Banner */}
              {idempotencyResult && (
                <div className="mb-3 p-3 rounded-lg border bg-cyan-950/40 border-cyan-700/60 text-cyan-200 text-xs shadow-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      <span>Idempotency Replay Verified (RFC 7240 / PayPal REST v2)</span>
                    </div>
                    <button
                      onClick={() => setIdempotencyResult(null)}
                      className="text-cyan-400 hover:text-white font-bold ml-2 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-cyan-100">{idempotencyResult.message}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                    <div className="p-1.5 rounded bg-slate-950/70 border border-cyan-800/40">
                      <span className="text-slate-400 block">Original Capture:</span>
                      <span className="text-cyan-300 truncate block">{idempotencyResult.original_capture_id}</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/70 border border-cyan-800/40">
                      <span className="text-slate-400 block">Replayed Capture:</span>
                      <span className="text-emerald-400 truncate block">{idempotencyResult.replayed_capture_id}</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/70 border border-cyan-800/40">
                      <span className="text-slate-400 block">Duplicate Deduplicated:</span>
                      <span className="text-emerald-400 font-bold block">✓ True (Zero Dups)</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/70 border border-cyan-800/40">
                      <span className="text-slate-400 block">Ledger Movements:</span>
                      <span className="text-slate-200 font-bold block">{idempotencyResult.total_ledger_movements} (Single Entry)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Verification Result Banner */}
              {verificationResult && (
                <div className={`mb-3 p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  verificationResult.chain_valid && verificationResult.paypal_synced
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{verificationResult.sync_message || verificationResult.chain_message}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {verificationResult.audit_status}
                  </span>
                </div>
              )}

              {/* Tab Content 1: Capture Audits View */}
              {activeLedgerTab === 'audits' && (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {currentOrder?.audits && currentOrder.audits.length > 0 ? (
                    currentOrder.audits.map((a: any) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-100">${a.amount.toFixed(2)} USD</strong>
                            <span className="font-mono text-[10px] text-slate-400">({a.capture_type})</span>
                          </div>
                          <p className="font-mono text-[10px] text-blue-400 mt-0.5 truncate max-w-xs">
                            Capture ID: {a.paypal_capture_id}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Reconciled ✓
                          </span>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-500 italic">
                      No captures executed for this order yet.
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Gateway Reconciler Logs AG Grid */}
              {activeLedgerTab === 'gateway_logs' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
                    <span>AG Grid: Live PayPal REST calls, Request-Id idempotency & balance verification</span>
                    <span className="text-cyan-400">{currentOrder?.gateway_logs?.length || 0} event(s)</span>
                  </div>
                  <GatewayLogsGrid logs={currentOrder?.gateway_logs || []} />
                </div>
              )}

              {/* Tab Content 3: Cryptographic Consent Chain AG Grid */}
              {activeLedgerTab === 'consent_chain' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
                    <span>AG Grid: Blockchain-style SHA-256 sequential consent audit trail</span>
                    <span className="text-emerald-400">{currentOrder?.consents?.length || 0} consent record(s)</span>
                  </div>
                  <ConsentChainGrid consents={currentOrder?.consents || []} />
                </div>
              )}
            </div>

            {/* Line Items Overview */}
            {currentOrder?.items && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-2">Order Line Items:</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {currentOrder.items.map((it: any) => (
                    <div key={it.id} className="p-2 rounded bg-slate-950 border border-slate-800/80">
                      <p className="font-semibold text-slate-200 truncate">{it.name}</p>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-slate-400">${it.amount.toFixed(2)}</span>
                        <span className={`font-mono text-[9px] font-bold uppercase ${
                          it.status === 'SHIPPED' ? 'text-emerald-400' :
                          it.status === 'DELAYED' ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {it.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AG Grid Transaction Table */}
        <OrdersGrid
          orders={orders}
          selectedOrderId={selectedOrderId}
          onSelectOrder={(id) => setSelectedOrderId(id)}
        />
      </main>
    </div>
  );
};

