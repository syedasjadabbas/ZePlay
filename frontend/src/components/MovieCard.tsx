import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
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
  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      setHovered(true);
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
      className="group flex-shrink-0 w-44 md:w-56 bg-brand-cards/25 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] flex flex-col focus-visible:ring-2 focus-visible:ring-brand-accent focus:outline-none"
      style={{
        transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? '0 20px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)'
          : '0 8px 30px rgba(0,0,0,0.4)',
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s cubic-bezier(0.16,1,0.3,1)',
        willChange: 'transform, box-shadow',
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

        {/* Image zoom inner layer */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: thumbnail_url && !imageError ? `url(${thumbnail_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            opacity: 0,
          }}
        />

        <div
          className="absolute inset-0 bg-gradient-to-t from-[#060B18]/70 to-transparent"
          style={{
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.3s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>

      <div className="p-3.5 flex flex-col justify-between flex-grow">
        <div>
          <h4
            className="font-bold text-white truncate text-xs md:text-sm mb-1.5 tracking-wide font-display transition-colors duration-200"
            style={{ color: hovered ? 'var(--color-brand-accent, #3B82F6)' : 'white' }}
          >
            {title}
          </h4>
          <div className="flex items-center text-[10px] md:text-xs text-brand-textMuted gap-2 mb-2">
            <span className="font-bold text-brand-accent">{release_year}</span>
            <span className="text-neutral-700">•</span>
            <span className="font-semibold text-neutral-300">{duration_minutes}m</span>
          </div>
        </div>
        <div className="text-[9px] text-brand-textMuted truncate uppercase tracking-widest font-extrabold mt-0.5">
          {genres.map(g => g.name).join(' / ')}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
