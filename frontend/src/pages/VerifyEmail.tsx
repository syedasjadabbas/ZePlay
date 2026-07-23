import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const VerifyEmail: React.FC = () => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const query = new URLSearchParams(location.search);
  const token = query.get('token');

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Verification link is missing or invalid.');
        return;
      }

      try {
        const response = await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');

        setTimeout(() => {
          navigate('/login', { state: { message: 'Email verified successfully! You can now sign in.' } });
        }, 2500);
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.detail ||
            'Invalid or expired verification token.'
        );
      }
    };

    performVerification();
  }, [token, navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-brand-background px-4 font-sans select-none overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-purple-500/4 rounded-full blur-[80px] pointer-events-none" />

      {/* Logo */}
      <div className="absolute top-8 left-8">
        <span className="text-2xl font-black text-brand-accent tracking-wider font-display">ZePlay</span>
      </div>

      <div
        className="w-full max-w-md relative z-10 rounded-2xl p-8 md:p-10 shadow-2xl overflow-hidden text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(11,21,53,0.92) 0%, rgba(7,14,38,0.96) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Verifying */}
        {status === 'verifying' && (
          <div className="space-y-5 py-6">
            <div className="flex justify-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  boxShadow: '0 0 20px rgba(59,130,246,0.1)',
                }}
              >
                <svg className="w-6 h-6 text-brand-accent animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Verifying your email</h2>
            <p className="text-xs text-brand-textMuted font-medium">Please wait while we activate your account...</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="space-y-5 py-4">
            <div className="flex justify-center">
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
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white font-display mb-2">
                Email Verified!
              </h2>
              <p className="text-xs text-emerald-300 font-medium px-4">{message}</p>
            </div>
            <div
              className="rounded-xl p-3.5 mx-auto"
              style={{
                background: 'rgba(16,185,129,0.05)',
                border: '1px solid rgba(16,185,129,0.15)',
              }}
            >
              <p className="text-[11px] text-brand-textMuted">
                You can now access all ZePlay features.{' '}
                <span className="text-emerald-300 font-semibold">Redirecting to sign in...</span>
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="space-y-5 py-4">
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  boxShadow: '0 0 30px rgba(239,68,68,0.1)',
                }}
              >
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white font-display mb-2">
                Verification Failed
              </h2>
              <p className="text-xs text-red-300 font-medium px-4">{message}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Link
                id="verify-go-login"
                to="/login"
                className="flex-1 py-3 rounded-xl font-bold text-xs text-brand-textMuted transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                Sign In
              </Link>
              <Link
                id="verify-go-register"
                to="/register"
                className="flex-1 py-3 rounded-xl font-bold text-xs text-white transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                  boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
                }}
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
