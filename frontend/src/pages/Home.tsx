import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_ORIGIN } from '../services/api';
import { queryClient, QUERY_KEYS } from '../services/queryClient';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MovieCardVertical from '../components/MovieCardVertical';
import Footer from '../components/Footer';

import { HeroSkeleton, MovieCardSkeleton } from '../components/Skeleton';
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

interface BecauseYouWatchedState {
  because_movie: Movie | null;
  recommendations: Movie[];
}

/** Preload an image by creating an Image object */
function preloadImage(src: string) {
  if (!src) return;
  const img = new Image();
  img.src = src;
}

const HERO_INTERVAL_MS = 9000; // 9 second auto-rotate

const Home: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [profileName] = useState(() => localStorage.getItem('selectedProfileName') || 'User');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [heroMovies, setHeroMovies] = useState<Movie[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  // Track which hero images have been preloaded
  const preloadedHero = useRef<Set<string>>(new Set());

  // Recommendation engine state
  const [personalizedMovies, setPersonalizedMovies] = useState<Movie[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<BecauseYouWatchedState>({ because_movie: null, recommendations: [] });
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [recentlyAddedMovies, setRecentlyAddedMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [continueWatchingItems, setContinueWatchingItems] = useState<any[]>([]);
  // Track items being removed for smooth animation
  const [removingItems] = useState<Set<string>>(new Set());

  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  // Carousel refs
  const trendingRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const recentlyAddedRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);
  const becauseRef = useRef<HTMLDivElement>(null);
  const heroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direction === 'left' ? -480 : 480,
        behavior: 'smooth'
      });
    }
  };

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY * 1.2;
    }
  };

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
    }
  }, [activeProfileId, navigate]);

  const [error, setError] = useState<string | null>(null);

  // Preload hero images eagerly
  const preloadHeroImages = useCallback((movies: Movie[], currentIdx: number) => {
    // Always preload current + next
    const indices = [currentIdx, (currentIdx + 1) % movies.length];
    indices.forEach(idx => {
      const url = movies[idx]?.thumbnail_url;
      if (url && !preloadedHero.current.has(url)) {
        preloadImage(url);
        preloadedHero.current.add(url);
      }
    });
  }, []);

  const fetchDashboardData = async () => {
    try {
      setError(null);

      // Check React Query cache for catalog movies first
      const cachedMovies = queryClient.getQueryData<Movie[]>(QUERY_KEYS.movies);
      if (cachedMovies && cachedMovies.length > 0) {
        setMovies(cachedMovies);
        const realMovies = cachedMovies.filter((m: any) => !m.is_generated);
        const heroSource = realMovies.length >= 3 ? realMovies : cachedMovies;
        setHeroMovies(heroSource.slice(0, 5));
        setCatalogLoading(false);
      } else {
        setCatalogLoading(true);
      }

      // Hydrate secondary section states from React Query cache immediately
      const cachedTrending = queryClient.getQueryData<Movie[]>(QUERY_KEYS.trending);
      if (cachedTrending) setTrendingMovies(cachedTrending);

      const cachedPopular = queryClient.getQueryData<Movie[]>(QUERY_KEYS.popular);
      if (cachedPopular) setPopularMovies(cachedPopular);

      const cachedRecentlyAdded = queryClient.getQueryData<Movie[]>(QUERY_KEYS.recentlyAdded);
      if (cachedRecentlyAdded) setRecentlyAddedMovies(cachedRecentlyAdded);

      if (activeProfileId) {
        const cachedCW = queryClient.getQueryData<any[]>(QUERY_KEYS.continueWatching(activeProfileId));
        if (cachedCW) setContinueWatchingItems(cachedCW);

        const cachedPers = queryClient.getQueryData<Movie[]>(QUERY_KEYS.personalized(activeProfileId));
        if (cachedPers) setPersonalizedMovies(cachedPers);

        const cachedBYW = queryClient.getQueryData<BecauseYouWatchedState>(QUERY_KEYS.becauseYouWatched(activeProfileId));
        if (cachedBYW) setBecauseYouWatched(cachedBYW);
      }

      // Fetch primary catalog in background
      queryClient.fetchQuery({
        queryKey: QUERY_KEYS.movies,
        queryFn: () => api.get('/catalog/movies?limit=5').then(r => r.data),
        staleTime: 5 * 60 * 1000
      }).then((moviesData: Movie[]) => {
        if (moviesData && Array.isArray(moviesData)) {
          setMovies(moviesData);
          const realMovies = moviesData.filter((m: any) => !m.is_generated);
          const heroSource = realMovies.length >= 3 ? realMovies : moviesData;
          const carouselMovies = heroSource.slice(0, 5);
          setHeroMovies(carouselMovies);

          if (carouselMovies.length > 0) {
            preloadImage(carouselMovies[0].thumbnail_url);
            preloadedHero.current.add(carouselMovies[0].thumbnail_url);
            if (carouselMovies.length > 1) {
              preloadImage(carouselMovies[1].thumbnail_url);
              preloadedHero.current.add(carouselMovies[1].thumbnail_url);
            }
          }
        }
        setCatalogLoading(false);
      }).catch((err) => {
        console.error("Primary catalog load error", err);
        setCatalogLoading(false);
      });

      // Fetch secondary recommendations independently without a blocking Promise.all
      setSecondaryLoading(false);

      queryClient.fetchQuery({
        queryKey: QUERY_KEYS.trending,
        queryFn: () => api.get('/recommendations/trending').then(r => r.data),
        staleTime: 5 * 60 * 1000
      }).then(r => setTrendingMovies(r || [])).catch(() => {});

      queryClient.fetchQuery({
        queryKey: QUERY_KEYS.popular,
        queryFn: () => api.get('/recommendations/popular').then(r => r.data),
        staleTime: 5 * 60 * 1000
      }).then(r => setPopularMovies(r || [])).catch(() => {});

      queryClient.fetchQuery({
        queryKey: QUERY_KEYS.recentlyAdded,
        queryFn: () => api.get('/recommendations/recently-added').then(r => r.data),
        staleTime: 5 * 60 * 1000
      }).then(r => setRecentlyAddedMovies(r || [])).catch(() => {});

      if (activeProfileId) {
        queryClient.fetchQuery({
          queryKey: QUERY_KEYS.continueWatching(activeProfileId),
          queryFn: () => api.get(`/watch-history/continue-watching?profile_id=${activeProfileId}`).then(r => r.data),
          staleTime: 60 * 1000
        }).then(r => setContinueWatchingItems(r || [])).catch(() => {});

        queryClient.fetchQuery({
          queryKey: QUERY_KEYS.personalized(activeProfileId),
          queryFn: () => api.get(`/recommendations/personalized?profile_id=${activeProfileId}`).then(r => r.data),
          staleTime: 3 * 60 * 1000
        }).then(r => setPersonalizedMovies(r || [])).catch(() => {});

        queryClient.fetchQuery({
          queryKey: QUERY_KEYS.becauseYouWatched(activeProfileId),
          queryFn: () => api.get(`/recommendations/because-you-watched?profile_id=${activeProfileId}`).then(r => r.data),
          staleTime: 3 * 60 * 1000
        }).then(r => setBecauseYouWatched(r || { because_movie: null, recommendations: [] })).catch(() => {});
      }
    } catch (err: any) {
      setError("Failed to load dashboard. Please try again.");
      setCatalogLoading(false);
      setSecondaryLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeProfileId]);

  // Hero auto-rotate with pause-on-hover
  const startHeroInterval = useCallback(() => {
    if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    heroIntervalRef.current = setInterval(() => {
      setCurrentSlideIndex(prev => {
        const next = (prev + 1) % heroMovies.length;
        preloadHeroImages(heroMovies, next);
        return next;
      });
    }, HERO_INTERVAL_MS);
  }, [heroMovies, preloadHeroImages]);

  useEffect(() => {
    if (heroMovies.length <= 1) return;
    if (!heroPaused) {
      startHeroInterval();
    } else {
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    }
    return () => { if (heroIntervalRef.current) clearInterval(heroIntervalRef.current); };
  }, [heroMovies.length, heroPaused, startHeroInterval]);

  useEffect(() => {
    if (heroMovies.length > 1) {
      preloadHeroImages(heroMovies, currentSlideIndex);
    }
  }, [currentSlideIndex, heroMovies, preloadHeroImages]);

  const handleDotClick = (index: number) => {
    setCurrentSlideIndex(index);
    if (!heroPaused) startHeroInterval();
  };

  const CarouselRow = ({
    title,
    movies: rowMovies,
    scrollRef,
    extra,
  }: {
    title: React.ReactNode;
    movies: any[];
    scrollRef: React.RefObject<HTMLDivElement>;
    extra?: React.ReactNode;
  }) => (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
          {title}
        </h3>
        {extra}
      </div>
      <div className="relative group/row">
        <button
          onClick={() => scroll(scrollRef, 'left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
        >
          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          ref={scrollRef}
          onWheel={handleWheelScroll}
          className="flex gap-6 overflow-x-auto py-8 -my-6 px-3 scrollbar-hide scroll-smooth select-none"
        >
          {rowMovies.map((movie: any) => (
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

        <button
          onClick={() => scroll(scrollRef, 'right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
        >
          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none overflow-x-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 ml-0 md:ml-56 flex flex-col justify-between min-h-screen pb-20 md:pb-0 overflow-x-hidden">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-4 sm:px-8 md:px-12 pb-20 space-y-12 md:space-y-16 max-w-7xl mx-auto w-full">
          {catalogLoading ? (
            <div className="space-y-12 animate-fadeIn">
              <HeroSkeleton />
              <div className="space-y-4">
                <div className="h-5 w-44 bg-[#1c1c1c] animate-shimmer rounded" />
                <div className="flex gap-5 overflow-hidden pb-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <MovieCardSkeleton key={i} aspect="vertical" />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-5 w-44 bg-[#1c1c1c] animate-shimmer rounded" />
                <div className="flex gap-5 overflow-hidden pb-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <MovieCardSkeleton key={i} aspect="vertical" />
                  ))}
                </div>
              </div>
            </div>
          ) : error ? (
            <ErrorState
              title="Dashboard Unavailable"
              message={error}
              onRetry={fetchDashboardData}
            />
          ) : (
            <>
              {/* Featured Hero Carousel */}
              {heroMovies.length > 0 && (
                <div
                  className="relative w-full h-[65vh] min-h-[480px] rounded-lg overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.85)] bg-[#141414]"
                  onMouseEnter={() => setHeroPaused(true)}
                  onMouseLeave={() => setHeroPaused(false)}
                >
                  {/* Crossfade Slides */}
                  {heroMovies.map((movie, index) => {
                    const isActive = index === currentSlideIndex;
                    return (
                      <div
                        key={movie.movie_id}
                        className={`absolute inset-0 ${isActive ? 'pointer-events-auto z-10' : 'pointer-events-none z-0'}`}
                        style={{
                          opacity: isActive ? 1 : 0,
                          transition: 'opacity 1.1s cubic-bezier(0.16,1,0.3,1)',
                          willChange: 'opacity',
                        }}
                      >
                        {/* Background image */}
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
                          style={{
                            backgroundImage: `linear-gradient(to top, rgba(20,20,20,1) 0%, rgba(20,20,20,0.75) 30%, rgba(0,0,0,0) 100%), linear-gradient(to right, rgba(20,20,20,0.95) 20%, rgba(20,20,20,0.45) 65%, rgba(0,0,0,0) 100%), url(${API_ORIGIN}/static/backdrops/backdrop_${movie.movie_id}.jpg), url(${movie.thumbnail_url && (movie.thumbnail_url.startsWith('http') || movie.thumbnail_url.startsWith('blob:') || movie.thumbnail_url.startsWith('data:')) ? movie.thumbnail_url : `${API_ORIGIN}${movie.thumbnail_url}`})`,
                          }}
                        />

                        {/* Content */}
                        <div
                          className="max-w-2xl absolute bottom-0 left-0 p-8 md:p-16 space-y-5"
                          style={{
                            transform: isActive ? 'translateY(0)' : 'translateY(16px)',
                            opacity: isActive ? 1 : 0,
                            transition: 'transform 1s cubic-bezier(0.16,1,0.3,1) 0.15s, opacity 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s',
                            willChange: 'transform, opacity',
                          }}
                        >
                          <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-none uppercase drop-shadow-2xl text-white">
                            {movie.title}
                          </h2>
                          <p className="text-sm text-brand-textMuted leading-relaxed line-clamp-2 max-w-xl">
                            {movie.description}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-neutral-400 pt-1">
                            <span>{movie.release_year}</span>
                            <span>·</span>
                            <span>{movie.duration_minutes} min</span>
                            {movie.genres && movie.genres.length > 0 && (
                              <>
                                <span>·</span>
                                <span>{movie.genres.map(g => g.name).join(', ')}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-4 pt-2">
                            <button
                              onClick={() => navigate(`/movies/${movie.movie_id}`)}
                              className="px-8 py-3.5 bg-white hover:bg-neutral-200 text-black font-extrabold rounded-lg transition-all flex items-center gap-2 shadow-lg text-sm active:scale-95 cursor-pointer"
                            >
                              <svg className="w-4 h-4 fill-current text-black" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              Play
                            </button>
                            <button
                              onClick={() => navigate(`/movies/${movie.movie_id}`)}
                              className="px-8 py-3.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-extrabold rounded-lg transition-all text-sm active:scale-95 backdrop-blur-md cursor-pointer"
                            >
                              More Info
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Dot Indicators */}
                  {heroMovies.length > 1 && (
                    <div className="absolute bottom-8 right-8 md:right-16 z-20 flex gap-2">
                      {heroMovies.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => handleDotClick(index)}
                          className="h-2.5 rounded-full transition-all duration-400 cursor-pointer"
                          style={{
                            width: index === currentSlideIndex ? '24px' : '10px',
                            backgroundColor: index === currentSlideIndex ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.35)',
                            transition: 'width 0.35s cubic-bezier(0.16,1,0.3,1), background-color 0.35s ease',
                          }}
                          title={`Go to slide ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {movies.length === 0 ? (
                <div className="text-center py-20 bg-brand-surface rounded-2xl">
                  <p className="text-neutral-400 mb-2">No videos cataloged in this workspace.</p>
                  <div className="text-xs text-neutral-600">Register catalog elements using admin endpoint.</div>
                </div>
              ) : (
                <>
                  {secondaryLoading ? (
                    <div className="space-y-12 animate-fadeIn mt-8">
                      <div className="space-y-4">
                        <div className="h-6 w-48 bg-[#1c1c1c] animate-shimmer rounded" />
                        <div className="flex gap-6 overflow-hidden">
                          {[1, 2, 3, 4, 5, 6].map((idx) => (
                            <MovieCardSkeleton key={idx} aspect="vertical" />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="h-6 w-48 bg-[#1c1c1c] animate-shimmer rounded" />
                        <div className="flex gap-6 overflow-hidden">
                          {[1, 2, 3, 4, 5, 6].map((idx) => (
                            <MovieCardSkeleton key={idx} aspect="vertical" />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 1. Continue Watching */}
                      {continueWatchingItems.length > 0 && (
                        <div className="space-y-5">
                          <div className="flex justify-between items-center">
                            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                              Continue Watching
                            </h3>
                            <span
                              onClick={() => navigate('/history')}
                              className="text-xs text-brand-accent hover:underline cursor-pointer font-semibold flex items-center gap-1"
                            >
                              <span>See History</span>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                          <div className="relative group/row">
                            <button
                              onClick={() => scroll(continueRef, 'left')}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                            >
                              <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>

                            <div
                              ref={continueRef}
                              onWheel={handleWheelScroll}
                              className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth select-none"
                            >
                              {continueWatchingItems.map((item: any) => {
                                const m = item.movie;
                                if (!m) return null;
                                const isRemoving = removingItems.has(item.history_id);
                                return (
                                  <div
                                    key={item.history_id}
                                    style={{
                                      opacity: isRemoving ? 0 : 1,
                                      transform: isRemoving ? 'scale(0.85)' : 'scale(1)',
                                      maxWidth: isRemoving ? '0px' : '200px',
                                      overflow: 'hidden',
                                      transition: 'opacity 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.35s cubic-bezier(0.16,1,0.3,1), max-width 0.4s cubic-bezier(0.16,1,0.3,1)',
                                    }}
                                  >
                                    <MovieCardVertical
                                      movie_id={m.movie_id}
                                      title={m.title}
                                      thumbnail_url={m.thumbnail_url}
                                      release_year={m.release_year}
                                      duration_minutes={m.duration_minutes}
                                      genres={m.genres || []}
                                      progressPercent={Math.min(Math.round(item.percentage_watched), 100)}
                                    />
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              onClick={() => scroll(continueRef, 'right')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                            >
                              <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. Recommended For You */}
                      {personalizedMovies.length > 0 && (
                        <CarouselRow
                          title="Recommended For You"
                          movies={personalizedMovies}
                          scrollRef={recommendedRef}
                        />
                      )}

                      {/* 3. Because You Watched */}
                      {becauseYouWatched.because_movie && becauseYouWatched.recommendations.length > 0 && (
                        <CarouselRow
                          title={<>Because You Watched <span className="text-brand-accent">"{becauseYouWatched.because_movie.title}"</span></>}
                          movies={becauseYouWatched.recommendations}
                          scrollRef={becauseRef}
                        />
                      )}

                      {/* 4. Trending Now */}
                      {trendingMovies.length > 0 && (
                        <CarouselRow
                          title="Trending Now"
                          movies={trendingMovies}
                          scrollRef={trendingRef}
                        />
                      )}

                      {/* 5. Recently Added */}
                      {recentlyAddedMovies.length > 0 && (
                        <CarouselRow
                          title="Recently Added"
                          movies={recentlyAddedMovies}
                          scrollRef={recentlyAddedRef}
                        />
                      )}

                      {/* 6. Popular Movies */}
                      {popularMovies.length > 0 && (
                        <CarouselRow
                          title="Popular Movies"
                          movies={popularMovies}
                          scrollRef={popularRef}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Home;
