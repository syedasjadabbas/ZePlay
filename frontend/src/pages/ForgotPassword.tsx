import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // The API always returns success (doesn't reveal user existence)
      const response = await api.post('/auth/forgot-password', { email });
      setEmailConfigured(response.data.email_configured ?? true);
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

          {!submitted ? (
            <>
              <div className="space-y-2 mb-8 relative z-10">
                <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Reset Password</h2>
                <p className="text-xs text-brand-textMuted font-medium">
                  Enter your registered email to receive a reset link.
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
                  className="w-full py-3 text-white font-bold rounded-xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    boxShadow: '0 8px 24px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
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
                      Sending link...
                    </span>
                  ) : (
                    'Send Reset Link'
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
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 0 30px rgba(59,130,246,0.15)',
                  }}
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
                  If a matching account exists, a password reset link has been sent to{' '}
                  <span className="text-brand-accent font-semibold">{email}</span>.
                </p>
              </div>

              {/* Dev Notice — shown only when email service is not configured */}
              {emailConfigured === false && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(234,179,8,0.06)',
                  border: '1px solid rgba(234,179,8,0.2)',
                }}
              >
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-[11px] font-bold text-yellow-300 mb-1">Email service not configured?</p>
                    <p className="text-[11px] text-yellow-400/80 leading-relaxed">
                      Check{' '}
                      <code className="bg-yellow-400/10 px-1 rounded text-yellow-300">local_emails.log</code>{' '}
                      on the server for the reset link.
                    </p>
                  </div>
                </div>
              </div>
              )}

              <button
                id="forgot-back-to-login"
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#8895b3',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#8895b3';
                }}
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

    </div>
  );
};

export default ForgotPassword;
