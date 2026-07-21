import React from 'react';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  profileName: string;
}

const TopBar: React.FC<TopBarProps> = ({ profileName }) => {
  const navigate = useNavigate();
  const initial = profileName ? profileName.substring(0, 1).toUpperCase() : 'A';

  return (
    <header className="fixed top-0 left-64 right-0 z-20 bg-[#060B18]/70 backdrop-blur-md border-b border-white/5 py-4 px-8 md:px-12 flex justify-between items-center transition-all">
      {/* Large Dominant Search Input Box */}
      <div className="relative w-full max-w-2xl">
        <span className="absolute inset-y-0 left-4 flex items-center text-neutral-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input 
          type="text"
          placeholder="Search movies, shows..."
          disabled
          className="w-full pl-12 pr-16 py-3 bg-[#101C40] text-white border border-white/[0.08] backdrop-blur-md rounded-xl text-xs focus:outline-none select-none placeholder:text-white/50 shadow-lg shadow-black/20 caret-brand-accent"
        />
        {/* Inline shortcut badge */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg text-[9px] text-neutral-400 font-mono">
          ⌘ K
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-6 pl-4">
        {/* Notifications Trigger */}
        <button className="text-brand-textMuted hover:text-white relative transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full animate-pulse" />
        </button>

        {/* User Profile dropdown */}
        <div 
          onClick={() => navigate('/profiles')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-full bg-brand-accent text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-md shadow-blue-500/10">
            {initial}
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-brand-textMuted group-hover:text-white transition-colors font-display">
            {profileName}
          </span>
          <svg className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
