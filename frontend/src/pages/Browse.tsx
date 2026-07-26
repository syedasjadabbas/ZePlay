import React, { useEffect, useState } from 'react';
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
}

const Browse: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedYearRange, setSelectedYearRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'title' | 'year_desc' | 'year_asc'>('relevance');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [profileName] = useState(() => localStorage.getItem('selectedProfileName') || 'User');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
      return;
    }
  }, [activeProfileId, navigate]);

  const fetchCatalogData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [genres, movies] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: QUERY_KEYS.genres,
          queryFn: () => api.get('/catalog/genres').then(r => r.data),
          staleTime: 10 * 60 * 1000,
        }).catch(() => []),
        queryClient.fetchQuery({
          queryKey: QUERY_KEYS.movies,
          queryFn: () => api.get('/catalog/movies').then(r => r.data),
          staleTime: 5 * 60 * 1000,
        }),
      ]);
      setGenres(genres || []);
      setMovies(movies || []);
    } catch (err: any) {
      setError("Failed to load catalog. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData();
  }, []);

  // Filter & Sort Logic
  const filteredMovies = movies.filter(movie => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = movie.title.toLowerCase().includes(q);
      const descMatch = movie.description.toLowerCase().includes(q);
      const genreMatch = movie.genres.some(g => g.name.toLowerCase().includes(q));
      if (!titleMatch && !descMatch && !genreMatch) return false;
    }

    // Genre filter
    if (selectedGenre) {
      const hasGenre = movie.genres.some(g => g.name === selectedGenre);
      if (!hasGenre) return false;
    }

    // Year filter
    if (selectedYearRange === '2020s') {
      if (movie.release_year < 2020) return false;
    } else if (selectedYearRange === '2010s') {
      if (movie.release_year < 2010 || movie.release_year > 2019) return false;
    } else if (selectedYearRange === 'classic') {
      if (movie.release_year >= 2010) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    } else if (sortBy === 'year_desc') {
      return b.release_year - a.release_year;
    } else if (sortBy === 'year_asc') {
      return a.release_year - b.release_year;
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-0 md:ml-56 flex flex-col justify-between min-h-screen pb-20 md:pb-0">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-4 sm:px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-10">
          {/* Header & Title */}
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase mt-2">
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
                placeholder="Search catalog titles, descriptions, or genres..."
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
            <div className="space-y-2">
              <span className="text-[11px] font-black text-neutral-450 uppercase tracking-widest block">
                Filter by Genre
              </span>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedGenre(null)}
                  className={`px-5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    !selectedGenre 
                      ? 'bg-brand-accent text-white font-black' 
                      : 'bg-black/30 text-brand-textMuted hover:bg-black/50 hover:text-white'
                  }`}
                >
                  All Genres
                </button>
                {genres.map(g => (
                  <button
                    key={g.genre_id}
                    onClick={() => setSelectedGenre(g.name)}
                    className={`px-5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      selectedGenre === g.name 
                        ? 'bg-brand-accent text-white font-black' 
                        : 'bg-black/30 text-brand-textMuted hover:bg-black/50 hover:text-white'
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
                  onChange={(e) => setSelectedYearRange(e.target.value)}
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
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-black/40 border border-white/10 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-accent font-medium cursor-pointer"
                >
                  <option value="relevance">Default Catalog Order</option>
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
              onRetry={fetchCatalogData}
            />
          ) : filteredMovies.length === 0 ? (
            <EmptyState
              title="No Movies Match Your Criteria"
              description="Try adjusting your search query, clearing genre filters, or choosing a different release era option."
              actionText="Reset All Filters"
              onAction={() => {
                setSelectedGenre(null);
                setSelectedYearRange('all');
                setSearchQuery('');
                setSortBy('relevance');
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-brand-textMuted font-semibold px-1">
                <span>Showing {filteredMovies.length} catalog results</span>
                {selectedGenre && <span className="text-brand-accent">Genre: {selectedGenre}</span>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {filteredMovies.map((movie) => (
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
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Browse;
