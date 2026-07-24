import React from 'react';
import { useNavigate } from 'react-router-dom';

interface MovieCardVerticalProps {
  movie_id: string;
  title: string;
  thumbnail_url: string;
  release_year: number;
  duration_minutes: number;
  genres: Array<{ name: string }>;
  progressPercent?: number; // Optional watch progress percentage
  isInWatchlist?: boolean; // Optional watchlist saved status
  ratingScore?: number; // Optional live average rating score
}

const MovieCardVertical: React.FC<MovieCardVerticalProps> = ({
  movie_id,
  title,
  thumbnail_url,
  progressPercent,
  isInWatchlist,
  ratingScore,
}) => {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/movies/${movie_id}`)}
      className="flex-shrink-0 w-36 sm:w-44 bg-brand-cards/25 border border-white/5 rounded-2xl overflow-hidden cursor-pointer transform hover:-translate-y-2 hover:border-brand-accent/30 hover:shadow-[0_20px_40px_rgba(59,130,246,0.15),_0_0_15px_rgba(59,130,246,0.08)] transition-all duration-350 ease-[var(--ease-out-premium)] active:scale-[0.98] group flex flex-col justify-between"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-900">
        <img 
          src={thumbnail_url} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-[var(--ease-out-premium)]"
          onError={(e) => {
            e.currentTarget.src = `https://placehold.co/300x450/0b1535/3b82f6?text=${encodeURIComponent(title)}`;
          }}
        />

        {/* Saved Watchlist Badge Indicator */}
        {isInWatchlist && (
          <div className="absolute top-2.5 left-2.5 bg-brand-accent/90 backdrop-blur-md px-2 py-0.5 rounded-lg text-[8px] font-black text-white uppercase tracking-wider shadow-md z-10 border border-white/10 flex items-center gap-1">
            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            List
          </div>
        )}

        {/* Standard Rating Overlay */}
        {progressPercent === undefined && (
          <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-bold text-brand-accent border border-white/5 flex items-center gap-1 select-none">
            ★ {ratingScore !== undefined && ratingScore > 0 ? ratingScore.toFixed(1) : '0.0'}
          </div>
        )}

        {/* Progress Overlays for Continue Watching */}
        {progressPercent !== undefined && (
          <>
            {/* Centered Play Button on Hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
              <div className="w-10 h-10 rounded-full bg-brand-accent text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-all duration-350 ease-[var(--ease-out-premium)] shadow-blue-500/25">
                <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Progress Indicator Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/60 backdrop-blur-sm">
              <div 
                className="h-full bg-brand-accent rounded-r shadow-[0_0_8px_rgba(59,130,246,0.7)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Details (Title and score/progress) below card */}
      <div className="p-3 flex flex-col gap-0.5">
        <h4 
          className="font-bold text-white text-[11px] sm:text-xs tracking-wide uppercase truncate group-hover:text-brand-accent transition-colors font-display duration-200"
          title={title}
        >
          {title}
        </h4>
        {progressPercent !== undefined ? (
          <span className="text-[8px] sm:text-[9px] text-brand-textMuted uppercase tracking-widest font-extrabold mt-0.5">
            Resume Playing
          </span>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] text-yellow-500">★</span>
            <span className="text-[8px] sm:text-[9px] text-brand-textMuted uppercase tracking-widest font-black">
              {ratingScore !== undefined && ratingScore > 0 ? ratingScore.toFixed(1) : '0.0'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieCardVertical;
