import React, { useEffect, useState, useRef } from 'react';
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

interface BecauseYouWatchedState {
  because_movie: Movie | null;
  recommendations: Movie[];
}

const Home: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [profileName] = useState(() => localStorage.getItem('selectedProfileName') || 'User');
  const [loading, setLoading] = useState(true);
  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);

  // Recommendation engine state
  const [personalizedMovies, setPersonalizedMovies] = useState<Movie[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<BecauseYouWatchedState>({ because_movie: null, recommendations: [] });
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [recentlyAddedMovies, setRecentlyAddedMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [continueWatchingItems, setContinueWatchingItems] = useState<any[]>([]);

  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  // Carousel refs
  const trendingRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const recentlyAddedRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);
  const becauseRef = useRef<HTMLDivElement>(null);

  const scroll = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 480;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (!activeProfileId) {
      navigate('/profiles');
      return;
    }
  }, [activeProfileId, navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [moviesRes, trendingRes, popularRes, recAddedRes] = await Promise.all([
        api.get('/catalog/movies').catch(() => ({ data: [] })),
        api.get('/recommendations/trending').catch(() => ({ data: [] })),
        api.get('/recommendations/popular').catch(() => ({ data: [] })),
        api.get('/recommendations/recently-added').catch(() => ({ data: [] }))
      ]);

      const moviesData = moviesRes.data || [];
      setMovies(moviesData);
      setTrendingMovies(trendingRes.data || []);
      setPopularMovies(popularRes.data || []);
      setRecentlyAddedMovies(recAddedRes.data || []);

      const interstellar = moviesData.find((m: any) => m.title.toLowerCase() === 'interstellar');
      if (interstellar) {
        setHeroMovie(interstellar);
      } else if (moviesData.length > 0) {
        setHeroMovie(moviesData[0]);
      }

      if (activeProfileId) {
        const [cwRes, persRes, bywRes] = await Promise.all([
          api.get(`/watch-history/continue-watching?profile_id=${activeProfileId}`).catch(() => ({ data: [] })),
          api.get(`/recommendations/personalized?profile_id=${activeProfileId}`).catch(() => ({ data: [] })),
          api.get(`/recommendations/because-you-watched?profile_id=${activeProfileId}`).catch(() => ({ data: { because_movie: null, recommendations: [] } }))
        ]);

        setContinueWatchingItems(cwRes.data);
        setPersonalizedMovies(persRes.data);
        setBecauseYouWatched(bywRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load catalog & recommendation data.", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeProfileId]);

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-56 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 space-y-16 max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <div className="text-sm font-medium text-neutral-400 animate-pulse">Loading personalized dashboard...</div>
            </div>
          ) : (
            <>
              {/* Featured Hero Banner */}
              {heroMovie && (
                <div 
                  className="relative w-full h-[65vh] min-h-[480px] rounded-[32px] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.85)] flex items-end p-8 md:p-16 bg-cover bg-center group"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(6, 11, 24, 1) 0%, rgba(6, 11, 24, 0.75) 30%, rgba(0, 0, 0, 0) 100%), linear-gradient(to right, rgba(6, 11, 24, 0.95) 20%, rgba(6, 11, 24, 0.45) 65%, rgba(0, 0, 0, 0) 100%), url(${heroMovie.thumbnail_url})`
                  }}
                >
                  <div className="max-w-2xl z-10 space-y-5">
                    <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter font-display leading-none uppercase drop-shadow-2xl text-white">
                      {heroMovie.title}
                    </h2>
                    <p className="text-sm text-brand-textMuted leading-relaxed line-clamp-2 max-w-xl">
                      {heroMovie.description}
                    </p>
                    
                    <div className="flex items-center gap-3 text-xs text-neutral-400 pt-1">
                      <span>{heroMovie.release_year}</span>
                      <span>·</span>
                      <span>{heroMovie.duration_minutes} min</span>
                      {heroMovie.genres && heroMovie.genres.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{heroMovie.genres.map(g => g.name).join(', ')}</span>
                        </>
                      )}
                    </div>
 
                    <div className="flex items-center gap-4 pt-2">
                      <button 
                        onClick={() => navigate(`/movies/${heroMovie.movie_id}`)}
                        className="px-8 py-3.5 bg-white hover:bg-neutral-200 text-black font-extrabold rounded-2xl transition-all flex items-center gap-2 shadow-lg text-sm active:scale-95 btn-premium cursor-pointer"
                      >
                        <svg className="w-4 h-4 fill-current text-black" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Play
                      </button>
                      <button 
                        onClick={() => navigate(`/movies/${heroMovie.movie_id}`)}
                        className="px-8 py-3.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-extrabold rounded-2xl transition-all text-sm active:scale-95 backdrop-blur-md btn-premium cursor-pointer"
                      >
                        More Info
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {movies.length === 0 ? (
                <div className="text-center py-20 bg-brand-surface rounded-2xl">
                  <p className="text-neutral-400 mb-2">No videos cataloged in this workspace.</p>
                  <div className="text-xs text-neutral-600">Register catalog elements using admin endpoint.</div>
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
                          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                        >
                          {continueWatchingItems.map((item: any) => {
                            const m = item.movie;
                            if (!m) return null;
                            return (
                              <MovieCardVertical
                                key={item.history_id}
                                movie_id={m.movie_id}
                                title={m.title}
                                thumbnail_url={m.thumbnail_url}
                                release_year={m.release_year}
                                duration_minutes={m.duration_minutes}
                                genres={m.genres || []}
                                progressPercent={Math.min(Math.round(item.percentage_watched), 100)}
                                ratingScore={m.average_rating}
                              />
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
                    <div className="space-y-5">
                      <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                        Recommended For You
                      </h3>
                      <div className="relative group/row">
                        <button 
                          onClick={() => scroll(recommendedRef, 'left')}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div 
                          ref={recommendedRef} 
                          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                        >
                          {personalizedMovies.map(movie => (
                            <MovieCardVertical
                              key={movie.movie_id}
                              movie_id={movie.movie_id}
                              title={movie.title}
                              thumbnail_url={movie.thumbnail_url}
                              release_year={movie.release_year}
                              duration_minutes={movie.duration_minutes}
                              genres={movie.genres}
                              ratingScore={movie.average_rating}
                            />
                          ))}
                        </div>

                        <button 
                          onClick={() => scroll(recommendedRef, 'right')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. Because You Watched */}
                  {becauseYouWatched.because_movie && becauseYouWatched.recommendations.length > 0 && (
                    <div className="space-y-5">
                      <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                        Because You Watched <span className="text-brand-accent">"{becauseYouWatched.because_movie.title}"</span>
                      </h3>
                      <div className="relative group/row">
                        <button 
                          onClick={() => scroll(becauseRef, 'left')}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div 
                          ref={becauseRef} 
                          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                        >
                          {becauseYouWatched.recommendations.map(movie => (
                            <MovieCardVertical
                              key={movie.movie_id}
                              movie_id={movie.movie_id}
                              title={movie.title}
                              thumbnail_url={movie.thumbnail_url}
                              release_year={movie.release_year}
                              duration_minutes={movie.duration_minutes}
                              genres={movie.genres}
                              ratingScore={movie.average_rating}
                            />
                          ))}
                        </div>

                        <button 
                          onClick={() => scroll(becauseRef, 'right')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 4. Trending Now */}
                  {trendingMovies.length > 0 && (
                    <div className="space-y-5">
                      <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                        Trending Now
                      </h3>
                      <div className="relative group/row">
                        <button 
                          onClick={() => scroll(trendingRef, 'left')}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div 
                          ref={trendingRef} 
                          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                        >
                          {trendingMovies.map(movie => (
                            <MovieCardVertical
                              key={movie.movie_id}
                              movie_id={movie.movie_id}
                              title={movie.title}
                              thumbnail_url={movie.thumbnail_url}
                              release_year={movie.release_year}
                              duration_minutes={movie.duration_minutes}
                              genres={movie.genres}
                              ratingScore={movie.average_rating}
                            />
                          ))}
                        </div>

                        <button 
                          onClick={() => scroll(trendingRef, 'right')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 5. Recently Added */}
                  {recentlyAddedMovies.length > 0 && (
                    <div className="space-y-5">
                      <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                        Recently Added
                      </h3>
                      <div className="relative group/row">
                        <button 
                          onClick={() => scroll(recentlyAddedRef, 'left')}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div 
                          ref={recentlyAddedRef} 
                          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                        >
                          {recentlyAddedMovies.map(movie => (
                            <MovieCardVertical
                              key={movie.movie_id}
                              movie_id={movie.movie_id}
                              title={movie.title}
                              thumbnail_url={movie.thumbnail_url}
                              release_year={movie.release_year}
                              duration_minutes={movie.duration_minutes}
                              genres={movie.genres}
                              ratingScore={movie.average_rating}
                            />
                          ))}
                        </div>

                        <button 
                          onClick={() => scroll(recentlyAddedRef, 'right')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 6. Popular Movies */}
                  {popularMovies.length > 0 && (
                    <div className="space-y-5">
                      <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                        Popular Movies
                      </h3>
                      <div className="relative group/row">
                        <button 
                          onClick={() => scroll(popularRef, 'left')}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div 
                          ref={popularRef} 
                          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                        >
                          {popularMovies.map(movie => (
                            <MovieCardVertical
                              key={movie.movie_id}
                              movie_id={movie.movie_id}
                              title={movie.title}
                              thumbnail_url={movie.thumbnail_url}
                              release_year={movie.release_year}
                              duration_minutes={movie.duration_minutes}
                              genres={movie.genres}
                              ratingScore={movie.average_rating}
                            />
                          ))}
                        </div>

                        <button 
                          onClick={() => scroll(popularRef, 'right')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                        >
                          <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>

        <footer className="p-6 text-center text-xs text-neutral-500 bg-[#081225]/40 backdrop-blur-sm space-y-1">
          <div>&copy; {new Date().getFullYear()} ZePlay. All rights reserved.</div>
          <div>
            <a 
              href="https://zeploy.tech" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-brand-accent hover:underline font-bold tracking-wider"
            >
              POWERED BY ZEPLOY TECH
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
