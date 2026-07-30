import React, { useState } from 'react';
import api from '../services/api';
import { queryClient, QUERY_KEYS } from '../services/queryClient';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  if (!isOpen) return null;

  const formatCardNumber = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    return raw.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      return `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    return raw;
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!cardName.trim() || cardName.trim().length < 2) {
      errors.cardName = 'Cardholder name must be at least 2 characters.';
    }

    const rawNum = cardNumber.replace(/\s+/g, '');
    if (!rawNum || rawNum.length < 15 || rawNum.length > 16 || !/^\d+$/.test(rawNum)) {
      errors.cardNumber = 'Enter a valid 16-digit test card number.';
    }

    const expClean = expiry.trim();
    if (!expClean || !/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/.test(expClean)) {
      errors.expiry = 'Enter expiry in MM/YY format.';
    }

    const cvvClean = cvv.trim();
    if (!cvvClean || cvvClean.length < 3 || cvvClean.length > 4 || !/^\d+$/.test(cvvClean)) {
      errors.cvv = 'Enter 3 or 4 digit CVV.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleQuickTestCard = (type: 'success' | 'failure') => {
    setErrorMessage(null);
    setFieldErrors({});
    if (type === 'success') {
      setCardName('Syed Asjad Abbas');
      setCardNumber('4242 4242 4242 4242');
      setExpiry('12/28');
      setCvv('123');
    } else {
      setCardName('Syed Asjad Abbas');
      setCardNumber('4000 0000 0000 0002');
      setExpiry('12/28');
      setCvv('999');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    try {
      setLoading(true);

      const payload = {
        cardholder_name: cardName.trim(),
        card_number: cardNumber.replace(/\s+/g, ''),
        expiry: expiry.trim(),
        cvv: cvv.trim(),
        plan_name: 'premium',
      };

      await api.post('/payment/process', payload);

      // Sync local session & invalidate React Query subscription caches
      try {
        const rawUser = localStorage.getItem('user');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          u.subscription_plan = 'premium';
          localStorage.setItem('user', JSON.stringify(u));
        }
      } catch {}

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscription });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.detail ||
          'Simulated payment authorization failed. Please try a valid test card.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-lg bg-[#0B1533] border border-brand-accent/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest block">
              Simulated Payment Checkout
            </span>
            <h2 className="text-2xl font-black font-display tracking-tight text-white uppercase">
              Upgrade to Premium
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Plan Summary Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-neutral-300">Selected Plan</span>
            <h3 className="text-lg font-black text-brand-accent uppercase tracking-wide">ZePlay Premium</h3>
            <p className="text-[11px] text-neutral-400">4K Ultra HD • Multi-Device • Full Catalog</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-white">$9.99</span>
            <span className="text-xs text-neutral-400 font-medium block">/ month</span>
          </div>
        </div>

        {/* Demo Quick Test Fillers */}
        <div className="bg-brand-accent/10 border border-brand-accent/20 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center gap-1.5 text-brand-accent font-bold">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Demo Test Payment Mode</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleQuickTestCard('success')}
              className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-3 py-1 rounded-lg border border-emerald-500/30 transition-all cursor-pointer"
            >
              Fill Valid Card (4242...)
            </button>
            <button
              type="button"
              onClick={() => handleQuickTestCard('failure')}
              className="text-[11px] font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 px-3 py-1 rounded-lg border border-rose-500/30 transition-all cursor-pointer"
            >
              Fill Failing Card (...0002)
            </button>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold p-3.5 rounded-xl animate-fadeIn">
            {errorMessage}
          </div>
        )}

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cardholder Name */}
          <div>
            <label className="text-xs font-bold text-neutral-300 block mb-1">Cardholder Name</label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g. Syed Asjad Abbas"
              disabled={loading}
              className={`w-full bg-black/40 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none transition-all ${
                fieldErrors.cardName ? 'border-rose-500' : 'border-white/10 focus:border-brand-accent'
              }`}
            />
            {fieldErrors.cardName && (
              <span className="text-[11px] font-semibold text-rose-400 mt-1 block">{fieldErrors.cardName}</span>
            )}
          </div>

          {/* Card Number */}
          <div>
            <label className="text-xs font-bold text-neutral-300 block mb-1">Card Number</label>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                disabled={loading}
                className={`w-full bg-black/40 border rounded-xl px-4 py-2.5 pr-10 text-sm text-white font-mono placeholder-neutral-500 focus:outline-none transition-all ${
                  fieldErrors.cardNumber ? 'border-rose-500' : 'border-white/10 focus:border-brand-accent'
                }`}
              />
              <svg className="w-5 h-5 text-neutral-400 absolute right-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            {fieldErrors.cardNumber && (
              <span className="text-[11px] font-semibold text-rose-400 mt-1 block">{fieldErrors.cardNumber}</span>
            )}
          </div>

          {/* Expiry & CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">Expiry Date</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                maxLength={7}
                disabled={loading}
                className={`w-full bg-black/40 border rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-neutral-500 focus:outline-none transition-all ${
                  fieldErrors.expiry ? 'border-rose-500' : 'border-white/10 focus:border-brand-accent'
                }`}
              />
              {fieldErrors.expiry && (
                <span className="text-[11px] font-semibold text-rose-400 mt-1 block">{fieldErrors.expiry}</span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">Security Code (CVV)</label>
              <input
                type="password"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                maxLength={4}
                disabled={loading}
                className={`w-full bg-black/40 border rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-neutral-500 focus:outline-none transition-all ${
                  fieldErrors.cvv ? 'border-rose-500' : 'border-white/10 focus:border-brand-accent'
                }`}
              />
              {fieldErrors.cvv && (
                <span className="text-[11px] font-semibold text-rose-400 mt-1 block">{fieldErrors.cvv}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white py-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-accent hover:bg-brand-accent/90 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-brand-accent/30 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Pay $9.99 & Activate</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckoutModal;
