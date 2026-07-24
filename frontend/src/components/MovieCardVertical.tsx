import React from 'react';
import { useNavigate } from 'react-router-dom';
import PremiumPoster from './PremiumPoster';

interface MovieCardVerticalProps {
  movie_id: string;
  title: string;
  thumbnail_url: string;
  release_year: number;
  duration_minutes: number;
  genres: Array<{ name: string }>;
  progressPercent?: number; // Optional watch progress percentage
  isInWatchlist?: boolean; // Optional watchlist saved status
}

const MovieCardVertical: React.FC<MovieCardVerticalProps> = ({
  movie_id,
  title,
  thumbnail_url,
  progressPercent,
  isInWatchlist,
}) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = React.useState(false);

  return (
    <div 
      onClick={() => navigate(`/movies/${movie_id}`)}
      className="flex-shrink-0 w-36 sm:w-44 bg-[#181818] rounded-md overflow-hidden cursor-pointer transform hover:scale-[1.05] hover:shadow-[0_12px_24px_rgba(0,0,0,0.65)] transition-all duration-300 ease-out active:scale-[0.98] group flex flex-col justify-between"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        {!thumbnail_url || imageError ? (
          <PremiumPoster title={title} aspectRatio="portrait" />
        ) : (
          <img 
            src={thumbnail_url} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        )}

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
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
              <div className="w-10 h-10 rounded-full bg-brand-accent text-white flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all duration-300 ease-out">
                <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Progress Indicator Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/60">
              <div 
                className="h-full bg-brand-accent rounded-r-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Details (Title and score/progress) below card */}
      <div className="p-3 flex flex-col gap-0.5 bg-[#181818]">
        <h4 
          className="font-bold text-white text-[11px] sm:text-xs tracking-wide truncate group-hover:text-brand-accent transition-colors duration-200"
          title={title}
        >
          {title}
        </h4>
        {progressPercent !== undefined && (
          <span className="text-[8px] sm:text-[9px] text-brand-textMuted uppercase tracking-widest font-extrabold mt-0.5">
            Resume Playing
          </span>
        )}
      </div>
    </div>
  );
};

export default MovieCardVertical;
