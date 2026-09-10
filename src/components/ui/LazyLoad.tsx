import { useRef, useState, useEffect, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { ContentSkeleton } from './LoadingStates';

interface LazyLoadProps {
  children: ReactNode;
  fallback?: ReactNode;
  threshold?: number;
  rootMargin?: string;
}

export function LazyLoad({ children, fallback, threshold = 0, rootMargin = '100px' }: LazyLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold, rootMargin }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return <div ref={ref}>{isVisible ? children : fallback || <ContentSkeleton />}</div>;
}

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fallback?: string;
}

export function LazyImage({ src, alt, width, height, fallback = '/placeholder.png' }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { img.src = src; observer.disconnect(); } },
      { rootMargin: '100px' }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, [src]);

  return (
    <Box
      component="img"
      ref={imgRef}
      src={hasError ? fallback : undefined}
      alt={alt}
      sx={{ width, height, opacity: isLoaded ? 1 : 0.5, transition: 'opacity 0.3s' }}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
    />
  );
}
