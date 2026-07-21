import React, { useState } from 'react';

interface StarRatingProps {
  rating: number; // Value from 0 to 5
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRate,
  readonly = false,
  size = 'md',
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const starSizeClass = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-6 h-6 text-lg sm:text-xl',
    lg: 'w-9 h-9 text-2xl sm:text-3xl',
  }[size];

  const handleStarClick = (selectedRating: number) => {
    if (!readonly && onRate) {
      onRate(selectedRating);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (!readonly) {
      setHoverRating(index);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(null);
    }
  };

  // 1-5 stars loop
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      {stars.map((starIndex) => {
        // Decide if filled, partially filled, or empty
        const activeVal = hoverRating !== null ? hoverRating : rating;
        const isFilled = starIndex <= Math.floor(activeVal);
        const isHalf = !isFilled && starIndex - 0.5 <= activeVal;

        return (
          <button
            key={starIndex}
            type="button"
            disabled={readonly}
            onClick={() => handleStarClick(starIndex)}
            onMouseEnter={() => handleMouseEnter(starIndex)}
            onMouseLeave={handleMouseLeave}
            className={`transition-all duration-200 focus:outline-none flex items-center justify-center relative ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-125 hover:rotate-6'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Base Background Star (Empty) */}
            <svg
              className={`${starSizeClass} text-neutral-750 fill-neutral-850/40`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499c.195-.39.771-.39.966 0l2.253 4.567 5.04.733c.43.062.602.583.292.89l-3.647 3.555.861 5.018c.074.431-.38.76-.767.557L12 18.73l-4.507 2.37c-.387.203-.84-.126-.767-.557l.862-5.018-3.647-3.555c-.31-.307-.138-.828.292-.89l5.04-.733 2.253-4.567z"
              />
            </svg>

            {/* Filled Star overlay */}
            <div
              className="absolute top-0 left-0 overflow-hidden h-full pointer-events-none"
              style={{
                width: isFilled ? '100%' : isHalf ? '50%' : '0%',
                transition: 'width 0.15s ease-out',
              }}
            >
              <svg
                className={`${starSizeClass} text-yellow-500 fill-yellow-500`}
                viewBox="0 0 24 24"
              >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
