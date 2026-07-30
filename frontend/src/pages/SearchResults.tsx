import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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

const SearchResults: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTerm = searchParams.get('q') || '';
  const selectedGenre = searchParams.get('genre') || '';
  const sortBy = searchParams.get('sort_by') || 'relevance';

  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [profileName] = useState(() => localStorage.getItem('selectedProfileName') || 'User');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');
  const abortRef = useRef<AbortController | null>(null);
  // Track filter signature to prevent stale load-more appends
  const filterSigRef = useRef<string>('');

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
      return;
    }
  }, [activeProfileId, navigate]);

  useEffect(() => {
    queryClient.fetchQuery({
      queryKey: QUERY_KEYS.genres,
      queryFn: () => api.get('/catalog/genres').then(r => r.data || []),
      staleTime: 30 * 60 * 1000,
    }).then(setGenres).catch(() => {});
  }, []);

  const buildParams = (currentOffset: number) => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(currentOffset));
    if (queryTerm) params.set('q', queryTerm);
    if (selectedGenre) params.set('genre', selectedGenre);
    if (sortBy) params.set('sort_by', sortBy);
    return params;
  };

  const fetchFirstPage = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setMovies([]);
    setOffset(0);
    setHasMore(false);
    filterSigRef.current = `${queryTerm}|${selectedGenre}|${sortBy}`;

    try {
      const params = buildParams(0);
      const response = await api.get(`/catalog/search?${params}`, { signal });
      const data: Movie[] = response.data || [];
      setMovies(data);
      setOffset(data.length);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.detail || 'Failed to load search results.');
    } finally {
      setLoading(false);
    }
  }, [queryTerm, selectedGenre, sortBy]);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    fetchFirstPage(abortRef.current.signal);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [queryTerm, selectedGenre, sortBy]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const snapSig = filterSigRef.current;
    setLoadingMore(true);

    try {
      const params = buildParams(offset);
      const response = await api.get(`/catalog/search?${params}`);
      const data: Movie[] = response.data || [];

      if (filterSigRef.current === snapSig) {
        setMovies(prev => {
          const existingIds = new Set(prev.map(m => m.movie_id));
          const newItems = data.filter(m => !existingIds.has(m.movie_id));
          return [...prev, ...newItems];
        });
        setOffset(prev => prev + data.length);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch {
      // Silent fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const handleGenreSelect = (genreName: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (genreName) {
      newParams.set('genre', genreName);
    } else {
      newParams.delete('genre');
    }
    setSearchParams(newParams);
  };

  const handleSortChange = (newSort: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort_by', newSort);
    setSearchParams(newParams);
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-0 md:ml-56 flex flex-col justify-between min-h-screen pb-20 md:pb-0">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-4 sm:px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase">
                {queryTerm ? `Results for "${queryTerm}"` : 'All Catalog Titles'}
              </h1>
              <p className="text-xs text-brand-textMuted font-medium mt-1">
                {loading
                  ? 'Searching...'
                  : `Showing ${movies.length}${hasMore ? '+' : ''} ${movies.length === 1 ? 'match' : 'matches'} across catalog titles and genres.`
                }
              </p>
            </div>

            {/* Sort Control */}
            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="text-xs text-neutral-400 font-semibold">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="bg-black/40 text-white text-xs rounded-lg px-3 py-2.5 font-medium focus:outline-none cursor-pointer"
              >
                <option value="relevance">Relevance</option>
                <option value="year_desc">Newest Release</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>

          {/* Genre Filter Pills */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-neutral-450 uppercase tracking-widest">
              Filter by Category / Genre
            </h3>
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => handleGenreSelect(null)}
                className={`px-5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  !selectedGenre
                    ? 'bg-brand-accent text-white'
                    : 'bg-black/30 text-brand-textMuted hover:bg-black/50 hover:text-white'
                }`}
              >
                All Genres
              </button>
              {genres.map(g => (
                <button
                  key={g.genre_id}
                  onClick={() => handleGenreSelect(g.name)}
                  className={`px-5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    selectedGenre.toLowerCase() === g.name.toLowerCase()
                      ? 'bg-brand-accent text-white'
                      : 'bg-black/30 text-brand-textMuted hover:bg-black/50 hover:text-white'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Results Display */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-fadeIn">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <MovieCardSkeleton key={i} aspect="vertical" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Search Unavailable"
              message={error}
              onRetry={() => fetchFirstPage()}
            />
          ) : movies.length === 0 ? (
            <EmptyState
              title="No Catalog Titles Found"
              description={`No matching movies found for "${queryTerm}". Try searching for titles like "Interstellar" or "Shaidai".`}
              actionText="Clear Search & View All Movies"
              onAction={() => setSearchParams({})}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {movies.map(movie => (
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
                    id="search-load-more"
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
                    ) : 'Load More Results'}
                  </button>
                </div>
              )}

              {!hasMore && movies.length > PAGE_SIZE && (
                <p className="text-center text-xs text-neutral-500 pt-4 font-medium">
                  All {movies.length} matches loaded
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

export default SearchResults;
