import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const VerifyEmail: React.FC = () => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // Extract token from URL query parameters
  const query = new URLSearchParams(location.search);
  const token = query.get('token');

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage("Verification token is missing from verification link.");
        return;
      }

      try {
        const response = await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage(response.data.message || "Email verified successfully!");
        
        // Wait 3 seconds then redirect to login
        setTimeout(() => {
          navigate('/login', { state: { message: "Email verified successfully! Please log in." } });
        }, 3000);
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.detail || 
          "Invalid or expired verification token."
        );
      }
    };

    performVerification();
  }, [token, navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-brand-background px-4 font-sans select-none overflow-hidden">
      {/* Radial ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-accent/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Brand logo link */}
      <div className="absolute top-8 left-8">
        <h1 className="text-2xl font-black text-brand-accent tracking-wider font-display">
          ZePlay
        </h1>
      </div>

      <div className="w-full max-w-md bg-brand-surface/90 border border-white/5 rounded-2xl p-8 md:p-10 shadow-2xl backdrop-blur-md relative z-10 text-center space-y-6">
        
        {status === 'verifying' && (
          <div className="space-y-4 py-6">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Verifying Email</h2>
            <p className="text-xs text-brand-textMuted font-medium">Activating your catalog subscription. Please wait...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Verified!</h2>
            <p className="text-xs text-emerald-300 font-medium px-4">{message}</p>
            <p className="text-[10px] text-brand-textMuted font-medium pt-2">Redirecting to login portal...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-full flex items-center justify-center mx-auto text-red-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display">Failed</h2>
            <p className="text-xs text-red-300 font-medium px-4">{message}</p>
            <div className="pt-4 flex gap-4">
              <Link 
                to="/login"
                className="flex-1 py-3 bg-brand-surface hover:bg-brand-cards border border-white/5 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Sign In
              </Link>
              <Link 
                to="/register"
                className="flex-1 py-3 bg-brand-accent hover:bg-blue-600 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20"
              >
                Register
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerifyEmail;
