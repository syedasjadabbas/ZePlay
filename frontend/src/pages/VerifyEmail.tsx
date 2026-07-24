import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const VerifyEmail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const passedEmail = location.state?.email || '';

  const [email, setEmail] = useState(passedEmail);
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const performVerification = async (codeToVerify: string) => {
    const cleanCode = codeToVerify.trim();
    if (cleanCode.length !== 6) {
      setStatus('error');
      setMessage('Please enter a valid 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setStatus('verifying');
    setMessage('');

    try {
      const response = await api.post('/auth/verify-email', { token: cleanCode });
      setStatus('success');
      setMessage(response.data.message || 'Email verified successfully!');

      setTimeout(() => {
        navigate('/login', { state: { message: 'Email verified successfully! You can now sign in.' } });
      }, 2000);
    } catch (err: any) {
      setStatus('error');
      setMessage(
        err.response?.data?.detail ||
          'Invalid or expired 6-digit OTP code. Please check your code or request a new one.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(otp);
  };

  const handleResendOtp = async () => {
    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid email address to resend OTP.');
      setStatus('error');
      return;
    }

    setResendMessage(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/resend-verification', { email });
      setResendMessage(res.data.message || 'A new 6-digit OTP code has been sent to your email.');
      setResendCooldown(30);
      setStatus('idle');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.detail || 'Failed to resend verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(val);
    if (val.length === 6) {
      performVerification(val);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.7)';
    e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.7), 0 0 12px rgba(59, 130, 246, 0.25)';
    e.currentTarget.style.background = 'rgba(16, 28, 64, 0.6)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.background = 'rgba(16, 28, 64, 0.4)';
  };

  const inputStyle = {
    background: 'rgba(16, 28, 64, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-brand-background px-4 font-sans select-none overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-purple-500/4 rounded-full blur-[80px] pointer-events-none" />

      {/* Logo */}
      <div className="absolute top-8 left-8">
        <span className="text-2xl font-black text-brand-accent tracking-wider font-display">ZePlay</span>
      </div>

      <div
        className="w-full max-w-md relative z-10 rounded-2xl p-8 md:p-10 shadow-2xl overflow-hidden text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(11,21,53,0.92) 0%, rgba(7,14,38,0.96) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Form State */}
        {status !== 'success' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  boxShadow: '0 0 20px rgba(59,130,246,0.1)',
                }}
              >
                <svg className="w-7 h-7 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white font-display mb-2">Verify Your Account</h2>
              <p className="text-xs text-brand-textMuted font-medium px-4">
                Enter the 6-digit OTP code sent to{' '}
                <span className="text-brand-accent font-semibold">{email || 'your email'}</span>.
              </p>
            </div>

            {resendMessage && (
              <div
                className="text-xs text-emerald-300 rounded-xl p-3 font-semibold text-center"
                style={{ background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                {resendMessage}
              </div>
            )}

            {status === 'error' && message && (
              <div
                className="text-xs text-red-200 rounded-xl p-3.5 font-semibold text-center"
                style={{ background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!passedEmail && (
                <div className="text-left">
                  <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1 font-bold">
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
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-2 font-bold">
                  6-Digit OTP Code
                </label>
                <input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={handleOtpChange}
                  required
                  autoFocus
                  className="w-full px-4 py-4 text-center text-3xl tracking-[12px] font-extrabold text-white rounded-xl placeholder:text-white/20 outline-none transition-all duration-200"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <button
                id="verify-submit"
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-3.5 text-white font-extrabold rounded-2xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] active:translate-y-0 shadow-[0_8px_24px_rgba(59,130,246,0.25),_inset_0_1px_0_rgba(255,255,255,0.1)] btn-premium cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying OTP...
                  </span>
                ) : (
                  'Verify & Activate'
                )}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs pt-2 text-brand-textMuted">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-brand-accent font-bold hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend OTP Code'}
              </button>

              <Link to="/login" className="text-brand-textMuted hover:text-white font-semibold">
                Sign In
              </Link>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="space-y-5 py-4">
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  boxShadow: '0 0 30px rgba(16,185,129,0.15)',
                }}
              >
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white font-display mb-2">
                Account Verified!
              </h2>
              <p className="text-xs text-emerald-300 font-medium px-4">{message}</p>
            </div>
            <div
              className="rounded-xl p-3.5 mx-auto"
              style={{
                background: 'rgba(16,185,129,0.05)',
                border: '1px solid rgba(16,185,129,0.15)',
              }}
            >
              <p className="text-[11px] text-brand-textMuted">
                Your account is active.{' '}
                <span className="text-emerald-300 font-semibold">Redirecting to sign in...</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
