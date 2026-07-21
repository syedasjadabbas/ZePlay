import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import PasswordInput from '../components/PasswordInput';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<{
    emailConfigured: boolean;
    devNotice: string | null;
    userEmail: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email,
        name,
        password,
      });
      setRegistrationData({
        emailConfigured: response.data.email_configured,
        devNotice: response.data.dev_notice,
        userEmail: response.data.email,
      });
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'An error occurred during registration. Please verify details.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ─── Success State ──────────────────────────────────────────── */
  if (registrationData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-brand-background font-sans overflow-hidden relative select-none px-4">
        {/* Ambient glow layers */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

        {/* Logo */}
        <div className="absolute top-8 left-8">
          <span className="text-2xl font-black text-brand-accent tracking-wider font-display">ZePlay</span>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div
            className="rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(11,21,53,0.92) 0%, rgba(7,14,38,0.96) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Check Icon */}
            <div className="flex justify-center mb-6">
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

            <div className="text-center mb-6">
              <h2 className="text-2xl font-extrabold tracking-tight text-white font-display mb-2">
                Account Created
              </h2>
              <p className="text-xs text-brand-textMuted font-medium">
                One step left — verify your email to start watching
              </p>
            </div>

            {/* Email Verification Required Notice */}
            <div
              className="rounded-xl p-4 mb-4"
              style={{
                background: 'rgba(59,130,246,0.07)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-brand-accent mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-xs font-bold text-white mb-1">✓ Email Verification Required</p>
                  <p className="text-[11px] text-brand-textMuted leading-relaxed">
                    We've sent a verification link to{' '}
                    <span className="text-brand-accent font-semibold">{registrationData.userEmail}</span>.
                    Please verify your account before signing in.
                  </p>
                </div>
              </div>
            </div>

            {/* Dev / Sandbox Notice — shown whenever devNotice is provided by backend */}
            {registrationData.devNotice && (
              <div
                className="rounded-xl p-4 mb-5"
                style={{
                  background: 'rgba(234,179,8,0.06)',
                  border: '1px solid rgba(234,179,8,0.25)',
                }}
              >
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-[11px] font-bold text-yellow-300 mb-1">⚡ Email Delivery Notice</p>
                    <p className="text-[11px] text-yellow-400/80 leading-relaxed">
                      {registrationData.devNotice}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 mt-2">
              {registrationData.emailConfigured && (
                <a
                  id="open-email-app"
                  href="mailto:"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    boxShadow: '0 8px 24px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Open Email App
                </a>
              )}

              <button
                id="back-to-signin"
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#8895b3',
                }}
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Registration Form ─────────────────────────────────────── */
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

          <div className="flex items-center gap-4 pt-2">
            {['4K Ultra HD', 'Any Device', 'Cancel Anytime'].map(badge => (
              <div key={badge} className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium">
                <svg className="w-3 h-3 text-brand-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {badge}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-neutral-500 font-medium relative z-10 space-y-1">
          <div>&copy; {new Date().getFullYear()} ZePlay. All rights reserved.</div>
          <div>
            <a
              href="https://zeploy.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent hover:underline font-bold tracking-wider"
            >
              POWERED BY ZEPLOY TECH
            </a>
          </div>
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

          <div className="space-y-1.5 mb-7 relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Create account</h2>
            <p className="text-xs text-brand-textMuted font-medium">Your next favorite story starts here.</p>
          </div>

          {error && (
            <div
              className="text-xs text-red-200 rounded-xl p-3.5 mb-5 font-semibold"
              style={{ background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4 relative z-10">
            {[
              { id: 'register-name', label: 'Display Name', type: 'text', placeholder: 'Enter your display name', value: name, onChange: (v: string) => setName(v) },
              { id: 'register-email', label: 'Email Address', type: 'email', placeholder: 'Enter your email address', value: email, onChange: (v: string) => setEmail(v) },
              { id: 'register-password', label: 'Password', type: 'password', placeholder: 'Enter your password', value: password, onChange: (v: string) => setPassword(v) },
              { id: 'register-confirm-password', label: 'Confirm Password', type: 'password', placeholder: 'Confirm your password', value: confirmPassword, onChange: (v: string) => setConfirmPassword(v) },
            ].map(field => (
              <div key={field.id}>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                  {field.label}
                </label>
                {field.type === 'password' ? (
                  <PasswordInput
                    id={field.id}
                    placeholder={field.placeholder}
                    value={field.value}
                    onChange={field.onChange}
                    required
                    style={{
                      background: 'rgba(16,28,64,0.8)',
                      border: '1px solid rgba(255,255,255,0.09)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(59,130,246,0.5)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.04)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                ) : (
                  <input
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    required
                    className="w-full px-4 py-3 text-white rounded-xl text-sm placeholder:text-white/30 caret-brand-accent outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(16,28,64,0.8)',
                      border: '1px solid rgba(255,255,255,0.09)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(59,130,246,0.5)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.04)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                )}
              </div>
            ))}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white font-bold rounded-xl text-sm transition-all duration-200 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-7 text-brand-textMuted text-xs text-center font-medium relative z-10">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-accent hover:text-blue-400 font-bold transition-colors duration-150">
              Sign In
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Register;
