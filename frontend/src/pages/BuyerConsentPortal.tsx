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
  Globe
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-600 font-sans">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0070BA]" />
          <span>Loading Order Information...</span>
        </div>
      </div>
    );
  }

  const delayedItem = order?.items?.find((i: any) => i.is_delayed || i.status === 'DELAYED');
  const shippedItems = order?.items?.filter((i: any) => i.status === 'SHIPPED') || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col antialiased">
      {/* ── Consumer Header (Apple / Stripe Style) ───────────────── */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3.5">
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#0070BA] text-white flex items-center justify-center font-bold text-xs">
              P
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-900 tracking-tight">Apex Industrial Supply</h1>
              <span className="text-[11px] text-slate-500 font-mono">Order #{order?.paypal_order_id || 'DEMO'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>PayPal Protected</span>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────── */}
      <main className="max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-4 flex-1">
        
        {/* Order Status & Hold Overview Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Shipment Status</span>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">Split Fulfillment in Progress</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Order Total</span>
              <span className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                ${order?.total_amount?.toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* Shipped vs Held Split Badges */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/60">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block">
                Shipped & Charged
              </span>
              <span className="text-base font-bold text-emerald-900 font-mono tabular-nums mt-0.5 block">
                ${order?.captured_amount?.toFixed(2)}
              </span>
              <p className="text-[11px] text-emerald-700 mt-1 line-clamp-1">
                {shippedItems.length > 0 ? shippedItems.map((i: any) => i.name).join(', ') : 'In-stock components'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
                Temporary Hold (Not Charged)
              </span>
              <span className="text-base font-bold text-amber-900 font-mono tabular-nums mt-0.5 block">
                ${order?.held_amount?.toFixed(2)}
              </span>
              <p className="text-[11px] text-amber-800 mt-1 line-clamp-1 font-medium">
                {delayedItem?.name || 'Delayed Component'}
              </p>
            </div>
          </div>

          {/* Plain-English Reassurance Callout */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-[#0070BA] shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block font-semibold mb-0.5">Authorization Hold Protection</strong>
              <span>
                Your card has <strong>not</strong> been charged for the delayed item. A pre-authorization hold of 
                ${order?.held_amount?.toFixed(2)} is currently reserved on your PayPal account. Funds are only 
                captured when your items ship.
              </span>
            </div>
          </div>
        </div>

        {/* Supplier Notice & Multi-Lingual Message */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <AlertCircle className="w-4 h-4 text-[#0070BA]" />
              <span>Delay Notification</span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
              {[
                { id: 'en', label: '🇺🇸 EN' },
                { id: 'de', label: '🇩🇪 DE' },
                { id: 'da', label: '🇩🇰 DA' },
                { id: 'ja', label: '🇯🇵 JA' }
              ].map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSwitchLocale(loc.id)}
                  disabled={localizing}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    buyerLocale === loc.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-slate-700 leading-relaxed">
            {localizing ? (
              <span className="text-slate-500 italic">Translating...</span>
            ) : localizedMessage ? (
              <span>{localizedMessage}</span>
            ) : (
              <p>
                Your item <strong>"{delayedItem?.name || 'Delayed Component'}"</strong> is delayed. 
                Please select below how you would like your order and authorization hold handled:
              </p>
            )}
          </div>
        </div>

        {/* ── Consent Result Confirmation ───────────────────────────── */}
        {consentResult ? (
          <div className="bg-white border border-emerald-300 rounded-xl p-5 shadow-xs text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Your Preference Has Been Recorded</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{consentResult.displayed_text}</p>
            </div>

            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-left font-mono text-[10px] text-slate-600 space-y-1">
              <span className="text-slate-400 uppercase font-semibold block">Cryptographic Receipt Hash:</span>
              <p className="break-all font-semibold text-slate-800">{consentResult.consent_hash}</p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <a
                href={`/api/orders/${orderId || order?.id || 1}/evidence/download`}
                download
                className="px-3 py-1.5 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-medium transition-colors"
              >
                Download Receipt (JSON)
              </a>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Three Decision Cards ─────────────────────────────────── */
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Please Select How to Proceed:
            </h3>

            {/* Option 1: WAIT */}
            <div
              onClick={() => setSelectedChoice('WAIT')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedChoice === 'WAIT'
                  ? 'border-[#0070BA] bg-blue-50/30 ring-1 ring-[#0070BA]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-[#0070BA] mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Wait for Delayed Delivery</h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Keep the <strong>${order?.held_amount?.toFixed(2)} authorization hold</strong> active. 
                      You will only be charged when the item physically ships.
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100/60 text-blue-800 font-semibold">
                      Payment Impact: Hold remains active until delivery
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="consent"
                  checked={selectedChoice === 'WAIT'}
                  onChange={() => setSelectedChoice('WAIT')}
                  className="mt-1 w-4 h-4 text-[#0070BA]"
                />
              </div>
            </div>

            {/* Option 2: SWAP */}
            <div
              onClick={() => setSelectedChoice('SWAP')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedChoice === 'SWAP'
                  ? 'border-emerald-600 bg-emerald-50/30 ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 mt-0.5">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">Swap for In-Stock Alternative</h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Select an immediate replacement. Any price difference is automatically released back to your PayPal balance.
                    </p>

                    {/* Swap Options */}
                    {selectedChoice === 'SWAP' && (
                      <div className="mt-3 pt-2.5 border-t border-emerald-200/60 space-y-1.5">
                        <label className="flex items-center justify-between p-2 rounded bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="swapItem"
                              value="SKU-SWAP-01"
                              checked={selectedSwapSku === 'SKU-SWAP-01'}
                              onChange={(e) => setSelectedSwapSku(e.target.value)}
                            />
                            <span className="font-medium text-slate-800">Standard Sealant Replacement Kit</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700">$25.00 USD</span>
                        </label>
                        <label className="flex items-center justify-between p-2 rounded bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="swapItem"
                              value="SKU-SWAP-02"
                              checked={selectedSwapSku === 'SKU-SWAP-02'}
                              onChange={(e) => setSelectedSwapSku(e.target.value)}
                            />
                            <span className="font-medium text-slate-800">Alternative Ceramic Coating Set</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700">$28.00 USD</span>
                        </label>
                      </div>
                    )}

                    <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100/60 text-emerald-800 font-semibold">
                      Payment Impact: Instant capture at lower amount • Remainder released
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="consent"
                  checked={selectedChoice === 'SWAP'}
                  onChange={() => setSelectedChoice('SWAP')}
                  className="mt-1 w-4 h-4 text-emerald-600"
                />
              </div>
            </div>

            {/* Option 3: CANCEL */}
            <div
              onClick={() => setSelectedChoice('CANCEL')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedChoice === 'CANCEL'
                  ? 'border-rose-600 bg-rose-50/30 ring-1 ring-rose-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-50 text-rose-700 mt-0.5">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Cancel Delayed Item & Release Hold</h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Immediately void the <strong>${order?.held_amount?.toFixed(2)} hold</strong>. 
                      You will not be charged, and your remaining PayPal authorization will be cancelled.
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100/60 text-rose-800 font-semibold">
                      Payment Impact: $0 charge • Pre-authorization hold cancelled
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="consent"
                  checked={selectedChoice === 'CANCEL'}
                  onChange={() => setSelectedChoice('CANCEL')}
                  className="mt-1 w-4 h-4 text-rose-600"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitConsent}
              disabled={!selectedChoice || submitting}
              className="w-full mt-4 py-3 px-4 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Choice...</span>
                </>
              ) : (
                <>
                  <span>Confirm Selection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}

      </main>
    </div>
  );
};
