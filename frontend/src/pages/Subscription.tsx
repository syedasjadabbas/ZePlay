import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

interface Plan {
  id: string;
  name: string;
  description: string;
  max_profiles: number;
  supports_4k: boolean;
  supports_multi_device: boolean;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  auto_renew: boolean;
  plan: Plan;
}

const PlanBadge: React.FC<{ name: string; size?: 'sm' | 'lg' }> = ({ name, size = 'sm' }) => {
  const isPremium = name === 'premium';
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded border ${
        size === 'lg'
          ? 'px-3 py-1 text-xs'
          : 'px-2 py-0.5 text-[9px]'
      } ${
        isPremium
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          : 'bg-neutral-900 border-neutral-800 text-neutral-400'
      }`}
    >
      {name.toUpperCase()}
    </span>
  );
};

const FeatureRow: React.FC<{ label: string; free: React.ReactNode; premium: React.ReactNode }> = ({
  label, free, premium
}) => (
  <div className="grid grid-cols-3 items-center py-3.5 border-b border-white/5 last:border-0">
    <span className="text-xs text-brand-textMuted font-semibold">{label}</span>
    <div className="text-center">{free}</div>
    <div className="text-center">{premium}</div>
  </div>
);

const Check: React.FC<{ yes: boolean }> = ({ yes }) =>
  yes ? (
    <svg className="w-5 h-5 text-emerald-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-5 h-5 text-neutral-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

const Subscription: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

  const profileName = localStorage.getItem('selectedProfileName') || 'User';
  const profileAvatar = localStorage.getItem('selectedProfileAvatar') || '🍿';

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const subRes = await api.get('/subscription/current');
      setSubscription(subRes.data);
    } catch (err) {
      showToast('Failed to load subscription data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpgrade = async () => {
    try {
      setActionLoading(true);
      await api.post('/subscription/upgrade', { plan_name: 'premium' });
      showToast('🎉 Upgraded to Premium! Enjoy all premium features.', 'success');
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Upgrade failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setShowDowngradeConfirm(false);
    try {
      setActionLoading(true);
      await api.post('/subscription/downgrade', { plan_name: 'free' });
      showToast('Downgraded to Free plan.', 'success');
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Downgrade failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setShowCancelConfirm(false);
    try {
      setActionLoading(true);
      await api.post('/subscription/cancel');
      showToast('Subscription cancelled.', 'success');
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Cancel failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const isPremium = subscription?.plan.name === 'premium' && subscription?.status === 'active';
  const isActive = subscription?.status === 'active';
  const isCancelled = subscription?.status === 'cancelled';

  const statusColors: Record<string, string> = {
    active: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30',
    cancelled: 'text-rose-400 bg-rose-400/10 border-rose-500/30',
    expired: 'text-amber-400 bg-amber-400/10 border-amber-500/30',
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-semibold transition-all animate-[fadeIn_0.25s_ease] ${
            toast.type === 'success'
              ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-200'
              : 'bg-red-900/80 border-red-500/30 text-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <TopBar profileName={profileName} profileAvatar={profileAvatar} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 max-w-4xl mx-auto w-full space-y-8">

          {/* Header */}
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20">
              Membership
            </span>
            <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase mt-2">
              Subscription
            </h1>
            <p className="text-xs text-brand-textMuted font-medium mt-1">
              Manage your ZePlay plan and unlock premium features.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Current Plan Card */}
              <div className={`relative overflow-hidden bg-[#0B1533]/80 border backdrop-blur-md p-8 rounded-3xl shadow-2xl ${
                isPremium ? 'border-amber-400/20 shadow-amber-500/5' : 'border-white/5'
              }`}>
                {isPremium && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-yellow-400/5 pointer-events-none" />
                )}

                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 relative z-10">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <PlanBadge name={subscription?.plan.name || 'free'} size="lg" />
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                        statusColors[subscription?.status || 'active']
                      }`}>
                        {subscription?.status || 'active'}
                      </span>
                    </div>
                    <p className="text-sm text-brand-textMuted leading-relaxed max-w-md">
                      {subscription?.plan.description}
                    </p>

                    {/* Plan features grid */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                        <svg className="w-4 h-4 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-xs font-bold text-white">{subscription?.plan.max_profiles} Profile{subscription?.plan.max_profiles !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                        <svg className="w-4 h-4 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                        <span className="text-xs font-bold text-white">{subscription?.plan.supports_4k ? '4K Ready' : 'Standard'}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                        <svg className="w-4 h-4 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-bold text-white">{subscription?.plan.supports_multi_device ? 'Multi-Device' : 'Single Device'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3 min-w-[160px]">
                    {!isPremium && isActive && (
                      <button
                        onClick={handleUpgrade}
                        disabled={actionLoading}
                        id="upgrade-btn"
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold rounded-xl transition-all shadow-lg shadow-amber-500/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        {actionLoading ? (
                          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            Upgrade to Premium
                          </>
                        )}
                      </button>
                    )}

                    {isPremium && isActive && (
                      <button
                        onClick={() => setShowDowngradeConfirm(true)}
                        disabled={actionLoading}
                        id="downgrade-btn"
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-brand-textMuted hover:text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                      >
                        Downgrade to Free
                      </button>
                    )}

                    {isActive && (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={actionLoading}
                        id="cancel-sub-btn"
                        className="w-full py-2.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/30 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 hover:text-red-300 font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                      >
                        Cancel Subscription
                      </button>
                    )}

                    {isCancelled && (
                      <button
                        onClick={handleUpgrade}
                        disabled={actionLoading}
                        id="reactivate-btn"
                        className="w-full py-2.5 bg-brand-accent hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan Comparison Table */}
              <div className="bg-[#0B1533]/80 border border-white/5 backdrop-blur-md p-8 rounded-3xl shadow-2xl">
                <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Plan Comparison
                </h2>

                {/* Column headers */}
                <div className="grid grid-cols-3 items-center pb-3 border-b border-white/10 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Feature</span>
                  <div className="text-center">
                    <PlanBadge name="free" />
                  </div>
                  <div className="text-center">
                    <PlanBadge name="premium" />
                  </div>
                </div>

                <FeatureRow
                  label="Max Profiles"
                  free={<span className="text-sm font-bold text-white">1</span>}
                  premium={<span className="text-sm font-bold text-amber-300">4</span>}
                />
                <FeatureRow
                  label="4K Streaming"
                  free={<Check yes={false} />}
                  premium={<Check yes={true} />}
                />
                <FeatureRow
                  label="Multi-Device"
                  free={<Check yes={false} />}
                  premium={<Check yes={true} />}
                />
                <FeatureRow
                  label="Premium Badge"
                  free={<Check yes={false} />}
                  premium={<Check yes={true} />}
                />
                <FeatureRow
                  label="Standard Streaming"
                  free={<Check yes={true} />}
                  premium={<Check yes={true} />}
                />
                <FeatureRow
                  label="Kids Profiles"
                  free={<Check yes={true} />}
                  premium={<Check yes={true} />}
                />
              </div>

              {/* Free upgrade CTA */}
              {!isPremium && isActive && (
                <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-[#0B1533]/80 to-yellow-400/5 border border-amber-400/20 backdrop-blur-md p-8 rounded-3xl shadow-2xl">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <h3 className="text-lg font-extrabold text-white">Unlock Premium</h3>
                      </div>
                      <p className="text-xs text-brand-textMuted leading-relaxed max-w-md">
                        Get up to 4 profiles, a premium badge on your account, 4K streaming capability, and multi-device support.
                      </p>
                    </div>
                    <button
                      onClick={handleUpgrade}
                      disabled={actionLoading}
                      className="shrink-0 px-8 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold rounded-2xl transition-all shadow-lg shadow-amber-500/25 text-sm uppercase tracking-wider"
                    >
                      Upgrade Now
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-[#0B1533] border border-red-800/30 w-full max-w-sm p-8 rounded-2xl shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/30 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-white">Cancel Subscription?</h3>
              <p className="text-xs text-brand-textMuted leading-relaxed">
                Your subscription will be marked as cancelled. You can reactivate at any time.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Keep Plan
              </button>
              <button
                id="confirm-cancel-btn"
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Cancel It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downgrade Confirmation Modal */}
      {showDowngradeConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-[#0B1533] border border-amber-800/30 w-full max-w-sm p-8 rounded-2xl shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-900/30 border border-amber-700/30 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-white">Downgrade to Free?</h3>
              <p className="text-xs text-brand-textMuted leading-relaxed">
                You'll lose premium features. Ensure you have at most 1 profile before downgrading.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDowngradeConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Stay Premium
              </button>
              <button
                id="confirm-downgrade-btn"
                onClick={handleDowngrade}
                className="flex-1 px-4 py-2.5 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Downgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
