import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearAuthSession } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState('User');
  const [profileAvatar, setProfileAvatar] = useState('🍿');
  const [planName, setPlanName] = useState<string>('free');
  const [planMaxProfiles, setPlanMaxProfiles] = useState<number>(1);
  
  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);

  const activeProfileId = localStorage.getItem('selectedProfileId');

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
      return;
    }

    const fetchProfileDetails = async () => {
      try {
        const response = await api.get('/profiles/');
        const activeProfile = response.data.find(
          (p: any) => p.profile_id === activeProfileId
        );
        if (activeProfile) {
          setProfileName(activeProfile.display_name);
          setProfileAvatar(activeProfile.avatar_url || '🍿');
        }
      } catch (err) {
        console.error("Failed to load profile details in Settings page.", err);
      }
    };

    fetchProfileDetails();

    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = cachedUser.is_admin === true;
    api.get('/subscription/current')
      .then((res) => {
        if (res.data) {
          const status = res.data.status;
          const isActive = status === 'active' || status === 'Administrator Account' || isAdmin;
          setPlanName(isActive && res.data.plan?.name ? res.data.plan.name : (isAdmin ? 'premium' : 'free'));
          setPlanMaxProfiles(isActive && res.data.plan?.max_profiles ? res.data.plan.max_profiles : (isAdmin ? 999 : 1));
        }
      })
      .catch(() => {});
  }, [activeProfileId, navigate]);

  // Handle countdown and auto-logout upon success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      clearAuthSession();
      navigate('/login');
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccess("Password successfully updated. Signing you out in...");
      setCountdown(3);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "Failed to change password. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(16, 28, 64, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.09)',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(59, 130, 246, 0.5)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.04)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.09)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} profileAvatar={profileAvatar} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 max-w-2xl mx-auto w-full space-y-8">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20">
              Account Control
            </span>
            <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase mt-2">
              Settings
            </h1>
            <p className="text-xs text-brand-textMuted font-medium mt-1">
              Manage your ZePlay profile credentials and account security.
            </p>
          </div>

          {/* Your Plan Card */}
          <div className={`relative overflow-hidden bg-[#0B1533]/80 border backdrop-blur-md p-6 rounded-3xl shadow-2xl ${
            planName === 'premium' ? 'border-amber-400/20' : 'border-white/5'
          }`}>
            {planName === 'premium' && (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-yellow-400/5 pointer-events-none rounded-3xl" />
            )}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  planName === 'premium' ? 'bg-amber-500/15' : 'bg-blue-500/10'
                }`}>
                  {planName === 'premium' ? (
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-textMuted">Your Plan</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-extrabold text-white capitalize">{planName}</span>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-brand-textMuted">
                      {planMaxProfiles} Profile{planMaxProfiles !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate('/subscription')}
                className="text-xs font-bold text-brand-accent hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                Manage
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="bg-[#0B1533]/80 border border-white/5 backdrop-blur-md p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-white">Change Password</h3>
                <p className="text-[10px] text-brand-textMuted">Ensure your account is protected with a strong, secure passphrase.</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800/30 text-rose-300 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-950/40 border border-emerald-800/30 text-emerald-300 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3">
                <svg className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <span>{success}</span>
                  <span className="font-extrabold text-brand-accent ml-1 text-sm">{countdown}s</span>
                </div>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Current Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={inputStyle}
                  required
                  className="w-full px-4 py-3 text-white rounded-xl outline-none transition-all text-xs placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={inputStyle}
                  required
                  className="w-full px-4 py-3 text-white rounded-xl outline-none transition-all text-xs placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={inputStyle}
                  required
                  className="w-full px-4 py-3 text-white rounded-xl outline-none transition-all text-xs placeholder:text-white/30"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !!success}
                  className="w-full py-3 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-[0_0_30px_rgba(59,130,246,0.25)] text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
