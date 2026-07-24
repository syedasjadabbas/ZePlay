import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { getToken } from '../services/api';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.is_admin) setIsAdmin(true);
      } catch (e) {}
    }

    const token = getToken();
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data?.is_admin) {
            setIsAdmin(true);
            localStorage.setItem('user', JSON.stringify(res.data));
          } else {
            setIsAdmin(false);
          }
        })
        .catch(() => {});
    }
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const getLinkClass = (path: string) => {
    const active = isActive(path);
    return `w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
      active
        ? 'bg-white/8 text-white font-semibold'
        : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04] font-medium'
    }`;
  };

  const getAdminLinkClass = (path: string) => {
    const active = isActive(path) || (path === '/admin/upload' && location.pathname === '/admin');
    return `w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
      active
        ? 'bg-amber-500/10 text-amber-300 font-semibold'
        : 'text-amber-600/60 hover:text-amber-400 hover:bg-amber-500/5 font-medium'
    }`;
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#080c12] flex flex-col justify-between z-30 py-8 px-4">
      {/* Brand */}
      <div className="space-y-8">
        <div className="px-3 cursor-pointer select-none" onClick={() => navigate('/')}>
          <span className="text-lg font-black tracking-[0.08em] text-white font-display uppercase">
            ZePlay
          </span>
        </div>

        {/* Navigation */}
        <nav className="space-y-6 overflow-y-auto scrollbar-hide">
          <div className="space-y-0.5">
            <span className="text-[9px] font-semibold tracking-widest text-neutral-700 block mb-2 uppercase px-3">Discover</span>
            <button onClick={() => navigate('/')} className={getLinkClass('/')}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive('/') ? 2.5 : 1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>

            <button onClick={() => navigate('/browse')} className={getLinkClass('/browse')}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive('/browse') ? 2.5 : 1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse
            </button>

            <button onClick={() => navigate('/my-list')} className={getLinkClass('/my-list')}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive('/my-list') ? 2.5 : 1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              My List
            </button>
          </div>

          {isAdmin && (
            <div className="space-y-0.5">
              <span className="text-[9px] font-semibold tracking-widest text-amber-700/60 block mb-2 uppercase px-3">Studio</span>
              <button onClick={() => navigate('/admin/upload')} className={getAdminLinkClass('/admin/upload')}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Catalog
              </button>

              <button onClick={() => navigate('/admin/users')} className={getAdminLinkClass('/admin/users')}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Users
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            <span className="text-[9px] font-semibold tracking-widest text-neutral-700 block mb-2 uppercase px-3">Library</span>
            <button onClick={() => navigate('/history')} className={getLinkClass('/history')}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive('/history') ? 2.5 : 1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Watch History
            </button>
          </div>

          <div className="space-y-0.5">
            <span className="text-[9px] font-semibold tracking-widest text-neutral-700 block mb-2 uppercase px-3">Account</span>
            <button onClick={() => navigate('/settings')} className={getLinkClass('/settings')}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive('/settings') ? 2.5 : 1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
              Settings
            </button>
            <button onClick={() => navigate('/subscription')} className={getLinkClass('/subscription')}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive('/subscription') ? 2.5 : 1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Plans
            </button>
          </div>
        </nav>
      </div>

      {/* Footer */}
      <div className="px-3 text-[9px] text-neutral-700 select-none">
        ZePlay · <a href="https://www.zeploy.tech" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-500 transition-colors">Zeploy Tech</a>
      </div>
    </aside>
  );
};

export default Sidebar;
