import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface TopBarProps {
  profileName: string;
  profileAvatar?: string;
}

interface SuggestionItem {
  movie_id: string;
  title: string;
  release_year: number;
  thumbnail_url: string;
  genres: { genre_id: string; name: string }[];
}

const TopBar: React.FC<TopBarProps> = ({ profileName, profileAvatar }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [planName, setPlanName] = useState<string>('free');
  
  const [localProfileName, setLocalProfileName] = useState(() => localStorage.getItem('selectedProfileName') || profileName || 'User');
  const [localProfileAvatar, setLocalProfileAvatar] = useState(() => localStorage.getItem('selectedProfileAvatar') || '🍿');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const activeProfileId = localStorage.getItem('selectedProfileId') || 'default';
  const recentStorageKey = `recentSearches_${activeProfileId}`;

  useEffect(() => {
    if (profileName) {
      setLocalProfileName(profileName);
    }
  }, [profileName]);

  useEffect(() => {
    if (profileAvatar) {
      setLocalProfileAvatar(profileAvatar);
    }
  }, [profileAvatar]);


  useEffect(() => {
    if (activeProfileId === 'default') return;

    const syncProfile = async () => {
      try {
        const response = await api.get('/profiles/');
        const activeProfile = response.data.find(
          (p: any) => p.profile_id === activeProfileId
        );
        if (activeProfile) {
          setLocalProfileName(activeProfile.display_name);
          setLocalProfileAvatar(activeProfile.avatar_url || '🍿');
          localStorage.setItem('selectedProfileName', activeProfile.display_name);
          localStorage.setItem('selectedProfileAvatar', activeProfile.avatar_url || '🍿');
        }
      } catch (err) {
        console.error("Failed to sync profile details in TopBar", err);
      }
    };

    syncProfile();

    // Fetch current subscription plan for badge
    api.get('/subscription/current')
      .then((res) => {
        const plan = (res.data?.status === 'active' && res.data?.plan?.name) ? res.data.plan.name : 'free';
        setPlanName(plan);
      })
      .catch(() => {});
  }, [activeProfileId]);


  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentStorageKey);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      setRecentSearches([]);
    }
  }, [recentStorageKey]);

  // Handle Cmd+K or Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search suggestions fetch
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/catalog/search/suggestions?q=${encodeURIComponent(query.trim())}`);
        setSuggestions(response.data);
        setShowDropdown(true);
      } catch (err) {
        console.error('Failed to fetch search suggestions', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const saveRecentSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    try {
      const existing = recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...existing].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem(recentStorageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save recent search', e);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    saveRecentSearch(query);
    setShowDropdown(false);
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const handleSelectSuggestion = (movie: SuggestionItem) => {
    saveRecentSearch(movie.title);
    setShowDropdown(false);
    navigate(`/movies/${movie.movie_id}`);
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    saveRecentSearch(term);
    setShowDropdown(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem(recentStorageKey);
  };

  return (
    <header className="fixed top-0 left-64 right-0 z-20 bg-brand-background/40 backdrop-blur-xl border-b border-white/5 py-4 px-8 md:px-12 flex justify-between items-center transition-all duration-350 ease-[var(--ease-out-premium)]">
      {/* Search Container */}
      <div ref={containerRef} className="relative w-full max-w-2xl">
        <form onSubmit={handleSearchSubmit} className="relative">
          <span className="absolute inset-y-0 left-4 flex items-center text-neutral-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setShowDropdown(true);
            }}
            placeholder="Search movies, descriptions, genres, release year..."
            className="w-full pl-12 pr-16 py-3.5 bg-brand-cards/40 text-white border border-white/10 focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/15 backdrop-blur-lg rounded-2xl text-xs focus:outline-none select-none placeholder:text-white/30 shadow-2xl caret-brand-accent input-premium transition-all duration-200"
          />
          {/* Keyboard shortcut hint badge */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg text-[9px] text-neutral-400 font-mono pointer-events-none">
            ⌘ K
          </div>
        </form>

        {/* Live Auto-Complete Suggestions & Recent Searches Dropdown */}
        {showDropdown && isFocused && (
          <div className="absolute left-0 right-0 top-full mt-3 bg-brand-surface/75 border border-white/8 backdrop-blur-3xl rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden z-50 divide-y divide-white/5 animate-scaleIn">
            {/* Live Movie Suggestions */}
            {query.trim() && suggestions.length > 0 && (
              <div className="p-4 space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent px-3 py-1 font-display">
                  Matching Suggestions
                </div>
                {suggestions.map((m) => (
                  <div
                    key={m.movie_id}
                    onClick={() => handleSelectSuggestion(m)}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 border border-transparent hover:border-white/5 rounded-2xl cursor-pointer transition-all duration-300 ease-[var(--ease-out-premium)] active:scale-[0.99] group"
                  >
                    <img 
                      src={m.thumbnail_url} 
                      alt={m.title} 
                      className="w-11 h-11 object-cover rounded-lg border border-white/10 group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors truncate">
                        {m.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-brand-textMuted mt-0.5">
                        <span className="font-bold text-brand-accent">{m.release_year}</span>
                        {m.genres && m.genres.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-450">{m.genres.map((g) => g.name).join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors duration-255" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between px-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 font-display">
                    Recent Searches
                  </span>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-[10px] text-neutral-500 hover:text-rose-400 font-bold transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 px-3">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectRecent(term)}
                      className="px-3.5 py-1.5 bg-white/5 hover:bg-brand-accent/15 border border-white/5 hover:border-brand-accent/20 text-xs text-neutral-300 hover:text-white rounded-xl transition-all flex items-center gap-2 select-none cursor-pointer active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Default prompt when input is empty & no recent searches */}
            {!query.trim() && recentSearches.length === 0 && (
              <div className="p-5 text-center text-xs text-neutral-500 italic font-medium">
                Type keywords to search title, description, genre, or release year...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-6 pl-4 select-none">
        <button className="text-brand-textMuted hover:text-white relative transition-all duration-200 active:scale-90">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </button>

        {/* Plan badge */}
        <button
          onClick={() => navigate('/subscription')}
          className={`hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all hover:opacity-90 active:scale-95 ${
            planName === 'premium'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
          }`}
        >
          {planName.toUpperCase()}
        </button>

        <div 
          onClick={() => navigate('/profiles')}
          className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-all duration-200"
        >
          {localProfileAvatar && ['😀', '😎', '🤖', '👽', '🦁', '🐼', '🐱', '🦊', '🐸', '🐵', '🦄', '🚀', '🎮', '🍿'].includes(localProfileAvatar) ? (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-950 border border-white/10 flex items-center justify-center text-xl shadow-md select-none group-hover:border-white/20 group-hover:shadow-[0_0_12px_rgba(255,255,255,0.08)] transition-all">
              {localProfileAvatar}
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-brand-accent text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-md shadow-blue-500/10 group-hover:shadow-blue-500/20 transition-all">
              {localProfileName ? localProfileName.substring(0, 1).toUpperCase() : 'U'}
            </div>
          )}
          <span className="hidden sm:inline text-sm font-semibold text-brand-textMuted group-hover:text-white transition-colors font-display">
            {localProfileName}
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
