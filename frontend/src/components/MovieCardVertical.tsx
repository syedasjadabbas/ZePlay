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

  const getRating = (name: string) => {
    switch (name.toLowerCase()) {
      case 'interstellar': return '8.6';
      case 'the dark knight': return '9.0';
      case 'inception': return '8.8';
      case 'the matrix': return '8.7';
      case 'dune': return '8.4';
      case 'the batman': return '8.3';
      case 'john wick': return '8.2';
      case 'tenet': return '7.8';
      case 'avatar': return '7.9';
      case 'oppenheimer': return '8.9';
      default: return '8.5';
    }
  };

  return (
    <div 
      onClick={() => navigate(`/movies/${movie_id}`)}
      className="flex-shrink-0 w-36 sm:w-44 bg-brand-surface border border-white/5 rounded-xl overflow-hidden cursor-pointer transform hover:-translate-y-2 hover:border-brand-accent/40 hover:shadow-[0_20px_40px_rgba(59,130,246,0.15)] transition-all duration-300 relative aspect-[2/3] group"
    >
      {/* Poster Image */}
      <img 
        src={thumbnail_url} 
        alt={title} 
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = `https://placehold.co/300x450/0b1535/3b82f6?text=${encodeURIComponent(title)}`;
        }}
      />

      {/* Saved Watchlist Badge Indicator */}
      {isInWatchlist && (
        <div className="absolute top-2.5 left-2.5 bg-brand-accent/95 backdrop-blur-md px-2 py-0.5 rounded-md text-[8px] font-black text-white uppercase tracking-wider shadow-md z-10 border border-white/20 flex items-center gap-1">
          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
          </svg>
          List
        </div>
      )}

      {/* Standard Rating Overlay */}
      {progressPercent === undefined && (
        <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-bold text-brand-accent border border-white/5 flex items-center gap-1">
          ★ {ratingScore !== undefined && ratingScore > 0 ? ratingScore.toFixed(1) : getRating(title)}
        </div>
      )}

      {/* Progress Overlays for Continue Watching */}
      {progressPercent !== undefined && (
        <>
          {/* Centered Play Button on Hover */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-brand-accent text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-all duration-300 shadow-blue-500/25">
              <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Text Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-end p-3 pb-5">
            <h4 className="font-extrabold text-white text-[10px] sm:text-xs font-display tracking-wide uppercase truncate">
              {title}
            </h4>
            <span className="text-[8px] sm:text-[9px] text-brand-textMuted uppercase tracking-wider font-semibold mt-0.5">
              Resume Playing
            </span>
          </div>

          {/* Progress Indicator Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/60 backdrop-blur-sm">
            <div 
              className="h-full bg-brand-accent rounded-r"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default MovieCardVertical;
