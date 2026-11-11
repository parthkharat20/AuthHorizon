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
  PackageCheck,
  AlertCircle
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-600 font-sans">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading Order Details...</span>
        </div>
      </div>
    );
  }

  const delayedItem = order?.items?.find((i: any) => i.is_delayed || i.status === 'DELAYED');
  const shippedItems = order?.items?.filter((i: any) => i.status === 'SHIPPED') || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Consumer Trust Navbar */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between shadow-sm">
        <div className="max-w-3xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
              AH
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">Order Fulfillment Update</h1>
              <p className="text-xs text-slate-500">PayPal Verified Order #{order?.paypal_order_id || 'SANDBOX'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Buyer Protection Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl w-full mx-auto p-6 space-y-6 flex-1">
        {/* Shipped vs Held Balance Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Order Status</span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">Partially Shipped</h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Original Total</span>
              <p className="text-lg font-bold text-slate-800">${order?.total_amount?.toFixed(2)} USD</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider">Shipped & Charged</span>
                <span className="text-base font-extrabold">${order?.captured_amount?.toFixed(2)}</span>
              </div>
              <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                {shippedItems.length > 0
                  ? shippedItems.map((i: any) => i.name).join(', ')
                  : 'In-stock components'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80">
              <div className="flex items-center justify-between text-amber-900">
                <span className="text-xs font-bold uppercase tracking-wider">Held on Authorization</span>
                <span className="text-base font-extrabold">${order?.held_amount?.toFixed(2)}</span>
              </div>
              <p className="text-xs text-amber-800 mt-2 leading-relaxed font-medium">
                Held for: {delayedItem?.name || 'Delayed Industrial Component'}
              </p>
            </div>
          </div>
        </div>

        {/* Delay Notice Banner with Cross-Border Localization */}
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-900 text-xs leading-relaxed space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <strong className="font-bold text-sm">Supplier Delay Notification</strong>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-lg border border-blue-200">
              {[
                { id: 'en', label: '🇺🇸 EN' },
                { id: 'ja', label: '🇯🇵 日本語' },
                { id: 'de', label: '🇩🇪 DE' },
                { id: 'da', label: '🇩🇰 DA' }
              ].map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSwitchLocale(loc.id)}
                  disabled={localizing}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    buyerLocale === loc.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-blue-100/50'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-white/70 border border-blue-100 text-slate-800 text-xs leading-relaxed font-sans">
            {localizing ? (
              <span className="text-slate-500 italic">Translating and re-verifying safety gate...</span>
            ) : localizedMessage ? (
              <span>{localizedMessage}</span>
            ) : (
              <p>
                Your item <strong>"{delayedItem?.name || 'Delayed Component'}"</strong> has encountered a manufacturing delay. 
                In compliance with consumer protection rules, your held balance of <strong>${order?.held_amount?.toFixed(2)}</strong> has <strong>NOT</strong> been charged. 
                Please select how you would like to proceed:
              </p>
            )}
          </div>
        </div>

        {/* Consent Choice Completed Confirmation */}
        {consentResult ? (
          <div className="bg-white border-2 border-emerald-500 rounded-2xl p-6 shadow-md text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Consent Choice Recorded Successfully</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{consentResult.displayed_text}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left font-mono text-[11px] text-slate-600 space-y-1">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Cryptographic SHA-256 Consent Hash:</span>
              <p className="break-all font-bold text-slate-800">{consentResult.consent_hash}</p>
              {consentResult.prev_hash && (
                <p className="break-all text-[10px] text-slate-500 mt-1">Prev Hash: {consentResult.prev_hash}</p>
              )}
              <span className="text-[10px] text-emerald-600 block mt-1">✓ Non-repudiable audit ledger updated</span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <a
                href={`/api/orders/${orderId || order?.id || 1}/evidence/download`}
                download
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>Download Evidence (JSON)</span>
              </a>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all"
              >
                Refresh Order Status
              </button>
            </div>
          </div>
        ) : (
          /* Three Interactive Choice Cards */
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Choose Your Resolution Option:</h3>

            {/* Option 1: WAIT */}
            <div
              onClick={() => setSelectedChoice('WAIT')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedChoice === 'WAIT'
                  ? 'border-blue-600 bg-blue-50/40 shadow-md ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Option 1: Wait for Delivery</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Keep the <strong>${order?.held_amount?.toFixed(2)} hold</strong> active. 
                      Funds will only be captured when the delayed item ships (estimated late November).
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="consent"
                  checked={selectedChoice === 'WAIT'}
                  onChange={() => setSelectedChoice('WAIT')}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
              </div>
            </div>

            {/* Option 2: SWAP */}
            <div
              onClick={() => setSelectedChoice('SWAP')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedChoice === 'SWAP'
                  ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 mt-0.5">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Option 2: Swap to an In-Stock Alternative</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Choose an available replacement item capped at or below ${order?.held_amount?.toFixed(2)}. 
                      We will fulfill and capture immediately.
                    </p>

                    {/* Swap Item Options */}
                    {selectedChoice === 'SWAP' && (
                      <div className="mt-3.5 pt-3 border-t border-emerald-200/60 space-y-2">
                        <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50">
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
                          <strong className="text-emerald-700">$25.00 USD</strong>
                        </label>
                        <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50">
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
                          <strong className="text-emerald-700">$28.00 USD</strong>
                        </label>
                      </div>
                    )}
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
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedChoice === 'CANCEL'
                  ? 'border-rose-600 bg-rose-50/40 shadow-md ring-1 ring-rose-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 mt-0.5">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Option 3: Cancel Delayed Item & Release Hold</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Release the <strong>${order?.held_amount?.toFixed(2)} hold immediately</strong>. 
                      You will not be charged, and your PayPal authorization will be voided.
                    </p>
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

            {/* Submit Consent Button */}
            <button
              onClick={handleSubmitConsent}
              disabled={!selectedChoice || submitting}
              className="w-full mt-6 py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recording Cryptographic Consent...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Execute Choice</span>
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

