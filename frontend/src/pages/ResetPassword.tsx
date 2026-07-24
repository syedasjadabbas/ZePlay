import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../services/api';
import PasswordInput from '../components/PasswordInput';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const passedEmail = location.state?.email || '';

  const [email, setEmail] = useState(passedEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter a valid 6-digit OTP reset code.');
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
        token: cleanOtp,
        new_password: newPassword,
      });
      setSuccessMessage('Password successfully reset! Redirecting to sign in...');
      setTimeout(() => {
        navigate('/login', { state: { message: 'Password reset successful. Please sign in with your new password.' } });
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Failed to reset password. The 6-digit OTP code may be invalid or expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter your email address to resend reset code.');
      return;
    }

    setResendMessage(null);
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setResendMessage(res.data.message || 'A new 6-digit reset code has been sent to your email.');
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resend reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(20, 20, 20, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)';
    e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.8), 0 0 16px rgba(59, 130, 246, 0.35)';
    e.currentTarget.style.background = 'rgba(10, 10, 10, 0.85)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.background = 'rgba(20, 20, 20, 0.65)';
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-between bg-cover bg-center text-white font-sans relative select-none"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.85) 100%), url(/auth_collage_bg.png)`
      }}
    >
      {/* Top Header bar */}
      <header className="px-8 py-6 md:px-16 flex items-center justify-between relative z-10 w-full">
        <Link to="/" className="text-3xl font-black text-brand-accent tracking-wider font-display drop-shadow-md">
          ZePlay
        </Link>
        <div className="text-[10px] font-black tracking-widest uppercase bg-brand-accent/15 border border-brand-accent/30 px-3 py-1 rounded-full text-brand-accent shadow-[0_0_15px_rgba(59,130,246,0.15)]">
          Stream Center
        </div>
      </header>

      {/* Centered Authentication Card */}
      <div className="flex-grow flex items-center justify-center p-6 relative z-10">
        <div
          className="w-full max-w-[430px] relative z-10 rounded-3xl p-10 md:p-12 shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(0, 0, 0, 0.78)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="space-y-2 mb-6 relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Reset Password</h2>
            <p className="text-xs text-brand-textMuted font-medium">
              Enter the 6-digit OTP code sent to{' '}
              <span className="text-brand-accent font-semibold">{email || 'your email'}</span> and choose a new password.
            </p>
          </div>

          {resendMessage && (
            <div
              className="text-xs text-emerald-300 rounded-xl p-3.5 mb-5 font-semibold flex items-center gap-2"
              style={{ background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {resendMessage}
            </div>
          )}

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

          <form onSubmit={handleResetPassword} className="space-y-4 relative z-10">
            {!passedEmail && (
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 text-sm text-white rounded-xl placeholder:text-white/20 outline-none"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                6-Digit OTP Reset Code
              </label>
              <input
                id="reset-otp-input"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                className="w-full px-4 py-3 text-center text-2xl tracking-[10px] font-extrabold text-white rounded-xl placeholder:text-white/20 outline-none transition-all duration-200 animate-pulse-slow"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <div>
              <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                New Password
              </label>
              <PasswordInput
                id="reset-new-password"
                placeholder="Enter new password"
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
                Confirm New Password
              </label>
              <PasswordInput
                id="reset-confirm-password"
                placeholder="Confirm new password"
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
              disabled={loading || !!successMessage || otp.length < 6}
              className="w-full py-3.5 text-white font-extrabold rounded-2xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 active:scale-[0.98] btn-premium cursor-pointer"
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

          <div className="flex items-center justify-between mt-6 text-brand-textMuted text-xs font-medium relative z-10">
            <button
              type="button"
              onClick={handleResendResetOtp}
              disabled={resendCooldown > 0 || loading}
              className="text-brand-accent font-bold hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Reset OTP'}
            </button>

            <Link to="/login" className="text-brand-accent hover:text-blue-400 font-bold transition-colors duration-150">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <footer className="px-8 py-6 text-center text-xs text-neutral-600 relative z-10 space-y-1">
        <div>&copy; 2026 ZePlay. All Rights Reserved.</div>
        <div className="text-[10px]">Powered by Zeploy Tech</div>
      </footer>
    </div>
  );
};

export default ResetPassword;
