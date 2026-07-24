import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { getToken } from '../services/api';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [planName, setPlanName] = useState<string>('free');

  useEffect(() => {
    // Check initial cached user info
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.is_admin) setIsAdmin(true);
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    // Verify user role with server (use getToken to check both localStorage and sessionStorage)
    const token = getToken();
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data && res.data.is_admin) {
            setIsAdmin(true);
            localStorage.setItem('user', JSON.stringify(res.data));
          } else {
            setIsAdmin(false);
          }
        })
        .catch(() => {
          // Token invalid or network error
        });

      // Fetch subscription plan for badge
      api.get('/subscription/current')
        .then((res) => {
          const plan = (res.data?.status === 'active' && res.data?.plan?.name) ? res.data.plan.name : 'free';
          setPlanName(plan);
        })
        .catch(() => {});
    }
  }, []);
  
  const isActive = (path: string) => location.pathname === path;

  const getLinkClass = (path: string) => {
    const active = isActive(path);
    return `w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-350 ease-[var(--ease-out-premium)] border active:scale-[0.98] ${
      active 
        ? 'bg-brand-accent/12 text-white border-brand-accent/30 shadow-[0_4px_20px_rgba(59,130,246,0.12)] text-shadow-glow' 
        : 'border-transparent text-brand-textMuted hover:bg-white/[0.04] hover:text-white'
    }`;
  };

  const getAdminLinkClass = (path: string) => {
    const active = isActive(path) || (path === '/admin/upload' && location.pathname === '/admin');
    return `w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-350 ease-[var(--ease-out-premium)] border active:scale-[0.98] ${
      active 
        ? 'bg-amber-500/12 text-amber-300 border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.12)]' 
        : 'border-amber-500/10 text-amber-400/90 hover:bg-amber-500/8 hover:text-amber-300'
    }`;
  };

  const getActionLinkClass = () => {
    return "w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-white/[0.04] hover:text-white transition-all duration-350 ease-[var(--ease-out-premium)] active:scale-[0.98]";
  };

  return (
    <aside className="fixed left-6 top-6 bottom-6 w-60 bg-gradient-to-b from-[#0c142c]/95 to-[#070b16]/98 border border-white/8 backdrop-blur-2xl rounded-[32px] flex flex-col justify-between z-30 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8),_inset_0_1px_1px_rgba(255,255,255,0.1)]">
      {/* Brand Header */}
      <div className="space-y-6">
        <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => navigate('/')}>
          <span className="text-xl font-black tracking-[0.1em] bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-blue-400 font-display uppercase">
            ZePlay
          </span>
          {/* Plan badge */}
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/subscription'); }}
            className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded transition-all hover:opacity-90 active:scale-95 ${
              planName === 'premium'
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-450'
            }`}
          >
            {planName.toUpperCase()}
          </button>
        </div>
        
        {/* Navigation list */}
        <nav className="space-y-6 overflow-y-auto pr-1 scrollbar-hide max-h-[70vh]">
          <div className="space-y-1">
            <span className="text-[8px] font-black tracking-[0.2em] text-neutral-500 block mb-2 uppercase px-3">Discover</span>
            <button 
              onClick={() => navigate('/')}
              className={getLinkClass('/')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>

            <button 
              onClick={() => navigate('/browse')}
              className={getLinkClass('/browse')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse
            </button>

            <button 
              onClick={() => navigate('/my-list')}
              className={getLinkClass('/my-list')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              My List
            </button>
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <span className="text-[8px] font-black tracking-[0.2em] text-amber-500/80 block mb-2 uppercase px-3">Studio Deck</span>
              <button 
                onClick={() => navigate('/admin/upload')}
                className={getAdminLinkClass('/admin/upload')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Catalog Ingestion
              </button>

              <button 
                onClick={() => navigate('/admin/users')}
                className={getAdminLinkClass('/admin/users')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Management
              </button>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-[8px] font-black tracking-[0.2em] text-neutral-500 block mb-2 uppercase px-3">History & Activity</span>
            <button 
              onClick={() => {
                if (location.pathname === '/') {
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                } else {
                  navigate('/');
                }
              }}
              className={getActionLinkClass()}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Continue Watching
            </button>

            <button 
              onClick={() => navigate('/history')}
              className={getLinkClass('/history')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Watch History
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-[8px] font-black tracking-[0.2em] text-neutral-500 block mb-2 uppercase px-3">Account Space</span>
            <button 
              onClick={() => navigate('/settings')}
              className={getLinkClass('/settings')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
              Settings
            </button>
            <button 
              onClick={() => navigate('/subscription')}
              className={getLinkClass('/subscription')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Subscription
            </button>
          </div>
        </nav>
      </div>
      
      {/* Footer */}
      <div className="pt-4 border-t border-white/5 text-center text-[9px] text-neutral-500 font-sans space-y-1 select-none">
        <div>ZePlay Platform</div>
        <div>
          <a 
            href="https://www.zeploy.tech" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-brand-accent hover:underline font-extrabold tracking-widest uppercase hover:text-blue-450 transition-colors"
          >
            ZEPLOY TECH
          </a>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
