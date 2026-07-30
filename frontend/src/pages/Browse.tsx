import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { queryClient, QUERY_KEYS } from '../services/queryClient';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MovieCardVertical from '../components/MovieCardVertical';
import Footer from '../components/Footer';
import { MovieCardSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

interface Genre {
  genre_id: string;
  name: string;
}

interface Movie {
  movie_id: string;
  title: string;
  description: string;
  release_year: number;
  duration_minutes: number;
  thumbnail_url: string;
  video_url: string;
  genres: Genre[];
  average_rating?: number;
  is_generated?: boolean;
}

const PAGE_SIZE = 40;

const Browse: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedYearRange, setSelectedYearRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'year_desc' | 'year_asc'>('title');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [profileName] = useState(() => localStorage.getItem('selectedProfileName') || 'User');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  // Abort controller ref to cancel stale requests when filters change
  const abortRef = useRef<AbortController | null>(null);
  // Debounce timer for search input
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track current filter signature to prevent stale load-more
  const filterSigRef = useRef<string>('');

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
    }
  }, [activeProfileId, navigate]);

  // Load genres once (cached via queryClient across page navigations)
  useEffect(() => {
    queryClient.fetchQuery({
      queryKey: QUERY_KEYS.genres,
      queryFn: () => api.get('/catalog/genres').then(r => r.data || []),
      staleTime: 30 * 60 * 1000,
    }).then(setGenres).catch(() => {});
  }, []);

  const buildParams = useCallback((currentOffset: number) => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(currentOffset));
    if (selectedGenre) params.set('genre', selectedGenre);
    if (selectedYearRange !== 'all') params.set('year_range', selectedYearRange);
    params.set('sort_by', sortBy);
    return params;
  }, [selectedGenre, selectedYearRange, sortBy]);

  const filterSig = useCallback(() =>
    `${selectedGenre || ''}|${selectedYearRange}|${sortBy}|${searchQuery}`,
    [selectedGenre, selectedYearRange, sortBy, searchQuery]
  );

  // Fetch first page whenever filters change
  const fetchFirstPage = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setMovies([]);
    setOffset(0);
    setHasMore(true);

    try {
      let url: string;
      let params: URLSearchParams;

      if (searchQuery.trim()) {
        params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', '0');
        params.set('q', searchQuery.trim());
        if (selectedGenre) params.set('genre', selectedGenre);
        if (selectedYearRange !== 'all') params.set('year_range', selectedYearRange);
        params.set('sort_by', sortBy);
        url = `/catalog/search?${params}`;
      } else {
        params = buildParams(0);
        url = `/catalog/movies?${params}`;
      }

      const res = await api.get(url, { signal });
      const data: Movie[] = res.data || [];
      setMovies(data);
      setOffset(data.length);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError('Failed to load catalog. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedGenre, selectedYearRange, sortBy, buildParams]);

  // When filters change: cancel in-flight request, debounce search, reload
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const sig = filterSig();
    filterSigRef.current = sig;

    if (searchQuery.trim()) {
      // Debounce search input by 350ms
      searchTimerRef.current = setTimeout(() => {
        fetchFirstPage(abortRef.current!.signal);
      }, 350);
    } else {
      fetchFirstPage(abortRef.current!.signal);
    }

    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [selectedGenre, selectedYearRange, sortBy, searchQuery, fetchFirstPage, filterSig]);

  // Load More — appends next page to existing list
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const currentSig = filterSig();
    setLoadingMore(true);

    try {
      let url: string;

      if (searchQuery.trim()) {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(offset));
        params.set('q', searchQuery.trim());
        if (selectedGenre) params.set('genre', selectedGenre);
        if (selectedYearRange !== 'all') params.set('year_range', selectedYearRange);
        params.set('sort_by', sortBy);
        url = `/catalog/search?${params}`;
      } else {
        const params = buildParams(offset);
        url = `/catalog/movies?${params}`;
      }

      const res = await api.get(url);
      const data: Movie[] = res.data || [];

      // Only append if filters haven't changed during the request
      if (filterSigRef.current === currentSig) {
        setMovies(prev => {
          // Deduplicate by movie_id
          const existingIds = new Set(prev.map(m => m.movie_id));
          const newItems = data.filter(m => !existingIds.has(m.movie_id));
          return [...prev, ...newItems];
        });
        setOffset(prev => prev + data.length);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err: any) {
      // Silent fail for Load More — user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const handleGenreChange = (genre: string | null) => {
    setSelectedGenre(genre);
  };

  const handleYearChange = (year: string) => {
    setSelectedYearRange(year);
  };

  const handleSortChange = (sort: 'title' | 'year_desc' | 'year_asc') => {
    setSortBy(sort);
  };

  const handleResetFilters = () => {
    setSelectedGenre(null);
    setSelectedYearRange('all');
    setSortBy('title');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-0 md:ml-56 flex flex-col justify-between min-h-screen pb-20 md:pb-0">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-4 sm:px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-10">
          {/* Header & Title */}
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase">
              Browse Movies
            </h1>
            <p className="text-xs text-brand-textMuted font-medium mt-1">
              Explore our full streaming catalog by genre, release year, title, and interactive filters.
            </p>
          </div>

          {/* Discovery Controls Bar: Search, Genres, Year, Sort */}
          <div className="bg-neutral-900/50 backdrop-blur-md p-6 rounded-xl space-y-6">
            {/* Search Input */}
            <div className="relative">
              <input
                id="browse-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog titles or genres..."
                aria-label="Search the catalog"
                autoComplete="off"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-5 py-3.5 pl-12 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-accent/60 transition-all"
              />
              <svg className="w-5 h-5 text-neutral-400 absolute left-4 top-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-3.5 text-xs text-neutral-400 hover:text-white bg-white/10 px-2 py-1 rounded-lg transition-all active:scale-95"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Genre Pills */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-black text-neutral-400 uppercase tracking-widest block">
                Filter by Genre
              </span>
              <div className="flex flex-wrap gap-2 sm:gap-2.5 items-center">
                <button
                  onClick={() => handleGenreChange(null)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    !selectedGenre
                      ? 'bg-brand-accent text-white font-black shadow-md'
                      : 'bg-black/40 text-neutral-300 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  All Genres
                </button>
                {genres.map(g => (
                  <button
                    key={g.genre_id}
                    onClick={() => handleGenreChange(g.name)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedGenre === g.name
                        ? 'bg-brand-accent text-white font-black shadow-md'
                        : 'bg-black/40 text-neutral-300 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Filters: Year & Sorting */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              {/* Year Selector */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <span className="text-xs font-semibold text-neutral-400">Release Era:</span>
                <select
                  value={selectedYearRange}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="bg-black/40 border border-white/10 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-accent font-medium cursor-pointer"
                >
                  <option value="all">All Release Years</option>
                  <option value="2020s">2020s & Newer</option>
                  <option value="2010s">2010s Era</option>
                  <option value="classic">Classics (Pre-2010)</option>
                </select>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <span className="text-xs font-semibold text-neutral-400">Sort By:</span>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as any)}
                  className="bg-black/40 border border-white/10 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-accent font-medium cursor-pointer"
                >
                  <option value="title">Title (A-Z)</option>
                  <option value="year_desc">Release Year (Newest First)</option>
                  <option value="year_asc">Release Year (Oldest First)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Full Catalog Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-fadeIn">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <MovieCardSkeleton key={i} aspect="vertical" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Catalog Unavailable"
              message={error}
              onRetry={() => fetchFirstPage()}
            />
          ) : movies.length === 0 ? (
            <EmptyState
              title="No Movies Match Your Criteria"
              description="Try adjusting your search query, clearing genre filters, or choosing a different release era option."
              actionText="Reset All Filters"
              onAction={handleResetFilters}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-brand-textMuted font-semibold px-1">
                <span>
                  Showing {movies.length} catalog results
                  {hasMore ? ' — scroll for more' : ''}
                </span>
                {selectedGenre && <span className="text-brand-accent">Genre: {selectedGenre}</span>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {movies.map((movie) => (
                  <MovieCardVertical
                    key={movie.movie_id}
                    movie_id={movie.movie_id}
                    title={movie.title}
                    thumbnail_url={movie.thumbnail_url}
                    release_year={movie.release_year}
                    duration_minutes={movie.duration_minutes}
                    genres={movie.genres || []}
                  />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-6">
                  <button
                    id="browse-load-more"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-10 py-3 rounded-xl text-sm font-black bg-white/8 border border-white/10 text-white hover:bg-white/15 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}

              {!hasMore && movies.length > PAGE_SIZE && (
                <p className="text-center text-xs text-neutral-500 pt-4 font-medium">
                  All {movies.length} results loaded
                </p>
              )}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Browse;
