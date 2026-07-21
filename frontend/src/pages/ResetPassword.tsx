import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../services/api';
import PasswordInput from '../components/PasswordInput';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const query = new URLSearchParams(location.search);
  const token = query.get('token');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token) {
      setError('Reset token is missing from URL.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      setSuccessMessage('Password successfully reset. Redirecting to sign in...');
      setTimeout(() => {
        navigate('/login', { state: { message: 'Password reset successful. Please sign in with your new password.' } });
      }, 2500);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Failed to reset password. The link may have expired or is invalid.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(16,28,64,0.8)',
    border: '1px solid rgba(255,255,255,0.09)',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(59,130,246,0.5)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.04)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div className="min-h-screen w-full flex bg-brand-background text-white font-sans overflow-hidden relative select-none">

      {/* Left Column: Cinematic Backdrop */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(6, 11, 24, 0.35) 0%, rgba(6, 11, 24, 0.97) 100%), url(https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop&q=80)`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-brand-background/60 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <span className="text-2xl font-black text-brand-accent tracking-wider font-display drop-shadow-lg">
            ZePlay
          </span>
        </div>

        <div className="max-w-md space-y-5 relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter font-display leading-tight">
            Unlimited entertainment,{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #93C5FD 100%)' }}
            >
              one platform.
            </span>
          </h2>
          <p className="text-sm text-brand-textMuted leading-relaxed">
            Watch blockbuster movies, trending series, and exclusive content across every device.
          </p>
        </div>

        <div className="text-xs text-neutral-500 font-medium relative z-10">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/6 rounded-full blur-[100px] pointer-events-none" />

        <div
          className="w-full max-w-md relative z-10 rounded-2xl p-8 md:p-10 shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(11,21,53,0.90) 0%, rgba(7,14,38,0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/8 rounded-full blur-[40px] pointer-events-none" />

          <div className="space-y-2 mb-8 relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">New Password</h2>
            <p className="text-xs text-brand-textMuted font-medium">Create a new password for your account.</p>
          </div>

          {successMessage && (
            <div
              className="text-xs text-emerald-300 rounded-xl p-3.5 mb-5 font-semibold flex items-center gap-2"
              style={{ background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}

          {error && (
            <div
              className="text-xs text-red-200 rounded-xl p-3.5 mb-5 font-semibold"
              style={{ background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {error}
            </div>
          )}

          {!token ? (
            <div className="text-center py-6 relative z-10">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-xs text-brand-textMuted mb-6">
                Reset token is missing. Please request a new password reset link.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block px-6 py-2.5 font-bold rounded-xl text-xs text-white transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                  boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
                }}
              >
                Request Reset Link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5 relative z-10">
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                  New Password
                </label>
                <PasswordInput
                  id="reset-new-password"
                  placeholder="Enter your password"
                  value={newPassword}
                  onChange={setNewPassword}
                  required
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                  Confirm Password
                </label>
                <PasswordInput
                  id="reset-confirm-password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <button
                id="reset-submit"
                type="submit"
                disabled={loading || !!successMessage}
                className="w-full py-3 text-white font-bold rounded-xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                  boxShadow: '0 8px 24px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
                }}
                onMouseEnter={e => {
                  if (!loading && !successMessage) {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(59,130,246,0.45), inset 0 1px 0 rgba(255,255,255,0.15)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.12)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Updating password...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-brand-textMuted text-xs text-center font-medium relative z-10">
            Remember your password?{' '}
            <Link to="/login" className="text-brand-accent hover:text-blue-400 font-bold transition-colors duration-150">
              Sign In
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ResetPassword;
