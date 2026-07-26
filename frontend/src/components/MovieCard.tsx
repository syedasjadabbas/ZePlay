import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { queryClient, QUERY_KEYS } from '../services/queryClient';
import PremiumPoster from './PremiumPoster';
import ProgressiveImage from './ProgressiveImage';

interface MovieCardProps {
  movie_id: string;
  title: string;
  thumbnail_url: string;
  release_year: number;
  duration_minutes: number;
  genres: Array<{ name: string }>;
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie_id,
  title,
  thumbnail_url,
  release_year,
  duration_minutes,
  genres,
}) => {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState<string>('center center');

  const handleMouseEnter = useCallback(() => {
    // Disable hover expansion on touch devices
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }

    if (hoverTimer.current) clearTimeout(hoverTimer.current);

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
      className="group flex-shrink-0 w-44 md:w-56 bg-[#181818] rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-brand-accent focus:outline-none transition-all"
      style={{
        transform: hovered ? 'scale(1.1) translateY(-4px)' : 'scale(1) translateY(0)',
        transformOrigin: transformOrigin,
        boxShadow: hovered
          ? '0 20px 40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.15)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)',
        transition: 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.35s cubic-bezier(0.25, 1, 0.5, 1), z-index 0.35s',
        willChange: 'transform, box-shadow',
        zIndex: hovered ? 50 : 1,
      }}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        {!thumbnail_url || imageError ? (
          <PremiumPoster title={title} aspectRatio="landscape" />
        ) : (
          <ProgressiveImage
            src={thumbnail_url}
            alt={title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            lazy
          />
        )}

        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Quick Play overlay action */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
            <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-3.5 flex flex-col justify-between flex-grow bg-[#181818]">
        <div>
          <h4
            className="font-bold text-white truncate text-xs md:text-sm mb-1 tracking-wide font-display transition-colors duration-200"
            style={{ color: hovered ? 'var(--color-brand-accent, #3B82F6)' : 'white' }}
          >
            {title}
          </h4>
          <div className="flex items-center text-[10px] md:text-xs text-brand-textMuted gap-2 mb-1 font-semibold">
            <span className="font-bold text-brand-accent">{release_year}</span>
            <span className="text-neutral-700">•</span>
            <span className="text-neutral-300">{duration_minutes}m</span>
          </div>
        </div>
        <div className="text-[9px] text-brand-textMuted truncate uppercase tracking-widest font-extrabold mt-0.5">
          {genres.map((g) => g.name).join(' / ')}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
