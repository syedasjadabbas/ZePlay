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
      className="group flex-shrink-0 w-44 md:w-56 bg-brand-cards/40 border border-white/5 hover:border-brand-accent/35 rounded-2xl overflow-hidden cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:shadow-[0_15px_35px_rgba(59,130,246,0.15)] flex flex-col"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-background">
        <img 
          src={thumbnail_url} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.currentTarget.src = `https://placehold.co/400x225/0b1535/3b82f6?text=${encodeURIComponent(title)}`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className="p-3.5 flex flex-col justify-between flex-grow">
        <div>
          <h4 className="font-bold text-white truncate text-xs md:text-sm mb-1.5 tracking-wide font-display group-hover:text-brand-accent transition-colors">
            {title}
          </h4>
          <div className="flex items-center text-[10px] md:text-xs text-brand-textMuted gap-2 mb-2">
            <span className="font-bold text-brand-accent">{release_year}</span>
            <span className="text-neutral-700">•</span>
            <span className="font-medium text-neutral-350">{duration_minutes}m</span>
            <span className="ml-auto bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] text-white font-extrabold tracking-wider">HD</span>
          </div>
        </div>
        <div className="text-[9px] text-brand-textMuted truncate uppercase tracking-widest font-semibold mt-0.5">
          {genres.map(g => g.name).join(' / ')}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
