import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../services/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      localStorage.setItem('token', access_token);
      navigate('/profiles');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "Incorrect email or password. Please verify credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-brand-background text-white font-sans overflow-hidden relative select-none">
      
      {/* Left Column: Cinematic Backdrop */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-16 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(6, 11, 24, 0.4) 0%, rgba(6, 11, 24, 0.96) 100%), url(https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop&q=80)`
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-brand-accent tracking-wider font-display">
            ZePlay
          </span>
        </div>

        <div className="max-w-md space-y-4">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter font-display leading-tight">
            Cinematic space verification pipeline.
          </h2>
          <p className="text-sm text-brand-textMuted leading-relaxed">
            ZePlay integrates real-time adaptive bitrate ingestion, secure CDN delivery networks, and authenticated multi-profile catalogs.
          </p>
        </div>

        <div className="text-xs text-neutral-500 font-medium">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand-accent/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#0B1535]/80 border border-white/5 rounded-2xl p-8 md:p-10 shadow-2xl backdrop-blur-md relative z-10">
          <div className="space-y-2 mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Sign In</h2>
            <p className="text-xs text-brand-textMuted font-medium">Welcome back. Enter your credentials to access ZePlay.</p>
          </div>
          
          {infoMessage && (
            <div className="bg-emerald-950/40 border border-emerald-800/30 text-xs text-emerald-300 rounded-xl p-3.5 mb-5 font-semibold">
              {infoMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-950/50 border border-red-800/40 text-xs text-red-200 rounded-xl p-3.5 mb-5 font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Email Address</label>
              <input
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/40 caret-brand-accent"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest font-bold">Password</label>
                <Link 
                  to="/forgot-password" 
                  className="text-[10px] text-brand-accent hover:underline font-bold uppercase tracking-wider transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/40 caret-brand-accent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-accent text-white font-bold rounded-xl hover:bg-blue-600 active:bg-blue-750 transition-all disabled:opacity-50 mt-6 shadow-lg shadow-blue-500/20 text-sm hover:-translate-y-0.5"
            >
              {loading ? 'Verifying access...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 text-brand-textMuted text-xs text-center font-medium">
            New to ZePlay?{' '}
            <Link to="/register" className="text-brand-accent hover:underline font-bold">
              Sign up now.
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
