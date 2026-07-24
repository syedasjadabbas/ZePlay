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
    verificationToken?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

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
      if (response.data?.verificationToken) {
        setRegistrationData({
          emailConfigured: response.data.email_configured,
          devNotice: response.data.dev_notice || null,
          userEmail: response.data.email || email,
          verificationToken: response.data.verificationToken,
        });
      } else {
        navigate('/verify-email', { state: { email: response.data?.email || email } });
      }
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
      <div 
        className="min-h-screen w-full flex flex-col justify-between bg-cover bg-center text-white font-sans relative select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.85) 100%), url(/auth_collage_bg.png)`
        }}
      >
        {/* Header bar */}
        <header className="px-8 py-6 md:px-16 flex items-center justify-between relative z-10 w-full">
          <Link to="/" className="hover:scale-[1.01] transition-transform select-none">
            <span className="text-3xl font-black tracking-wider font-display drop-shadow-md">
              <span className="text-[#1E3A8A]">Ze</span>
              <span className="text-[#3B82F6]">Play</span>
            </span>
          </Link>
          <div className="text-[10px] font-black tracking-widest uppercase bg-brand-accent/15 border border-brand-accent/30 px-3 py-1 rounded-full text-brand-accent shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            Stream Center
          </div>
        </header>

        {/* Centered Success Card */}
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
                  <p className="text-xs font-bold text-white mb-1">✓ 6-Digit OTP Code Sent</p>
                  <p className="text-[11px] text-brand-textMuted leading-relaxed">
                    We've sent a 6-digit OTP code to{' '}
                    <span className="text-brand-accent font-semibold">{registrationData.userEmail}</span>.
                    Please enter the code to activate your account.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <button
                id="enter-otp-button"
                onClick={() => navigate('/verify-email', { state: { email: registrationData.userEmail } })}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-white transition-all duration-300 btn-premium cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                  boxShadow: '0 8px 24px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Enter OTP Code
              </button>

              <button
                id="back-to-signin"
                onClick={() => navigate('/login')}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all duration-300 btn-premium cursor-pointer"
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

        {/* Footer bar */}
        <footer className="px-8 py-6 text-center text-xs text-neutral-600 relative z-10 space-y-1">
          <div>&copy; 2026 ZePlay. All Rights Reserved.</div>
          <div className="text-[10px]">
            <a href="https://zeploy.tech" target="_blank" rel="noopener noreferrer" className="hover:underline">
              Powered by Zeploy Tech
            </a>
          </div>
        </footer>
      </div>
    );
  }

  /* ─── Registration Form ─────────────────────────────────────── */
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
          <span className="text-3xl font-black tracking-wider font-display drop-shadow-md">
            <span className="text-[#1E3A8A]">Ze</span>
            <span className="text-[#3B82F6]">Play</span>
          </span>
        </Link>
        <div className="text-[10px] font-black tracking-widest uppercase bg-brand-accent/15 border border-brand-accent/30 px-3 py-1 rounded-full text-brand-accent shadow-[0_0_15px_rgba(59,130,246,0.15)]">
          Stream Center
        </div>
      </header>

      {/* Centered Registration Card */}
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
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
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
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                )}
              </div>
            ))}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white font-extrabold rounded-2xl text-sm transition-all duration-300 mt-4 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 active:scale-[0.98] btn-premium cursor-pointer"
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

      {/* Footer bar */}
      <footer className="px-8 py-6 text-center text-xs text-neutral-600 relative z-10 space-y-1">
        <div>&copy; 2026 ZePlay. All Rights Reserved.</div>
        <div className="text-[10px]">
          <a href="https://zeploy.tech" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Powered by Zeploy Tech
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Register;
