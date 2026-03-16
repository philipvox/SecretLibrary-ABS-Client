/**
 * src/features/reading-history-wizard/screens/ReadingHistoryScreen.tsx
 *
 * Redesigned reading history screen with:
 * - Stats summary header
 * - Sort pill filters
 * - Compact list items with duration
 * - Selection mode with footer
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  CheckCircle,
  Circle,
  Book,
  CloudCheck,
  CloudUpload,
  CheckSquare,
  Square,
  ArrowLeft,
  BookOpen,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  X,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useGalleryStore, DurationFilter } from '../stores/galleryStore';
import { useFinishedBooks, useBulkMarkFinished } from '@/core/hooks/useUserBooks';
import { finishedBooksSync } from '@/core/services/finishedBooksSync';
import { FilterSheet } from '../components/FilterSheet';
import { SortSheet, SortOption } from '../components/SortSheet';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { getCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { useTheme, wp, hp, moderateScale, spacing, colors } from '@/shared/theme';
import { logger } from '@/shared/utils/logger';
import { useToast } from '@/shared/hooks/useToast';

// =============================================================================
// THEME COLORS INTERFACE (for createStyles)
// =============================================================================

interface ThemeColorsConfig {
  accent: string;
  accentDim: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textHint: string;
  textInverse: string;
  surface: string;
  surfaceBorder: string;
  success: string;
  danger: string;
  background: string;
}

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

const LAYOUT = {
  HORIZONTAL_PADDING: wp(5.5),
  COVER_SIZE: wp(12),
  COVER_RADIUS: wp(12) * 0.125,
  CHECKBOX_SIZE: wp(5.5),
};

// =============================================================================
// TYPES
// =============================================================================

interface HistoryBook {
  id: string;
  title: string;
  authorName: string;
  seriesName?: string;
  genres: string[];
  duration: number;
  coverUrl: string | null;
  markedAt: number;
  synced: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getMetadata(item: LibraryItem): any {
  return (item.media?.metadata as any) || {};
}

function getTitle(item: LibraryItem): string {
  return getMetadata(item).title || 'Unknown Title';
}

function getAuthorName(item: LibraryItem): string {
  return getMetadata(item).authorName || 'Unknown Author';
}

function getSeriesName(item: LibraryItem): string {
  const name = getMetadata(item).seriesName || '';
  return name.replace(/\s*#[\d.]+$/, '').trim();
}

function _getSeriesSequence(item: LibraryItem): string {
  const name = getMetadata(item).seriesName || '';
  const match = name.match(/#([\d.]+)$/);
  return match ? match[1] : '';
}

function getGenres(item: LibraryItem): string[] {
  return getMetadata(item).genres || [];
}

function getDuration(item: LibraryItem): number {
  return (item.media as any)?.duration || 0;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function _formatTotalHours(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  return `~${hours} hours`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateGroup(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (date >= today) return 'TODAY';
  if (date >= yesterday) return 'YESTERDAY';
  if (date >= weekAgo) return 'THIS WEEK';
  if (date >= twoWeeksAgo) return 'LAST WEEK';
  if (date >= monthAgo) return 'THIS MONTH';

  // Return month and year for older items
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

function matchesDurationFilter(duration: number, filter: DurationFilter): boolean {
  if (!filter) return true;
  const hours = duration / 3600;
  switch (filter) {
    case 'under_5h': return hours < 5;
    case '5_10h': return hours >= 5 && hours < 10;
    case '10_20h': return hours >= 10 && hours < 20;
    case 'over_20h': return hours >= 20;
    default: return true;
  }
}

// =============================================================================
// TOOLBAR COMPONENT
// =============================================================================

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recent',
  title: 'Title',
  author: 'Author',
  duration_long: 'Longest',
  duration_short: 'Shortest',
};

interface ToolbarProps {
  currentSort: SortOption;
  onSortPress: () => void;
  filterCount: number;
  onFilterPress: () => void;
  isSearching: boolean;
  onSearchPress: () => void;
  styles: ReturnType<typeof createStyles>;
  COLORS: ThemeColorsConfig;
}

function Toolbar({
  currentSort,
  onSortPress,
  filterCount,
  onFilterPress,
  isSearching,
  onSearchPress,
  styles,
  COLORS,
}: ToolbarProps) {
  return (
    <View style={styles.toolbar}>
      <View style={styles.toolbarLeft}>
        {/* Sort Button */}
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => {
            Haptics.selectionAsync();
            onSortPress();
          }}
        >
          <ArrowDownUp size={wp(4)} color={COLORS.accent} strokeWidth={2} />
          <Text style={styles.toolbarButtonText}>{SORT_LABELS[currentSort]}</Text>
        </TouchableOpacity>

        {/* Filter Button */}
        <TouchableOpacity
          style={[styles.toolbarButton, filterCount > 0 && styles.toolbarButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            onFilterPress();
          }}
        >
          <SlidersHorizontal
            size={wp(4)}
            color={filterCount > 0 ? COLORS.textInverse : COLORS.textTertiary}
            strokeWidth={2}
          />
          <Text style={[styles.toolbarButtonText, filterCount > 0 && styles.toolbarButtonTextActive]}>
            Filter{filterCount > 0 ? ` (${filterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Button */}
      <TouchableOpacity
        style={[styles.searchButton, isSearching && styles.searchButtonActive]}
        onPress={() => {
          Haptics.selectionAsync();
          onSearchPress();
        }}
      >
        <Search
          size={wp(4.5)}
          color={isSearching ? COLORS.accent : COLORS.textTertiary}
          strokeWidth={2}
        />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// SEARCH BAR COMPONENT
// =============================================================================

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  styles: ReturnType<typeof createStyles>;
  COLORS: ThemeColorsConfig;
}

function SearchBar({ value, onChangeText, onClose, styles, COLORS }: SearchBarProps) {
  return (
    <Animated.View
      style={styles.searchBar}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      <Search size={wp(4.5)} color={COLORS.textTertiary} strokeWidth={2} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by title, author, series..."
        placeholderTextColor={COLORS.textTertiary}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <X size={wp(4.5)} color={COLORS.textSecondary} strokeWidth={2} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// ACTIVE FILTERS ROW COMPONENT
// =============================================================================

interface ActiveFilter {
  id: string;
  label: string;
  type: 'genre' | 'author' | 'series' | 'sync' | 'duration';
}

interface ActiveFiltersRowProps {
  filters: ActiveFilter[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  styles: ReturnType<typeof createStyles>;
  COLORS: ThemeColorsConfig;
}

function ActiveFiltersRow({ filters, onRemove, onClearAll, styles, COLORS }: ActiveFiltersRowProps) {
  if (filters.length === 0) return null;

  return (
    <Animated.View
      style={styles.activeFiltersContainer}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.activeFiltersContent}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={styles.activeFilterChip}
            onPress={() => {
              Haptics.selectionAsync();
              onRemove(filter.id);
            }}
          >
            <Text style={styles.activeFilterText}>{filter.label}</Text>
            <X size={wp(3)} color={COLORS.accent} strokeWidth={2.5} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClearAll();
          }}
        >
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

// =============================================================================
// SECTION HEADER COMPONENT
// =============================================================================

interface SectionHeaderProps {
  title: string;
  styles: ReturnType<typeof createStyles>;
}

function _SectionHeader({ title, styles }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

// =============================================================================
// STATS CARD COMPONENT (Enhanced per UX spec)
// =============================================================================

interface StatsCardProps {
  totalBooks: number;
  totalDuration: number;
  syncedCount: number;
  syncPercentage: number;
  onSyncAll: () => void;
  isSyncing: boolean;
  styles: ReturnType<typeof createStyles>;
}

function StatsCard({
  totalBooks,
  totalDuration,
  syncedCount,
  syncPercentage,
  onSyncAll,
  isSyncing,
  styles,
}: StatsCardProps) {
  const totalHours = Math.round(totalDuration / 3600);
  const hasUnsynced = syncedCount < totalBooks;

  return (
    <View style={styles.statsCard}>
      {/* 3-column stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{totalBooks}</Text>
          <Text style={styles.statLabel}>books</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{totalHours}h</Text>
          <Text style={styles.statLabel}>listened</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={[styles.statValue, styles.statValueSynced]}>{syncedCount}</Text>
          <Text style={styles.statLabel}>synced</Text>
        </View>
      </View>

      {/* Sync progress section */}
      <View style={styles.syncSection}>
        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${syncPercentage}%` }]} />
        </View>

        {/* Sync status row */}
        <View style={styles.syncStatusRow}>
          <Text style={styles.syncStatusText}>
            {syncPercentage}% synced to server
          </Text>
          {hasUnsynced && (
            <TouchableOpacity
              style={[styles.syncAllButton, isSyncing && styles.syncAllButtonDisabled]}
              onPress={onSyncAll}
              disabled={isSyncing}
            >
              <Text style={styles.syncAllButtonText}>
                {isSyncing ? 'Syncing...' : 'Sync All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// LIST ITEM COMPONENT
// =============================================================================

interface HistoryListItemProps {
  book: HistoryBook;
  isSelecting: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  styles: ReturnType<typeof createStyles>;
  COLORS: ThemeColorsConfig;
}

function HistoryListItem({
  book,
  isSelecting,
  isSelected,
  onPress,
  onLongPress,
  styles,
  COLORS,
}: HistoryListItemProps) {
  const seriesInfo = book.seriesName
    ? `${book.seriesName} • ${formatDuration(book.duration)}`
    : formatDuration(book.duration);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        style={[styles.listItem, isSelected && styles.listItemSelected]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {/* Selection checkbox */}
        {isSelecting && (
          <View style={styles.checkboxContainer}>
            {isSelected ? (
              <CheckCircle size={LAYOUT.CHECKBOX_SIZE} color={COLORS.accent} strokeWidth={2} />
            ) : (
              <Circle size={LAYOUT.CHECKBOX_SIZE} color={COLORS.textTertiary} strokeWidth={2} />
            )}
          </View>
        )}

        {/* Cover */}
        {book.coverUrl ? (
          <Image source={book.coverUrl} style={styles.listCover} contentFit="cover" />
        ) : (
          <View style={[styles.listCover, styles.listCoverPlaceholder]}>
            <Book size={wp(5)} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          </View>
        )}

        {/* Info */}
        <View style={styles.listInfo}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={styles.listSubtitle} numberOfLines={1}>
            {book.authorName}
          </Text>
          <Text style={styles.listMeta} numberOfLines={1}>
            {seriesInfo}
          </Text>
        </View>

        {/* Date & Sync */}
        <View style={styles.listRight}>
          <Text style={styles.listDate}>{formatDate(book.markedAt)}</Text>
          {book.synced ? (
            <CloudCheck size={wp(4)} color={COLORS.success} strokeWidth={2} />
          ) : (
            <CloudUpload size={wp(4)} color={COLORS.textTertiary} strokeWidth={2} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// SELECTION FOOTER COMPONENT
// =============================================================================

interface SelectionFooterProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onSync: () => void;
  canSync: boolean;
  styles: ReturnType<typeof createStyles>;
  COLORS: ThemeColorsConfig;
}

function SelectionFooter({
  selectedCount,
  totalCount,
  onSelectAll,
  onCancel,
  onRemove,
  onSync,
  canSync,
  styles,
  COLORS,
}: SelectionFooterProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <Animated.View
      style={styles.selectionFooter}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      <View style={styles.selectionFooterLeft}>
        <TouchableOpacity style={styles.selectAllButton} onPress={onSelectAll}>
          {allSelected ? (
            <CheckSquare size={wp(5)} color={COLORS.textPrimary} strokeWidth={2} />
          ) : (
            <Square size={wp(5)} color={COLORS.textPrimary} strokeWidth={2} />
          )}
        </TouchableOpacity>
        <Text style={styles.selectionCount}>{selectedCount} selected</Text>
      </View>

      <View style={styles.selectionFooterRight}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        {/* Sync button - only when there are unsynced items */}
        {canSync && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={onSync}
          >
            <CloudUpload size={wp(4)} color={COLORS.accent} strokeWidth={2} />
            <Text style={styles.syncButtonText}>Sync</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.removeButton, selectedCount === 0 && styles.removeButtonDisabled]}
          onPress={onRemove}
          disabled={selectedCount === 0}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// MAIN SCREEN COMPONENT
// =============================================================================

export function ReadingHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Theme-aware colors
  const { colors: themeColors } = useTheme();
  const COLORS: ThemeColorsConfig = useMemo(() => ({
    accent: colors.accent.primary,
    accentDim: themeColors.accent.primarySubtle,
    textPrimary: themeColors.text.primary,
    textSecondary: themeColors.text.secondary,
    textTertiary: themeColors.text.tertiary,
    textHint: themeColors.text.disabled,
    textInverse: themeColors.text.inverse,
    surface: themeColors.surface.default,
    surfaceBorder: themeColors.border.default,
    success: themeColors.semantic.success,
    danger: themeColors.semantic.error,
    background: themeColors.background.primary,
  }), [themeColors]);

  // Theme-aware styles
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  // Finished books from SQLite (single source of truth)
  const { data: finishedBooksData = [], refetch: refetchFinishedBooks } = useFinishedBooks();
  const bulkMarkFinished = useBulkMarkFinished();

  // Gallery store for UI filters only
  const filters = useGalleryStore((s) => s.filters);
  const setFilters = useGalleryStore((s) => s.setFilters);
  const clearFilters = useGalleryStore((s) => s.clearFilters);
  const getActiveFilterCount = useGalleryStore((s) => s.getActiveFilterCount);
  const items = useLibraryCache((s) => s.items);
  const { showError } = useToast();

  // Build a map of finished books for quick lookup
  const finishedBooksMap = useMemo(() => {
    const map = new Map<string, { finishedAt: number; synced: boolean }>();
    for (const book of finishedBooksData) {
      const finishedAtValue = book.finishedAt;
      const finishedAtNum = typeof finishedAtValue === 'string'
        ? parseInt(finishedAtValue, 10) || Date.now()
        : (finishedAtValue || Date.now());
      map.set(book.bookId, {
        finishedAt: finishedAtNum,
        synced: book.finishedSynced ?? false,
      });
    }
    return map;
  }, [finishedBooksData]);

  // UI State
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Build history list with filtering and sorting
  const historyBooks = useMemo((): HistoryBook[] => {
    let books: HistoryBook[] = [];

    finishedBooksMap.forEach((marked, bookId) => {
      const item = items.find((i) => i.id === bookId);
      if (item) {
        books.push({
          id: bookId,
          title: getTitle(item),
          authorName: getAuthorName(item),
          seriesName: getSeriesName(item) || undefined,
          genres: getGenres(item),
          duration: getDuration(item),
          coverUrl: getCoverUrl(bookId),
          markedAt: marked.finishedAt,
          synced: marked.synced,
        });
      }
    });

    // Apply filters
    if (filters.syncStatus.length > 0) {
      books = books.filter((book) => {
        if (filters.syncStatus.includes('synced') && book.synced) return true;
        if (filters.syncStatus.includes('not_synced') && !book.synced) return true;
        return false;
      });
    }

    if (filters.genres.length > 0) {
      books = books.filter((book) =>
        book.genres.some((g) => filters.genres.includes(g.toLowerCase()))
      );
    }

    if (filters.authors.length > 0) {
      books = books.filter((book) =>
        filters.authors.includes(book.authorName.toLowerCase())
      );
    }

    if (filters.series.length > 0) {
      books = books.filter((book) =>
        book.seriesName && filters.series.includes(book.seriesName.toLowerCase())
      );
    }

    if (filters.duration) {
      books = books.filter((book) => matchesDurationFilter(book.duration, filters.duration));
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      books = books.filter((book) =>
        book.title.toLowerCase().includes(query) ||
        book.authorName.toLowerCase().includes(query) ||
        (book.seriesName && book.seriesName.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        books.sort((a, b) => b.markedAt - a.markedAt);
        break;
      case 'title':
        books.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        books.sort((a, b) => a.authorName.localeCompare(b.authorName));
        break;
      case 'duration_long':
        books.sort((a, b) => b.duration - a.duration);
        break;
      case 'duration_short':
        books.sort((a, b) => a.duration - b.duration);
        break;
    }

    return books;
  }, [finishedBooksMap, items, sortBy, filters, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    let totalDuration = 0;
    let syncedCount = 0;

    finishedBooksMap.forEach((marked, bookId) => {
      const item = items.find((i) => i.id === bookId);
      if (item) {
        totalDuration += getDuration(item);
        if (marked.synced) syncedCount++;
      }
    });

    const totalBooks = finishedBooksMap.size;
    const syncPercentage = totalBooks > 0 ? Math.round((syncedCount / totalBooks) * 100) : 100;

    return {
      totalBooks,
      totalDuration,
      syncedCount,
      syncPercentage,
    };
  }, [finishedBooksMap, items]);

  // Available filters computed from all books (before filtering)
  const availableFilters = useMemo(() => {
    const genreMap = new Map<string, number>();
    const authorMap = new Map<string, number>();
    const seriesMap = new Map<string, number>();

    finishedBooksMap.forEach((_, bookId) => {
      const item = items.find((i) => i.id === bookId);
      if (!item) return;

      // Genres
      const genres = getGenres(item);
      genres.forEach((g) => {
        const key = g.toLowerCase();
        genreMap.set(key, (genreMap.get(key) || 0) + 1);
      });

      // Authors
      const author = getAuthorName(item).toLowerCase();
      if (author) {
        authorMap.set(author, (authorMap.get(author) || 0) + 1);
      }

      // Series
      const series = getSeriesName(item).toLowerCase();
      if (series) {
        seriesMap.set(series, (seriesMap.get(series) || 0) + 1);
      }
    });

    return {
      genres: Array.from(genreMap.entries())
        .map(([id, count]) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), count }))
        .sort((a, b) => b.count - a.count),
      authors: Array.from(authorMap.entries())
        .map(([id, count]) => {
          const item = items.find((i) => getAuthorName(i).toLowerCase() === id);
          return { id, name: item ? getAuthorName(item) : id, count };
        })
        .sort((a, b) => b.count - a.count),
      series: Array.from(seriesMap.entries())
        .map(([id, count]) => {
          const item = items.find((i) => getSeriesName(i).toLowerCase() === id);
          return { id, name: item ? getSeriesName(item) : id, count };
        })
        .sort((a, b) => b.count - a.count),
    };
  }, [finishedBooksMap, items]);

  // Active filters for display
  const activeFilters = useMemo((): ActiveFilter[] => {
    const result: ActiveFilter[] = [];

    filters.syncStatus.forEach((status) => {
      result.push({
        id: `sync_${status}`,
        label: status === 'synced' ? 'Synced' : 'Not Synced',
        type: 'sync',
      });
    });

    filters.genres.forEach((genre) => {
      result.push({
        id: `genre_${genre}`,
        label: genre.charAt(0).toUpperCase() + genre.slice(1),
        type: 'genre',
      });
    });

    filters.authors.forEach((author) => {
      const found = availableFilters.authors.find((a) => a.id === author);
      result.push({
        id: `author_${author}`,
        label: found?.name || author,
        type: 'author',
      });
    });

    filters.series.forEach((series) => {
      const found = availableFilters.series.find((s) => s.id === series);
      result.push({
        id: `series_${series}`,
        label: found?.name || series,
        type: 'series',
      });
    });

    if (filters.duration) {
      const labels: Record<string, string> = {
        under_5h: 'Under 5h',
        '5_10h': '5-10h',
        '10_20h': '10-20h',
        over_20h: 'Over 20h',
      };
      result.push({
        id: `duration_${filters.duration}`,
        label: labels[filters.duration] || filters.duration,
        type: 'duration',
      });
    }

    return result;
  }, [filters, availableFilters]);

  // Group books by date for section headers
  const _groupedBooks = useMemo(() => {
    if (sortBy !== 'recent') {
      return [{ title: null, data: historyBooks }];
    }

    const groups = new Map<string, HistoryBook[]>();
    historyBooks.forEach((book) => {
      const group = getDateGroup(book.markedAt);
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(book);
    });

    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [historyBooks, sortBy]);

  // Sync All handler
  const handleSyncAll = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await finishedBooksSync.syncToServer();
      await refetchFinishedBooks();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.warn('[ReadingHistory] Sync failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refetchFinishedBooks]);

  // Handle removing a single filter
  const handleRemoveFilter = useCallback((filterId: string) => {
    const [type, ...valueParts] = filterId.split('_');
    const value = valueParts.join('_');

    switch (type) {
      case 'sync':
        setFilters({
          syncStatus: filters.syncStatus.filter((s) => s !== value),
        });
        break;
      case 'genre':
        setFilters({
          genres: filters.genres.filter((g) => g !== value),
        });
        break;
      case 'author':
        setFilters({
          authors: filters.authors.filter((a) => a !== value),
        });
        break;
      case 'series':
        setFilters({
          series: filters.series.filter((s) => s !== value),
        });
        break;
      case 'duration':
        setFilters({ duration: null });
        break;
    }
  }, [filters, setFilters]);

  // Handle sync selected items
  const handleSyncSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const unsyncedIds = Array.from(selectedIds).filter((id) => {
      const marked = finishedBooksMap.get(id);
      return marked && !marked.synced;
    });

    if (unsyncedIds.length === 0) return;

    setIsSyncing(true);
    try {
      await finishedBooksSync.syncToServer();
      await refetchFinishedBooks();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.warn('[ReadingHistory] Sync selected failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
      setSelectedIds(new Set());
      setIsSelecting(false);
    }
  }, [selectedIds, finishedBooksMap, refetchFinishedBooks]);

  // Count unsynced in selection
  const unsyncedSelectedCount = useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const marked = finishedBooksMap.get(id);
      return marked && !marked.synced;
    }).length;
  }, [selectedIds, finishedBooksMap]);

  // Handlers
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleToggleSelect = useCallback((bookId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }, []);

  const handleLongPress = useCallback((bookId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSelecting(true);
    setSelectedIds(new Set([bookId]));
  }, []);

  const handleCancelSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === historyBooks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(historyBooks.map((b) => b.id)));
    }
  }, [selectedIds.size, historyBooks]);

  const handleRemoveSelected = useCallback(() => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      'Remove from History',
      `Remove ${selectedIds.size} book${selectedIds.size > 1 ? 's' : ''} from your reading history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await bulkMarkFinished.mutateAsync({
              bookIds: Array.from(selectedIds),
              isFinished: false,
            });
            setSelectedIds(new Set());
            setIsSelecting(false);
          },
        },
      ]
    );
  }, [selectedIds, bulkMarkFinished]);

  const handleItemPress = useCallback((bookId: string) => {
    if (isSelecting) {
      handleToggleSelect(bookId);
    }
  }, [isSelecting, handleToggleSelect]);

  const renderItem = useCallback(({ item }: { item: HistoryBook }) => (
    <HistoryListItem
      book={item}
      isSelecting={isSelecting}
      isSelected={selectedIds.has(item.id)}
      onPress={() => handleItemPress(item.id)}
      onLongPress={() => handleLongPress(item.id)}
      styles={styles}
      COLORS={COLORS}
    />
  ), [isSelecting, selectedIds, handleItemPress, handleLongPress, styles, COLORS]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
          <ArrowLeft size={moderateScale(22)} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Reading History</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            if (!isSelecting && historyBooks.length > 0) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsSelecting(true);
            }
          }}
        >
          {!isSelecting && historyBooks.length > 0 && (
            <Text style={styles.selectLink}>Select</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Stats Card - hidden during selection mode */}
      {stats.totalBooks > 0 && !isSelecting && (
        <StatsCard
          totalBooks={stats.totalBooks}
          totalDuration={stats.totalDuration}
          syncedCount={stats.syncedCount}
          syncPercentage={stats.syncPercentage}
          onSyncAll={handleSyncAll}
          isSyncing={isSyncing}
          styles={styles}
        />
      )}

      {/* Toolbar or Search Bar */}
      {stats.totalBooks > 0 && !isSelecting && (
        isSearching ? (
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClose={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}
            styles={styles}
            COLORS={COLORS}
          />
        ) : (
          <Toolbar
            currentSort={sortBy}
            onSortPress={() => setShowSortSheet(true)}
            filterCount={getActiveFilterCount()}
            onFilterPress={() => setShowFilterSheet(true)}
            isSearching={isSearching}
            onSearchPress={() => setIsSearching(true)}
            styles={styles}
            COLORS={COLORS}
          />
        )
      )}

      {/* Active Filters */}
      {!isSelecting && activeFilters.length > 0 && (
        <ActiveFiltersRow
          filters={activeFilters}
          onRemove={handleRemoveFilter}
          onClearAll={clearFilters}
          styles={styles}
          COLORS={COLORS}
        />
      )}

      {/* Book List */}
      {historyBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <BookOpen size={wp(15)} color={COLORS.textTertiary} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Books Yet</Text>
          <Text style={styles.emptySubtitle}>
            Books you mark as finished will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={historyBooks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: isSelecting ? hp(12) : insets.bottom + spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Selection Footer */}
      {isSelecting && (
        <View style={[styles.selectionFooterWrapper, { paddingBottom: insets.bottom }]}>
          <SelectionFooter
            selectedCount={selectedIds.size}
            totalCount={historyBooks.length}
            onSelectAll={handleSelectAll}
            onCancel={handleCancelSelection}
            onRemove={handleRemoveSelected}
            onSync={handleSyncSelected}
            canSync={unsyncedSelectedCount > 0}
            styles={styles}
            COLORS={COLORS}
          />
        </View>
      )}

      {/* Sort Sheet */}
      <SortSheet
        visible={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        currentSort={sortBy}
        onSelectSort={setSortBy}
      />

      {/* Filter Sheet */}
      <FilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        filters={filters}
        onApply={setFilters}
        availableFilters={availableFilters}
        resultCount={historyBooks.length}
      />
    </View>
  );
}

// =============================================================================
// STYLES (factory function for theme support)
// =============================================================================

const createStyles = (COLORS: ThemeColorsConfig) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    height: hp(5),
  },
  headerButton: {
    width: wp(12),
    height: wp(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: moderateScale(17),
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  selectLink: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: COLORS.accent,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingVertical: hp(1),
  },
  toolbarLeft: {
    flexDirection: 'row',
    gap: wp(2),
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: COLORS.surface,
    borderRadius: hp(2),
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  toolbarButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  toolbarButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  toolbarButtonTextActive: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  searchButton: {
    width: hp(4),
    height: hp(4),
    borderRadius: hp(2),
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonActive: {
    borderColor: COLORS.accent,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginHorizontal: LAYOUT.HORIZONTAL_PADDING,
    marginVertical: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1.2),
    backgroundColor: COLORS.surface,
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: COLORS.textPrimary,
    padding: 0,
  },

  // Active Filters
  activeFiltersContainer: {
    paddingVertical: hp(1),
  },
  activeFiltersContent: {
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    gap: wp(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.8),
    backgroundColor: COLORS.accentDim,
    borderRadius: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(243, 182, 12, 0.3)',
  },
  activeFilterText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    color: COLORS.accent,
  },
  clearAllButton: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.8),
  },
  clearAllText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    color: COLORS.accent,
  },

  // Section Header
  sectionHeader: {
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingTop: hp(2),
    paddingBottom: hp(1),
  },
  sectionHeaderText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: COLORS.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Stats Card (Enhanced)
  statsCard: {
    marginHorizontal: LAYOUT.HORIZONTAL_PADDING,
    marginTop: hp(0.5),
    padding: wp(4),
    backgroundColor: COLORS.surface,
    borderRadius: wp(4),
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statValueSynced: {
    color: COLORS.success,
  },
  statLabel: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    color: COLORS.textTertiary,
    marginTop: wp(0.5),
  },
  syncSection: {
    marginTop: wp(3),
    paddingTop: wp(3),
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  progressBarContainer: {
    height: hp(0.4),
    backgroundColor: COLORS.surfaceBorder,
    borderRadius: hp(0.2),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: hp(0.2),
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: wp(2),
  },
  syncStatusText: {
    fontSize: moderateScale(12),
    color: COLORS.textTertiary,
  },
  syncAllButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    backgroundColor: COLORS.accentDim,
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  syncAllButtonDisabled: {
    opacity: 0.5,
  },
  syncAllButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: COLORS.accent,
  },

  // List
  listContent: {
    paddingTop: hp(1),
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingVertical: hp(1.2),
    gap: wp(3),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  listItemSelected: {
    backgroundColor: COLORS.accentDim,
  },
  checkboxContainer: {
    marginRight: wp(1),
  },
  listCover: {
    width: LAYOUT.COVER_SIZE,
    height: LAYOUT.COVER_SIZE,
    borderRadius: LAYOUT.COVER_RADIUS,
    backgroundColor: COLORS.surface,
  },
  listCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    gap: wp(0.5),
  },
  listTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  listSubtitle: {
    fontSize: moderateScale(12),
    color: COLORS.textSecondary,
  },
  listMeta: {
    fontSize: moderateScale(11),
    color: COLORS.textTertiary,
  },
  listRight: {
    alignItems: 'flex-end',
    gap: wp(1),
  },
  listDate: {
    fontSize: moderateScale(11),
    color: COLORS.textSecondary,
  },

  // Selection Footer
  selectionFooterWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  selectionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingVertical: hp(1.5),
  },
  selectionFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  selectAllButton: {
    padding: wp(1),
  },
  selectionCount: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  selectionFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  cancelButton: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
  },
  cancelButtonText: {
    fontSize: moderateScale(14),
    color: COLORS.textSecondary,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    backgroundColor: COLORS.accentDim,
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  syncButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: COLORS.accent,
  },
  removeButton: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    backgroundColor: COLORS.danger,
    borderRadius: wp(2),
  },
  removeButtonDisabled: {
    opacity: 0.4,
  },
  removeButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp(8),
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: hp(2),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: COLORS.textSecondary,
    marginTop: hp(1),
    textAlign: 'center',
  },
});

export default ReadingHistoryScreen;
