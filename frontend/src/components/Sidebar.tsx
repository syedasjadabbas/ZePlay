import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 bg-[#081225] border-r border-white/5 flex flex-col h-screen fixed left-0 top-0 z-30 p-6">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={() => navigate('/')}>
        <span className="text-2xl font-black text-brand-accent tracking-wider font-display">
          ZePlay
        </span>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 space-y-6 overflow-y-auto pr-1 scrollbar-hide">
        <div className="space-y-1.5">
          <button 
            onClick={() => navigate('/')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 border ${
              isActive('/') 
                ? 'bg-brand-accent/18 text-brand-accent border-brand-accent/35 shadow-md shadow-blue-500/5' 
                : 'border-transparent text-brand-textMuted hover:bg-brand-cards/50 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>

          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Browse
          </button>

          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            My List
          </button>

          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Continue Watching
          </button>

          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Watch History
          </button>
        </div>

        <div className="border-t border-white/5 my-4" />

        <div className="space-y-1.5">
          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.9.135-.9.45 0l1.24 3.82a1 1 0 00.95.69h4.03c.95 0 1.34 1.22.58 1.8l-3.26 2.37a1 1 0 00-.364 1.118l1.24 3.82c.3.9-.74 1.66-1.528 1.118l-3.26-2.37a1 1 0 00-1.176 0l-3.26 2.37c-.78.54-1.83-.22-1.528-1.118l1.24-3.82a1 1 0 00-.364-1.118L2.05 9.237c-.76-.58-.37-1.8.58-1.8h4.03a1 1 0 00.95-.69l1.24-3.82z" />
            </svg>
            Top Rated
          </button>

          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
            New & Popular
          </button>
        </div>

        <div className="border-t border-white/5 my-4" />

        <div className="space-y-1.5 font-sans">
          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <button 
            className="w-full flex items-center gap-4 px-4 py-3 border border-transparent rounded-xl text-sm font-semibold text-brand-textMuted hover:bg-brand-cards/50 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Help & Support
          </button>
        </div>
      </nav>
      
      {/* Footer */}
      <div className="pt-4 border-t border-white/5 text-center text-[10px] text-neutral-600 font-sans">
        ZePlay Platform
      </div>
    </aside>
  );
};

export default Sidebar;
