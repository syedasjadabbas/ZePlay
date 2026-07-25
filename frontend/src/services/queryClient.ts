/**
 * Centralized React Query configuration and query-key constants.
 * Import queryClient here for imperative cache access (prefetch, invalidate).
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min — good for catalog, recommendations
      gcTime: 15 * 60 * 1000,      // 15 min — keep cache alive across routes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ─── Stable query keys ────────────────────────────────────────────────────────
export const QUERY_KEYS = {
  // Auth
  me: ['auth', 'me'] as const,

  // Catalog
  movies: ['catalog', 'movies'] as const,
  movie: (id: string) => ['catalog', 'movie', id] as const,
  genres: ['catalog', 'genres'] as const,
  search: (q: string, genre: string, sort: string) => ['catalog', 'search', q, genre, sort] as const,

  // Recommendations
  trending: ['recommendations', 'trending'] as const,
  popular: ['recommendations', 'popular'] as const,
  recentlyAdded: ['recommendations', 'recently-added'] as const,
  personalized: (profileId: string) => ['recommendations', 'personalized', profileId] as const,
  becauseYouWatched: (profileId: string) => ['recommendations', 'because-you-watched', profileId] as const,
  similar: (movieId: string) => ['recommendations', 'similar', movieId] as const,

  // Profile-specific
  continueWatching: (profileId: string) => ['watch-history', 'continue-watching', profileId] as const,
  watchHistory: (profileId: string) => ['watch-history', 'list', profileId] as const,
  watchProgress: (movieId: string, profileId: string) => ['watch-history', 'progress', movieId, profileId] as const,
  watchlist: (profileId: string) => ['watchlist', 'list', profileId] as const,
  watchlistCheck: (movieId: string, profileId: string) => ['watchlist', 'check', movieId, profileId] as const,

  // Subscription
  subscription: ['subscription', 'current'] as const,

  // Admin
  adminUsers: ['admin', 'users'] as const,
};
