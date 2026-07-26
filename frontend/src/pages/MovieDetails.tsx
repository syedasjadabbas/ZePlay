import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import api, { API_ORIGIN, getToken } from '../services/api';
import { queryClient, QUERY_KEYS } from '../services/queryClient';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MovieCardVertical from '../components/MovieCardVertical';
import { useToast } from '../components/Toast';
import PremiumPoster from '../components/PremiumPoster';
import Footer from '../components/Footer';
import { MovieDetailsSkeleton, MovieCardSkeleton } from '../components/Skeleton';
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
}

interface SavedProgress {
  current_position: number;
  duration: number;
  percentage_watched: number;
}

const MovieDetails: React.FC = () => {
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [profileName] = useState(() => localStorage.getItem('selectedProfileName') || 'User');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamType, setStreamType] = useState<'HLS' | 'MP4'>('HLS');
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [isInWatchlist, setIsInWatchlist] = useState<boolean>(false);
  const [watchlistSubmitting, setWatchlistSubmitting] = useState<boolean>(false);
  const [imageError, setImageError] = useState(false);

  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [levels, setLevels] = useState<{ index: number; name: string }[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);

  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentAutoResolution, setCurrentAutoResolution] = useState<string>('');
  const [showControls, setShowControls] = useState(true);
  const [qualityToast, setQualityToast] = useState<string | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [isPremiumUser, setIsPremiumUser] = useState<boolean>(false);
  const [accessState, setAccessState] = useState<'UNKNOWN' | 'FREE' | 'PREMIUM' | 'ADMIN'>('UNKNOWN');
  const [showUpgradeState, setShowUpgradeState] = useState<boolean>(false);

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0 ? true : (newVol > 0 && isMuted ? false : isMuted);
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (videoRef.current) {
      videoRef.current.muted = nextMute;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((e) => console.log('Playback error:', e));
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setVideoCurrentTime(newTime);
    }
  };

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const similarRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<any>(null);
  const toastTimeoutRef = useRef<any>(null);
  const seekFeedbackTimeoutRef = useRef<any>(null);
  const clickTimerRef = useRef<any>(null);

  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  const triggerQualityToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setQualityToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setQualityToast(null);
    }, 2500);
  };

  const triggerSeekFeedback = (msg: string) => {
    if (seekFeedbackTimeoutRef.current) clearTimeout(seekFeedbackTimeoutRef.current);
    setSeekFeedback(msg);
    seekFeedbackTimeoutRef.current = setTimeout(() => {
      setSeekFeedback(null);
    }, 1000);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    if (isPlaying && videoRef.current && !videoRef.current.paused) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleQualityChange = (val: number) => {
    setSelectedLevel(val);
    if (hlsInstance) {
      hlsInstance.currentLevel = val;
      if (val === -1) {
        triggerQualityToast(`Quality: Auto (${currentAutoResolution || '1080p'})`);
      } else {
        const lvl = levels.find((l) => l.index === val);
        if (lvl) triggerQualityToast(`Quality: ${lvl.name}`);
      }
    }
  };

  const handlePlayerContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If click was on controls overlay elements, ignore
    if ((e.target as HTMLElement).closest('button, select, option')) return;
    if (!videoRef.current || !isPlaying) return;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;

      if (!playerContainerRef.current) return;
      const rect = playerContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const relativeX = clickX / rect.width;

      if (relativeX < 0.35) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        triggerSeekFeedback('-10s');
      } else if (relativeX > 0.65) {
        videoRef.current.currentTime = Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + 10);
        triggerSeekFeedback('+10s');
      } else {
        toggleContainerFullscreen();
      }
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        if (videoRef.current) {
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
        }
      }, 250);
    }
  };

  const touchStartRef = useRef<{ time: number; x: number } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing inside form input fields
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        if (!isPlaying) {
          const canResume = Boolean(savedProgress && savedProgress.current_position > 5 && savedProgress.percentage_watched < 95);
          handleStartPlay(canResume);
        } else if (videoRef.current) {
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
        }
        return;
      }

      if (!isPlaying || !videoRef.current) return;
      const v = videoRef.current;

      switch (e.code) {
        case 'KeyK':
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          triggerSeekFeedback('-10s');
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
          triggerSeekFeedback('+10s');
          break;
        case 'ArrowUp':
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case 'KeyM':
          e.preventDefault();
          v.muted = !v.muted;
          break;
        case 'KeyF':
          e.preventDefault();
          toggleContainerFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, savedProgress]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, select, option')) return;
    const now = Date.now();
    const touchX = e.touches[0].clientX;

    if (touchStartRef.current && now - touchStartRef.current.time < 300) {
      // Double tap gesture detected on mobile!
      if (!playerContainerRef.current || !videoRef.current) return;
      const rect = playerContainerRef.current.getBoundingClientRect();
      const relativeX = (touchX - rect.left) / rect.width;

      if (relativeX < 0.35) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        triggerSeekFeedback('-10s');
      } else if (relativeX > 0.65) {
        videoRef.current.currentTime = Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + 10);
        triggerSeekFeedback('+10s');
      } else {
        toggleContainerFullscreen();
      }
      touchStartRef.current = null;
    } else {
      touchStartRef.current = { time: now, x: touchX };
      handleMouseMove();
    }
  };

  const handleToggleWatchlist = async () => {
    if (!activeProfileId || !id || watchlistSubmitting) return;
    const wasInList = isInWatchlist;
    try {
      setWatchlistSubmitting(true);
      if (isInWatchlist) {
        await api.delete(`/watchlist/${id}?profile_id=${activeProfileId}`);
        setIsInWatchlist(false);
        showToast('Removed from My List', 'info');
      } else {
        await api.post('/watchlist/', {
          profile_id: activeProfileId,
          movie_id: id
        });
        setIsInWatchlist(true);
        showToast('Added to My List', 'success');
      }
      // Invalidate cache so My List page fetches fresh data on next visit
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.watchlist(activeProfileId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.watchlistCheck(id, activeProfileId) });
    } catch (err) {
      setIsInWatchlist(wasInList);
      showToast('Could not update My List. Please try again.', 'error');
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
    
    const doc = document as any;
    const elem = playerContainerRef.current as any;
    
    const requestFS = elem.requestFullscreen || elem.mozRequestFullScreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
    const exitFS = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    
    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
      if (requestFS) {
        requestFS.call(elem).catch((err: any) => {
          console.error("Error enabling full-screen: ", err);
        });
      }
    } else {
      if (exitFS) {
        exitFS.call(doc).catch((err: any) => {
          console.error("Error exiting full-screen: ", err);
        });
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFS = !!(doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
      setIsFullscreen(isFS);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
      return;
    }
  }, [activeProfileId, navigate]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);

        // Fire all 4 requests in a single parallel wave using React Query cache
        const [movieData, simData, progData, wlData] = await Promise.all([
          // Movie detail — cached for 5min, skips network if already loaded
          queryClient.fetchQuery({
            queryKey: QUERY_KEYS.movie(id!),
            queryFn: () => api.get(`/catalog/movies/${id}`).then(r => r.data),
            staleTime: 5 * 60 * 1000,
          }),
          // Similar movies — cached
          queryClient.fetchQuery({
            queryKey: QUERY_KEYS.similar(id!),
            queryFn: () => api.get(`/recommendations/similar/${id}`).then(r => r.data),
            staleTime: 5 * 60 * 1000,
          }).catch(() => []),
          // Watch progress — short TTL (user-specific, changes during playback)
          activeProfileId ? queryClient.fetchQuery({
            queryKey: QUERY_KEYS.watchProgress(id!, activeProfileId),
            queryFn: () => api.get(`/watch-history/progress/${id}?profile_id=${activeProfileId}`).then(r => r.data),
            staleTime: 30 * 1000,
          }).catch(() => null) : Promise.resolve(null),
          // Watchlist check
          activeProfileId ? queryClient.fetchQuery({
            queryKey: QUERY_KEYS.watchlistCheck(id!, activeProfileId),
            queryFn: () => api.get(`/watchlist/check/${id}?profile_id=${activeProfileId}`).then(r => r.data),
            staleTime: 2 * 60 * 1000,
          }).catch(() => null) : Promise.resolve(null),
        ]);

        setMovie(movieData);
        setSimilarMovies(simData || []);
        if (progData) {
          setSavedProgress({
            current_position: progData.current_position,
            duration: progData.duration,
            percentage_watched: progData.percentage_watched
          });
        }
        if (wlData) setIsInWatchlist(wlData.is_in_watchlist === true);

        // Check user subscription plan
        try {
          const subRes = await api.get('/subscription/current');
          const subPlan = subRes.data?.plan?.name || subRes.data?.subscription_plan || '';
          const userStr = localStorage.getItem('user');
          const userObj = userStr ? JSON.parse(userStr) : null;
          const isAdmin = userObj?.is_admin || subRes.data?.status === "Administrator Account" || false;
          if (isAdmin) {
            setAccessState('ADMIN');
            setIsPremiumUser(true);
          } else if (subPlan === 'premium') {
            setAccessState('PREMIUM');
            setIsPremiumUser(true);
          } else {
            setAccessState('FREE');
            setIsPremiumUser(false);
          }
        } catch (subErr) {
          console.error("Failed to check subscription", subErr);
          const userStr = localStorage.getItem('user');
          const userObj = userStr ? JSON.parse(userStr) : null;
          const isAdmin = userObj?.is_admin || false;
          const isPrem = userObj?.subscription_plan === 'premium';
          if (isAdmin) {
            setAccessState('ADMIN');
            setIsPremiumUser(true);
          } else if (isPrem) {
            setAccessState('PREMIUM');
            setIsPremiumUser(true);
          } else {
            setAccessState('FREE');
            setIsPremiumUser(false);
          }
        }

        // Fire analytics view tracking async — no await, non-blocking
        api.post(`/recommendations/track-view/${id}`).catch(() => {});

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
      setImageError(false);
      fetchMovieDetails();
    }
  }, [id, activeProfileId]);

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
    // SECURITY ENTITLEMENT GATE:
    // If access state is UNKNOWN/LOADING or FREE, DO NOT initialize HLS or attempt streaming!
    if (!videoRef.current || !movie || loading || accessState === 'UNKNOWN' || accessState === 'FREE') {
      return;
    }

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
      setIsPlayerLoading(false);
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
        setIsPlayerLoading(false);

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

          const initialIdx = hls.currentLevel >= 0 ? hls.currentLevel : (hls.loadLevel >= 0 ? hls.loadLevel : 0);
          if (hls.levels && hls.levels[initialIdx]) {
            setCurrentAutoResolution(`${hls.levels[initialIdx].height}p`);
          }
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (hls && hls.levels[data.level]) {
          const height = hls.levels[data.level].height;
          setCurrentAutoResolution(`${height}p`);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn('HLS.js fatal error, attempting recovery:', data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              setPlayerError("Fatal streaming playback error: " + (data.details || data.type));
              break;
          }
        }
      });
    } else if (videoRef.current) {
      videoRef.current.src = streamUrl;
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
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
  }, [movie, loading, accessState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentPos = savedProgress?.current_position || 0;
  const percentWatched = savedProgress?.percentage_watched || 0;
  const hasResumeOption = Boolean(savedProgress && currentPos > 5 && percentWatched < 95);

  const handleStartPlay = (resume: boolean) => {
    if (!isPremiumUser) {
      setShowUpgradeState(true);
      return;
    }
    setIsPlaying(true);
    const targetTime = (resume && savedProgress && savedProgress.current_position > 0)
      ? savedProgress.current_position
      : 0;

    if (videoRef.current) {
      const v = videoRef.current;
      const applySeekAndPlay = () => {
        if (targetTime > 0) {
          v.currentTime = targetTime;
        } else if (!resume) {
          v.currentTime = 0;
        }
        v.play().catch((e) => console.log('Playback error:', e));
      };

      if (v.readyState >= 1) {
        applySeekAndPlay();
      } else {
        const onReady = () => {
          v.removeEventListener('loadedmetadata', onReady);
          v.removeEventListener('canplay', onReady);
          applySeekAndPlay();
        };
        v.addEventListener('loadedmetadata', onReady);
        v.addEventListener('canplay', onReady);
        v.play().then(() => {
          if (targetTime > 0) v.currentTime = targetTime;
        }).catch(() => {});
      }
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-56 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 flex flex-col justify-center max-w-7xl mx-auto w-full space-y-12">
          <div className="self-start">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-xs text-brand-textMuted hover:text-white border border-white/10 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 backdrop-blur-md transition-all font-semibold btn-premium cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Browse
            </button>
          </div>

          {loading ? (
            <div className="w-full space-y-12 animate-fadeIn">
              <MovieDetailsSkeleton />
              <div className="space-y-4">
                <div className="h-6 w-48 bg-[#1c1c1c] animate-shimmer rounded" />
                <div className="flex gap-6 overflow-hidden">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <MovieCardSkeleton key={idx} aspect="vertical" />
                  ))}
                </div>
              </div>
            </div>
          ) : error ? (
            <ErrorState
              title="Movie Unavailable"
              message={error}
              onRetry={() => window.location.reload()}
            />
          ) : movie ? (
            <>
              {/* Main Video & Details Card */}
              <div className="w-full bg-[#181818] border border-white/5 rounded-xl overflow-hidden flex flex-col lg:flex-row min-h-[450px] animate-scaleIn">
                
                {/* Left Column: Interactive Video Player */}
                <div 
                  ref={playerContainerRef}
                  onMouseMove={handleMouseMove}
                  onTouchStart={handleTouchStart}
                  onClick={handlePlayerContainerClick}
                  className={`relative bg-black flex flex-col items-center justify-center group overflow-hidden transition-all duration-300 ${
                    isFullscreen 
                      ? 'w-full h-full' 
                      : 'w-full lg:w-3/5 aspect-video lg:aspect-auto min-h-[300px] lg:min-h-[450px]'
                  } ${!showControls && isPlaying ? 'cursor-none' : ''}`}
                >
                  <video
                    ref={videoRef}
                    controls={false}
                    className={`w-full h-full object-contain ${isPlaying ? 'block' : 'hidden'}`}
                    onTimeUpdate={() => {
                      if (videoRef.current) setVideoCurrentTime(videoRef.current.currentTime);
                    }}
                    onDurationChange={() => {
                      if (videoRef.current) setVideoDuration(videoRef.current.duration);
                    }}
                    onPlay={() => setIsPaused(false)}
                    onPause={() => {
                      setIsPaused(true);
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

                  {/* Polished ZePlay Upgrade State Overlay */}
                  {showUpgradeState && (
                    <div className="absolute inset-0 bg-[#0c0f1d]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 animate-fadeIn">
                      <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6">
                        <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-black text-white tracking-wide uppercase font-display">Premium Required</h3>
                      <p className="text-xs text-neutral-400 max-w-sm mt-3 leading-relaxed">
                        "{movie.title}" is available exclusively to Premium subscribers. Upgrade now to stream this and other titles in high quality.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-xs justify-center">
                        <button
                          onClick={() => {
                            if (isFullscreen) toggleContainerFullscreen();
                            navigate('/subscription');
                          }}
                          className="px-6 py-3 bg-brand-accent hover:bg-blue-650 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-accent/25 select-none"
                        >
                          Upgrade / View Plans
                        </button>
                        <button
                          onClick={() => setShowUpgradeState(false)}
                          className="px-6 py-3 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold uppercase tracking-wider rounded-xl border border-white/10 transition-all cursor-pointer select-none"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {!isPlaying && !isPlayerLoading && (
                    <>
                      {!movie.thumbnail_url || imageError ? (
                        <PremiumPoster title={movie.title} aspectRatio="landscape" />
                      ) : (
                        <img 
                          className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[1px] group-hover:scale-105 transition-transform duration-700 ease-[var(--ease-out-premium)]"
                          src={getFullPlaybackUrl(movie.thumbnail_url)}
                          alt=""
                          onError={() => setImageError(true)}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
                      
                      <div className="z-10 text-center p-6 space-y-4 max-w-md animate-fadeIn">
                        {hasResumeOption ? (
                          <div className="space-y-3">
                            <button 
                              onClick={() => handleStartPlay(true)}
                              className="w-full px-6 py-3.5 bg-brand-accent hover:bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-brand-accent/25 min-h-[44px]"
                            >
                              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              <span>Resume Watching (Continue from {formatTime(currentPos)})</span>
                            </button>
 
                            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-brand-accent h-full"
                                style={{ width: `${percentWatched}%` }}
                              />
                            </div>

                            <button 
                              onClick={() => handleStartPlay(false)}
                              className="text-xs text-neutral-400 hover:text-white font-semibold transition-colors underline cursor-pointer p-2 min-h-[44px]"
                            >
                              Start From Beginning
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleStartPlay(false)}
                            className="w-20 h-20 rounded-full bg-brand-accent hover:bg-blue-600 flex items-center justify-center mx-auto cursor-pointer transform hover:scale-110 active:scale-95 transition-all duration-300 ease-[var(--ease-spring-premium)] group/btn btn-premium shadow-xl shadow-brand-accent/30 min-h-[44px] min-w-[44px]"
                          >
                            <svg className="w-8 h-8 fill-current text-white translate-x-1 group-hover/btn:scale-115 transition-transform" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        )}

                        <div>
                          <h4 className="font-extrabold text-xl font-display text-white tracking-wide">
                            Watch {movie.title}
                          </h4>
                          <div className="flex items-center justify-center gap-2 mt-1" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Player Overlays when Playing */}
                  {isPlaying && (
                    <>
                      {/* Top-Left: Close Player Button */}
                      <div className={`absolute top-4 left-4 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.pause();
                              saveProgress(videoRef.current.currentTime, videoRef.current.duration || (movie.duration_minutes * 60));
                            }
                            setIsPlaying(false);
                          }}
                          className="text-xs bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white font-bold px-3 py-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-lg min-h-[44px]"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Close</span>
                        </button>
                      </div>

                      {/* Unified Netflix-Style Custom Player Controls Overlay */}
                      <div className={`absolute bottom-0 inset-x-0 z-20 flex flex-col bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 md:p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        {/* Custom Progress / Seek Bar */}
                        <div className="w-full mb-3.5 flex items-center gap-3.5 group/progress">
                          <span className="text-[10px] text-neutral-400 font-mono select-none">
                            {formatTime(videoCurrentTime)}
                          </span>
                          <input
                            type="range"
                            min="0"
                            max={videoDuration || 100}
                            step="0.1"
                            value={videoCurrentTime}
                            onChange={handleSeek}
                            className="flex-grow h-1.5 bg-white/20 accent-brand-accent rounded-lg cursor-pointer transition-all group-hover/progress:h-2"
                            title="Seek"
                          />
                          <span className="text-[10px] text-neutral-400 font-mono select-none">
                            {formatTime(videoDuration)}
                          </span>
                        </div>

                        {/* Controls Bottom Row */}
                        <div className="flex items-center justify-between w-full">
                          {/* Bottom Left controls: Play/Pause, Volume, Time Display */}
                          <div className="flex items-center gap-3">
                            {/* Play/Pause Button */}
                            <button
                              type="button"
                              onClick={togglePlayPause}
                              className="p-2 text-white/90 hover:text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer rounded-xl hover:bg-white/10 flex items-center justify-center min-h-[44px] min-w-[44px]"
                              title={isPaused ? "Play" : "Pause"}
                            >
                              {isPaused ? (
                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                </svg>
                              )}
                            </button>

                            {/* Volume controls with smooth expanded slider */}
                            <div className="relative flex items-center group/vol">
                              <button
                                type="button"
                                onClick={toggleMute}
                                className="p-2.5 text-white/80 hover:text-white transition-colors cursor-pointer rounded-xl hover:bg-white/10 flex items-center justify-center min-h-[44px] min-w-[44px]"
                                title={isMuted ? "Unmute (M)" : "Mute (M)"}
                              >
                                {isMuted || volume === 0 ? (
                                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                  </svg>
                                ) : volume < 0.5 ? (
                                  <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.314M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                  </svg>
                                )}
                              </button>
                              <div className="w-0 group-hover/vol:w-20 group-focus-within/vol:w-20 overflow-hidden transition-all duration-300 ease-out flex items-center pr-1">
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={isMuted ? 0 : volume}
                                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                  className="w-16 h-1 bg-white/30 accent-brand-accent rounded-lg cursor-pointer"
                                  title="Volume adjustment"
                                />
                              </div>
                            </div>

                            {/* Time details */}
                            <div className="text-xs text-neutral-300 font-semibold select-none hidden sm:block">
                              <span>{formatTime(videoCurrentTime)}</span>
                              <span className="mx-1.5 text-neutral-600">/</span>
                              <span>{formatTime(videoDuration)}</span>
                            </div>
                          </div>

                          {/* Bottom Right controls: Quality settings, Fullscreen */}
                          <div className="flex items-center gap-3">
                            {/* Quality Menu select */}
                            {streamType === 'HLS' && levels.length > 1 && (
                              <div className="relative flex items-center p-1 rounded-xl hover:bg-white/10 transition-colors">
                                <label htmlFor="quality-select" className="p-1.5 text-white/80 cursor-pointer flex items-center gap-1.5 min-h-[44px] min-w-[44px] justify-center" title="Quality / Settings">
                                  <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </label>
                                <select
                                  id="quality-select"
                                  value={selectedLevel}
                                  onChange={(e) => handleQualityChange(parseInt(e.target.value))}
                                  className="text-xs bg-transparent text-white font-extrabold uppercase cursor-pointer outline-none border-none py-1 pr-1.5 focus:ring-0 appearance-none font-sans"
                                  title="Video Quality Menu"
                                >
                                  {levels.map((lvl) => (
                                    <option key={lvl.index} value={lvl.index} className="bg-[#141414] text-white font-sans uppercase animate-fadeIn">
                                      {lvl.name === 'Auto'
                                        ? (selectedLevel === -1 && currentAutoResolution ? `Auto (${currentAutoResolution})` : 'Auto')
                                        : lvl.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Fullscreen Button */}
                            <button
                              onClick={toggleContainerFullscreen}
                              className="p-2.5 text-white/80 hover:text-white transition-colors cursor-pointer rounded-xl hover:bg-white/10 flex items-center justify-center min-h-[44px] min-w-[44px]"
                              title="Toggle Fullscreen (F)"
                            >
                              {isFullscreen ? (
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m7 5l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4m7-5l5 5m0 0v-4m0 4h-4" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Quality Toast Notification */}
                  {qualityToast && (
                    <div className="absolute top-16 z-30 bg-black/80 backdrop-blur-md border border-brand-accent/30 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl animate-fadeIn pointer-events-none">
                      {qualityToast}
                    </div>
                  )}

                  {/* Seek Feedback Indicator */}
                  {seekFeedback && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      <div className="bg-black/75 backdrop-blur-md border border-white/20 text-white text-base font-black px-6 py-3 rounded-2xl shadow-2xl animate-scaleIn">
                        {seekFeedback}
                      </div>
                    </div>
                  )}

                  {/* Cinematic Netflix-style Loading Overlay */}
                  {isPlaying && isPlayerLoading && !playerError && (
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-20 pointer-events-none transition-opacity duration-300">
                      <div className="relative flex items-center justify-center mb-4">
                        <div className="w-14 h-14 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
                        <div className="absolute w-8 h-8 border-2 border-white/20 border-b-white rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                      </div>
                      <h4 className="text-sm font-bold text-white tracking-wider uppercase">{movie.title}</h4>
                      <p className="mt-2 text-xs text-neutral-400 font-medium tracking-wider uppercase animate-pulse">Loading...</p>
                    </div>
                  )}

                  {/* Buffering Overlay */}
                  {isBuffering && !isPlayerLoading && !playerError && (
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm flex flex-col items-center justify-center z-20 pointer-events-none transition-opacity duration-300">
                      <div className="w-10 h-10 border-4 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin mb-2"></div>
                      <p className="text-[11px] text-white font-bold uppercase tracking-wider">Loading...</p>
                    </div>
                  )}

                  {/* Premium Error State Card */}
                  {playerError && (
                    <div className="absolute inset-0 bg-[#141414]/95 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-30 transition-all duration-300">
                      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h5 className="text-base font-black text-white uppercase tracking-wide">Playback Unavailable</h5>
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
                          className="px-5 py-2.5 bg-brand-accent hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                        >
                          Retry Playback
                        </button>
                        <button
                          onClick={() => navigate('/')}
                          className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold rounded-lg border border-white/10 transition-all cursor-pointer"
                        >
                          Back to Browse
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Metadata Detail Fields */}
                <div className="w-full lg:w-2/5 p-8 md:p-12 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter font-display leading-tight text-white uppercase">
                      {movie.title}
                    </h2>
                    <div className="flex items-center text-xs text-brand-textMuted gap-3 font-semibold">
                      <span className="text-brand-accent font-black">{movie.release_year}</span>
                      <span className="text-neutral-600">•</span>
                      <span>{movie.duration_minutes} minutes</span>
                      <span className="ml-auto text-[8px] text-neutral-500 font-bold">HLS / 4K</span>
                    </div>
                    <p className="text-xs md:text-sm text-brand-textMuted leading-relaxed pt-2 font-sans max-w-[65ch]">
                      {movie.description}
                    </p>



                    {/* Watchlist Toggle Action Button */}
                    <div className="pt-1">
                      <button
                        onClick={handleToggleWatchlist}
                        disabled={watchlistSubmitting}
                        className={`w-full py-3.5 px-5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                          isInWatchlist
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
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

                  <div className="space-y-4 pt-6">
                    <div>
                      <span className="text-xs text-neutral-500 uppercase tracking-wider block mb-2 font-medium">Genres</span>
                      <div className="flex flex-wrap gap-2">
                        {movie.genres.map(g => (
                          <span 
                            key={g.genre_id}
                            className="px-3 py-1 bg-white/[0.04] border border-white/5 text-xs rounded-lg text-neutral-300 font-medium"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Similar Movies Section */}
              {similarMovies.length > 0 && (
                <div className="space-y-5 pt-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-extrabold tracking-tight text-white font-display">
                      Similar Movies
                    </h3>
                  </div>

                  <div className="relative group/row">
                    <button 
                      onClick={() => scrollSimilar('left')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-all duration-300 active:scale-90 select-none cursor-pointer"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-all duration-300 active:scale-90 select-none cursor-pointer"
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

        <Footer />
      </div>
    </div>
  );
};

export default MovieDetails;
