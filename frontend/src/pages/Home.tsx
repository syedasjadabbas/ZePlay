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
}

interface BecauseYouWatchedState {
  because_movie: Movie | null;
  recommendations: Movie[];
}

const Home: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('User');
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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [genresRes, moviesRes, trendingRes, popularRes, recAddedRes] = await Promise.all([
        api.get('/catalog/genres'),
        api.get('/catalog/movies'),
        api.get('/recommendations/trending'),
        api.get('/recommendations/popular'),
        api.get('/recommendations/recently-added')
      ]);

      setGenres(genresRes.data);
      const moviesData = moviesRes.data;
      setMovies(moviesData);
      setTrendingMovies(trendingRes.data);
      setPopularMovies(popularRes.data);
      setRecentlyAddedMovies(recAddedRes.data);

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

  const displayedMovies = selectedGenre
    ? movies.filter(movie => movie.genres.some(g => g.name === selectedGenre))
    : movies;

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col justify-between min-h-screen">
        <TopBar profileName={profileName} />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 space-y-16 max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <div className="text-sm font-medium text-neutral-400 animate-pulse">Loading personalized dashboard...</div>
            </div>
          ) : (
            <>
              {/* Featured Hero Banner */}
              {heroMovie && !selectedGenre && (
                <div 
                  className="relative w-full h-[450px] rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(6,11,24,0.9)] flex items-end p-8 md:p-16 bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(to right, rgba(6, 11, 24, 0.95) 25%, rgba(6, 11, 24, 0.5) 60%, rgba(6, 11, 24, 0.2) 100%), url(${heroMovie.thumbnail_url})`
                  }}
                >
                  <div className="max-w-2xl z-10 space-y-5">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold text-brand-accent tracking-widest uppercase bg-brand-accent/15 px-2.5 py-1 rounded-md border border-brand-accent/25">
                      • Featured
                    </span>
                    <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter font-display leading-none uppercase drop-shadow-2xl text-white">
                      {heroMovie.title}
                    </h2>
                    <p className="text-sm text-brand-textMuted leading-relaxed line-clamp-2 max-w-xl">
                      {heroMovie.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-brand-textMuted font-semibold pt-1">
                      <span className="flex items-center gap-1.5 text-brand-accent">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        8.6
                      </span>
                      <span>•</span>
                      <span>{heroMovie.release_year}</span>
                      <span>•</span>
                      <span>{heroMovie.duration_minutes} min</span>
                      {heroMovie.genres && heroMovie.genres.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="uppercase text-[9px] tracking-widest font-extrabold bg-brand-cards border border-white/5 px-2 py-0.5 rounded">
                            {heroMovie.genres.map(g => g.name).join(', ')}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      <button 
                        onClick={() => navigate(`/movies/${heroMovie.movie_id}`)}
                        className="px-8 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(59,130,246,0.35)] text-sm hover:-translate-y-0.5"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch Now
                      </button>
                      <button 
                        onClick={() => navigate(`/movies/${heroMovie.movie_id}`)}
                        className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-md text-white font-bold rounded-xl transition-all text-sm hover:-translate-y-0.5"
                      >
                        More Info
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Browse by Genre */}
              <div className="space-y-4">
                <h3 className="text-xl md:text-2xl font-bold tracking-tight font-display text-white">
                  Browse by Genre
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedGenre(null)}
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      !selectedGenre 
                        ? 'bg-brand-accent border-brand-accent text-white shadow-lg shadow-blue-500/10' 
                        : 'bg-[#101C40] border-white/5 text-brand-textMuted hover:bg-[#182350] hover:text-white'
                    }`}
                  >
                    All Genres
                  </button>
                  {genres.map(g => (
                    <button
                      key={g.genre_id}
                      onClick={() => setSelectedGenre(g.name)}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        selectedGenre === g.name 
                          ? 'bg-brand-accent border-brand-accent text-white shadow-lg shadow-blue-500/10' 
                          : 'bg-[#101C40] border-white/5 text-brand-textMuted hover:bg-[#182350] hover:text-white'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedGenre ? (
                <div className="space-y-6">
                  <h3 className="text-2xl md:text-3xl font-bold font-display text-white mb-6 border-l-4 border-brand-accent pl-3">
                    {selectedGenre} Category
                  </h3>
                  {displayedMovies.length === 0 ? (
                    <div className="text-neutral-500 text-sm">No videos found in this genre.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {displayedMovies.map(movie => (
                        <MovieCardVertical
                          key={movie.movie_id}
                          movie_id={movie.movie_id}
                          title={movie.title}
                          thumbnail_url={movie.thumbnail_url}
                          release_year={movie.release_year}
                          duration_minutes={movie.duration_minutes}
                          genres={movie.genres}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {movies.length === 0 ? (
                    <div className="text-center py-20 bg-brand-surface border border-white/5 rounded-2xl">
                      <p className="text-neutral-400 mb-2">No videos cataloged in this workspace.</p>
                      <div className="text-xs text-neutral-600">Register catalog elements using admin endpoint.</div>
                    </div>
                  ) : (
                    <>
                      {/* 1. Continue Watching */}
                      {continueWatchingItems.length > 0 && (
                        <div className="space-y-5">
                          <div className="flex justify-between items-center">
                            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display flex items-center gap-3">
                              <span>Continue Watching</span>
                              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-sans">
                                Active ({continueWatchingItems.length})
                              </span>
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
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                                  />
                                );
                              })}
                            </div>

                            <button 
                              onClick={() => scroll(continueRef, 'right')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display flex items-center gap-3">
                            <span>Recommended For You</span>
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-sans">
                              Personalized
                            </span>
                          </h3>
                          <div className="relative group/row">
                            <button 
                              onClick={() => scroll(recommendedRef, 'left')}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                                />
                              ))}
                            </div>

                            <button 
                              onClick={() => scroll(recommendedRef, 'right')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                                />
                              ))}
                            </div>

                            <button 
                              onClick={() => scroll(becauseRef, 'right')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                                />
                              ))}
                            </div>

                            <button 
                              onClick={() => scroll(trendingRef, 'right')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                                />
                              ))}
                            </div>

                            <button 
                              onClick={() => scroll(recentlyAddedRef, 'right')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
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
                                />
                              ))}
                            </div>

                            <button 
                              onClick={() => scroll(popularRef, 'right')}
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
                  )}
                </>
              )}
            </>
          )}
        </main>

        <footer className="p-6 text-center text-xs text-neutral-600 border-t border-white/5 bg-[#081225]/40 backdrop-blur-sm">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default Home;
