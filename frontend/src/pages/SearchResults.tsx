import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
        console.error('Failed to fetch genres', e);
      }
    };
    fetchGenres();
  }, []);

  const fetchSearchResults = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (queryTerm) params.append('q', queryTerm);
      if (selectedGenre) params.append('genre', selectedGenre);
      if (sortBy) params.append('sort_by', sortBy);

      const response = await api.get(`/catalog/search?${params.toString()}`);
      setMovies(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load search results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearchResults();
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
                className="bg-black/40 text-white text-xs rounded-xl px-3 py-2.5 font-medium focus:outline-none cursor-pointer"
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
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
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
                  className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
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
            <div className="h-[40vh] flex items-center justify-center">
              <div className="text-sm text-neutral-400 animate-pulse font-medium">
                Searching catalog...
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-brand-surface rounded-2xl">
              <p className="text-rose-400 font-semibold mb-2">{error}</p>
              <button 
                onClick={fetchSearchResults}
                className="px-4 py-2 bg-brand-accent hover:bg-blue-600 text-xs font-bold rounded-xl"
              >
                Retry Search
              </button>
            </div>
          ) : movies.length === 0 ? (
            <div className="text-center py-20 bg-brand-surface rounded-3xl p-12 space-y-4">
              <svg className="w-16 h-16 text-neutral-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-bold text-white">No Catalog Titles Found</h3>
              <p className="text-xs text-brand-textMuted max-w-md mx-auto">
                No matching movies found for "{queryTerm}". Try searching for keywords like "Interstellar", "Sci-Fi", or "2024".
              </p>
              <button 
                onClick={() => {
                  setSearchParams({});
                }}
                className="px-6 py-2.5 bg-brand-accent hover:bg-blue-600 text-xs font-bold rounded-xl transition-all"
              >
                Clear Search & View All Movies
              </button>
            </div>
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
                  ratingScore={movie.average_rating}
                />
              ))}
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

export default SearchResults;
