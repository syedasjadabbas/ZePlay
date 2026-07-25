import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
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

const SearchResults: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTerm = searchParams.get('q') || '';
  const selectedGenre = searchParams.get('genre') || '';
  const sortBy = searchParams.get('sort_by') || 'relevance';

  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
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

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const res = await api.get('/catalog/genres');
        setGenres(res.data);
      } catch (e) {
        // genres are non-critical, silently fail
      }
    };
    fetchGenres();
  }, []);

  const fetchSearchResults = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (queryTerm) params.append('q', queryTerm);
      if (selectedGenre) params.append('genre', selectedGenre);
      if (sortBy) params.append('sort_by', sortBy);

      const response = await api.get(`/catalog/search?${params.toString()}`, { signal });
      setMovies(response.data);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.detail || "Failed to load search results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSearchResults(controller.signal);
    return () => controller.abort();
  }, [queryTerm, selectedGenre, sortBy]);

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

      <div className="flex-1 ml-56 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase mt-2">
                {queryTerm ? `Results for "${queryTerm}"` : 'All Catalog Titles'}
              </h1>
              <p className="text-xs text-brand-textMuted font-medium mt-1">
                Showing {movies.length} {movies.length === 1 ? 'match' : 'matches'} across catalog titles, descriptions, genres, and release years.
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
              onRetry={() => fetchSearchResults()}
            />
          ) : movies.length === 0 ? (
            <EmptyState
              title="No Catalog Titles Found"
              description={`No matching movies found for "${queryTerm}". Try searching for titles like "Interstellar" or "Shaidai".`}
              actionText="Clear Search & View All Movies"
              onAction={() => setSearchParams({})}
            />
          ) : (
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
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default SearchResults;
