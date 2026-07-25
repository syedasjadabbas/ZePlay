import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
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
  isInWatchlist,
}) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      setHovered(true);
      // Prefetch movie details on hover
      if (movie_id) {
        api.get(`/catalog/movies/${movie_id}`).catch(() => {});
      }
    }, 150);
  }, [movie_id]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHovered(false);
  }, []);

  return (
    <div
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
      className="flex-shrink-0 w-36 sm:w-44 bg-[#181818] rounded-md overflow-hidden cursor-pointer active:scale-[0.97] group flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-brand-accent focus:outline-none"
      style={{
        transform: hovered ? 'scale(1.06) translateY(-4px)' : 'scale(1) translateY(0)',
        boxShadow: hovered
          ? '0 20px 40px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s cubic-bezier(0.16,1,0.3,1)',
        willChange: 'transform, box-shadow',
        zIndex: hovered ? 10 : 'auto',
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

        {/* Overlay zoom on hover */}
        <div
          className="absolute inset-0"
          style={{
            transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
          }}
        />

        {/* Saved Watchlist Badge Indicator */}
        {isInWatchlist && (
          <div className="absolute top-2.5 left-2.5 text-[8px] font-black text-brand-accent uppercase tracking-wider z-10 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded-sm">
            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            List
          </div>
        )}

        {/* Progress Overlays for Continue Watching */}
        {progressPercent !== undefined && (
          <>
            {/* Centered Play Button on Hover */}
            <div
              className="absolute inset-0 bg-black/50 flex items-center justify-center"
              style={{
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.25s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div
                className="w-10 h-10 rounded-full bg-brand-accent text-white flex items-center justify-center"
                style={{
                  transform: hovered ? 'scale(1)' : 'scale(0.75)',
                  transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/60">
              <div
                className="h-full bg-brand-accent rounded-r-sm"
                style={{
                  width: `${progressPercent}%`,
                  transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Details below card */}
      <div className="p-3 flex flex-col gap-0.5 bg-[#181818]">
        <h4
          className="font-bold text-white text-[11px] sm:text-xs tracking-wide truncate transition-colors duration-200"
          style={{ color: hovered ? 'var(--color-brand-accent, #3B82F6)' : 'white' }}
          title={title}
        >
          {title}
        </h4>

        {/* Metadata reveal on hover */}
        <div
          style={{
            maxHeight: hovered ? '40px' : '0px',
            opacity: hovered ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div className="flex items-center gap-1 text-[9px] text-neutral-500 mt-0.5">
            <span className="text-brand-accent font-bold">{release_year}</span>
            <span>·</span>
            <span>{duration_minutes}m</span>
            {genres && genres.length > 0 && (
              <>
                <span>·</span>
                <span className="truncate">{genres[0]?.name}</span>
              </>
            )}
          </div>
        </div>

        {progressPercent !== undefined && (
          <span
            className="text-[8px] sm:text-[9px] text-brand-textMuted uppercase tracking-widest font-extrabold mt-0.5"
            style={{
              animation: hovered ? 'resumePulse 1.8s ease-in-out infinite' : 'none',
            }}
          >
            Resume Playing
          </span>
        )}
      </div>
    </div>
  );
};

export default MovieCardVertical;
