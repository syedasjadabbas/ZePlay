import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const PRESET_AVATARS = [
  { id: 'grad-nebula', classes: 'from-indigo-600 via-purple-600 to-pink-500' },
  { id: 'grad-sunfire', classes: 'from-amber-500 via-red-500 to-rose-600' },
  { id: 'grad-ocean', classes: 'from-blue-600 via-indigo-700 to-teal-500' },
  { id: 'grad-cyberpunk', classes: 'from-fuchsia-600 via-violet-600 to-cyan-500' },
  { id: 'grad-jade', classes: 'from-emerald-500 via-teal-600 to-cyan-600' },
  { id: 'grad-gold', classes: 'from-yellow-500 via-amber-500 to-orange-600' },
  { id: 'grad-velvet', classes: 'from-neutral-700 via-neutral-800 to-neutral-900' },
  { id: 'grad-aurora', classes: 'from-rose-400 via-pink-400 to-indigo-400' }
];

const TRENDING_SEARCHES = [
  'Action', 'Thriller', 'Sci-Fi', 'Drama', 'Comedy', 'Horror', 'Documentary', 'Animation'
];

const getAvatarClasses = (avatarUrl: string | null) => {
  const found = PRESET_AVATARS.find(p => p.id === avatarUrl);
  return found ? found.classes : 'from-indigo-600 via-purple-600 to-pink-500';
};

/** Highlight matching text segments */
const HighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-transparent text-brand-accent font-bold">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const TopBar: React.FC<TopBarProps> = ({ profileName, profileAvatar }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [localProfileName, setLocalProfileName] = useState(() => localStorage.getItem('selectedProfileName') || profileName || 'User');
  const [localProfileAvatar, setLocalProfileAvatar] = useState(() => localStorage.getItem('selectedProfileAvatar') || 'grad-nebula');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProfileId = localStorage.getItem('selectedProfileId') || 'default';
  const recentStorageKey = `recentSearches_${activeProfileId}`;

  useEffect(() => {
    if (profileName) setLocalProfileName(profileName);
  }, [profileName]);

  useEffect(() => {
    if (profileAvatar) setLocalProfileAvatar(profileAvatar);
  }, [profileAvatar]);

  useEffect(() => {
    if (activeProfileId === 'default') return;
    api.get('/profiles/')
      .then((response) => {
        const activeProfile = response.data.find((p: any) => p.profile_id === activeProfileId);
        if (activeProfile) {
          setLocalProfileName(activeProfile.display_name);
          setLocalProfileAvatar(activeProfile.avatar_url || 'grad-nebula');
          localStorage.setItem('selectedProfileName', activeProfile.display_name);
          localStorage.setItem('selectedProfileAvatar', activeProfile.avatar_url || 'grad-nebula');
        }
      })
      .catch(() => {});
  }, [activeProfileId]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentStorageKey);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {
      setRecentSearches([]);
    }
  }, [recentStorageKey]);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search with loading state
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsSearchLoading(false);
      setHasSearched(false);
      return;
    }
    setIsSearchLoading(true);
    setHasSearched(false);
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/catalog/search/suggestions?q=${encodeURIComponent(query.trim())}`);
        setSuggestions(response.data || []);
        setShowDropdown(true);
        setHasSearched(true);
      } catch {
        setSuggestions([]);
        setHasSearched(true);
      } finally {
        setIsSearchLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [suggestions]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
      } else {
        handleSearchSubmit(e as any);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      searchInputRef.current?.blur();
    }
  };

  const saveRecentSearch = useCallback((searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    try {
      const existing = recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...existing].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem(recentStorageKey, JSON.stringify(updated));
    } catch {}
  }, [recentSearches, recentStorageKey]);

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

  const handleSelectTrending = (term: string) => {
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

  const showEmpty = !query.trim() && isFocused;
  const showSkeleton = isSearchLoading && query.trim();
  const showResults = !isSearchLoading && hasSearched && query.trim() && suggestions.length > 0;
  const showNoResults = !isSearchLoading && hasSearched && query.trim() && suggestions.length === 0;

  return (
    <header className="fixed top-0 left-56 right-0 z-20 bg-[#080c12]/80 backdrop-blur-xl py-3.5 px-8 flex justify-between items-center">
      {/* Search */}
      <div ref={containerRef} className="relative w-full max-w-xl">
        <form onSubmit={handleSearchSubmit} className="relative">
          <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            {isSearchLoading ? (
              <span className="w-4 h-4 border-2 border-neutral-500 border-t-brand-accent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </span>
          <input
            ref={searchInputRef}
            id="topbar-search"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHasSearched(false); }}
            onFocus={() => { setIsFocused(true); setShowDropdown(true); }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search titles, genres, years..."
            autoComplete="off"
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.05] text-white rounded-lg text-sm focus:outline-none placeholder:text-neutral-600 caret-white transition-colors duration-200 focus:bg-white/[0.08]"
          />
        </form>

        {/* Dropdown */}
        {showDropdown && isFocused && (
          <div
            className="absolute left-0 right-0 top-full mt-2 bg-[#141414] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden z-50 border border-white/5"
            style={{
              animation: 'scaleIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            {/* Loading skeleton */}
            {showSkeleton && (
              <div className="p-3 space-y-2.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 px-2 py-1">
                    <div className="w-9 h-9 rounded-lg bg-neutral-800 animate-shimmer flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 bg-neutral-800 animate-shimmer rounded" />
                      <div className="h-2 w-1/2 bg-neutral-800 animate-shimmer rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search results with highlight */}
            {showResults && (
              <div className="p-2">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-500 px-3 py-2">Results</div>
                {suggestions.map((m, idx) => (
                  <div
                    key={m.movie_id}
                    onClick={() => handleSelectSuggestion(m)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${
                      idx === activeSuggestionIndex ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-neutral-300 hover:text-white'
                    }`}
                    style={{ transition: 'background-color 0.15s ease' }}
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-800">
                      {m.thumbnail_url && (
                        <img
                          src={m.thumbnail_url}
                          alt={m.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        <HighlightText text={m.title} query={query} />
                      </p>
                      <p className="text-xs text-neutral-500">
                        {m.release_year}{m.genres?.length > 0 ? ` · ${m.genres.map(g => g.name).join(', ')}` : ''}
                      </p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            {/* No results illustration */}
            {showNoResults && (
              <div className="p-8 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-300">No results for "{query}"</p>
                  <p className="text-xs text-neutral-600 mt-0.5">Try a different title, genre, or year</p>
                </div>
              </div>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className={`p-2 ${(showResults || showNoResults) ? 'border-t border-white/5' : ''}`}>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recent
                  </span>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[10px] text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectRecent(term)}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-xs text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      style={{ transition: 'background-color 0.15s ease, color 0.15s ease' }}
                    >
                      <svg className="w-2.5 h-2.5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending searches (shown when input is empty) */}
            {showEmpty && recentSearches.length === 0 && (
              <div className="p-2">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-500 px-3 py-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Trending
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {TRENDING_SEARCHES.map(term => (
                    <button
                      key={term}
                      onClick={() => handleSelectTrending(term)}
                      className="px-3 py-1 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/20 text-xs text-brand-accent hover:text-white rounded-lg transition-all cursor-pointer"
                      style={{ transition: 'background-color 0.15s ease, color 0.15s ease' }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending when there's recent searches + input is empty */}
            {showEmpty && recentSearches.length > 0 && (
              <div className="p-2 border-t border-white/5">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-500 px-3 py-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Trending
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {TRENDING_SEARCHES.slice(0, 5).map(term => (
                    <button
                      key={term}
                      onClick={() => handleSelectTrending(term)}
                      className="px-3 py-1 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/20 text-xs text-brand-accent hover:text-white rounded-lg transition-all cursor-pointer"
                      style={{ transition: 'background-color 0.15s ease, color 0.15s ease' }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="flex items-center gap-4 pl-6 select-none">
        <div
          onClick={() => navigate('/profiles')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarClasses(localProfileAvatar)} flex items-center justify-center text-xs font-bold text-white select-none`}>
            {localProfileName ? localProfileName.substring(0, 1).toUpperCase() : 'U'}
          </div>
          <span className="hidden sm:inline text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">
            {localProfileName}
          </span>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
