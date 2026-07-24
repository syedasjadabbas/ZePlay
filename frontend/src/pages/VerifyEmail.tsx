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
    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)';
    e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.8), 0 0 16px rgba(59, 130, 246, 0.35)';
    e.currentTarget.style.background = 'rgba(10, 10, 10, 0.85)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.background = 'rgba(20, 20, 20, 0.65)';
  };

  const inputStyle = {
    background: 'rgba(20, 20, 20, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
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
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/8 rounded-full blur-[40px] pointer-events-none" />

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
                    className="w-full px-4 py-4 text-center text-3xl tracking-[12px] font-extrabold text-white rounded-xl placeholder:text-white/20 outline-none transition-all duration-200 animate-pulse-slow"
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
            <div className="space-y-5 py-4 text-center">
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

      {/* Footer bar */}
      <footer className="px-8 py-6 text-center text-xs text-neutral-600 relative z-10 space-y-1">
        <div>&copy; {new Date().getFullYear()} ZePlay. All rights reserved.</div>
        <div>
          <a
            href="https://zeploy.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline font-bold tracking-wider text-[10px]"
          >
            POWERED BY ZEPLOY TECH
          </a>
        </div>
      </footer>
    </div>
  );
};

export default VerifyEmail;
