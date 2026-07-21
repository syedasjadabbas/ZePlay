import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../services/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state && (location.state as any).message) {
      setInfoMessage((location.state as any).message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await api.post('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      if (rememberMe) {
        localStorage.setItem('token', access_token);
      } else {
        sessionStorage.setItem('token', access_token);
        localStorage.setItem('token', access_token);
      }
      navigate('/profiles');
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Incorrect email or password. Please verify credentials.'
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
            Your next favorite story{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #93C5FD 100%)' }}
            >
              starts here.
            </span>
          </h2>
          <p className="text-sm text-brand-textMuted leading-relaxed">
            Experience premium streaming with personalized recommendations and seamless playback.
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
          {/* Top highlight line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/8 rounded-full blur-[40px] pointer-events-none" />

          <div className="space-y-2 mb-8 relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Sign In</h2>
            <p className="text-xs text-brand-textMuted font-medium">Welcome back. Enter your credentials to continue.</p>
          </div>

          {infoMessage && (
            <div
              className="text-xs text-emerald-300 rounded-xl p-3.5 mb-5 font-semibold"
              style={{ background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              {infoMessage}
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

          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div>
              <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                Email Address
              </label>
              <input
                id="login-email"
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

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest font-bold">
                  Password
                </label>
              </div>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 text-white rounded-xl text-sm placeholder:text-white/30 caret-brand-accent outline-none transition-all duration-200"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              {/* Forgot Password — directly under password field */}
              <div className="flex justify-end mt-2">
                <Link
                  to="/forgot-password"
                  id="forgot-password-link"
                  className="text-[11px] text-brand-accent hover:text-blue-400 font-semibold transition-colors duration-150"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Remember Me */}
            <label
              className="flex items-center gap-3 cursor-pointer group mt-1"
              htmlFor="remember-me"
            >
              <div className="relative">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className="w-4 h-4 rounded flex items-center justify-center transition-all duration-200 flex-shrink-0"
                  style={{
                    background: rememberMe
                      ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                      : 'rgba(16,28,64,0.8)',
                    border: rememberMe
                      ? '1px solid rgba(59,130,246,0.6)'
                      : '1px solid rgba(255,255,255,0.15)',
                    boxShadow: rememberMe ? '0 0 8px rgba(59,130,246,0.3)' : 'none',
                  }}
                  onClick={() => setRememberMe(r => !r)}
                >
                  {rememberMe && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span
                className="text-[11px] font-medium transition-colors duration-150 select-none"
                style={{ color: rememberMe ? '#93C5FD' : '#8895b3' }}
                onClick={() => setRememberMe(r => !r)}
              >
                Remember me
              </span>
            </label>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white font-bold rounded-xl text-sm transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-brand-textMuted text-xs text-center font-medium relative z-10">
            New to ZePlay?{' '}
            <Link to="/register" className="text-brand-accent hover:text-blue-400 font-bold transition-colors duration-150">
              Create an account
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
