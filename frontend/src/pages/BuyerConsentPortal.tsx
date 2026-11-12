import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Clock, 
  RefreshCw, 
  XCircle, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Package, 
  AlertCircle,
  Lock,
  ChevronRight,
  Globe,
  Check
} from 'lucide-react';

export const BuyerConsentPortal: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedChoice, setSelectedChoice] = useState<'WAIT' | 'SWAP' | 'CANCEL' | null>(null);
  const [selectedSwapSku, setSelectedSwapSku] = useState<string>('SKU-SWAP-01');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [consentResult, setConsentResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buyerLocale, setBuyerLocale] = useState<string>('en');
  const [localizedMessage, setLocalizedMessage] = useState<string | null>(null);
  const [localizing, setLocalizing] = useState<boolean>(false);

  const fetchOrder = async () => {
    try {
      const res = await axios.get(`/api/orders/${orderId || '1'}`);
      setOrder(res.data);
      const latestNotice = res.data?.delay_notices?.[res.data.delay_notices.length - 1];
      if (latestNotice?.buyer_message) {
        setLocalizedMessage(latestNotice.buyer_message);
        if (latestNotice.buyer_locale) {
          setBuyerLocale(latestNotice.buyer_locale);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchLocale = async (newLocale: string) => {
    setBuyerLocale(newLocale);
    setLocalizing(true);
    try {
      const res = await axios.post(`/api/orders/${orderId || order?.id || 1}/localize-message`, {
        order_id: Number(orderId || order?.id || 1),
        buyer_locale: newLocale
      });
      setLocalizedMessage(res.data.buyer_message);
    } catch (err) {
      console.error('Failed to localize message:', err);
    } finally {
      setLocalizing(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const handleSubmitConsent = async () => {
    if (!selectedChoice) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        order_id: Number(orderId || order?.id || 1),
        choice: selectedChoice
      };
      if (selectedChoice === 'SWAP') {
        payload.swapped_sku = selectedSwapSku;
      }

      const res = await axios.post('/api/consent/submit', payload);
      setConsentResult(res.data);
      await fetchOrder();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to submit consent choice');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 text-[#1d1d1f]">
        <div className="flex items-center gap-3 text-sm font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-[#0071e3]" />
          <span>Loading Order Information...</span>
        </div>
      </div>
    );
  }

  const delayedItem = order?.items?.find((i: any) => i.is_delayed || i.status === 'DELAYED');
  const shippedItems = order?.items?.filter((i: any) => i.status === 'SHIPPED') || [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col antialiased selection:bg-[#0071e3] selection:text-white">
      {/* ── Apple-Style Frosted Global Navigation ────────────────── */}
      <header className="apple-frosted-light sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center font-semibold text-xs shadow-xs">
              P
            </div>
            <div>
              <h1 className="text-[13px] font-semibold text-[#1d1d1f] tracking-tight">Apex Industrial Supply</h1>
              <p className="text-[11px] text-[#86868b] font-mono">PayPal Order #{order?.paypal_order_id || 'DEMO'}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34c759]" />
            <span>PayPal Protected</span>
          </div>
        </div>
      </header>

      {/* ── Main Canvas ───────────────────────────────────────────── */}
      <main className="max-w-2xl w-full mx-auto p-5 sm:p-8 space-y-5 flex-1">
        
        {/* Hero Order Status Card */}
        <div className="bg-white border border-[#e5e5ea] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-baseline justify-between pb-4 border-b border-[#f0f0f2]">
            <div>
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">Fulfillment Status</span>
              <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mt-0.5">Partially Shipped</h2>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-[#86868b] uppercase tracking-wider block">Authorized Total</span>
              <span className="text-lg font-mono font-bold text-[#1d1d1f] tabular-nums">
                ${order?.total_amount?.toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* Proportional Split Tiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]/80 space-y-1">
              <span className="text-[11px] font-semibold text-[#34c759] uppercase tracking-wider block">
                Shipped & Charged
              </span>
              <span className="text-xl font-bold text-[#1d1d1f] font-mono tabular-nums block">
                ${order?.captured_amount?.toFixed(2)}
              </span>
              <p className="text-[12px] text-[#86868b] pt-1 truncate">
                {shippedItems.length > 0 ? shippedItems.map((i: any) => i.name).join(', ') : 'In-stock components'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]/80 space-y-1">
              <span className="text-[11px] font-semibold text-[#ff9f0a] uppercase tracking-wider block">
                Authorization Hold (Not Charged)
              </span>
              <span className="text-xl font-bold text-[#1d1d1f] font-mono tabular-nums block">
                ${order?.held_amount?.toFixed(2)}
              </span>
              <p className="text-[12px] text-[#86868b] pt-1 truncate font-medium">
                {delayedItem?.name || 'Delayed Component'}
              </p>
            </div>
          </div>

          {/* Reassuring Apple Pay Protection Callout */}
          <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[13px] text-[#1d1d1f] leading-relaxed flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#0071e3] shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-0.5">Pre-Authorization Protection</strong>
              <span className="text-[#86868b]">
                Your account has <strong className="text-[#1d1d1f]">not</strong> been charged for the delayed item. A temporary authorization hold of 
                ${order?.held_amount?.toFixed(2)} is currently reserved on your PayPal account and will only be captured when fulfillment occurs.
              </span>
            </div>
          </div>
        </div>

        {/* Delay Notification Banner with Multi-Lingual Switcher */}
        <div className="bg-white border border-[#e5e5ea] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1d1d1f]">
              <AlertCircle className="w-4 h-4 text-[#0071e3]" />
              <span>Supplier Notice</span>
            </div>

            {/* Apple-style Capsule Language Picker */}
            <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea]">
              {[
                { id: 'en', label: 'English' },
                { id: 'de', label: 'Deutsch' },
                { id: 'da', label: 'Dansk' },
                { id: 'ja', label: '日本語' }
              ].map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSwitchLocale(loc.id)}
                  disabled={localizing}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    buyerLocale === loc.id
                      ? 'bg-white text-[#1d1d1f] shadow-xs font-semibold'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f5f5f7] text-[13px] text-[#1d1d1f] leading-relaxed">
            {localizing ? (
              <span className="text-[#86868b] italic">Translating...</span>
            ) : localizedMessage ? (
              <span>{localizedMessage}</span>
            ) : (
              <p>
                Your item <strong>"{delayedItem?.name || 'Delayed Component'}"</strong> is currently in transit with our logistics partner. 
                Please choose below how you would like your hold and order handled:
              </p>
            )}
          </div>
        </div>

        {/* ── Consent Result Confirmation ───────────────────────────── */}
        {consentResult ? (
          <div className="bg-white border border-[#34c759] rounded-2xl p-6 shadow-xs text-center space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-[#34c759]/10 text-[#34c759] mx-auto flex items-center justify-center">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">Choice Confirmed</h3>
              <p className="text-[13px] text-[#86868b] mt-1 max-w-md mx-auto">{consentResult.displayed_text}</p>
            </div>

            <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-left font-mono text-[11px] text-[#86868b] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#1d1d1f] block">Cryptographic Receipt Digest:</span>
              <p className="break-all text-[#1d1d1f] font-semibold">{consentResult.consent_hash}</p>
              <span className="text-[10px] text-[#34c759] font-medium block mt-1">✓ Non-repudiable audit ledger recorded</span>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <a
                href={`/api/orders/${orderId || order?.id || 1}/evidence/download`}
                download
                className="px-5 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-medium transition-colors shadow-xs"
              >
                Download Receipt (JSON)
              </a>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] text-[13px] font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Three Decision Cards (Apple Configurator Style) ──────── */
          <div className="space-y-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#86868b] px-1">
              Select Your Resolution Option:
            </h3>

            {/* Option 1: WAIT */}
            <div
              onClick={() => setSelectedChoice('WAIT')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                selectedChoice === 'WAIT'
                  ? 'border-[#0071e3] ring-2 ring-[#0071e3] shadow-xs'
                  : 'border-[#e5e5ea] hover:border-[#d2d2d7]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-[#0071e3]/10 text-[#0071e3] mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-[#1d1d1f]">Wait for Delayed Delivery</h4>
                    <p className="text-[13px] text-[#86868b] mt-0.5 leading-relaxed">
                      Keep the <strong>${order?.held_amount?.toFixed(2)} hold</strong> active. You are only charged when the item physically ships.
                    </p>
                    <span className="inline-block mt-2 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] font-medium">
                      Payment Impact: Hold remains active • Charged upon delivery
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                  selectedChoice === 'WAIT' ? 'border-[#0071e3] bg-[#0071e3] text-white' : 'border-[#d2d2d7]'
                }`}>
                  {selectedChoice === 'WAIT' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>

            {/* Option 2: SWAP */}
            <div
              onClick={() => setSelectedChoice('SWAP')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                selectedChoice === 'SWAP'
                  ? 'border-[#0071e3] ring-2 ring-[#0071e3] shadow-xs'
                  : 'border-[#e5e5ea] hover:border-[#d2d2d7]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-[#34c759]/10 text-[#34c759] mt-0.5">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[15px] font-semibold text-[#1d1d1f]">Swap to In-Stock Alternative</h4>
                    <p className="text-[13px] text-[#86868b] mt-0.5 leading-relaxed">
                      Choose an available replacement item. Price differences are automatically released to your PayPal balance.
                    </p>

                    {/* Swap Options Chips */}
                    {selectedChoice === 'SWAP' && (
                      <div className="mt-3 pt-3 border-t border-[#f0f0f2] space-y-2">
                        <label className={`flex items-center justify-between p-3 rounded-xl border text-[13px] cursor-pointer transition-all ${
                          selectedSwapSku === 'SKU-SWAP-01' ? 'border-[#0071e3] bg-[#f5f5f7] font-semibold' : 'border-[#e5e5ea] bg-white'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="swapItem"
                              value="SKU-SWAP-01"
                              checked={selectedSwapSku === 'SKU-SWAP-01'}
                              onChange={(e) => setSelectedSwapSku(e.target.value)}
                              className="accent-[#0071e3]"
                            />
                            <span>Standard Sealant Replacement Kit</span>
                          </div>
                          <strong className="text-[#1d1d1f] font-mono">$25.00 USD</strong>
                        </label>
                        <label className={`flex items-center justify-between p-3 rounded-xl border text-[13px] cursor-pointer transition-all ${
                          selectedSwapSku === 'SKU-SWAP-02' ? 'border-[#0071e3] bg-[#f5f5f7] font-semibold' : 'border-[#e5e5ea] bg-white'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="swapItem"
                              value="SKU-SWAP-02"
                              checked={selectedSwapSku === 'SKU-SWAP-02'}
                              onChange={(e) => setSelectedSwapSku(e.target.value)}
                              className="accent-[#0071e3]"
                            />
                            <span>Alternative Ceramic Coating Set</span>
                          </div>
                          <strong className="text-[#1d1d1f] font-mono">$28.00 USD</strong>
                        </label>
                      </div>
                    )}

                    <span className="inline-block mt-2 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] font-medium">
                      Payment Impact: Lower capture executed • Balance released
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                  selectedChoice === 'SWAP' ? 'border-[#0071e3] bg-[#0071e3] text-white' : 'border-[#d2d2d7]'
                }`}>
                  {selectedChoice === 'SWAP' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>

            {/* Option 3: CANCEL */}
            <div
              onClick={() => setSelectedChoice('CANCEL')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                selectedChoice === 'CANCEL'
                  ? 'border-[#0071e3] ring-2 ring-[#0071e3] shadow-xs'
                  : 'border-[#e5e5ea] hover:border-[#d2d2d7]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-[#ff453a]/10 text-[#ff453a] mt-0.5">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-[#1d1d1f]">Cancel Item & Release Hold</h4>
                    <p className="text-[13px] text-[#86868b] mt-0.5 leading-relaxed">
                      Immediately release the <strong>${order?.held_amount?.toFixed(2)} hold</strong>. Your authorization is cancelled at zero charge.
                    </p>
                    <span className="inline-block mt-2 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] font-medium">
                      Payment Impact: $0 charge • PayPal authorization voided
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                  selectedChoice === 'CANCEL' ? 'border-[#0071e3] bg-[#0071e3] text-white' : 'border-[#d2d2d7]'
                }`}>
                  {selectedChoice === 'CANCEL' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>

            {/* Primary Apple-Style Pill CTA */}
            <button
              onClick={handleSubmitConsent}
              disabled={!selectedChoice || submitting}
              className="w-full mt-4 py-3.5 px-6 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-medium text-[15px] flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting to PayPal...</span>
                </>
              ) : (
                <>
                  <span>Confirm Resolution Choice</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

      </main>
    </div>
  );
};
