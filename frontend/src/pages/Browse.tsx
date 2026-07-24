import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MovieCardVertical from '../components/MovieCardVertical';

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
      const [genresRes, moviesRes] = await Promise.all([
        api.get('/catalog/genres').catch(() => ({ data: [] })),
        api.get('/catalog/movies').catch(() => ({ data: [] }))
      ]);

      setGenres(genresRes.data || []);
      setMovies(moviesRes.data || []);
    } catch (err) {
      console.error("Failed to fetch catalog data.", err);
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

      <div className="flex-1 ml-56 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-10">
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
          <div className="bg-neutral-900/50 backdrop-blur-md p-6 rounded-3xl space-y-6">
            {/* Search Input */}
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog titles, descriptions, or genres..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 pl-12 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-accent/60 transition-all input-premium"
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
                  className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
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
                    className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
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
                  className="bg-black/40 border border-white/10 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-accent font-medium input-premium cursor-pointer"
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
                  className="bg-black/40 border border-white/10 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-accent font-medium input-premium cursor-pointer"
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
            <div className="h-[40vh] flex items-center justify-center">
              <div className="text-sm font-medium text-neutral-400 animate-pulse">Loading catalog grid...</div>
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="text-center py-20 bg-brand-surface rounded-3xl p-12 space-y-4">
              <svg className="w-16 h-16 text-neutral-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-bold text-white">No Movies Match Your Criteria</h3>
              <p className="text-xs text-brand-textMuted max-w-md mx-auto">
                Try adjusting your search query, clearing genre filters, or choosing a different release era option.
              </p>
              <button 
                onClick={() => {
                  setSelectedGenre(null);
                  setSelectedYearRange('all');
                  setSearchQuery('');
                  setSortBy('relevance');
                }}
                className="px-6 py-2.5 bg-brand-accent hover:bg-blue-600 text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                Reset All Filters
              </button>
            </div>
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
                    ratingScore={movie.average_rating}
                  />
                ))}
              </div>
            </div>
          )}
        </main>

        <footer className="p-6 text-center text-xs text-neutral-600 bg-[#081225]/40 backdrop-blur-sm">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default Browse;
