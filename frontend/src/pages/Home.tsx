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

const Home: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('User');
  const [loading, setLoading] = useState(true);
  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);
  
  const navigate = useNavigate();
  const activeProfileId = localStorage.getItem('selectedProfileId');

  // Carousel refs
  const trendingRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);

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

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const genresRes = await api.get('/catalog/genres');
      setGenres(genresRes.data);

      const moviesRes = await api.get('/catalog/movies');
      const moviesData = moviesRes.data;
      setMovies(moviesData);

      const interstellar = moviesData.find((m: any) => m.title.toLowerCase() === 'interstellar');
      if (interstellar) {
        setHeroMovie(interstellar);
      } else if (moviesData.length > 0) {
        setHeroMovie(moviesData[0]);
      }
    } catch (err: any) {
      console.error("Failed to load catalog data.", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const displayedMovies = selectedGenre
    ? movies.filter(movie => movie.genres.some(g => g.name === selectedGenre))
    : movies;

  const getMockProgress = (title: string) => {
    switch (title.toLowerCase()) {
      case 'inception': return 35;
      case 'the martian': return 62;
      case 'the expanse': return 82;
      case 'stranger things': return 12;
      case 'the witcher': return 90;
      case 'mindhunter': return 48;
      default: return 50;
    }
  };

  const trendingTitles = ["Dune", "The Batman", "John Wick", "Tenet", "Avatar", "Oppenheimer", "The Dark Knight"];
  const trendingMovies = trendingTitles
    .map(t => movies.find(m => m.title.toLowerCase() === t.toLowerCase()))
    .filter(Boolean) as Movie[];

  const continueTitles = ["Inception", "The Martian", "The Expanse", "Stranger Things", "The Witcher", "Mindhunter"];
  const continueMovies = continueTitles
    .map(t => movies.find(m => m.title.toLowerCase() === t.toLowerCase()))
    .filter(Boolean) as Movie[];

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Panel Viewport */}
      <div className="flex-1 ml-64 flex flex-col justify-between min-h-screen">
        {/* Top Header Bar */}
        <TopBar profileName={profileName} />

        {/* Content Body */}
        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 space-y-16 max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <div className="text-sm font-medium text-neutral-450 animate-pulse">Loading dashboard catalog...</div>
            </div>
          ) : (
            <>
              {/* Large Cinematic Featured Hero Banner */}
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
                    
                    {/* Premium Metadata indicators with SVGs */}
                    <div className="flex items-center gap-4 text-xs text-brand-textMuted font-semibold pt-1">
                      <span className="flex items-center gap-1.5 text-brand-accent">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        8.6
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        2014
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        169 min
                      </span>
                      <span>•</span>
                      <span className="uppercase text-[9px] tracking-widest font-extrabold bg-brand-cards border border-white/5 px-2 py-0.5 rounded">
                        Sci-Fi, Adventure
                      </span>
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

                  {/* Centered Pagination Indicators */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-accent shadow-lg shadow-blue-500/50" />
                    <span className="w-2 h-2 rounded-full bg-neutral-600" />
                    <span className="w-2 h-2 rounded-full bg-neutral-600" />
                    <span className="w-2 h-2 rounded-full bg-neutral-600" />
                    <span className="w-2 h-2 rounded-full bg-neutral-600" />
                  </div>
                </div>
              )}

              {/* Browse by Genre - Glassmorphic pills */}
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

              {/* Filter lists */}
              {selectedGenre ? (
                <div className="space-y-6">
                  <h3 className="text-2xl md:text-3xl font-bold font-display text-white mb-6 border-l-4 border-brand-accent pl-3">
                    {selectedGenre} Category
                  </h3>
                  {displayedMovies.length === 0 ? (
                    <div className="text-neutral-500 text-sm">No videos found.</div>
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
                      {/* Trending Now Slider Row */}
                      <div className="space-y-5">
                        <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                          Trending Now
                        </h3>
                        <div className="relative group/row">
                          {/* Carousel Left arrow control */}
                          <button 
                            onClick={() => scroll(trendingRef, 'left')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
                          >
                            <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          {/* Scrollable list */}
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

                          {/* Carousel Right arrow control */}
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

                      {/* Continue Watching Slider Row */}
                      <div className="space-y-5">
                        <div className="flex justify-between items-center">
                          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                            Continue Watching
                          </h3>
                          <span className="text-xs text-brand-accent hover:underline cursor-pointer font-semibold">
                            See All
                          </span>
                        </div>
                        <div className="relative group/row">
                          {/* Carousel Left arrow control */}
                          <button 
                            onClick={() => scroll(continueRef, 'left')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
                          >
                            <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>

                          {/* Scrollable list */}
                          <div 
                            ref={continueRef} 
                            className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                          >
                            {continueMovies.map(movie => (
                              <MovieCardVertical
                                key={movie.movie_id}
                                movie_id={movie.movie_id}
                                title={movie.title}
                                thumbnail_url={movie.thumbnail_url}
                                release_year={movie.release_year}
                                duration_minutes={movie.duration_minutes}
                                genres={movie.genres}
                                progressPercent={getMockProgress(movie.title)}
                              />
                            ))}
                          </div>

                          {/* Carousel Right arrow control */}
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

                      {/* Recommended For You Slider Row */}
                      <div className="space-y-5">
                        <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                          Recommended For You
                        </h3>
                        <div className="relative group/row">
                          {/* Carousel Left arrow control */}
                          <button 
                            onClick={() => scroll(recommendedRef, 'left')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10 text-white z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 shadow-xl"
                          >
                            <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>

                          {/* Scrollable list */}
                          <div 
                            ref={recommendedRef} 
                            className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                          >
                            {[...movies].reverse().slice(0, 7).map(movie => (
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

                          {/* Carousel Right arrow control */}
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
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="p-6 text-center text-xs text-neutral-600 border-t border-white/5 bg-[#081225]/40 backdrop-blur-sm">
          &copy; {new Date().getFullYear()} ZePlay. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default Home;
