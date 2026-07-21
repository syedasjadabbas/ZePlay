import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', {
        email,
        name,
        password,
      });
      setSuccessMessage("Account created successfully! We've sent a verification link to your email address. Please click it to verify your account.");
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "An error occurred during registration. Please verify details."
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
          <div className="space-y-2 mb-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display font-display">Create account</h2>
            <p className="text-xs text-brand-textMuted font-medium">Get started with ZePlay space today.</p>
          </div>

          {successMessage && (
            <div className="bg-emerald-950/40 border border-emerald-800/30 text-xs text-emerald-300 rounded-xl p-3.5 mb-5 font-semibold text-center">
              <p className="mb-4">{successMessage}</p>
              <button 
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-brand-accent text-white font-bold rounded-lg hover:bg-blue-600 transition-all text-xs"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-950/50 border border-red-800/40 text-xs text-red-200 rounded-xl p-3.5 mb-5 font-semibold">
              {error}
            </div>
          )}

          {!successMessage && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Display Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/40 caret-brand-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Email address</label>
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
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/40 caret-brand-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/40 caret-brand-accent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-accent text-white font-bold rounded-xl hover:bg-blue-600 active:bg-blue-750 transition-all disabled:opacity-50 mt-6 shadow-lg shadow-blue-500/20 text-sm hover:-translate-y-0.5"
              >
                {loading ? 'Creating space...' : 'Register'}
              </button>
            </form>
          )}

          <div className="mt-8 text-brand-textMuted text-xs text-center font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-accent hover:underline font-bold">
              Sign In
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Register;
