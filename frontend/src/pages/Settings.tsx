import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearAuthSession } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState('User');
  const [profileAvatar, setProfileAvatar] = useState('🍿');
  
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
