import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

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

const MovieDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [profileName, setProfileName] = useState('User');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamType, setStreamType] = useState<'HLS' | 'MP4'>('HLS');

  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
      return;
    }

    const fetchProfileDetails = async () => {
      try {
        const response = await api.get('/profiles/');
        const activeProfile = response.data.find(
          (p: any) => p.profile_id === activeProfileId
        );
        if (activeProfile) {
          setProfileName(activeProfile.display_name);
        }
      } catch (err) {
        console.error("Failed to load profile details.", err);
      }
    };

    fetchProfileDetails();
  }, [activeProfileId, navigate]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/catalog/movies/${id}`);
        setMovie(response.data);
      } catch (err: any) {
        setError(
          err.response?.data?.detail || 
          "Failed to load movie details from catalog."
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMovieDetails();
    }
  }, [id]);

  const getFullPlaybackUrl = (urlPath: string): string => {
    if (!urlPath) return '';
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
      return urlPath;
    }
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    return `${baseUrl.replace('/api', '')}${urlPath}`;
  };

  // Initialize HLS.js Player
  useEffect(() => {
    if (!isPlaying || !videoRef.current || !movie) return;

    const rawUrl = movie.video_url || '';
    const isHls = rawUrl.includes('/hls/') || rawUrl.endsWith('.m3u8');
    const streamUrl = getFullPlaybackUrl(rawUrl);

    setStreamType(isHls ? 'HLS' : 'MP4');

    let hls: Hls | null = null;

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        debug: false,
        enableWorker: true,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch((e) => console.log('Autoplay prevented:', e));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn('HLS.js fatal error, falling back to MP4 stream', data);
          // Fallback to MP4 stream
          if (videoRef.current) {
            videoRef.current.src = streamUrl.replace('/hls/master.m3u8', '/stream');
            videoRef.current.play().catch(() => {});
            setStreamType('MP4');
          }
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl') && isHls) {
      // Native HLS for Safari
      videoRef.current.src = streamUrl;
      videoRef.current.play().catch(() => {});
    } else {
      // Standard MP4 stream fallback
      videoRef.current.src = streamUrl;
      videoRef.current.play().catch(() => {});
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [isPlaying, movie]);

  const getRating = (name: string) => {
    switch (name.toLowerCase()) {
      case 'interstellar': return '8.6';
      case 'the dark knight': return '9.0';
      case 'inception': return '8.8';
      case 'the matrix': return '8.7';
      case 'dune': return '8.4';
      case 'the batman': return '8.3';
      case 'john wick': return '8.2';
      case 'tenet': return '7.8';
      case 'avatar': return '7.9';
      case 'oppenheimer': return '8.9';
      default: return '8.5';
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      {/* Sidebar Section */}
      <Sidebar />

      {/* Main Panel Viewport */}
      <div className="flex-1 ml-64 flex flex-col justify-between min-h-screen">
        {/* Top Header Bar */}
        <TopBar profileName={profileName} />

        {/* Content Body */}
        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 flex flex-col justify-center max-w-7xl mx-auto w-full">
          <div className="mb-6 self-start">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-xs text-brand-textMuted hover:text-white border border-white/10 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-md transition-all font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Browse
            </button>
          </div>

          {loading ? (
            <div className="h-[50vh] flex items-center justify-center">
              <div className="text-sm text-neutral-400 animate-pulse">Loading details...</div>
            </div>
          ) : error ? (
            <div className="text-center space-y-4 max-w-md mx-auto bg-brand-surface border border-white/5 p-8 rounded-2xl shadow-xl">
              <p className="text-red-500 font-semibold">{error}</p>
              <button 
                onClick={() => navigate('/')}
                className="px-5 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] shadow-[0_0_30px_rgba(59,130,246,0.35)] text-white rounded-xl transition-colors text-sm shadow-md"
              >
                Return Home
              </button>
            </div>
          ) : movie ? (
            <div className="w-full bg-brand-surface border border-white/5 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(6,11,24,0.85)] flex flex-col lg:flex-row min-h-[450px]">
              
              {/* Left Column: Interactive Video Player */}
              <div className="relative w-full lg:w-3/5 aspect-video lg:aspect-auto bg-black flex flex-col items-center justify-center min-h-[300px] lg:min-h-[450px] group overflow-hidden">
                {!isPlaying ? (
                  <>
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-40 blur-[1px] group-hover:scale-105 transition-transform duration-700"
                      style={{ backgroundImage: `url(${movie.thumbnail_url})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                    
                    <div className="z-10 text-center p-6 space-y-4">
                      <button 
                        onClick={() => setIsPlaying(true)}
                        className="w-20 h-20 rounded-full bg-brand-accent hover:bg-blue-600 shadow-[0_0_40px_rgba(59,130,246,0.5)] flex items-center justify-center mx-auto cursor-pointer transform hover:scale-110 transition-all duration-300 group/btn"
                      >
                        <svg className="w-8 h-8 fill-current text-white translate-x-1 group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                      <div>
                        <h4 className="font-extrabold text-xl font-display text-white tracking-wide">
                          Watch {movie.title}
                        </h4>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            HLS Streaming Enabled
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            .m3u8 / .ts
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative w-full h-full bg-black flex items-center justify-center">
                    <video
                      ref={videoRef}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded bg-brand-accent/20 text-brand-accent border border-brand-accent/30 backdrop-blur-md">
                        {streamType} Mode
                      </span>
                      <button
                        onClick={() => setIsPlaying(false)}
                        className="text-xs bg-black/60 hover:bg-black/80 text-white font-bold px-3 py-1 rounded border border-white/10 backdrop-blur-md transition-colors"
                      >
                        Close Player
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Metadata Detail Fields */}
              <div className="w-full lg:w-2/5 p-8 md:p-12 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex px-2.5 py-0.5 bg-brand-accent/15 text-brand-accent text-[9px] font-bold uppercase rounded-md tracking-wider">
                    ZePlay Premium Stream
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display text-white uppercase">
                    {movie.title}
                  </h2>
                  <div className="flex items-center text-xs text-brand-textMuted gap-3">
                    <span className="text-brand-accent font-semibold">{movie.release_year}</span>
                    <span className="text-neutral-600">•</span>
                    <span>{movie.duration_minutes} minutes</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-brand-accent font-semibold">★ {getRating(movie.title)}</span>
                    <span className="ml-auto border border-white/5 px-1.5 py-0.5 rounded text-[8px] text-neutral-400">HLS / 4K</span>
                  </div>
                  <p className="text-sm text-brand-textMuted leading-relaxed pt-2 font-sans">
                    {movie.description}
                  </p>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/5">
                  <div>
                    <span className="text-xs text-neutral-500 uppercase tracking-wider block mb-2 font-medium">Genres</span>
                    <div className="flex flex-wrap gap-2">
                      {movie.genres.map(g => (
                        <span 
                          key={g.genre_id}
                          className="px-2.5 py-1 bg-brand-background text-xs rounded text-neutral-300 border border-white/5"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 uppercase tracking-wider block mb-2 font-medium">HLS Transcode Stream Pointer</span>
                    <span className="text-xs text-neutral-400 font-mono break-all bg-brand-background border border-white/5 p-2.5 rounded-lg block select-text">
                      {movie.video_url}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </main>

        {/* Footer */}
        <footer className="p-6 text-center text-xs text-neutral-600 border-t border-white/5 bg-[#081225]/40 backdrop-blur-sm">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default MovieDetails;
