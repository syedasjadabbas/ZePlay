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
      .then((res) => { if (res.data?.plan?.name) setPlanName(res.data.plan.name); })
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
    <header className="fixed top-0 left-64 right-0 z-20 bg-[#060B18]/80 backdrop-blur-md border-b border-white/5 py-4 px-8 md:px-12 flex justify-between items-center transition-all">
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
            className="w-full pl-12 pr-16 py-3 bg-[#101C40] text-white border border-white/[0.12] focus:border-brand-accent/60 backdrop-blur-md rounded-xl text-xs focus:outline-none select-none placeholder:text-white/40 shadow-lg shadow-black/20 caret-brand-accent transition-all"
          />
          {/* Keyboard shortcut hint badge */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg text-[9px] text-neutral-400 font-mono pointer-events-none">
            ⌘ K
          </div>
        </form>

        {/* Live Auto-Complete Suggestions & Recent Searches Dropdown */}
        {showDropdown && isFocused && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#0B1533]/95 border border-white/10 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5">
            {/* Live Movie Suggestions */}
            {query.trim() && suggestions.length > 0 && (
              <div className="p-3 space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent px-3 py-1">
                  Matching Suggestions
                </div>
                {suggestions.map((m) => (
                  <div
                    key={m.movie_id}
                    onClick={() => handleSelectSuggestion(m)}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-xl cursor-pointer transition-colors group"
                  >
                    <img 
                      src={m.thumbnail_url} 
                      alt={m.title} 
                      className="w-10 h-10 object-cover rounded-lg border border-white/10 group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors truncate">
                        {m.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-brand-textMuted">
                        <span>{m.release_year}</span>
                        {m.genres && m.genres.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-400">{m.genres.map((g) => g.name).join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-neutral-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                    Recent Searches
                  </span>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-[10px] text-neutral-500 hover:text-rose-400 font-medium transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pt-1">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectRecent(term)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-brand-accent/20 border border-white/10 hover:border-brand-accent/30 text-xs text-neutral-300 hover:text-white rounded-lg transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="p-5 text-center text-xs text-neutral-400">
                Type keywords to search title, description, genre, or release year...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-6 pl-4">
        <button className="text-brand-textMuted hover:text-white relative transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full animate-pulse" />
        </button>

        {/* Plan badge */}
        <button
          onClick={() => navigate('/subscription')}
          className={`hidden sm:inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border transition-all hover:scale-105 ${
            planName === 'premium'
              ? 'bg-amber-500/15 border-amber-400/40 text-amber-300 hover:bg-amber-500/25'
              : 'bg-blue-500/10 border-blue-400/25 text-blue-300 hover:bg-blue-500/20'
          }`}
        >
          {planName === 'premium' && (
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
          {planName.toUpperCase()}
        </button>

        <div 
          onClick={() => navigate('/profiles')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {localProfileAvatar && ['😀', '😎', '🤖', '👽', '🦁', '🐼', '🐱', '🦊', '🐸', '🐵', '🦄', '🚀', '🎮', '🍿'].includes(localProfileAvatar) ? (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-850 to-neutral-950 border border-white/5 flex items-center justify-center text-xl shadow-md select-none">
              {localProfileAvatar}
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-brand-accent text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-md shadow-blue-500/10">
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
