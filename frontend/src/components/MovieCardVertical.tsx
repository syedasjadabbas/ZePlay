import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { queryClient, QUERY_KEYS } from '../services/queryClient';
import PremiumPoster from './PremiumPoster';
import ProgressiveImage from './ProgressiveImage';

interface MovieCardVerticalProps {
  movie_id: string;
  title: string;
  thumbnail_url: string;
  release_year: number;
  duration_minutes: number;
  genres: Array<{ name: string }>;
  progressPercent?: number;
  isInWatchlist?: boolean;
}

const MovieCardVertical: React.FC<MovieCardVerticalProps> = ({
  movie_id,
  title,
  thumbnail_url,
  release_year,
  duration_minutes,
  genres,
  progressPercent,
  isInWatchlist: propIsInWatchlist,
}) => {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState<string>('center center');
  const [inWatchlist, setInWatchlist] = useState<boolean>(Boolean(propIsInWatchlist));
  const [watchlistSubmitting, setWatchlistSubmitting] = useState(false);

  const activeProfileId = localStorage.getItem('selectedProfileId');

  useEffect(() => {
    setInWatchlist(Boolean(propIsInWatchlist));
  }, [propIsInWatchlist]);

  const handleMouseEnter = useCallback(() => {
    // Mobile/touch check: Disable hover expansion on non-pointer / touch devices
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }

    if (hoverTimer.current) clearTimeout(hoverTimer.current);

    // Intentional 250ms hover delay to prevent accidental activation during scrolling
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        if (rect.left < 100) {
          setTransformOrigin('left center');
        } else if (viewportWidth - rect.right < 100) {
          setTransformOrigin('right center');
        } else {
          setTransformOrigin('center center');
        }
      }

      setHovered(true);

      // Prefetch movie details into React Query cache (deduplicated by query key)
      if (movie_id) {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.movie(movie_id),
          queryFn: () => api.get(`/catalog/movies/${movie_id}`).then((r) => r.data),
          staleTime: 5 * 60 * 1000,
        });
      }
    }, 250);
  }, [movie_id]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHovered(false);
  }, []);

  const handleToggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProfileId || !movie_id || watchlistSubmitting) return;

    const previousState = inWatchlist;
    setInWatchlist(!previousState);
    setWatchlistSubmitting(true);

    try {
      if (previousState) {
        await api.delete(`/watchlist/${movie_id}?profile_id=${activeProfileId}`);
      } else {
        await api.post('/watchlist/', {
          profile_id: activeProfileId,
          movie_id: movie_id,
        });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.watchlist(activeProfileId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.watchlistCheck(movie_id, activeProfileId) });
    } catch (err) {
      setInWatchlist(previousState);
    } finally {
      setWatchlistSubmitting(false);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/movies/${movie_id}`);
  };

  return (
    <div
      ref={cardRef}
      onClick={() => navigate(`/movies/${movie_id}`)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/movies/${movie_id}`);
        }
      }}
      className="flex-shrink-0 w-36 sm:w-44 bg-[#181818] rounded-xl overflow-hidden cursor-pointer active:scale-[0.98] group flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-brand-accent focus:outline-none transition-all"
      style={{
        transform: hovered ? 'scale(1.12) translateY(-6px)' : 'scale(1) translateY(0)',
        transformOrigin: transformOrigin,
        boxShadow: hovered
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.15)'
          : '0 4px 16px rgba(0, 0, 0, 0.4)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), z-index 0.3s',
        willChange: 'transform, box-shadow',
        zIndex: hovered ? 50 : 1,
      }}
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        {!thumbnail_url || imageError ? (
          <PremiumPoster title={title} aspectRatio="portrait" />
        ) : (
          <ProgressiveImage
            src={thumbnail_url}
            alt={title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            lazy
          />
        )}

        {/* Dark gradient overlay on hover */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Watchlist Badge Indicator (Static state when not hovered) */}
        {inWatchlist && !hovered && (
          <div className="absolute top-2.5 left-2.5 text-[8px] font-black text-brand-accent uppercase tracking-wider z-10 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-brand-accent/30">
            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
            </svg>
            List
          </div>
        )}

        {/* Quick Action Overlay Buttons on Hover */}
        <div
          className={`absolute inset-x-0 bottom-3 px-3 z-20 flex items-center justify-between transition-all duration-300 ${
            hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          {/* Play Action Button */}
          <button
            type="button"
            onClick={handlePlayClick}
            className="w-9 h-9 rounded-full bg-white text-black hover:bg-neutral-200 flex items-center justify-center shadow-xl transform hover:scale-110 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px]"
            title={`Play ${title}`}
          >
            <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          {/* Add / Remove My List Action Button */}
          <button
            type="button"
            onClick={handleToggleWatchlist}
            disabled={watchlistSubmitting}
            className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center border shadow-xl transform hover:scale-110 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] ${
              inWatchlist
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-black/60 border-white/20 text-white hover:bg-black/80'
            }`}
            title={inWatchlist ? "Remove from My List" : "Add to My List"}
          >
            {inWatchlist ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>

        {/* Progress Bar for Continue Watching */}
        {progressPercent !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/80 z-10">
            <div
              className="h-full bg-brand-accent rounded-r-sm"
              style={{
                width: `${progressPercent}%`,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        )}
      </div>

      {/* Details Area Below Poster */}
      <div className="p-3 flex flex-col justify-between bg-[#181818] min-h-[56px]">
        <h4
          className="font-bold text-white text-[11px] sm:text-xs tracking-wide truncate transition-colors duration-200"
          style={{ color: hovered ? 'var(--color-brand-accent, #3B82F6)' : 'white' }}
          title={title}
        >
          {title}
        </h4>

        {/* Metadata reveal area */}
        <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 mt-1 font-semibold">
          <span className="text-brand-accent font-black">{release_year}</span>
          <span className="text-neutral-600">•</span>
          <span>{duration_minutes}m</span>
          {genres && genres.length > 0 && (
            <>
              <span className="text-neutral-600">•</span>
              <span className="truncate text-neutral-300 max-w-[65px]">{genres[0]?.name}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieCardVertical;
