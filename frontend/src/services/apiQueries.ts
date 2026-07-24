import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

export interface Movie {
  movie_id: string;
  title: string;
  description: string;
  release_year: number;
  genre: string;
  duration: number;
  rating: string;
  poster_url: string;
  video_url: string;
  video_type?: string;
  is_hls?: boolean;
  hls_master_playlist?: string;
  average_rating?: number;
  ratings_count?: number;
}

export interface WatchHistoryItem {
  id: string;
  movie_id: string;
  current_position: number;
  duration: number;
  completed: boolean;
  last_watched: string;
  movie?: Movie;
}

// 1. Catalog / Movies Query
export const useCatalog = (genre?: string) => {
  return useQuery<Movie[]>({
    queryKey: ['catalog', genre || 'all'],
    queryFn: async () => {
      const url = genre && genre !== 'all' ? `/catalog?genre=${encodeURIComponent(genre)}` : '/catalog';
      const res = await api.get(url);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// 2. Movie Details Query
export const useMovieDetails = (movieId: string | undefined) => {
  return useQuery<Movie>({
    queryKey: ['movie', movieId],
    queryFn: async () => {
      if (!movieId) throw new Error('Movie ID is required');
      const res = await api.get(`/catalog/${movieId}`);
      return res.data;
    },
    enabled: !!movieId,
    staleTime: 5 * 60 * 1000,
  });
};

// 3. Recommendations Query
export const useRecommendations = (profileId: string | null) => {
  return useQuery<Movie[]>({
    queryKey: ['recommendations', profileId],
    queryFn: async () => {
      const res = await api.get('/recommendations', {
        headers: profileId ? { 'X-Profile-ID': profileId } : {},
      });
      return res.data;
    },
    enabled: !!profileId,
    staleTime: 3 * 60 * 1000,
  });
};

// 4. Watch History Query
export const useWatchHistory = (profileId: string | null) => {
  return useQuery<WatchHistoryItem[]>({
    queryKey: ['watchHistory', profileId],
    queryFn: async () => {
      const res = await api.get('/watch-history', {
        headers: profileId ? { 'X-Profile-ID': profileId } : {},
      });
      return res.data;
    },
    enabled: !!profileId,
    staleTime: 1 * 60 * 1000,
  });
};

// 5. Watchlist Query
export const useWatchlist = (profileId: string | null) => {
  return useQuery<Movie[]>({
    queryKey: ['watchlist', profileId],
    queryFn: async () => {
      const res = await api.get('/watchlist', {
        headers: profileId ? { 'X-Profile-ID': profileId } : {},
      });
      return res.data;
    },
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000,
  });
};

// 6. Update Watch Progress Mutation
export const useUpdateWatchProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      movieId,
      profileId,
      currentPosition,
      duration,
    }: {
      movieId: string;
      profileId: string;
      currentPosition: number;
      duration: number;
    }) => {
      const res = await api.post(
        `/watch-history/${movieId}`,
        { current_position: currentPosition, duration },
        { headers: { 'X-Profile-ID': profileId } }
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchHistory', variables.profileId] });
    },
  });
};
