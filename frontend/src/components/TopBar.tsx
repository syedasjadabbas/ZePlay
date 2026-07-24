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

const getAvatarClasses = (avatarUrl: string | null) => {
  const found = PRESET_AVATARS.find(p => p.id === avatarUrl);
  return found ? found.classes : 'from-indigo-600 via-purple-600 to-pink-500';
};

const TopBar: React.FC<TopBarProps> = ({ profileName, profileAvatar }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

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
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const saveRecentSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    try {
      const existing = recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...existing].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem(recentStorageKey, JSON.stringify(updated));
    } catch {}
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
    <header className="fixed top-0 left-56 right-0 z-20 bg-[#080c12]/80 backdrop-blur-xl py-3.5 px-8 flex justify-between items-center">
      {/* Search */}
      <div ref={containerRef} className="relative w-full max-w-xl">
        <form onSubmit={handleSearchSubmit} className="relative">
          <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { setIsFocused(true); setShowDropdown(true); }}
            placeholder="Search titles, genres, years..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.05] text-white rounded-xl text-sm focus:outline-none placeholder:text-neutral-600 caret-white transition-colors duration-200 focus:bg-white/[0.08]"
          />
        </form>

        {/* Dropdown */}
        {showDropdown && isFocused && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#0d1117] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden z-50 animate-scaleIn">
            {query.trim() && suggestions.length > 0 && (
              <div className="p-2">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600 px-3 py-2">Results</div>
                {suggestions.map((m) => (
                  <div
                    key={m.movie_id}
                    onClick={() => handleSelectSuggestion(m)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group"
                  >
                    <img
                      src={m.thumbnail_url}
                      alt={m.title}
                      className="w-9 h-9 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.title}</p>
                      <p className="text-xs text-neutral-500">
                        {m.release_year}{m.genres?.length > 0 ? ` · ${m.genres.map(g => g.name).join(', ')}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recentSearches.length > 0 && (
              <div className="p-2 border-t border-white/5">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">Recent</span>
                  <button onClick={clearRecentSearches} className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer">Clear</button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectRecent(term)}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-xs text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!query.trim() && recentSearches.length === 0 && (
              <div className="p-4 text-center text-xs text-neutral-600">
                Search for titles, genres, or release years
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
