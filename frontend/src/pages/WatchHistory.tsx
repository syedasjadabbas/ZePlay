import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { useModal } from '../components/ModalProvider';

interface Movie {
  movie_id: string;
  title: string;
  description: string;
  release_year: number;
  duration_minutes: number;
  thumbnail_url: string;
  video_url: string;
}

interface WatchHistoryItem {
  history_id: string;
  movie_id: string;
  current_position: number;
  duration: number;
  percentage_watched: number;
  last_watched: string;
  movie?: Movie;
}

const WatchHistoryPage: React.FC = () => {
  const { showAlert } = useModal();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
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

  const fetchHistory = async () => {
    if (!activeProfileId) return;
    try {
      setLoading(true);
      const res = await api.get(`/watch-history/?profile_id=${activeProfileId}`);
      setHistory(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load watch history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [activeProfileId]);

  const handleDeleteItem = async (historyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/watch-history/${historyId}`);
      setHistory(prev => prev.filter(item => item.history_id !== historyId));
    } catch (err) {
      showAlert("Error", "Failed to remove item from history.", "danger");
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
                Playback Log
              </span>
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase mt-2">
                Watch History
              </h1>
              <p className="text-xs text-brand-textMuted font-medium mt-1">
                Timeline of movies and streams watched on {profileName}'s profile.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="h-[50vh] flex items-center justify-center">
              <div className="text-sm text-neutral-400 animate-pulse font-medium">
                Loading watch history...
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-brand-surface border border-white/5 rounded-2xl">
              <p className="text-rose-400 font-semibold mb-2">{error}</p>
              <button 
                onClick={fetchHistory}
                className="px-4 py-2 bg-brand-accent hover:bg-blue-600 text-xs font-bold rounded-xl"
              >
                Retry
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-brand-surface border border-white/5 rounded-3xl p-12 space-y-4">
              <svg className="w-16 h-16 text-neutral-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-bold text-white">No Watch History Recorded</h3>
              <p className="text-xs text-brand-textMuted max-w-md mx-auto">
                Videos and movies watched on this profile will automatically appear here with exact playback progress tracking.
              </p>
              <button 
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-brand-accent hover:bg-blue-600 text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                Start Browsing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((item) => {
                const movie = item.movie;
                const percent = Math.min(Math.round(item.percentage_watched), 100);

                return (
                  <div 
                    key={item.history_id}
                    onClick={() => movie && navigate(`/movies/${movie.movie_id}`)}
                    className="bg-brand-surface border border-white/5 rounded-2xl overflow-hidden hover:border-brand-accent/40 transition-all duration-300 hover:-translate-y-1 shadow-xl cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail & Progress Bar */}
                      <div className="relative aspect-video bg-black overflow-hidden">
                        <img 
                          src={movie?.thumbnail_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800'} 
                          alt={movie?.title || 'Movie'} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                        {/* Percent Badge */}
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-[10px] font-bold text-brand-accent">
                          {percent >= 95 ? 'Watched' : `${percent}% Watched`}
                        </div>

                        {/* Progress Bar overlay */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-800">
                          <div 
                            className="h-full bg-brand-accent transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-5 space-y-2">
                        <h3 className="font-extrabold text-lg text-white group-hover:text-brand-accent transition-colors font-display line-clamp-1">
                          {movie?.title || 'Unknown Title'}
                        </h3>
                        
                        <div className="flex items-center justify-between text-[11px] text-brand-textMuted font-semibold">
                          <span>Progress: {formatTime(item.current_position)} / {formatTime(item.duration)}</span>
                          <span>{movie?.release_year}</span>
                        </div>

                        <p className="text-xs text-neutral-400 line-clamp-2 pt-1 font-sans">
                          {movie?.description}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {formatTimestamp(item.last_watched)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDeleteItem(item.history_id, e)}
                          className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Remove from Watch History"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <footer className="p-6 text-center text-xs text-neutral-600 border-t border-white/5 bg-[#081225]/40 backdrop-blur-sm">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default WatchHistoryPage;
