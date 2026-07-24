import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { useModal } from '../components/ModalProvider';
import Footer from '../components/Footer';

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
}

interface WatchlistItem {
  watchlist_id: string;
  movie_id: string;
  created_at: string;
  movie?: Movie;
}

const MyList: React.FC = () => {
  const { showAlert } = useModal();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
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

  const fetchWatchlist = async () => {
    if (!activeProfileId) return;
    try {
      setLoading(true);
      const res = await api.get(`/watchlist/?profile_id=${activeProfileId}`);
      setWatchlist(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load watchlist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [activeProfileId]);

  const handleRemoveFromList = async (movieId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProfileId) return;
    try {
      await api.delete(`/watchlist/${movieId}?profile_id=${activeProfileId}`);
      setWatchlist(prev => prev.filter(item => item.movie_id !== movieId));
    } catch (err) {
      showAlert("Error", "Failed to remove item from My List.", "danger");
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-56 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20">
                Saved Favorites
              </span>
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase mt-2">
                My List
              </h1>
              <p className="text-xs text-brand-textMuted font-medium mt-1">
                Movies and shows saved to {profileName}'s personal watchlist.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-3 animate-pulse">
                  <div className="aspect-[2/3] w-full bg-[#181818] rounded-md animate-shimmer" />
                  <div className="h-3 bg-white/5 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-brand-surface rounded-xl">
              <p className="text-rose-400 font-semibold mb-2">{error}</p>
              <button 
                onClick={fetchWatchlist}
                className="px-4 py-2 bg-brand-accent hover:bg-blue-600 text-xs font-bold rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="text-center py-20 bg-brand-surface rounded-xl p-12 space-y-4">
              <svg className="w-16 h-16 text-neutral-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <h3 className="text-xl font-bold text-white">Your Watchlist is Empty</h3>
              <p className="text-xs text-brand-textMuted max-w-md mx-auto">
                Explore our catalog and click "+ Add to My List" on any movie to save it here for quick access later.
              </p>
              <button 
                onClick={() => navigate('/browse')}
                className="px-6 py-2.5 bg-brand-accent hover:bg-blue-600 text-xs font-bold rounded-lg transition-all"
              >
                Explore Catalog
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {watchlist.map((item) => {
                const movie = item.movie;
                if (!movie) return null;

                return (
                  <div 
                    key={item.watchlist_id}
                    onClick={() => navigate(`/movies/${movie.movie_id}`)}
                    className="bg-[#181818] rounded-md overflow-hidden transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_12px_24px_rgba(0,0,0,0.65)] cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail */}
                      <div className="relative aspect-[2/3] bg-black overflow-hidden">
                        <img 
                          src={movie.thumbnail_url} 
                          alt={movie.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-70" />
                      </div>

                      {/* Details */}
                      <div className="p-4 space-y-1.5">
                        <h3 className="font-extrabold text-sm text-white group-hover:text-brand-accent transition-colors font-display line-clamp-1">
                          {movie.title}
                        </h3>
                        <div className="flex items-center justify-between text-[10px] text-brand-textMuted font-semibold">
                          <span>{movie.release_year}</span>
                          <span>{movie.duration_minutes} min</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="px-4 py-2.5 bg-black/30 flex items-center justify-between text-xs">
                      <button
                        onClick={(e) => handleRemoveFromList(movie.movie_id, e)}
                        className="w-full flex items-center justify-center gap-1.5 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors font-bold text-[11px]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove from List
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default MyList;
