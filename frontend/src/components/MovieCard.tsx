import React from 'react';
import { useNavigate } from 'react-router-dom';

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

  return (
    <div 
      onClick={() => navigate(`/movies/${movie_id}`)}
      className="flex-shrink-0 w-44 md:w-56 bg-brand-container rounded-xl overflow-hidden cursor-pointer transform hover:scale-[1.03] transition-all duration-300 shadow-xl border border-brand-border hover:border-brand-blue hover:shadow-brand-blue/20"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-canvas">
        <img 
          src={thumbnail_url} 
          alt={title} 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://placehold.co/400x225/0b1535/3b82f6?text=${encodeURIComponent(title)}`;
          }}
        />
      </div>
      
      <div className="p-4">
        <h4 className="font-semibold text-white truncate text-sm md:text-base mb-1 font-display">
          {title}
        </h4>
        <div className="flex items-center text-[10px] md:text-xs text-neutral-400 gap-2 mb-2">
          <span className="font-medium text-brand-blue">{release_year}</span>
          <span className="text-neutral-600">•</span>
          <span>{duration_minutes}m</span>
          <span className="ml-auto border border-brand-border px-1.5 py-0.5 rounded text-[8px] text-neutral-400">HD</span>
        </div>
        <div className="text-[9px] md:text-[10px] text-neutral-400 truncate uppercase tracking-wide font-medium">
          {genres.map(g => g.name).join(' / ')}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
