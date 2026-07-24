import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import api, { API_ORIGIN, getToken } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MovieCardVertical from '../components/MovieCardVertical';
import StarRating from '../components/StarRating';
import { useModal } from '../components/ModalProvider';

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

interface SavedProgress {
  current_position: number;
  duration: number;
  percentage_watched: number;
}

const MovieDetails: React.FC = () => {
  const { showAlert } = useModal();
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [profileName, setProfileName] = useState('User');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamType, setStreamType] = useState<'HLS' | 'MP4'>('HLS');
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [shouldResume, setShouldResume] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState<boolean>(false);
  const [watchlistSubmitting, setWatchlistSubmitting] = useState<boolean>(false);

  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [levels, setLevels] = useState<{ index: number; name: string }[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);

  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [ratingStats, setRatingStats] = useState<{ average_rating: number; total_ratings: number }>({ average_rating: 0, total_ratings: 0 });
  const [userScore, setUserScore] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const similarRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  const handleToggleWatchlist = async () => {
    if (!activeProfileId || !id || watchlistSubmitting) return;
    try {
      setWatchlistSubmitting(true);
      if (isInWatchlist) {
        await api.delete(`/watchlist/${id}?profile_id=${activeProfileId}`);
        setIsInWatchlist(false);
      } else {
        await api.post('/watchlist/', {
          profile_id: activeProfileId,
          movie_id: id
        });
        setIsInWatchlist(true);
      }
    } catch (err) {
      console.error("Failed to toggle watchlist status.", err);
      showAlert("Error", "Could not update My List.", "danger");
    } finally {
      setWatchlistSubmitting(false);
    }
  };

  const scrollSimilar = (direction: 'left' | 'right') => {
    if (similarRef.current) {
      const scrollAmount = 480;
      similarRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const toggleContainerFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        console.error("Error enabling full-screen: ", err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error("Error exiting full-screen: ", err);
      });
    }
  };

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
        const [response, simRes] = await Promise.all([
          api.get(`/catalog/movies/${id}`),
          api.get(`/recommendations/similar/${id}`).catch(() => ({ data: [] }))
        ]);

        setMovie(response.data);
        setSimilarMovies(simRes.data);

        // Track movie view analytics
        api.post(`/recommendations/track-view/${id}`).catch(() => {});

        // Fetch saved progress for profile & movie
        if (activeProfileId) {
          try {
            const progRes = await api.get(`/watch-history/progress/${id}?profile_id=${activeProfileId}`);
            if (progRes.data) {
              setSavedProgress({
                current_position: progRes.data.current_position,
                duration: progRes.data.duration,
                percentage_watched: progRes.data.percentage_watched
              });
            }
          } catch (e) {
            console.log("No saved progress record.", e);
          }

          try {
            const wlRes = await api.get(`/watchlist/check/${id}?profile_id=${activeProfileId}`);
            if (wlRes.data) {
              setIsInWatchlist(wlRes.data.is_in_watchlist);
            }
          } catch (e) {
            console.log("Failed to check watchlist status.", e);
          }

          try {
            const ratingRes = await api.get(`/ratings/movie/${id}?profile_id=${activeProfileId}`);
            if (ratingRes.data) {
              setRatingStats({
                average_rating: ratingRes.data.average_rating,
                total_ratings: ratingRes.data.total_ratings,
              });
              setUserScore(ratingRes.data.user_rating);
            }
          } catch (e) {
            console.log("Failed to fetch rating stats.", e);
          }
        }
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
  }, [id, activeProfileId]);

  const handleRateMovie = async (score: number) => {
    if (!activeProfileId || !movie || ratingSubmitting) return;
    try {
      setRatingSubmitting(true);
      await api.post(`/ratings/movie/${movie.movie_id}?profile_id=${activeProfileId}`, { score });
      setUserScore(score);

      const ratingRes = await api.get(`/ratings/movie/${movie.movie_id}?profile_id=${activeProfileId}`);
      if (ratingRes.data) {
        setRatingStats({
          average_rating: ratingRes.data.average_rating,
          total_ratings: ratingRes.data.total_ratings,
        });
      }
    } catch (err) {
      console.error("Failed to rate movie", err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const getFullPlaybackUrl = (urlPath: string): string => {
    if (!urlPath) return '';
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
      return urlPath;
    }
    return `${API_ORIGIN}${urlPath}`;
  };

  // Helper to report current playback progress to API
  const saveProgress = async (currentTime: number, duration: number) => {
    if (!activeProfileId || !movie || duration <= 0) return;
    try {
      await api.post('/watch-history/progress', {
        profile_id: activeProfileId,
        movie_id: movie.movie_id,
        current_position: currentTime,
        duration: duration
      });
    } catch (err) {
      console.error("Failed to save watch history progress", err);
    }
  };

  // Initialize HLS.js Player
  useEffect(() => {
    if (!isPlaying || !videoRef.current || !movie) return;

    setIsPlayerLoading(true);
    setIsBuffering(false);
    setPlayerError(null);

    const rawUrl = movie.video_url || '';
    const isHls = rawUrl.includes('/hls/') || rawUrl.endsWith('.m3u8');
    const baseUrl = getFullPlaybackUrl(rawUrl);
    const token = getToken();
    const streamUrl = token ? (baseUrl.includes('?') ? `${baseUrl}&token=${token}` : `${baseUrl}?token=${token}`) : baseUrl;

    setStreamType(isHls ? 'HLS' : 'MP4');

    let hls: Hls | null = null;

    const handleLoadedMetadata = () => {
      if (shouldResume && savedProgress && savedProgress.current_position > 0 && videoRef.current) {
        videoRef.current.currentTime = savedProgress.current_position;
      }
    };

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        debug: false,
        enableWorker: true,
        xhrSetup: (xhr, _url) => {
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        }
      });
      hls.loadSource(streamUrl);
      if (videoRef.current) {
        hls.attachMedia(videoRef.current);
      }
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (shouldResume && savedProgress && savedProgress.current_position > 0 && videoRef.current) {
          videoRef.current.currentTime = savedProgress.current_position;
        }
        videoRef.current?.play().catch((e) => console.log('Autoplay prevented:', e));

        if (hls) {
          const detectedLevels = hls.levels.map((level, index) => {
            let name = `${level.height}p`;
            if (level.height === 1080) name = '1080p';
            else if (level.height === 720) name = '720p';
            else if (level.height === 480) name = '480p';
            return { index, name };
          });
          detectedLevels.sort((a, b) => b.index - a.index);
          setLevels([{ index: -1, name: 'Auto' }, ...detectedLevels]);
          setHlsInstance(hls);
          setSelectedLevel(hls.currentLevel);
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn('HLS.js fatal error, falling back to MP4 stream', data);
          if (videoRef.current) {
            const fallbackUrl = baseUrl.replace('/hls/master.m3u8', '/stream');
            const fallbackAuthUrl = token ? (fallbackUrl.includes('?') ? `${fallbackUrl}&token=${token}` : `${fallbackUrl}?token=${token}`) : fallbackUrl;
            videoRef.current.src = fallbackAuthUrl;
            if (shouldResume && savedProgress && savedProgress.current_position > 0) {
              videoRef.current.currentTime = savedProgress.current_position;
            }
            videoRef.current.play().catch((err) => {
              console.error("Fallback stream failed:", err);
              setPlayerError("Failed to load local media stream. Please verify local file path.");
            });
            setStreamType('MP4');
          } else {
            setPlayerError("Fatal streaming playback error: " + data.type);
          }
        }
      });
    } else if (videoRef.current) {
      videoRef.current.src = streamUrl;
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.play().catch(() => {});
    }

    // Interval to automatically save progress every 5 seconds
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration || (movie.duration_minutes * 60));
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration || (movie.duration_minutes * 60));
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
      if (hls) {
        hls.destroy();
      }
      setHlsInstance(null);
      setLevels([]);
      setSelectedLevel(-1);
    };
  }, [isPlaying, movie, shouldResume, savedProgress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const hasResumeOption = savedProgress && savedProgress.current_position > 5 && savedProgress.percentage_watched < 95;

  const handleStartPlay = (resume: boolean) => {
    setShouldResume(resume);
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 flex flex-col justify-center max-w-7xl mx-auto w-full space-y-12">
          <div className="self-start">
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
            <div className="w-full space-y-12 animate-pulse">
              {/* Main Card Skeleton */}
              <div className="w-full bg-brand-surface border border-white/5 rounded-3xl overflow-hidden flex flex-col lg:flex-row min-h-[450px]">
                {/* Left Column (Video aspect placeholder) */}
                <div className="w-full lg:w-3/5 aspect-video lg:aspect-auto bg-white/5 min-h-[300px] lg:min-h-[450px]" />
                {/* Right Column (Meta detail placeholder) */}
                <div className="w-full lg:w-2/5 p-8 md:p-12 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="h-4 w-28 bg-white/5 rounded-md" />
                    <div className="h-10 w-3/4 bg-white/10 rounded-lg" />
                    <div className="flex gap-3 pt-2">
                      <div className="h-4 w-12 bg-white/5 rounded" />
                      <div className="h-4 w-20 bg-white/5 rounded" />
                      <div className="h-4 w-14 bg-white/5 rounded" />
                    </div>
                    <div className="space-y-2 pt-4">
                      <div className="h-4 w-full bg-white/5 rounded" />
                      <div className="h-4 w-full bg-white/5 rounded" />
                      <div className="h-4 w-5/6 bg-white/5 rounded" />
                    </div>
                    <div className="h-14 w-full bg-white/5 rounded-2xl" />
                    <div className="h-12 w-full bg-white/5 rounded-xl" />
                  </div>
                  <div className="h-20 w-full bg-white/5 rounded-xl" />
                </div>
              </div>
              {/* Similar Movies Row Skeleton */}
              <div className="space-y-4">
                <div className="h-7 w-48 bg-white/10 rounded-md" />
                <div className="flex gap-6 overflow-hidden">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <div key={idx} className="flex-shrink-0 w-[180px] space-y-3">
                      <div className="aspect-[2/3] w-full bg-white/5 rounded-2xl" />
                      <div className="h-4 w-3/4 bg-white/10 rounded" />
                      <div className="h-3 w-1/2 bg-white/5 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="text-center space-y-4 max-w-md mx-auto bg-brand-surface border border-white/5 p-8 rounded-2xl shadow-xl">
              <p className="text-red-500 font-semibold">{error}</p>
              <button 
                onClick={() => navigate('/')}
                className="px-5 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl transition-colors text-sm shadow-md"
              >
                Return Home
              </button>
            </div>
          ) : movie ? (
            <>
              {/* Main Video & Details Card */}
              <div className="w-full bg-brand-surface border border-white/5 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(6,11,24,0.85)] flex flex-col lg:flex-row min-h-[450px]">
                
                {/* Left Column: Interactive Video Player */}
                <div 
                  ref={playerContainerRef}
                  className="relative w-full lg:w-3/5 aspect-video lg:aspect-auto bg-black flex flex-col items-center justify-center min-h-[300px] lg:min-h-[450px] group overflow-hidden"
                >
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    className={`w-full h-full object-contain ${isPlaying ? 'block' : 'hidden'}`}
                    onPause={() => {
                      if (videoRef.current) saveProgress(videoRef.current.currentTime, videoRef.current.duration || (movie.duration_minutes * 60));
                    }}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => {
                      setIsBuffering(false);
                      setIsPlayerLoading(false);
                      setPlayerError(null);
                    }}
                    onLoadStart={() => {
                      setIsPlayerLoading(true);
                      setPlayerError(null);
                    }}
                    onCanPlay={() => setIsPlayerLoading(false)}
                    onSeeking={() => setIsBuffering(true)}
                    onSeeked={() => setIsBuffering(false)}
                    onError={() => {
                      if (videoRef.current && videoRef.current.error) {
                        setPlayerError(`Playback error code: ${videoRef.current.error.code} - ${videoRef.current.error.message}`);
                      } else {
                        setPlayerError("An unexpected error occurred during media playback.");
                      }
                      setIsPlayerLoading(false);
                      setIsBuffering(false);
                    }}
                  />

                  {!isPlaying && (
                    <>
                      <div 
                        className="absolute inset-0 bg-cover bg-center opacity-40 blur-[1px] group-hover:scale-105 transition-transform duration-700"
                        style={{ backgroundImage: `url(${movie.thumbnail_url})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                      
                      <div className="z-10 text-center p-6 space-y-4 max-w-md">
                        {hasResumeOption ? (
                          <div className="space-y-3">
                            <button 
                              onClick={() => handleStartPlay(true)}
                              className="w-full px-6 py-3.5 bg-brand-accent hover:bg-blue-600 text-white font-bold rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-105"
                            >
                              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              <span>Resume Watching ({formatTime(savedProgress.current_position)})</span>
                            </button>

                            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-brand-accent h-full transition-all"
                                style={{ width: `${savedProgress.percentage_watched}%` }}
                              />
                            </div>

                            <button 
                              onClick={() => handleStartPlay(false)}
                              className="text-xs text-neutral-400 hover:text-white font-semibold transition-colors underline"
                            >
                              Start Over from Beginning
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleStartPlay(false)}
                            className="w-20 h-20 rounded-full bg-brand-accent hover:bg-blue-600 shadow-[0_0_40px_rgba(59,130,246,0.5)] flex items-center justify-center mx-auto cursor-pointer transform hover:scale-110 transition-all duration-300 group/btn"
                          >
                            <svg className="w-8 h-8 fill-current text-white translate-x-1 group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        )}

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
                  )}
                  {isPlaying && (
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded bg-brand-accent/20 text-brand-accent border border-brand-accent/30 backdrop-blur-md">
                          {streamType} Mode
                        </span>
                        <button
                          onClick={() => {
                            if (videoRef.current) saveProgress(videoRef.current.currentTime, videoRef.current.duration || (movie.duration_minutes * 60));
                            setIsPlaying(false);
                          }}
                          className="text-xs bg-black/60 hover:bg-black/80 text-white font-bold px-3 py-1 rounded border border-white/10 backdrop-blur-md transition-colors"
                        >
                          Close Player
                        </button>
                        <button
                          onClick={toggleContainerFullscreen}
                          className="text-xs bg-black/60 hover:bg-black/80 text-white font-bold px-3 py-1 rounded border border-white/10 backdrop-blur-md transition-colors flex items-center gap-1.5"
                          title="Toggle Fullscreen"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          <span>Fullscreen</span>
                        </button>
                      </div>
                  )}

                      {streamType === 'HLS' && levels.length > 1 && (
                        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/50 hover:bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg transition-all duration-300">
                          <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <select
                            id="quality-select"
                            value={selectedLevel}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setSelectedLevel(val);
                              if (hlsInstance) {
                                hlsInstance.currentLevel = val;
                                console.log(`Switched quality to level: ${val}`);
                              }
                            }}
                            className="text-[11px] bg-transparent text-white font-black uppercase cursor-pointer outline-none border-none py-0.5 pr-2 focus:ring-0"
                          >
                            {levels.map((lvl) => (
                              <option key={lvl.index} value={lvl.index} className="bg-[#0b1225] text-white font-sans uppercase">
                                {lvl.name === 'Auto' ? 'Auto (ABR)' : lvl.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Loading State Overlay */}
                      {isPlayerLoading && !playerError && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 pointer-events-none transition-opacity duration-300">
                          <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                          <p className="mt-3 text-xs text-neutral-400 font-medium tracking-wider uppercase animate-pulse">Loading Stream...</p>
                        </div>
                      )}

                      {/* Buffering State Overlay */}
                      {isBuffering && !isPlayerLoading && !playerError && (
                        <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center z-10 pointer-events-none transition-opacity duration-300">
                          <div className="w-10 h-10 border-4 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin"></div>
                          <p className="mt-2.5 text-[10px] text-neutral-300 font-bold uppercase tracking-wider">Buffering...</p>
                        </div>
                      )}

                      {/* Friendly Error State Card */}
                      {playerError && (
                        <div className="absolute inset-0 bg-[#080d19]/95 flex flex-col items-center justify-center p-6 text-center z-30 transition-all duration-300">
                          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <h5 className="text-base font-extrabold text-white uppercase tracking-wide">Playback Interrupted</h5>
                          <p className="text-xs text-neutral-400 max-w-sm mt-2 leading-relaxed">
                            {playerError}
                          </p>
                          <div className="flex gap-3 mt-6">
                            <button
                              onClick={() => {
                                setPlayerError(null);
                                setIsPlayerLoading(true);
                                if (videoRef.current) {
                                  videoRef.current.load();
                                  videoRef.current.play().catch(() => {});
                                }
                              }}
                              className="px-4 py-2 bg-brand-accent hover:bg-blue-600 text-white text-xs font-bold rounded-xl border border-blue-500/20 shadow-lg shadow-brand-accent/20 transition-all transform hover:scale-105 active:scale-95"
                            >
                              Retry Playback
                            </button>
                            <button
                              onClick={() => {
                                setIsPlaying(false);
                                setPlayerError(null);
                              }}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold rounded-xl border border-white/10 transition-all"
                            >
                              Go Back
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
                      <span className="text-brand-accent font-semibold">
                        ★ {ratingStats.average_rating > 0 ? ratingStats.average_rating.toFixed(1) : '0.0'}
                        {ratingStats.total_ratings > 0 && <span className="text-[10px] font-normal text-neutral-400 ml-1">({ratingStats.total_ratings})</span>}
                      </span>
                      <span className="ml-auto border border-white/5 px-1.5 py-0.5 rounded text-[8px] text-neutral-400">HLS / 4K</span>
                    </div>
                    <p className="text-sm text-brand-textMuted leading-relaxed pt-2 font-sans">
                      {movie.description}
                    </p>

                    {/* 1-5 Star User Rating Widget */}
                    <div className="p-4 bg-brand-background/60 border border-white/5 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-neutral-300">Rate this Movie</span>
                        {ratingStats.average_rating > 0 && (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            ★ {ratingStats.average_rating.toFixed(1)} <span className="text-neutral-500 font-normal">({ratingStats.total_ratings} votes)</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <StarRating
                          rating={userScore || 0}
                          onRate={handleRateMovie}
                          readonly={ratingSubmitting}
                          size="md"
                        />
                        {userScore ? (
                          <span className="text-xs text-amber-400 font-bold ml-2">Your Rating: {userScore}/5</span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 ml-2">Click star to rate</span>
                        )}
                      </div>
                    </div>

                    {/* Watchlist Toggle Action Button */}
                    <div className="pt-1">
                      <button
                        onClick={handleToggleWatchlist}
                        disabled={watchlistSubmitting}
                        className={`w-full py-3 px-5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 border transition-all ${
                          isInWatchlist
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 shadow-md'
                            : 'bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border-brand-accent/40 shadow-md'
                        }`}
                      >
                        {isInWatchlist ? (
                          <>
                            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>In My List (Click to Remove)</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>+ Add to My List</span>
                          </>
                        )}
                      </button>
                    </div>
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

              {/* Similar Movies Section */}
              {similarMovies.length > 0 && (
                <div className="space-y-5 pt-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-extrabold tracking-tight text-white font-display flex items-center gap-3">
                      <span>Similar Movies</span>
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-sans">
                        Related Content
                      </span>
                    </h3>
                  </div>

                  <div className="relative group/row">
                    <button 
                      onClick={() => scrollSimilar('left')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
                    >
                      <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <div 
                      ref={similarRef} 
                      className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                    >
                      {similarMovies.map(sim => (
                        <MovieCardVertical
                          key={sim.movie_id}
                          movie_id={sim.movie_id}
                          title={sim.title}
                          thumbnail_url={sim.thumbnail_url}
                          release_year={sim.release_year}
                          duration_minutes={sim.duration_minutes}
                          genres={sim.genres || []}
                        />
                      ))}
                    </div>

                    <button 
                      onClick={() => scrollSimilar('right')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
                    >
                      <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </main>

        <footer className="p-6 text-center text-xs text-neutral-600 border-t border-white/5 bg-[#081225]/40 backdrop-blur-sm">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default MovieDetails;
