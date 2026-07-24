import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import Logo from '../components/Logo';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Failed to initiate password reset. Please verify inputs.'
      );
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
        <Link to="/" className="hover:scale-[1.01] transition-transform select-none">
          <Logo height={42} className="w-auto" />
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

          {!submitted ? (
            <>
              <div className="space-y-2 mb-8 relative z-10">
                <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Reset Password</h2>
                <p className="text-xs text-brand-textMuted font-medium">
                  Enter your registered email to receive a 6-digit OTP reset code.
                </p>
              </div>

              {error && (
                <div
                  className="text-xs text-red-200 rounded-xl p-3.5 mb-5 font-semibold"
                  style={{ background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                    Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 text-white rounded-xl text-sm placeholder:text-white/30 caret-brand-accent outline-none transition-all duration-200"
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>

                <button
                  id="forgot-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 text-white font-extrabold rounded-2xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 active:scale-[0.98] btn-premium cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending OTP...
                    </span>
                  ) : (
                    'Send OTP Reset Code'
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ── Success State ── */
            <div className="relative z-10 space-y-5">
              {/* Icon */}
              <div className="flex justify-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-500/10 text-brand-accent"
                >
                  <svg className="w-7 h-7 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-extrabold tracking-tight text-white font-display mb-2">
                  Check Your Email
                </h2>
                <p className="text-[11px] text-brand-textMuted leading-relaxed">
                  If the email exists, a password reset code will be sent.
                </p>
              </div>

              <button
                id="enter-reset-code"
                onClick={() => navigate('/reset-password', { state: { email } })}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all duration-300 btn-premium cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Enter Reset Code
              </button>

              <button
                id="forgot-back-to-login"
                onClick={() => navigate('/login')}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all duration-300 bg-white/5 hover:bg-white/10 text-neutral-350 hover:text-white border border-white/5 active:scale-[0.98] btn-premium cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          )}

          <div className="mt-7 text-brand-textMuted text-xs text-center font-medium relative z-10">
            Remember your password?{' '}
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

export default ForgotPassword;
