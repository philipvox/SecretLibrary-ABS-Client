/**
 * src/features/stats/hooks/useListeningStats.ts
 *
 * React hooks for accessing listening statistics from SQLite.
 * Provides cached data with automatic refetch on focus.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  sqliteCache,
} from '@/core/services/sqliteCache';

// Query keys
const STATS_KEYS = {
  all: ['listeningStats'] as const,
  today: () => [...STATS_KEYS.all, 'today'] as const,
  weekly: () => [...STATS_KEYS.all, 'weekly'] as const,
  monthly: (year: number, month: number) => [...STATS_KEYS.all, 'monthly', year, month] as const,
  streak: () => [...STATS_KEYS.all, 'streak'] as const,
  allTime: () => [...STATS_KEYS.all, 'allTime'] as const,
  topBooks: (limit: number) => [...STATS_KEYS.all, 'topBooks', limit] as const,
  byHour: () => [...STATS_KEYS.all, 'byHour'] as const,
  recentSessions: (limit: number) => [...STATS_KEYS.all, 'recent', limit] as const,
  bookSessions: (bookId: string) => [...STATS_KEYS.all, 'book', bookId] as const,
  daily: (startDate: string, endDate: string) => [...STATS_KEYS.all, 'daily', startDate, endDate] as const,
};

/**
 * Get today's listening stats
 */
export function useTodayStats() {
  return useQuery({
    queryKey: STATS_KEYS.today(),
    queryFn: () => sqliteCache.getTodayStats(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get weekly stats (last 7 days)
 */
export function useWeeklyStats() {
  return useQuery({
    queryKey: STATS_KEYS.weekly(),
    queryFn: () => sqliteCache.getWeeklyStats(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get monthly stats for a specific month
 */
export function useMonthlyStats(year: number, month: number) {
  return useQuery({
    queryKey: STATS_KEYS.monthly(year, month),
    queryFn: () => sqliteCache.getMonthlyStats(year, month),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get listening streak info
 */
export function useListeningStreak() {
  return useQuery({
    queryKey: STATS_KEYS.streak(),
    queryFn: () => sqliteCache.getListeningStreak(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get all-time listening stats
 */
export function useAllTimeStats() {
  return useQuery({
    queryKey: STATS_KEYS.allTime(),
    queryFn: () => sqliteCache.getAllTimeStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get top books by listening time
 */
export function useTopBooks(limit = 10) {
  return useQuery({
    queryKey: STATS_KEYS.topBooks(limit),
    queryFn: () => sqliteCache.getTopBooks(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get listening activity by hour of day
 */
export function useListeningByHour() {
  return useQuery({
    queryKey: STATS_KEYS.byHour(),
    queryFn: () => sqliteCache.getListeningByHour(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get recent listening sessions
 */
export function useRecentSessions(limit = 50) {
  return useQuery({
    queryKey: STATS_KEYS.recentSessions(limit),
    queryFn: () => sqliteCache.getRecentSessions(limit),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get listening sessions for a specific book
 */
export function useBookSessions(bookId: string) {
  return useQuery({
    queryKey: STATS_KEYS.bookSessions(bookId),
    queryFn: () => sqliteCache.getBookSessions(bookId),
    enabled: !!bookId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get daily stats for a date range
 */
export function useDailyStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: STATS_KEYS.daily(startDate, endDate),
    queryFn: () => sqliteCache.getDailyStats(startDate, endDate),
    enabled: !!startDate && !!endDate,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Combined hook for the main stats screen
 * Fetches all relevant data in parallel
 */
export function useStatsScreen() {
  const today = useTodayStats();
  const weekly = useWeeklyStats();
  const streak = useListeningStreak();
  const allTime = useAllTimeStats();
  const topBooks = useTopBooks(5);
  const byHour = useListeningByHour();

  const isLoading =
    today.isLoading ||
    weekly.isLoading ||
    streak.isLoading ||
    allTime.isLoading ||
    topBooks.isLoading ||
    byHour.isLoading;

  const isError =
    today.isError ||
    weekly.isError ||
    streak.isError ||
    allTime.isError ||
    topBooks.isError ||
    byHour.isError;

  return {
    today: today.data,
    weekly: weekly.data,
    streak: streak.data,
    allTime: allTime.data,
    topBooks: topBooks.data,
    byHour: byHour.data,
    isLoading,
    isError,
    refetch: () => {
      today.refetch();
      weekly.refetch();
      streak.refetch();
      allTime.refetch();
      topBooks.refetch();
      byHour.refetch();
    },
  };
}

/**
 * Hook to invalidate stats queries after recording a session
 */
export function useInvalidateStats() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: STATS_KEYS.all });
  }, [queryClient]);
}

export function formatDateRelative(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

export function getWeekdayName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}
