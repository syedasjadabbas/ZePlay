import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api, { setAuthSession } from '../services/api';
import PasswordInput from '../components/PasswordInput';

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

      const { access_token, user } = response.data;
      setAuthSession(access_token, rememberMe);

      // Immediately cache user profile (including is_admin) returned directly in login response
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
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
              className="text-xs text-red-200 rounded-xl p-3.5 mb-5 font-semibold space-y-2"
              style={{ background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <div>{error}</div>
              {error.toLowerCase().includes('verify') && (
                <button
                  type="button"
                  onClick={() => navigate('/verify-email', { state: { email } })}
                  className="text-brand-accent hover:underline font-bold text-[11px] block text-left cursor-pointer"
                >
                  Verify your email now &rarr;
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
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
              <PasswordInput
                id="login-password"
                placeholder="Enter your password"
                value={password}
                onChange={setPassword}
                required
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              {/* Forgot Password */}
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
                      : 'rgba(20,20,20,0.8)',
                    border: rememberMe
                      ? '1px solid rgba(59,130,246,0.6)'
                      : '1px solid rgba(255,255,255,0.15)',
                    boxShadow: rememberMe ? '0 0 8px rgba(59,130,246,0.3)' : 'none',
                  }}
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
              >
                Remember me
              </span>
            </label>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white font-extrabold rounded-2xl text-sm transition-all duration-300 mt-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 active:scale-[0.98] btn-premium cursor-pointer"
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

export default Login;
