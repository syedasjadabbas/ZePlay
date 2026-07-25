import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text' | 'card' | 'poster';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClasses = 'animate-shimmer bg-[#1c1c1c] rounded';

  if (variant === 'circle') {
    return <div className={`${baseClasses} rounded-full ${className}`} />;
  }
  if (variant === 'poster') {
    return <div className={`aspect-[2/3] w-full ${baseClasses} rounded-xl ${className}`} />;
  }
  if (variant === 'card') {
    return <div className={`aspect-video w-full ${baseClasses} rounded-xl ${className}`} />;
  }

  return <div className={`${baseClasses} ${className}`} />;
};

export const MovieCardSkeleton: React.FC<{ aspect?: 'vertical' | 'horizontal' }> = ({ aspect = 'vertical' }) => {
  if (aspect === 'horizontal') {
    return (
      <div className="flex-shrink-0 w-[220px] md:w-[260px] space-y-3">
        <Skeleton variant="card" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-[140px] sm:w-[170px] md:w-[190px] space-y-3">
      <Skeleton variant="poster" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
};

export const HeroSkeleton: React.FC = () => {
  return (
    <div className="relative w-full h-[60vh] md:h-[70vh] bg-[#161616] border border-white/5 rounded-2xl overflow-hidden flex flex-col justify-end p-8 md:p-14 space-y-4">
      <div className="absolute inset-0 animate-shimmer bg-[#1c1c1c]" />
      <div className="relative z-10 space-y-4 max-w-xl">
        <Skeleton className="h-8 md:h-12 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 w-full hidden md:block" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-12 w-36 rounded-lg" />
          <Skeleton className="h-12 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full bg-[#181818] border border-white/5 rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-center pb-4 border-b border-white/5">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
          <div className="flex items-center gap-3 w-1/3">
            <Skeleton variant="circle" className="w-9 h-9 flex-shrink-0" />
            <div className="space-y-1.5 w-full">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
};

export const MovieDetailsSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-[#181818] border border-white/5 rounded-xl overflow-hidden flex flex-col lg:flex-row min-h-[450px]">
      <div className="w-full lg:w-3/5 aspect-video min-h-[300px] lg:min-h-[450px] animate-shimmer bg-[#1c1c1c]" />
      <div className="w-full lg:w-2/5 p-8 space-y-6 flex flex-col justify-between">
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-3 pt-4 border-t border-white/5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
};
