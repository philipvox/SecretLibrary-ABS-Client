/**
 * src/features/home/screens/LibraryScreen.tsx
 *
 * Secret Library - Library Screen
 * Features two view modes: Bookshelf (spines, primary) and Grid (secondary)
 *
 * Design: Clean editorial aesthetic with Playfair Display titles,
 * JetBrains Mono metadata, and a cream/black color scheme.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  FlatList,
  GestureResponderEvent,
  Animated,
  Alert,
  Platform,
  TextInput,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
// Note: Safe area is handled by TopNav component
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import ReAnimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gyroscope } from 'expo-sensors';

import { apiClient } from '@/core/api';
import { librarySyncService } from '@/core/services/librarySyncService';
import { useLibrarySyncStore } from '@/shared/stores/librarySyncStore';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { haptics } from '@/core/native/haptics';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useLibraryCache } from '@/core/cache';
import { useToastStore } from '@/shared/hooks/useToast';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { TopNav, TopNavSearchIcon, SkullRefreshControl, SkeletonBox, useBookContextMenu } from '@/shared/components';
import { useNavigationWithLoading } from '@/shared/hooks';
import {
  secretLibraryColors as staticColors,
  secretLibraryTypography as typography,
  secretLibrarySpacing as spacing,
  secretLibrarySizes as sizes,
  secretLibraryFonts as fonts,
} from '@/shared/theme/secretLibrary';
import { getTitle, getAuthorName, getNarratorName } from '@/shared/utils/metadata';

// Extended metadata with tags
interface ExtendedBookMetadata extends BookMetadata {
  tags?: string[];
}

// Helper to get book metadata safely
// Note: Does NOT require audioFiles - works with cache items that only have metadata
function getBookMetadata(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

// Helper to get book duration safely
// Note: Does NOT require audioFiles - works with cache items that only have duration
function getBookDuration(item: LibraryItem | null | undefined): number {
  return item?.media?.duration || 0;
}

import { BookshelfView, LayoutMode } from '../components/BookshelfView';
import { BookSpineVerticalData } from '../components/BookSpineVertical';
import { DiscoverMoreCard, RecommendedBook } from '../components/DiscoverMoreCard';
import { useHomeData } from '../hooks/useHomeData';
import { useRecommendations } from '@/features/recommendations/hooks/useRecommendations';
import { useInProgressBooks, useFinishedBooks } from '@/core/hooks/useUserBooks';
import { useShallow } from 'zustand/react/shallow';
import { useProgressStore } from '@/core/stores/progressStore';
import { usePlayerStore } from '@/features/player/stores';
import { GLOBAL_MINI_PLAYER_HEIGHT } from '@/navigation/components/GlobalMiniPlayer';
import { useAppReadyStore } from '@/core/stores/appReadyStore';
import { useSpineCacheStore } from '../stores/spineCache';
import { usePlaylists, usePlaylistSettingsStore } from '@/features/playlists';

// =============================================================================
// BOTTOM PADDING CONSTANTS - Edit these to adjust shelf/stack/list positioning
// =============================================================================

// SHELF MODE (upright spines, horizontal scroll)
// Minimal gap — spines sit just above the mini player
const SHELF_PADDING_WITH_MINI_PLAYER = GLOBAL_MINI_PLAYER_HEIGHT + 4;
const SHELF_PADDING_NO_MINI_PLAYER = 40;

// LIST MODE (vertical list with covers)
const LIST_PADDING_WITH_MINI_PLAYER = GLOBAL_MINI_PLAYER_HEIGHT + 20;
const LIST_PADDING_NO_MINI_PLAYER = 40;

// GRID MODE (2-column card grid)
const GRID_PADDING_WITH_MINI_PLAYER = GLOBAL_MINI_PLAYER_HEIGHT + 20;
const GRID_PADDING_NO_MINI_PLAYER = 40;

// =============================================================================
// TYPES
// =============================================================================

type ViewMode = 'shelf' | 'list' | 'grid';  // Shelf (upright spines), List (vertical), or Grid (2-column cards)
type SortMode = 'lastPlayed' | 'added' | 'title' | 'author' | 'progress' | 'series' | 'duration';
type SortDirection = 'asc' | 'desc';
type ContentMode = 'library' | 'lastPlayed' | 'finished' | string;  // What content to show (includes playlist:${id})

const SORT_OPTIONS: { key: SortMode; label: string; defaultDir: SortDirection }[] = [
  { key: 'lastPlayed', label: 'Last Played', defaultDir: 'desc' },
  { key: 'added', label: 'Added', defaultDir: 'desc' },
  { key: 'title', label: 'Title', defaultDir: 'asc' },
  { key: 'author', label: 'Author', defaultDir: 'asc' },
  { key: 'progress', label: 'Progress', defaultDir: 'desc' },
  { key: 'series', label: 'Series', defaultDir: 'asc' },
  { key: 'duration', label: 'Duration', defaultDir: 'desc' },
];

// Base content options (playlists are added dynamically)
const BASE_CONTENT_OPTIONS: { key: ContentMode; label: string }[] = [
  { key: 'library', label: 'My Library' },
  { key: 'mySeries', label: 'My Series' },
  { key: 'lastPlayed', label: 'Last Played' },
  { key: 'finished', label: 'Finished' },
];

// Download filter cycles: all → downloaded → not-downloaded → all

interface LibraryBook {
  id: string;
  title: string;
  author: string;
  duration: string;
  durationSeconds: number;
  progress: number;
  coverUrl?: string;
  lastPlayedAt?: number; // Unix timestamp in milliseconds
  addedAt?: number; // When added to server library (fallback for recent sort)
  isDownloaded: boolean;
  seriesName?: string;
  seriesSequence?: number;
}

// =============================================================================
// ICONS
// =============================================================================

interface IconProps {
  color?: string;
}

// Shelf icon - upright books on shelf (filled)
const ShelfIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
    <Rect x={3} y={4} width={4} height={14} rx={1} />
    <Rect x={9} y={6} width={4} height={12} rx={1} />
    <Rect x={15} y={3} width={4} height={15} rx={1} />
    <Rect x={2} y={19} width={20} height={2} rx={0.5} />
  </Svg>
);

// List icon - horizontal lines (filled)
const ListIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
    <Circle cx={3} cy={6} r={1.5} />
    <Circle cx={3} cy={12} r={1.5} />
    <Circle cx={3} cy={18} r={1.5} />
    <Rect x={7} y={5} width={14} height={2} rx={1} />
    <Rect x={7} y={11} width={14} height={2} rx={1} />
    <Rect x={7} y={17} width={14} height={2} rx={1} />
  </Svg>
);

// Grid icon - 2x2 squares (filled)
const GridIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
    <Rect x={3} y={3} width={8} height={8} rx={1.5} />
    <Rect x={13} y={3} width={8} height={8} rx={1.5} />
    <Rect x={3} y={13} width={8} height={8} rx={1.5} />
    <Rect x={13} y={13} width={8} height={8} rx={1.5} />
  </Svg>
);

// Globe icon — discover/browse navigation
const GlobeIcon = ({ color = '#000', size = 16 }: IconProps & { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Svg>
);

// Down chevron — small arrow for pill dropdown indicator
const DownChevron = ({ color = '#000' }: IconProps) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3}>
    <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Sort arrow — bold chevron, flips for asc/desc
const SortArrow = ({ color = '#000', direction = 'desc' }: IconProps & { direction?: 'asc' | 'desc' }) => (
  <Svg
    width={10}
    height={10}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={3}
    style={direction === 'asc' ? { transform: [{ rotate: '180deg' }] } : undefined}
  >
    <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Refresh icon - circular arrows
const RefreshIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
    <Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <Path d="M21 3v5h-5" />
  </Svg>
);

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Format duration as compact string (e.g., "10h")
function formatDurationCompact(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  return `${hours}h`;
}

// =============================================================================
// TRANSFORM DATA
// =============================================================================

function transformToLibraryBook(item: LibraryItem, downloadedIds: Set<string>): LibraryBook {
  const metadata = getBookMetadata(item) || {};
  const mediaProgress = item.mediaProgress || item.userMediaProgress;
  const duration = getBookDuration(item);

  // Use LOCAL progress from progressStore (updated immediately on playback)
  // This prevents sort flickering when server data arrives with different timestamps
  const localProgress = useProgressStore.getState().getProgress(item.id);
  const progress = localProgress?.progress ?? mediaProgress?.progress ?? 0;
  const lastPlayedAt = localProgress?.lastPlayedAt ?? mediaProgress?.lastUpdate ?? 0;

  const seriesInfo = extractSeriesInfo(metadata);

  return {
    id: item.id,
    title: getTitle(item),
    author: getAuthorName(item),
    duration: formatDuration(duration),
    durationSeconds: duration,
    progress,
    coverUrl: apiClient.getItemCoverUrl(item.id, { width: 400, height: 400 }),
    lastPlayedAt,
    addedAt: item.addedAt,
    isDownloaded: downloadedIds.has(item.id),
    seriesName: seriesInfo.name,
    seriesSequence: seriesInfo.sequence,
  };
}

/**
 * Extract series name and sequence from metadata
 * Handles both series array and seriesName string formats
 */
function extractSeriesInfo(metadata: any): { name?: string; sequence?: number } {
  // Handle null/undefined metadata
  if (!metadata) return {};

  // Try series array first (expanded API data with name and sequence)
  if (metadata.series?.length > 0) {
    const seriesEntry = metadata.series[0];
    const name = seriesEntry.name || seriesEntry;
    const sequence = seriesEntry.sequence ? parseFloat(seriesEntry.sequence) : undefined;
    if (name && typeof name === 'string') {
      return { name, sequence: sequence || undefined };
    }
  }

  // Try seriesName string (format: "Series Name #N")
  const seriesNameRaw = metadata.seriesName || '';
  if (seriesNameRaw) {
    const seqMatch = seriesNameRaw.match(/#([\d.]+)/);
    if (seqMatch) {
      const sequence = parseFloat(seqMatch[1]);
      const name = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();
      return { name, sequence };
    }
    // Series name without sequence
    return { name: seriesNameRaw, sequence: undefined };
  }

  return {};
}

function transformToSpineData(
  book: LibraryBook,
  item: LibraryItem,
  showLastPlayed: boolean = false
): BookSpineVerticalData {
  const metadata = getBookMetadata(item);
  const duration = getBookDuration(item);
  const genres: string[] = metadata?.genres || [];
  const tags: string[] = metadata?.tags || [];

  // Convert timestamp to ISO string only when showing last played
  const lastPlayedAt = showLastPlayed && book.lastPlayedAt
    ? new Date(book.lastPlayedAt).toISOString()
    : undefined;

  // PERF: Use series info already extracted on LibraryBook (avoids redundant regex)
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    progress: book.progress,
    genres,
    tags,
    duration,
    seriesName: book.seriesName,
    seriesSequence: book.seriesSequence,
    lastPlayedAt,
    isDownloaded: book.isDownloaded,
  };
}

// =============================================================================
// VIEW MODE PICKER — single button, long-press reveals overlapping capsule
// The capsule appears on top of the button with the current mode aligned.
// A sliding circle indicator animates smoothly as the user drags.
// =============================================================================

const VIEW_MODES: ViewMode[] = ['shelf', 'grid', 'list'];
const BUTTON_SIZE = 36;
const INDICATOR_SIZE = 26;
const CAPSULE_PADDING = 4;
const CELL_SIZE = INDICATOR_SIZE + 4;
const CAPSULE_WIDTH = INDICATOR_SIZE + CAPSULE_PADDING * 2;
const CAPSULE_HEIGHT = CELL_SIZE * VIEW_MODES.length + CAPSULE_PADDING * 2;
const CAPSULE_RADIUS = CAPSULE_WIDTH / 2;
const CAPSULE_GAP = 4; // gap between button and capsule
// Base top offset for indicator within capsule (index 0 position)
const INDICATOR_BASE_TOP = CAPSULE_PADDING + (CELL_SIZE - INDICATOR_SIZE) / 2;

interface ViewModePickerProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  iconColor: string;         // icon color on button (collapsed state)
  activeIconColor: string;   // icon color on white indicator (dark on white)
  inactiveIconColor: string; // icon color for non-selected options in capsule
  borderColor: string;       // button & capsule border
  indicatorColor: string;    // sliding circle fill (white)
  capsuleBg: string;         // capsule background (dark)
}

function ViewModePicker({ mode, onModeChange, iconColor, activeIconColor, inactiveIconColor, borderColor, indicatorColor, capsuleBg }: ViewModePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<View>(null);
  const containerLayout = useRef({ y: 0 });
  const didOpen = useRef(false);
  const highlightedRef = useRef(-1);

  // Animated translateY for indicator (uses native driver for smooth animation)
  const indicatorTranslateY = useRef(new Animated.Value(0)).current;

  const getModeIcon = (m: ViewMode, color: string) => {
    switch (m) {
      case 'shelf': return <ShelfIcon color={color} />;
      case 'grid': return <GridIcon color={color} />;
      case 'list': return <ListIcon color={color} />;
    }
  };

  // Map pageY to capsule option index (capsule is fixed below button)
  const getOptionIndex = (pageY: number) => {
    const capsuleAbsTop = containerLayout.current.y + BUTTON_SIZE + CAPSULE_GAP;
    const relativeY = pageY - capsuleAbsTop - CAPSULE_PADDING;
    const index = Math.floor(relativeY / CELL_SIZE);
    return index >= 0 && index < VIEW_MODES.length ? index : -1;
  };

  const animateIndicator = useCallback((toIndex: number) => {
    Animated.spring(indicatorTranslateY, {
      toValue: toIndex * CELL_SIZE,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  }, [indicatorTranslateY]);

  // Clean up longPressTimer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handlePressIn = useCallback((e: GestureResponderEvent) => {
    didOpen.current = false;
    containerRef.current?.measureInWindow((_x, y) => {
      containerLayout.current = { y };
    });
    longPressTimer.current = setTimeout(() => {
      didOpen.current = true;
      const modeIdx = VIEW_MODES.indexOf(mode);
      // Set indicator to current mode position (no animation)
      indicatorTranslateY.setValue(modeIdx * CELL_SIZE);
      highlightedRef.current = modeIdx;
      setHighlightedIndex(modeIdx);
      setIsOpen(true);
      haptics.selection();
    }, 300);
  }, [mode, indicatorTranslateY]);

  const handleMove = useCallback((e: GestureResponderEvent) => {
    if (!didOpen.current) return;
    const newIndex = getOptionIndex(e.nativeEvent.pageY);
    if (newIndex >= 0 && newIndex !== highlightedRef.current) {
      highlightedRef.current = newIndex;
      haptics.selection();
      animateIndicator(newIndex);
      setHighlightedIndex(newIndex);
    }
  }, [animateIndicator]);

  const handlePressOut = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!didOpen.current) {
      // Short tap — cycle to next mode
      const currentIndex = VIEW_MODES.indexOf(mode);
      const nextMode = VIEW_MODES[(currentIndex + 1) % VIEW_MODES.length];
      onModeChange(nextMode);
      return;
    }

    // Long press release — select highlighted
    const idx = highlightedRef.current;
    if (idx >= 0) {
      const selectedMode = VIEW_MODES[idx];
      if (selectedMode !== mode) {
        onModeChange(selectedMode);
      }
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    highlightedRef.current = -1;
    didOpen.current = false;
  }, [mode, onModeChange]);

  return (
    <View
      ref={containerRef}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handlePressIn}
      onResponderMove={handleMove}
      onResponderRelease={handlePressOut}
      onResponderTerminate={handlePressOut}
      style={viewPickerStyles.wrapper}
    >
      {/* Button (always rendered to maintain layout size) */}
      <View style={[viewPickerStyles.button, { borderColor, opacity: isOpen ? 0 : 1 }]}>
        {getModeIcon(mode, iconColor)}
      </View>

      {/* Capsule overlapping button — current mode aligned with button center */}
      {isOpen && (
        <View style={[viewPickerStyles.capsule, {
          backgroundColor: capsuleBg,
          borderColor,
        }]}>
          {/* Animated sliding indicator */}
          <Animated.View style={[
            viewPickerStyles.indicator,
            {
              backgroundColor: indicatorColor,
              transform: [{ translateY: indicatorTranslateY }],
            },
          ]} />
          {VIEW_MODES.map((m) => {
            const isActive = (highlightedIndex >= 0 ? VIEW_MODES[highlightedIndex] : mode) === m;
            return (
              <View key={m} style={viewPickerStyles.cell}>
                {getModeIcon(m, isActive ? activeIconColor : inactiveIconColor)}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const viewPickerStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 100,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    position: 'absolute',
    top: BUTTON_SIZE + CAPSULE_GAP,
    right: 0,
    width: CAPSULE_WIDTH,
    height: CAPSULE_HEIGHT,
    borderRadius: CAPSULE_RADIUS,
    borderWidth: 1,
    padding: CAPSULE_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_BASE_TOP,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LibraryScreen() {
  const { navigateWithLoading, jumpToTabWithLoading, navigation } = useNavigationWithLoading();
  // Note: Safe area is handled by TopNav component (includeSafeArea={true} by default)

  // Book context menu (long-press actions)
  const { showMenu } = useBookContextMenu();

  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  const [viewMode, setViewMode] = useState<ViewMode>('shelf');
  const [sortMode, setSortMode] = useState<SortMode>(
    usePlaylistSettingsStore.getState().defaultView === 'mySeries' ? 'series' : 'lastPlayed'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const prevSortRef = useRef<{ mode: SortMode; dir: SortDirection }>({ mode: 'lastPlayed', dir: 'desc' });
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showContentDropdown, setShowContentDropdown] = useState(false);
  const [showPlaylistNameModal, setShowPlaylistNameModal] = useState(false);
  const [playlistNameInput, setPlaylistNameInput] = useState('');

  // Playlist settings from store
  const defaultView = usePlaylistSettingsStore((s) => s.defaultView);
  const visiblePlaylistIds = usePlaylistSettingsStore((s) => s.visiblePlaylistIds);
  const playlistOrder = usePlaylistSettingsStore((s) => s.playlistOrder);
  const hiddenBuiltInViews = usePlaylistSettingsStore((s) => s.hiddenBuiltInViews);
  const allItemOrder = usePlaylistSettingsStore((s) => s.allItemOrder);

  // Initialize content mode from default view setting
  const [contentMode, setContentMode] = useState<ContentMode>(defaultView || 'library');

  // Sync contentMode when defaultView changes (e.g., user changes setting and returns to this tab)
  useEffect(() => {
    if (defaultView) {
      setContentMode(defaultView as ContentMode);
    }
  }, [defaultView]);

  // Close dropdown modals when navigating away to prevent flash on return
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setShowSortDropdown(false);
      setShowContentDropdown(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Favorite series names (for My Series view reactivity)
  const favoriteSeriesNames = useMyLibraryStore((s) => s.favoriteSeriesNames);

  // Fetch playlists
  const { data: playlists = [] } = usePlaylists();

  // Get data from home hook (for refresh and in-progress data)
  const {
    recentlyListened,
    isRefreshing,
    refresh,
  } = useHomeData();

  // Get library IDs (books user has added to their library)
  // Use progressStore which is the unified source of truth (same as book detail "IN LIBRARY" button)
  // PERF FIX: Subscribe to version number instead of librarySet directly to prevent re-render loops
  // The Set reference changes on every store update, causing cascading re-renders
  const progressVersion = useProgressStore((state) => state.version);
  const isProgressLoaded = useProgressStore((state) => state.isLoaded);

  // Check if mini player is active (has a book loaded)
  const currentBook = usePlayerStore((state) => state.currentBook);
  const isMiniPlayerActive = currentBook !== null;

  // Calculate bottom padding based on view mode and mini player state
  const getBottomPadding = useCallback((mode: ViewMode) => {
    switch (mode) {
      case 'shelf':
        return isMiniPlayerActive ? SHELF_PADDING_WITH_MINI_PLAYER : SHELF_PADDING_NO_MINI_PLAYER;
      case 'list':
        return isMiniPlayerActive ? LIST_PADDING_WITH_MINI_PLAYER : LIST_PADDING_NO_MINI_PLAYER;
      case 'grid':
        return isMiniPlayerActive ? GRID_PADDING_WITH_MINI_PLAYER : GRID_PADDING_NO_MINI_PLAYER;
    }
  }, [isMiniPlayerActive]);

  // Get local SQLite progress data as fallback for "Last Played"
  const { data: localInProgressBooks = [] } = useInProgressBooks();

  // Get finished books from SQLite
  const { data: finishedBooks = [] } = useFinishedBooks();

  // Get library cache for items and refresh functionality
  // PERF FIX: Use selector to only subscribe to needed fields, preventing re-renders from other store changes
  // PERF FIX: Use itemsById (pre-built index) instead of creating Map from items array
  const { items: allCacheItems, itemsById: cacheItemsById, refreshCache, isLoading: isCacheLoading, isLoaded: isCacheLoaded } = useLibraryCache(
    useShallow((state) => ({
      items: state.items,
      itemsById: state.itemsById,
      refreshCache: state.refreshCache,
      isLoading: state.isLoading,
      isLoaded: state.isLoaded,
    }))
  );

  // Load spine manifest on mount to ensure spines render correctly
  useEffect(() => {
    useLibraryCache.getState().loadSpineManifest();
  }, []);

  // Get recommendations for "Find More Books" card (5 for empty state stack)
  const { recommendations: recommendedItems } = useRecommendations(allCacheItems, 5);

  // Note: Auto-refresh now happens during app boot (App.tsx) to prevent library flash
  // Manual refresh is still available via pull-to-refresh

  // Transform recommendations to the format needed by DiscoverMoreCard
  // Include genres, tags, and duration so BookSpineVertical can render properly
  const discoverRecommendations = useMemo((): RecommendedBook[] => {
    return recommendedItems.slice(0, 5).map((item) => {
      const metadata = getBookMetadata(item);
      return {
        id: item.id,
        title: getTitle(item),
        author: getAuthorName(item),
        genres: metadata?.genres || [],
        tags: metadata?.tags || [],
        duration: getBookDuration(item),
      };
    });
  }, [recommendedItems]);

  // Handler for "Find More Books" card press
  const handleDiscoverPress = useCallback(() => {
    haptics.buttonPress();
    jumpToTabWithLoading('DiscoverTab');
  }, [jumpToTabWithLoading]);

  // Gyroscope-driven rotation for discover ring
  const discoverRotation = useSharedValue(0);
  useEffect(() => {
    Gyroscope.setUpdateInterval(32);
    let prev = Date.now();
    const sub = Gyroscope.addListener((data) => {
      const now = Date.now();
      const dt = (now - prev) / 1000;
      prev = now;
      discoverRotation.value += (data.y / 2) * dt * (180 / Math.PI) * 3;
    });
    return () => sub.remove();
  }, [discoverRotation]);

  const discoverRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${discoverRotation.value}deg` }],
  }));

  // Handler for recommendation book spine press - navigate to book detail
  const handleRecommendationPress = useCallback((book: RecommendedBook) => {
    haptics.buttonPress();
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  // Build local "recently listened" from SQLite when server data is empty
  // This ensures "Last Played" shows books even when server returns 0 items
  // PERF FIX: Use pre-built cacheItemsById Map instead of creating new Map
  const localRecentlyListened = useMemo(() => {
    if (recentlyListened.length > 0) return recentlyListened;
    if (localInProgressBooks.length === 0) return [];

    // Convert local progress data to LibraryItems by looking up in cache
    const localItems: LibraryItem[] = [];

    for (const userBook of localInProgressBooks) {
      const cacheItem = cacheItemsById.get(userBook.bookId);
      if (cacheItem) {
        // Enrich cache item with local progress data
        const lastUpdateTime = userBook.lastPlayedAt ? new Date(userBook.lastPlayedAt).getTime() : Date.now();
        localItems.push({
          ...cacheItem,
          mediaProgress: {
            id: userBook.bookId,
            libraryItemId: userBook.bookId,
            currentTime: userBook.currentTime,
            duration: userBook.duration,
            progress: userBook.progress,
            isFinished: userBook.isFinished,
            hideFromContinueListening: false,
            lastUpdate: lastUpdateTime,
            startedAt: lastUpdateTime, // Use lastUpdate as fallback for startedAt
          },
        });
      }
    }

    return localItems.slice(0, 20);
  }, [recentlyListened, localInProgressBooks, cacheItemsById]);

  // Build finished books list from SQLite data
  // PERF FIX: Use pre-built cacheItemsById Map instead of creating new Map
  const finishedLibraryItems = useMemo(() => {
    if (finishedBooks.length === 0) return [];

    // Convert finished books to LibraryItems by looking up in cache
    const items: LibraryItem[] = [];

    for (const userBook of finishedBooks) {
      const cacheItem = cacheItemsById.get(userBook.bookId);
      if (cacheItem) {
        // Enrich cache item with finished data
        const finishedTime = userBook.finishedAt ? new Date(userBook.finishedAt).getTime() : Date.now();
        items.push({
          ...cacheItem,
          mediaProgress: {
            id: userBook.bookId,
            libraryItemId: userBook.bookId,
            currentTime: userBook.currentTime,
            duration: userBook.duration,
            progress: userBook.progress,
            isFinished: true,
            hideFromContinueListening: false,
            lastUpdate: finishedTime,
            startedAt: finishedTime,
          },
        });
      }
    }

    return items;
  }, [finishedBooks, cacheItemsById]);

  // Build dynamic content options respecting visibility and order settings
  const contentOptions = useMemo(() => {
    // Map of all possible items by their order key (__library, __mySeries, etc. or playlist ID)
    const builtInMap: Record<string, { key: ContentMode; label: string }> = {
      '__library': { key: 'library', label: 'My Library' },
      '__mySeries': { key: 'mySeries', label: 'My Series' },
      '__lastPlayed': { key: 'lastPlayed', label: 'Last Played' },
      '__finished': { key: 'finished', label: 'Finished' },
    };

    // Build playlist map
    const playlistMap = new Map<string, { key: ContentMode; label: string }>();
    for (const p of playlists) {
      if (!p.name.startsWith('__sl_') && visiblePlaylistIds.includes(p.id)) {
        playlistMap.set(p.id, { key: `playlist:${p.id}`, label: p.name });
      }
    }

    // Hidden built-in keys as a set for quick lookup
    const hiddenSet = new Set(hiddenBuiltInViews);

    // If allItemOrder is set, use it for ordering
    if (allItemOrder.length > 0) {
      const options: { key: ContentMode; label: string }[] = [];
      const addedKeys = new Set<string>();

      for (const id of allItemOrder) {
        if (id in builtInMap) {
          // Built-in view — check if hidden
          const builtInKey = id.replace('__', '') as string;
          if (!hiddenSet.has(builtInKey as any)) {
            options.push(builtInMap[id]);
            addedKeys.add(id);
          }
        } else if (playlistMap.has(id)) {
          options.push(playlistMap.get(id)!);
          addedKeys.add(id);
        }
      }

      // Add any items not in the stored order (newly added)
      for (const [key, item] of Object.entries(builtInMap)) {
        const builtInKey = key.replace('__', '') as string;
        if (!addedKeys.has(key) && !hiddenSet.has(builtInKey as any)) {
          options.push(item);
        }
      }
      for (const [id, item] of playlistMap) {
        if (!addedKeys.has(id)) {
          options.push(item);
        }
      }

      return options;
    }

    // Fallback: no allItemOrder stored yet — use old logic
    const options: { key: ContentMode; label: string }[] = [];

    // Add visible built-in views
    for (const opt of BASE_CONTENT_OPTIONS) {
      if (!hiddenSet.has(opt.key as any)) {
        options.push(opt);
      }
    }

    // Add visible playlists in order
    const orderedPlaylistIds = playlistOrder.filter(id => visiblePlaylistIds.includes(id));
    const remainingVisibleIds = visiblePlaylistIds.filter(id => !playlistOrder.includes(id));
    for (const playlistId of [...orderedPlaylistIds, ...remainingVisibleIds]) {
      const playlist = playlists.find(p => p.id === playlistId);
      if (playlist && !playlist.name.startsWith('__sl_')) {
        options.push({ key: `playlist:${playlist.id}`, label: playlist.name });
      }
    }

    return options;
  }, [playlists, visiblePlaylistIds, playlistOrder, hiddenBuiltInViews, allItemOrder]);

  // Get downloaded books
  const { downloads, isLoading: isDownloadsLoading } = useDownloads();
  const downloadedIds = useMemo(() => {
    const ids = new Set<string>();
    downloads
      .filter((d) => d.status === 'complete')
      .forEach((d) => ids.add(d.itemId));
    return ids;
  }, [downloads]);

  // Check if app boot is complete (initial refresh finished)
  const isBootComplete = useAppReadyStore((s) => s.isBootComplete);

  // Data readiness flag - wait for essential data sources before showing books
  // Note: We don't wait for isRefreshComplete - books show immediately as dark placeholders
  // (via isWaitingForServerSpine in BookSpineVertical) and may re-sort when fresh data arrives.
  // Dark boxes re-sorting is less jarring than colorful covers moving.
  const isDataReady = isProgressLoaded && isCacheLoaded && !isDownloadsLoading && isBootComplete;

  // DEBUG: Log loading states (can be removed once stable)
  if (__DEV__) {
    console.log(`[LibraryScreen] isDataReady=${isDataReady} (progress=${isProgressLoaded}, cache=${isCacheLoaded}, downloads=${!isDownloadsLoading}, boot=${isBootComplete})`);
  }

  // Get all completed downloads as LibraryItems
  const downloadedLibraryItems = useMemo(() => {
    return downloads
      .filter((d) => d.status === 'complete' && d.libraryItem)
      .map((d) => d.libraryItem as LibraryItem);
  }, [downloads]);

  // Get books in user's library from cache
  // Now using progressStore.librarySet which is the same source as book detail screen
  // PERF FIX: Use getState() inside useMemo instead of subscribing to librarySet
  // This way we re-filter when progressVersion changes (number equality is stable)
  const libraryBooksFromCache = useMemo(() => {
    const librarySet = useProgressStore.getState().librarySet;
    if (!isCacheLoaded || !isProgressLoaded || librarySet.size === 0) return [];
    return allCacheItems.filter(item => librarySet.has(item.id));
  }, [allCacheItems, progressVersion, isCacheLoaded, isProgressLoaded]);

  // Select items based on content mode (Library vs Last Played vs Finished vs Playlist)
  // PERF FIX: Use pre-built cacheItemsById Map instead of creating new Map
  const baseLibraryItems = useMemo(() => {
    // Handle playlist content mode
    if (contentMode.startsWith('playlist:')) {
      const playlistId = contentMode.replace('playlist:', '');
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return [];

      // Get library items from playlist, looking up in cache
      const items: LibraryItem[] = [];

      for (const playlistItem of playlist.items) {
        // First try the embedded libraryItem, then fall back to cache lookup
        const item = playlistItem.libraryItem || cacheItemsById.get(playlistItem.libraryItemId);
        if (item) {
          items.push(item);
        }
      }

      return items;
    }

    switch (contentMode) {
      case 'library':
        // "My Library" - show books user has added to their library
        return libraryBooksFromCache;
      case 'mySeries': {
        // "My Series" - show ALL books from favorited series via library cache
        const favSeriesNames = useMyLibraryStore.getState().favoriteSeriesNames;
        if (favSeriesNames.length === 0) return [];
        const seen = new Set<string>();
        const seriesItems: LibraryItem[] = [];
        for (const seriesName of favSeriesNames) {
          const seriesInfo = useLibraryCache.getState().getSeries(seriesName);
          if (seriesInfo) {
            for (const book of seriesInfo.books) {
              if (!seen.has(book.id)) {
                seen.add(book.id);
                seriesItems.push(book);
              }
            }
          }
        }
        return seriesItems;
      }
      case 'lastPlayed':
        // "Last Played" - use local SQLite data as fallback when server returns empty
        return localRecentlyListened;
      case 'finished':
        // "Finished" - show completed books from SQLite
        return finishedLibraryItems;
      default:
        return libraryBooksFromCache;
    }
  }, [contentMode, libraryBooksFromCache, localRecentlyListened, finishedLibraryItems, playlists, cacheItemsById, favoriteSeriesNames]);

  const effectiveLibraryItems = baseLibraryItems;

  // Book counts per content mode (for dropdown display)
  const contentCounts = useMemo(() => {
    const counts: Record<string, number> = {
      library: libraryBooksFromCache.length,
      lastPlayed: localRecentlyListened.length,
      finished: finishedLibraryItems.length,
    };
    // My Series count
    const favSeriesNames = useMyLibraryStore.getState().favoriteSeriesNames;
    let seriesCount = 0;
    const seen = new Set<string>();
    for (const seriesName of favSeriesNames) {
      const seriesInfo = useLibraryCache.getState().getSeries(seriesName);
      if (seriesInfo) {
        for (const book of seriesInfo.books) {
          if (!seen.has(book.id)) { seen.add(book.id); seriesCount++; }
        }
      }
    }
    counts.mySeries = seriesCount;
    // Playlist counts
    for (const p of playlists) {
      counts[`playlist:${p.id}`] = p.items?.length || 0;
    }
    return counts;
  }, [libraryBooksFromCache, localRecentlyListened, finishedLibraryItems, playlists, favoriteSeriesNames]);

  // Transform to LibraryBook format for list/grid views
  // Uses LOCAL progressStore timestamps (not server) to avoid sort flicker on refresh
  // Depends on progressVersion so it re-sorts when local progress updates
  const allBooksUnsorted = useMemo(() => {
    return effectiveLibraryItems.map((item) => transformToLibraryBook(item, downloadedIds));
  }, [effectiveLibraryItems, downloadedIds, progressVersion]);

  // Books are already filtered by effectiveLibraryItems, no additional filtering needed
  const filteredBooks = allBooksUnsorted;

  // Sort books based on sort mode
  // Guard with isDataReady to prevent flash/reordering as data sources load
  const allBooks = useMemo(() => {
    // Return empty array while data is loading - skeleton will show
    if (!isDataReady) {
      return [];
    }

    const sorted = [...filteredBooks];
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortMode) {
      case 'title':
        sorted.sort((a, b) => dir * a.title.localeCompare(b.title));
        break;
      case 'author':
        sorted.sort((a, b) => dir * a.author.localeCompare(b.author));
        break;
      case 'progress':
        sorted.sort((a, b) => dir * (a.progress - b.progress));
        break;
      case 'series':
        sorted.sort((a, b) => {
          if (!a.seriesName && !b.seriesName) return dir * a.title.localeCompare(b.title);
          if (!a.seriesName) return 1;
          if (!b.seriesName) return -1;
          const seriesCompare = dir * a.seriesName.localeCompare(b.seriesName);
          if (seriesCompare !== 0) return seriesCompare;
          return dir * ((a.seriesSequence || 999) - (b.seriesSequence || 999));
        });
        break;
      case 'duration':
        sorted.sort((a, b) => dir * (a.durationSeconds - b.durationSeconds));
        break;
      case 'added':
        sorted.sort((a, b) => dir * ((a.addedAt || 0) - (b.addedAt || 0)));
        break;
      case 'lastPlayed':
      default:
        sorted.sort((a, b) => {
          const aTime = a.lastPlayedAt || a.addedAt || 0;
          const bTime = b.lastPlayedAt || b.addedAt || 0;
          return dir * (aTime - bTime);
        });
        break;
    }
    return sorted;
  }, [filteredBooks, sortMode, sortDirection, isDataReady]);

  // Extract active playlist ID when in playlist content mode
  const activePlaylistId = useMemo(
    () => contentMode.startsWith('playlist:') ? contentMode.slice('playlist:'.length) : undefined,
    [contentMode]
  );

  // Handlers
  const handleBookPress = useCallback((book: LibraryBook | BookSpineVerticalData) => {
    const item = cacheItemsById.get(book.id);
    if (item) showMenu(item, activePlaylistId ? { playlistId: activePlaylistId } : undefined);
  }, [cacheItemsById, showMenu, activePlaylistId]);

  const handleBookLongPress = useCallback((book: LibraryBook | BookSpineVerticalData) => {
    haptics.selection();
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    haptics.selection();
    navigation.navigate('Search');
  }, [navigation]);

  const handleRefreshPress = useCallback(async () => {
    haptics.selection();
    await refreshCache();
    await refresh();
  }, [refreshCache, refresh]);

  const [isSyncing, setIsSyncing] = useState(false);
  const isCollectionLinked = useLibrarySyncStore(s => !!s.libraryPlaylistId);

  const handleSyncPress = useCallback(async () => {
    if (isSyncing) return;
    haptics.selection();
    setIsSyncing(true);
    useToastStore.getState().clearToasts();
    useToastStore.getState().addToast({ type: 'info', message: 'Syncing Library…', duration: 8000 });
    try {
      // 1. Cloud sync — upload/download library changes
      await librarySyncService.fullSync();
      // 2. Reload spine manifest from server
      await useLibraryCache.getState().loadSpineManifest();
      // 3. Reload library from server (re-download book list & covers)
      await refreshCache();
      // 4. Clear cached spine dimensions so fresh images load
      useSpineCacheStore.getState().clearServerSpineDimensions();
      useToastStore.getState().clearToasts();
      useToastStore.getState().addToast({ type: 'success', message: 'Library Synced', duration: 2000 });
    } catch {
      useToastStore.getState().clearToasts();
      useToastStore.getState().addToast({ type: 'error', message: 'Sync Failed', duration: 3000 });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCache]);

  const createPlaylistWithName = useCallback(async (name: string) => {
    if (!name?.trim()) return;
    try {
      const libraryId = useLibraryCache.getState().currentLibraryId;
      if (!libraryId) return;
      const { playlistsApi } = await import('@/core/api/endpoints/playlists');
      await playlistsApi.create({ libraryId, name: name.trim(), items: [] });
      const { queryClient } = await import('@/core/queryClient');
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      haptics.success();
      useToastStore.getState().addToast({ type: 'success', message: `Created "${name.trim()}"`, duration: 2000 });
    } catch {
      useToastStore.getState().addToast({ type: 'error', message: 'Failed to create playlist', duration: 3000 });
    }
  }, []);

  const handleCreateNewPlaylist = useCallback(() => {
    if (Platform.OS === 'ios') {
      // Alert.prompt is iOS-only
      Alert.prompt(
        'New Playlist',
        'Enter a name for the playlist',
        (name) => { createPlaylistWithName(name); },
        'plain-text',
        '',
        'Playlist name',
      );
    } else {
      // On Android, show a Modal with a TextInput instead
      setPlaylistNameInput('');
      setShowPlaylistNameModal(true);
    }
  }, [createPlaylistWithName]);

  const handlePlaylistNameSubmit = useCallback(() => {
    setShowPlaylistNameModal(false);
    createPlaylistWithName(playlistNameInput);
  }, [createPlaylistWithName, playlistNameInput]);

  const handleLogoLongPress = useCallback(() => {
    haptics.selection();
    navigation.navigate('Main', { screen: 'ProfileTab' });
  }, [navigation]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    haptics.selection();
    setViewMode(mode);
  }, []);

  const handleSortPress = useCallback(() => {
    haptics.selection();
    setShowSortDropdown(true);
  }, []);

  const handleSortSelect = useCallback((mode: SortMode) => {
    haptics.selection();
    if (mode === sortMode) {
      // Same sort tapped — toggle direction
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort — use its default direction
      const defaultDir = SORT_OPTIONS.find(o => o.key === mode)?.defaultDir || 'asc';
      setSortMode(mode);
      setSortDirection(defaultDir);
    }
    setShowSortDropdown(false);
  }, [sortMode]);

  const handleContentPress = useCallback(() => {
    haptics.selection();
    setShowContentDropdown(true);
  }, []);

  const handleContentSelect = useCallback((mode: ContentMode) => {
    haptics.selection();
    setContentMode(prev => {
      // Save sort before entering My Series, restore when leaving
      if (mode === 'mySeries' && prev !== 'mySeries') {
        prevSortRef.current = { mode: sortMode, dir: sortDirection };
        setSortMode('series');
        setSortDirection('asc');
      } else if (mode !== 'mySeries' && prev === 'mySeries') {
        setSortMode(prevSortRef.current.mode);
        setSortDirection(prevSortRef.current.dir);
      }
      return mode;
    });
    setShowContentDropdown(false);
  }, [sortMode, sortDirection]);

  // Use pre-built cacheItemsById for quick lookup of library items by ID
  // PERF FIX: Removed creation of new Map - use cacheItemsById directly
  // All items in effectiveLibraryItems are also in cacheItemsById
  const libraryItemsMap = cacheItemsById;

  // Dynamic styles based on mode - using white/black background
  const screenBg = colors.white;
  const textColor = colors.black;
  const buttonInactiveColor = colors.grayLine;
  const buttonInactiveTextColor = colors.gray;

  // Get current labels for dropdowns
  const currentSortLabel = SORT_OPTIONS.find(opt => opt.key === sortMode)?.label || 'Last Played';
  const currentContentLabel = contentOptions.find(opt => opt.key === contentMode)?.label || 'Library';

  // PERF: Memoized row renderer for list view FlatList
  const renderListItem = useCallback(({ item: book }: { item: LibraryBook }) => {
    const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
    const durationText = formatDurationCompact(book.durationSeconds);

    return (
      <Pressable
        style={[styles.verticalListItem, { borderBottomColor: colors.grayLine }]}
        onPress={() => handleBookPress(book)}
        onLongPress={() => handleBookLongPress(book)}
      >
        <Image
          source={{ uri: coverUrl }}
          style={styles.verticalCover}
        />
        <View style={styles.verticalInfo}>
          <Text style={[styles.verticalTitle, { color: colors.black }]} numberOfLines={1}>{book.title}</Text>
          {book.seriesName && (
            <Text style={[styles.verticalSeries, { color: colors.gray }]} numberOfLines={1}>
              {book.seriesName}{book.seriesSequence ? ` #${book.seriesSequence}` : ''}
            </Text>
          )}
        </View>
        <Text style={[styles.verticalDuration, { color: colors.gray }]}>{durationText}</Text>
      </Pressable>
    );
  }, [colors, handleBookPress, handleBookLongPress]);

  const listKeyExtractor = useCallback((item: LibraryBook) => item.id, []);

  // Render list view (virtualized FlatList)
  const renderListView = () => {
    return (
      <FlatList
        key="list-view"
        data={allBooks}
        renderItem={renderListItem}
        keyExtractor={listKeyExtractor}
        style={styles.listScrollView}
        contentContainerStyle={{ paddingBottom: getBottomPadding('list') }}
        showsVerticalScrollIndicator={false}
        refreshing={isCacheLoading || isRefreshing}
        onRefresh={handleRefreshPress}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
      />
    );
  };

  // PERF: Memoized row renderer for grid view FlatList
  const renderGridItem = useCallback(({ item: book }: { item: LibraryBook }) => {
    const item = libraryItemsMap.get(book.id);
    const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 300, height: 300 });
    const narrator = item ? getNarratorName(item) : '';
    const durationText = formatDurationCompact(book.durationSeconds);

    return (
      <Pressable
        style={styles.gridCard}
        onPress={() => handleBookPress(book)}
        onLongPress={() => handleBookLongPress(book)}
      >
        <Image
          source={{ uri: coverUrl }}
          style={styles.gridCover}
          contentFit="cover"
        />
        <View style={styles.gridInfo}>
          <Text style={[styles.gridTitle, { color: colors.black }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[styles.gridAuthor, { color: colors.gray }]} numberOfLines={1}>
            {book.author}
          </Text>
          {book.seriesName && (
            <Text style={[styles.gridMeta, { color: colors.gray }]} numberOfLines={1}>
              {book.seriesName}{book.seriesSequence ? ` #${book.seriesSequence}` : ''}
            </Text>
          )}
          {narrator && (
            <Text style={[styles.gridMeta, { color: colors.gray }]} numberOfLines={1}>
              {narrator}
            </Text>
          )}
          <Text style={[styles.gridMeta, { color: colors.gray }]}>
            {durationText}
          </Text>
        </View>
      </Pressable>
    );
  }, [colors, libraryItemsMap, handleBookPress, handleBookLongPress]);

  // Render grid view (virtualized 2-column FlatList)
  const renderGridView = () => {
    return (
      <FlatList
        key="grid-view"
        data={allBooks}
        renderItem={renderGridItem}
        keyExtractor={listKeyExtractor}
        style={styles.gridScrollView}
        contentContainerStyle={{ paddingBottom: getBottomPadding('grid'), paddingHorizontal: spacing.screenPaddingH, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshing={isCacheLoading || isRefreshing}
        onRefresh={handleRefreshPress}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
      />
    );
  };

  // Navigate to browse
  const handleBrowsePress = useCallback(() => {
    haptics.selection();
    jumpToTabWithLoading('DiscoverTab');
  }, [jumpToTabWithLoading]);

  // Render empty state based on content mode
  const renderEmptyState = () => {
    // For "My Library" mode with no books, use BookshelfView with empty books array
    // This ensures DiscoverMoreCard is positioned exactly the same as when there are books
    if (contentMode === 'library' && discoverRecommendations.length > 0) {
      return (
        <BookshelfView
          books={[]}
          onBookPress={() => {}}
          layoutMode="shelf"
          bottomPadding={getBottomPadding('shelf')}
          recommendations={discoverRecommendations}
          onDiscoverPress={handleDiscoverPress}
          onRecommendationPress={handleRecommendationPress}
        />
      );
    }

    // Fallback text empty state for other modes or when no recommendations
    let title = 'No Books Saved';
    let subtitle = 'Add books to your library to see them here';

    if (contentMode === 'lastPlayed') {
      title = 'No Recently Played';
      subtitle = 'Start listening to see your books here';
    } else if (contentMode === 'finished') {
      title = 'No Finished Books';
      subtitle = 'Complete a book to see it here';
    }

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: colors.black }]}>
          {title}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.gray }]}>
          {subtitle}
        </Text>
        <Pressable
          style={[styles.browseButton, { backgroundColor: colors.black }]}
          onPress={handleBrowsePress}
        >
          <Text style={[styles.browseButtonText, { color: colors.white }]}>Browse Library →</Text>
        </Pressable>
      </View>
    );
  };

  // Render loading skeleton for shelf/stack mode
  const renderLoadingSkeleton = () => {
    // Simple skeleton matching spine dimensions
    const spineWidths = [45, 50, 40, 55, 48, 52, 44, 46];
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingSpines}>
          {spineWidths.map((width, i) => (
            <SkeletonBox
              key={i}
              width={width}
              height={220}
              borderRadius={4}
              style={{ marginRight: 6 }}
            />
          ))}
        </View>
      </View>
    );
  };

  // Group books by series for series-sorted shelf view
  // PERF: Pre-fetch all unique series counts in one pass, then build groups
  const seriesGroups = useMemo(() => {
    if (sortMode !== 'series') return [];

    // 1. Collect unique series names and pre-fetch counts (single cache access)
    const seriesNames = new Set<string>();
    for (const book of allBooks) {
      seriesNames.add(book.seriesName || 'No Series');
    }
    const cacheState = useLibraryCache.getState();
    const seriesTotalMap = new Map<string, number>();
    for (const name of seriesNames) {
      seriesTotalMap.set(name, cacheState.getSeries(name)?.bookCount || 0);
    }

    // 2. Build groups in one pass (allBooks is already sorted by series)
    const groups: { name: string; inLibrary: number; total: number; books: BookSpineVerticalData[] }[] = [];
    let currentGroup: typeof groups[0] | null = null;

    for (const book of allBooks) {
      const seriesName = book.seriesName || 'No Series';
      if (!currentGroup || currentGroup.name !== seriesName) {
        currentGroup = {
          name: seriesName,
          inLibrary: 0,
          total: seriesTotalMap.get(seriesName) || 0,
          books: [],
        };
        groups.push(currentGroup);
      }
      const item = libraryItemsMap.get(book.id);
      if (item) {
        currentGroup.books.push(transformToSpineData(book, item, false));
        currentGroup.inLibrary++;
      }
    }

    return groups;
  }, [allBooks, sortMode, libraryItemsMap]);

  // Render content based on view mode
  const renderContent = () => {
    // Show loading skeleton while data sources are loading
    if (!isDataReady) {
      return renderLoadingSkeleton();
    }

    // Show empty state when no books
    if (allBooks.length === 0) {
      return renderEmptyState();
    }

    // List view uses its own rendering
    if (viewMode === 'list') {
      return renderListView();
    }

    // Grid view uses 2-column cards
    if (viewMode === 'grid') {
      return renderGridView();
    }

    // Series sort in shelf mode: render grouped sections
    if (sortMode === 'series' && viewMode === 'shelf') {
      return (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: getBottomPadding('shelf') }}
          showsVerticalScrollIndicator={false}
        >
          {seriesGroups.map((group) => (
            <View key={group.name}>
              {/* Series header — tappable to navigate to series detail */}
              <TouchableOpacity
                style={styles.seriesSectionHeader}
                onPress={() => {
                  if (group.name !== 'No Series') {
                    navigation.navigate('SeriesDetail', { seriesName: group.name });
                  }
                }}
                activeOpacity={group.name === 'No Series' ? 1 : 0.6}
              >
                <Text style={[styles.seriesSectionName, { color: colors.gray }]} numberOfLines={1}>
                  {group.name.toUpperCase()}
                </Text>
                <Text style={[styles.seriesSectionCount, { color: colors.gray }]}>
                  {group.inLibrary}:{group.total}
                </Text>
              </TouchableOpacity>
              {/* Horizontal shelf for this series */}
              <BookshelfView
                books={group.books}
                onBookPress={(book) => handleBookPress(book)}
                onBookLongPress={(book) => handleBookLongPress(book)}
                layoutMode="shelf"
                heightScale={0.5}
                bottomPadding={0}
              />
            </View>
          ))}
        </ScrollView>
      );
    }

    // Only show last played time when sorted by recent
    const showLastPlayed = sortMode === 'recent';
    const spineData = allBooks.map((book) => {
      const item = libraryItemsMap.get(book.id);
      return item ? transformToSpineData(book, item, showLastPlayed) : null;
    }).filter(Boolean) as BookSpineVerticalData[];

    // Shelf and Stack modes use BookshelfView with different layoutMode
    return (
      <BookshelfView
        books={spineData}
        onBookPress={(book) => handleBookPress(book)}
        onBookLongPress={(book) => handleBookLongPress(book)}
        layoutMode={viewMode}
        bottomPadding={getBottomPadding(viewMode)}
        recommendations={discoverRecommendations}
        onDiscoverPress={handleDiscoverPress}
        onRecommendationPress={handleRecommendationPress}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <TopNav
        variant={isDarkMode ? 'dark' : 'light'}
        showLogo={true}
        onLogoLongPress={handleLogoLongPress}
        style={{ backgroundColor: 'transparent' }}
        pills={[
          {
            key: 'content',
            icon: <DownChevron color={showContentDropdown
              ? (isDarkMode ? staticColors.black : staticColors.white)
              : (isDarkMode ? staticColors.white : staticColors.black)
            } />,
            label: currentContentLabel,
            onPress: handleContentPress,
            active: showContentDropdown,
          },
          {
            key: 'sort',
            icon: <SortArrow color={showSortDropdown
              ? (isDarkMode ? staticColors.black : staticColors.white)
              : (isDarkMode ? staticColors.white : staticColors.black)
            } direction={sortDirection} />,
            label: currentSortLabel,
            onPress: handleSortPress,
            active: showSortDropdown,
          },
        ]}
        circleButtons={[
          {
            key: 'viewMode',
            customRender: true,
            icon: (
              <ViewModePicker
                mode={viewMode}
                onModeChange={handleViewModeChange}
                iconColor={buttonInactiveTextColor}
                activeIconColor={colors.white}
                inactiveIconColor={colors.gray}
                borderColor={colors.grayLine}
                indicatorColor={colors.black}
                capsuleBg={colors.grayLight}
              />
            ),
          },
          {
            key: 'search',
            icon: <TopNavSearchIcon color={colors.black} size={16} />,
            onPress: handleSearchPress,
          },
        ]}
      />

      {/* Discover sticker — right-aligned below nav */}
      {/* Discover button — globe with rotating "DISCOVER" ring */}
      <Pressable
        style={{ alignSelf: 'flex-end', marginRight: 16, marginTop: scale(4), width: scale(72), height: scale(72) }}
        onPress={handleDiscoverPress}
      >
        {/* Static globe */}
        <Image
          source={require('../../../../assets/discover-world.png')}
          style={{ width: scale(72), height: scale(72), position: 'absolute' }}
          contentFit="contain"
        />
        {/* Rotating "DISCOVER" text ring */}
        <ReAnimated.View style={[{ width: scale(72), height: scale(72) }, discoverRingStyle]}>
          <Image
            source={require('../../../../assets/discover-ring.png')}
            style={{ width: scale(72), height: scale(72) }}
            contentFit="contain"
          />
        </ReAnimated.View>
      </Pressable>

      {/* Sort Dropdown Modal */}
      <Modal
        visible={showSortDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={[styles.dropdownMenuWide, { backgroundColor: isDarkMode ? colors.shelfBg : colors.white }]}>
            {SORT_OPTIONS.map((option) => {
              const isActive = sortMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.contentDropdownItem}
                  onPress={() => handleSortSelect(option.key)}
                >
                  <Text
                    style={[
                      styles.contentDropdownText,
                      { color: colors.black },
                      isActive && styles.contentDropdownTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isActive && (
                    <Text style={styles.contentDropdownCheck}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Content Mode Dropdown Modal */}
      <Modal
        visible={showContentDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContentDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowContentDropdown(false)}
        >
          <View style={[styles.dropdownMenuWide, { backgroundColor: isDarkMode ? colors.shelfBg : colors.white }]}>
            {/* Sync at top */}
            {isCollectionLinked && (
              <TouchableOpacity
                style={styles.contentDropdownSync}
                onPress={() => { setShowContentDropdown(false); handleSyncPress(); }}
              >
                <RefreshIcon color={colors.black} />
                <Text style={[styles.contentDropdownSyncText, { color: colors.black }]}>
                  Sync Library
                </Text>
              </TouchableOpacity>
            )}

            {/* Views list */}
            <ScrollView style={styles.dropdownScrollView} showsVerticalScrollIndicator={false}>
              {contentOptions.map((option) => {
                const isActive = contentMode === option.key;
                const count = contentCounts[option.key];
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.contentDropdownItem}
                    onPress={() => handleContentSelect(option.key)}
                  >
                    <View style={styles.contentDropdownLeft}>
                      <Text
                        style={[
                          styles.contentDropdownText,
                          { color: colors.black },
                          isActive && styles.contentDropdownTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {option.label}
                      </Text>
                      {count != null && (
                        <Text style={[styles.contentDropdownCount, { color: colors.gray }]}>
                          {count}
                        </Text>
                      )}
                    </View>
                    {isActive && (
                      <Text style={styles.contentDropdownCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Add Playlist at bottom */}
            <TouchableOpacity
              style={styles.contentDropdownAction}
              onPress={() => {
                setShowContentDropdown(false);
                handleCreateNewPlaylist();
              }}
            >
              <Text style={styles.contentDropdownActionText}>
                + Add Playlist
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Playlist Name Input Modal (Android only - Alert.prompt is iOS-only) */}
      <Modal
        visible={showPlaylistNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlaylistNameModal(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowPlaylistNameModal(false)}
        >
          <Pressable
            style={[styles.playlistNameModalContent, { backgroundColor: isDarkMode ? colors.shelfBg : colors.white }]}
            onPress={() => {/* prevent dismiss when tapping inside */}}
          >
            <Text style={[styles.playlistNameModalTitle, { color: colors.black }]}>New Playlist</Text>
            <Text style={[styles.playlistNameModalSubtitle, { color: colors.black, opacity: 0.6 }]}>Enter a name for the playlist</Text>
            <TextInput
              style={[styles.playlistNameInput, { color: colors.black, borderColor: 'rgba(0,0,0,0.2)' }]}
              value={playlistNameInput}
              onChangeText={setPlaylistNameInput}
              placeholder="Playlist name"
              placeholderTextColor="rgba(0,0,0,0.35)"
              autoFocus
              onSubmitEditing={handlePlaylistNameSubmit}
              returnKeyType="done"
            />
            <View style={styles.playlistNameModalButtons}>
              <TouchableOpacity
                style={styles.playlistNameModalButton}
                onPress={() => setShowPlaylistNameModal(false)}
              >
                <Text style={[styles.playlistNameModalButtonText, { color: colors.black, opacity: 0.5 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.playlistNameModalButton}
                onPress={handlePlaylistNameSubmit}
              >
                <Text style={[styles.playlistNameModalButtonText, { color: '#F3B60C' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  discoverSticker: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: scale(4),
  },
  discoverStickerImage: {
    width: scale(220),
    height: scale(220),
  },
  discoverStickerImage: {
    width: scale(36),
    height: scale(36),
  },

  // Series section header (for series-sorted shelf view)
  seriesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  seriesSectionName: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 8,
  },
  seriesSectionCount: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    letterSpacing: 0.5,
  },


  // Dropdown Modal
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: 200,
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Wider dropdown for content mode (includes playlist names)
  dropdownMenuWide: {
    width: 260,
    maxHeight: 420,
    borderRadius: 12,
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScrollView: {
    maxHeight: 340,
  },
  dropdownTitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  // Taller dropdown items for better touch targets (Apple HIG minimum 44pt)
  dropdownItemTall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  dropdownItemSelected: {
    // Selected state styling
  },
  dropdownItemText: {
    fontFamily: fonts.playfair.regular,
    fontSize: 16,
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
  },
  dropdownCheck: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Content dropdown — no dividers, generous touch targets
  contentDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  } as ViewStyle,
  contentDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  } as ViewStyle,
  contentDropdownText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  } as TextStyle,
  contentDropdownTextActive: {
    fontFamily: fonts.jetbrainsMono.bold,
  } as TextStyle,
  contentDropdownCount: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 12,
    opacity: 0.35,
  } as TextStyle,
  contentDropdownCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F3B60C',
  } as TextStyle,
  contentDropdownSync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  } as ViewStyle,
  contentDropdownSyncText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.5,
  } as TextStyle,
  contentDropdownAction: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  } as ViewStyle,
  contentDropdownActionText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.35)',
  } as TextStyle,

  // Content
  content: {
    flex: 1,
  },

  // Loading skeleton
  loadingContainer: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: spacing.screenPaddingH,
  },
  loadingSpines: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  // List View Styles
  listScrollView: {
    flex: 1,
    paddingHorizontal: spacing.screenPaddingH,
  },
  verticalList: {
    flex: 1,
  },
  verticalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: staticColors.grayLine,
  },
  verticalCover: {
    width: scale(40),
    height: scale(40),
    borderRadius: 4,
  },
  verticalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  verticalTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(16),
    color: staticColors.black,
  },
  verticalSeries: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.gray,
    marginTop: 2,
  },
  verticalDuration: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: staticColors.gray,
  },

  // Grid View Styles
  gridScrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: spacing.screenPaddingH,
    paddingTop: 8,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gridCard: {
    width: '48%',
  },
  gridCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: staticColors.grayLine,
  },
  gridInfo: {
    marginTop: 10,
  },
  gridTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
    color: staticColors.black,
    lineHeight: scale(18),
  },
  gridAuthor: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: staticColors.gray,
    marginTop: 4,
  },
  gridMeta: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.gray,
    marginTop: 2,
  },

  // Empty State - Text version
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(24),
    color: staticColors.black,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: staticColors.gray,
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: staticColors.black,
    borderRadius: 4,
  },
  browseButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: staticColors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Playlist Name Modal (Android)
  playlistNameModalContent: {
    width: '80%',
    borderRadius: 14,
    padding: 24,
    alignSelf: 'center',
  } as ViewStyle,
  playlistNameModalTitle: {
    fontFamily: fonts.playfair.bold,
    fontSize: 18,
    marginBottom: 4,
  } as TextStyle,
  playlistNameModalSubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 13,
    marginBottom: 16,
  } as TextStyle,
  playlistNameInput: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: scale(44),
    marginBottom: 20,
  } as TextStyle,
  playlistNameModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  } as ViewStyle,
  playlistNameModalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: scale(44),
    justifyContent: 'center',
  } as ViewStyle,
  playlistNameModalButtonText: {
    fontFamily: fonts.jetbrainsMono.bold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as TextStyle,
});

export default LibraryScreen;
