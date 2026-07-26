import React, { useState, useRef, useEffect } from 'react';
import { API_ORIGIN } from '../services/api';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  onError?: () => void;
  lazy?: boolean;
}

/**
 * ProgressiveImage - blur-up placeholder with smooth fade-in.
 * Prevents image flashing and layout shifts.
 */
const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = '',
  onError,
  lazy = true,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const resolveSrc = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
      return path;
    }
    return `${API_ORIGIN}${path}`;
  };

  // Detect already-cached images and reset states when src updates
  useEffect(() => {
    setError(false);
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => {
    setError(true);
    onError?.();
  };

  if (error) return null;

  return (
    <>
      {/* Blur placeholder */}
      <div
        className={`absolute inset-0 bg-neutral-900 transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
        aria-hidden="true"
        style={{ willChange: 'opacity' }}
      />
      <img
        ref={imgRef}
        src={resolveSrc(src)}
        alt={alt}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={className}
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'opacity',
        }}
      />
    </>
  );
};

export default ProgressiveImage;
