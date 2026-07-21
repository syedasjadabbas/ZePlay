import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../services/api';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Extract token from URL query parameters
  const query = new URLSearchParams(location.search);
  const token = query.get('token');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token) {
      setError("Reset token is missing from URL.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: newPassword
      });
      setSuccessMessage("Password successfully reset! Redirection to sign in page shortly...");
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "Failed to reset password. The link may have expired or is invalid."
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
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">New Password</h2>
            <p className="text-xs text-brand-textMuted font-medium">Please enter your new credentials below.</p>
          </div>

          {successMessage && (
            <div className="bg-emerald-950/40 border border-emerald-800/30 text-xs text-emerald-300 rounded-xl p-3.5 mb-5 font-semibold">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-950/50 border border-red-800/40 text-xs text-red-200 rounded-xl p-3.5 mb-5 font-semibold">
              {error}
            </div>
          )}

          {!token ? (
            <div className="text-center py-6">
              <p className="text-xs text-brand-textMuted mb-6">Reset token is missing. Please initiate a reset from login screen.</p>
              <Link 
                to="/login"
                className="inline-block px-6 py-2.5 bg-brand-surface hover:bg-brand-cards border border-white/5 font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
                {loading ? 'Updating credentials...' : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="mt-8 text-brand-textMuted text-xs text-center font-medium">
            Remember password?{' '}
            <Link to="/login" className="text-brand-accent hover:underline font-bold">
              Sign In
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ResetPassword;
