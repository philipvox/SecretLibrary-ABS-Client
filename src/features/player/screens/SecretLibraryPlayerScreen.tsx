/**
 * src/features/player/screens/SecretLibraryPlayerScreen.tsx
 *
 * Secret Library Player - Clean editorial design
 * Features large title, square cover with chapter number,
 * simple progress bar, and minimal controls.
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  StatusBar,
  Animated,
  BackHandler,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import RAnimated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { CoverStars } from '@/shared/components/CoverStars';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PlayIcon, PauseIcon } from '../components/PlayerIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import Slider from '@react-native-community/slider';

import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { TopNav, TopNavCloseIcon } from '@/shared/components';
import {
  playerTransitionProgress,
  SPRING_CONFIG,
  SNAP_THRESHOLD,
  VELOCITY_THRESHOLD,
} from '../stores/playerTransition';
import {
  usePlayerStore,
  useSeekingStore,
  useCurrentChapterIndex,
  useSleepTimerStore,
  useBookmarksStore,
  useBookmarks,
  usePlaybackRate,
  usePlayerSettingsStore,
} from '../stores';
import type { Bookmark } from '../stores/bookmarksStore';
import { audioService } from '../services/audioService';
import { useCoverUrl } from '@/core/cache';
import { useDownloadStatus, useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useNormalizedChapters } from '@/shared/hooks';
import { haptics } from '@/core/native/haptics';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import {
  secretLibraryColors as staticColors,
  secretLibraryFonts as fonts,
} from '@/shared/theme/secretLibrary';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useSpineCacheStore, getTypographyForGenres, getSeriesStyle } from '@/shared/spine';

// Sheets/Panels
import { SpeedSheet } from '../sheets/SpeedSheet';
import { SleepTimerSheet } from '../sheets/SleepTimerSheet';
import { ChaptersSheet } from '../sheets/ChaptersSheet';
import { BookmarksSheet } from '../sheets/BookmarksSheet';
import { QueuePanel } from '@/features/queue/components/QueuePanel';

// Sheet types
type ActiveSheet = 'speed' | 'sleep' | 'queue' | 'chapters' | 'bookmarks' | null;

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_CONTENT_WIDTH = 500; // Max width on iPad to prevent overly stretched layouts

// =============================================================================
// ICONS
// =============================================================================

interface IconProps {
  color?: string;
  size?: number;
}

const ClockIcon = ({ color = staticColors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Svg>
);

const ListIcon = ({ color = staticColors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);

const DownloadIcon = ({ color = staticColors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M7 10l5 5 5-5" />
    <Path d="M12 15V3" />
  </Svg>
);

const CloudStreamIcon = ({ color = '#FFFFFF', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </Svg>
);

const CheckCircleIcon = ({ color = '#F3B60C', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Path d="M22 4L12 14.01l-3-3" />
  </Svg>
);

const BookmarkIcon = ({ color = staticColors.black, size = 13 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

const PrevIcon = ({ color = staticColors.black, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
  </Svg>
);

const NextIcon = ({ color = staticColors.black, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
  </Svg>
);

// Rewind icon (<<)
const RewindIcon = ({ color = staticColors.black, size = 20 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M11 18V6l-7 6 7 6zm7 0V6l-7 6 7 6z" />
  </Svg>
);

// Fast Forward icon (>>)
const FastForwardIcon = ({ color = staticColors.black, size = 20 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M13 6v12l7-6-7-6zm-7 0v12l7-6-7-6z" />
  </Svg>
);

// Skip to next icon (chevron up with line)
const SkipNextIcon = ({ color = staticColors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M6 17l6-5-6-5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18 7v10" strokeLinecap="round" />
  </Svg>
);

// Skip to prev icon (chevron down with line)
const SkipPrevIcon = ({ color = staticColors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M18 7l-6 5 6 5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M6 17V7" strokeLinecap="round" />
  </Svg>
);

// Chevron down icon (for other uses)
const ChevronDownIcon = ({ color = staticColors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `-${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDeltaTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '+0s';
  const sign = seconds >= 0 ? '+' : '-';
  const absSeconds = Math.abs(Math.round(seconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  if (mins > 0) {
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${sign}${secs}s`;
}

function getDeltaFontSize(seconds: number): number {
  if (!Number.isFinite(seconds)) return scale(80);
  const absSeconds = Math.abs(Math.round(seconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;

  // Calculate character count (sign + digits + separators)
  let charCount: number;
  if (mins > 0) {
    // Format: +M:SS or +MM:SS or +MMM:SS
    charCount = 1 + String(mins).length + 1 + 2; // sign + mins + colon + secs
  } else {
    // Format: +Ns or +NNs
    charCount = 1 + String(secs).length + 1; // sign + secs + 's'
  }

  // Scale font size inversely with character count
  // 3-4 chars (e.g., +5s, -15s) = 80pt
  // 5-6 chars (e.g., +1:30, -15:00) = 64pt
  // 7+ chars (e.g., +222:40) = 48pt
  if (charCount <= 4) return scale(80);
  if (charCount <= 6) return scale(64);
  return scale(48);
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SecretLibraryPlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Responsive layout for iPad
  const responsive = useResponsive();
  const { width: screenWidth, height: screenHeight, isTablet } = responsive;

  // Content width constraint for iPad (center content)
  const contentStyle = useMemo(() => {
    if (isTablet && screenWidth > MAX_CONTENT_WIDTH) {
      const padding = (screenWidth - MAX_CONTENT_WIDTH) / 2;
      return { paddingHorizontal: padding };
    }
    return { paddingHorizontal: scale(20) };
  }, [isTablet, screenWidth]);

  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  // Sheet state - no sheet open by default
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;  // Start hidden
  const sheetTranslateY = useRef(new Animated.Value(screenHeight)).current;  // Start at closed position

  // Progress mode: 'book' shows full book progress, 'chapter' shows current chapter progress
  const [progressMode, setProgressMode] = useState<'book' | 'chapter'>('chapter');

  // Slider scrubbing state
  const [sliderValue, setSliderValue] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Time delta popup state
  const [timeDelta, setTimeDelta] = useState(0);
  const [showDelta, setShowDelta] = useState(false);
  const deltaOpacity = useRef(new Animated.Value(0)).current;
  const deltaFontSize = useRef(new Animated.Value(scale(80))).current;
  const deltaStartPosition = useRef(0);
  const deltaHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bookmark edit/add state
  const [bookmarkModalMode, setBookmarkModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editTime, setEditTime] = useState(0);

  // Store state
  const {
    currentBook,
    isPlayerVisible,
    isPlaying,
    isLoading,
    isBuffering,
    duration,
    chapters,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlayerVisible: s.isPlayerVisible,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      duration: s.duration,
      chapters: s.chapters,
    }))
  );

  // Skip intervals from settings store
  const skipForwardInterval = usePlayerSettingsStore((s) => s.skipForwardInterval);
  const skipBackInterval = usePlayerSettingsStore((s) => s.skipBackInterval);

  // Playback rate from speed store
  const playbackRate = usePlaybackRate();

  // Sleep timer subscription - real-time countdown (1 sec updates)
  const sleepTimer = useSleepTimerStore((s) => s.sleepTimer);

  // Position - read isSeeking/seekPosition from seekingStore (single source of truth)
  // playerStore.isSeeking is a dead leftover from Phase 7 refactor and is always false
  const storePosition = usePlayerStore((s) => s.position);
  const seekingIsSeeking = useSeekingStore((s) => s.isSeeking);
  const seekingPosition = useSeekingStore((s) => s.seekPosition);
  const position = Math.floor(seekingIsSeeking ? seekingPosition : storePosition);

  // Bookmarks
  const bookmarks = useBookmarks();
  const { removeBookmark, updateBookmark } = useBookmarksStore(
    useShallow((s) => ({
      removeBookmark: s.removeBookmark,
      updateBookmark: s.updateBookmark,
    }))
  );

  // Actions
  const {
    closePlayer,
    play,
    pause,
    seekTo,
    nextChapter,
    prevChapter,
    addBookmark,
    skipForward,
    skipBackward,
  } = usePlayerStore(
    useShallow((s) => ({
      closePlayer: s.closePlayer,
      play: s.play,
      pause: s.pause,
      seekTo: s.seekTo,
      nextChapter: s.nextChapter,
      prevChapter: s.prevChapter,
      addBookmark: s.addBookmark,
      skipForward: s.skipForward,
      skipBackward: s.skipBackward,
    }))
  );

  const chapterIndex = useCurrentChapterIndex();
  const coverUrl = useCoverUrl(currentBook?.id || '', { width: 1024 });
  const { isDownloaded, isDownloading, isPaused, isPending, progress: downloadProgress } = useDownloadStatus(currentBook?.id || '');
  const { queueDownload } = useDownloads();

  // Book metadata
  const metadata = currentBook?.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const authorId = metadata?.authors?.[0]?.id || null;
  const publishedYear = metadata?.publishedYear || '';

  // Parse series name - handle multiple formats
  const seriesName = useMemo(() => {
    // Try series array first (expanded API data)
    if (metadata?.series?.length > 0) {
      const seriesEntry = metadata.series[0];
      const name = seriesEntry.name || seriesEntry;
      if (name && typeof name === 'string') {
        return name;
      }
    }
    // Try seriesName string
    const rawSeriesName = metadata?.seriesName || '';
    if (rawSeriesName) {
      // Strip sequence number if present (e.g., "Series Name #1" -> "Series Name")
      return rawSeriesName.replace(/\s*#[\d.]+$/, '').trim();
    }
    return null;
  }, [metadata?.series, metadata?.seriesName]);

  // Parse narrator name - handle multiple formats
  const narratorName = useMemo(() => {
    // Try narrators array first (strings)
    if (metadata?.narrators?.length > 0) {
      const narrator = metadata.narrators[0];
      if (typeof narrator === 'string') return narrator;
      return narrator?.name || null;
    }
    // Try narratorName string
    if (metadata?.narratorName) {
      return metadata.narratorName;
    }
    // Try narrator (singular)
    if (metadata?.narrator) {
      return metadata.narrator;
    }
    return null;
  }, [metadata?.narrators, metadata?.narratorName, metadata?.narrator]);

  // Get normalized chapter names
  const normalizedChapters = useNormalizedChapters(chapters, { bookTitle: title });
  const currentChapter = normalizedChapters[chapterIndex];
  const chapterTitle = currentChapter?.displayTitle || `Chapter ${chapterIndex + 1}`;

  // Chapter progress (guard against undefined start/end)
  const chapter = chapters[chapterIndex];
  const chapterStart = chapter?.start ?? 0;
  const chapterEnd = chapter?.end ?? 0;
  const rawChapterPosition = chapter ? Math.max(0, position - chapterStart) : 0;
  const rawChapterDuration = chapterEnd > chapterStart ? chapterEnd - chapterStart : 0;
  // Fallback: when no real chapter data (0 chapters or single chapterless book),
  // use book-level values so the time display isn't stuck at 00:00:00
  const hasChapterData = rawChapterDuration > 0;
  const chapterPosition = hasChapterData ? rawChapterPosition : position;
  const chapterDuration = hasChapterData ? rawChapterDuration : duration;
  const chapterProgress = chapterDuration > 0 ? chapterPosition / chapterDuration : 0;

  // Book progress
  const bookProgress = duration > 0 ? position / duration : 0;
  const timeRemaining = (duration > 0 && Number.isFinite(position)) ? duration - position : 0;

  // Get cached spine data for typography (same as BookDetailScreen)
  const cachedSpineData = useSpineCacheStore((s) => currentBook?.id ? s.cache.get(currentBook.id) : undefined);

  // Get spine typography - USE CACHED TYPOGRAPHY for consistency
  // This ensures player shows the EXACT same font as the book spine on home screen
  const spineTypography = useMemo(() => {
    if (!currentBook?.id) return null;

    // FIRST: Use pre-computed typography from spine cache (computed at app startup)
    // This is the SAME typography used by BookSpineVertical.tsx
    if (cachedSpineData?.typography) {
      return cachedSpineData.typography;
    }

    // FALLBACK: Recalculate if not in cache (e.g., book just added to library)
    const cachedSeriesName = cachedSpineData?.seriesName;
    const genres = cachedSpineData?.genres || metadata?.genres || [];

    // Check if in a series AND has cached series name
    if (cachedSeriesName) {
      const seriesStyle = getSeriesStyle(cachedSeriesName);
      if (seriesStyle?.typography) {
        return seriesStyle.typography;
      }
    }

    // Genre-based typography (fallback path)
    return getTypographyForGenres(genres, currentBook.id);
  }, [cachedSpineData?.typography, cachedSpineData?.seriesName, cachedSpineData?.genres, metadata?.genres, currentBook?.id]);

  // Extract font properties with fallbacks
  // ALWAYS use Georgia for player title - matches book detail page
  // Spine typography is only for book spines on home screen
  const titleFontFamily = Platform.select({ ios: 'Georgia', android: 'serif' });
  const titleFontWeight = '400';

  // Display title as-is (no uppercase transform - that's for spines only)
  const displayTitle = title;

  // Reanimated: outer container slides based on shared transition progress
  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(
        playerTransitionProgress.value,
        [0, 1],
        [screenHeight, 0],
      ),
    }],
  }));

  // Gradient background fades in early — feathered edge from transparent top to solid bottom
  const bgAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      playerTransitionProgress.value,
      [0.05, 0.35],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Solid background fills in fully at the end of the transition
  const bgSolidAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      playerTransitionProgress.value,
      [0.5, 0.8],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Cover: grows from mini player cover position/size to full player cover
  //
  // Geometry:
  //   At progress=0, the container is at translateY=screenHeight (off-screen below).
  //   The cover sits near the TOP of the player container (~insets.top + topNav).
  //   The mini player cover sits near the BOTTOM of the screen.
  //   We offset the cover within the container so its screen position matches
  //   the mini player cover, then animate that offset to 0 as progress → 1.
  //
  const miniCoverSize = scale(40);       // mini player cover dimensions
  const miniPlayerPadH = scale(20);      // mini player paddingHorizontal
  const fullContentPad = isTablet && screenWidth > MAX_CONTENT_WIDTH
    ? (screenWidth - MAX_CONTENT_WIDTH) / 2
    : scale(20);
  const fullCoverWidth = screenWidth - 2 * fullContentPad;
  const scaleRatio = miniCoverSize / fullCoverWidth;
  const bottomPad = insets.bottom > 0 ? insets.bottom : scale(12);

  // Distance from container top to cover center Y (safe area + topNav + margin + half cover)
  const coverTopInPlayer = insets.top + scale(79);
  const coverCenterYInPlayer = coverTopInPlayer + fullCoverWidth / 2;

  // Mini player cover center in screen coordinates
  const miniCoverCenterX = miniPlayerPadH + miniCoverSize / 2;
  const miniCoverCenterY = screenHeight - bottomPad - miniCoverSize / 2;

  // Full player cover center in screen coordinates (at progress=0, container at screenHeight)
  const fullCoverCenterX = screenWidth / 2;
  const fullCoverCenterYAtP0 = screenHeight + coverCenterYInPlayer;

  // Offsets needed at progress=0 to align cover with mini player
  const targetTX = miniCoverCenterX - fullCoverCenterX;
  const targetTY = miniCoverCenterY - fullCoverCenterYAtP0;

  const coverAnimStyle = useAnimatedStyle(() => {
    const p = playerTransitionProgress.value;
    const coverScale = interpolate(p, [0, 0.7], [scaleRatio, 1], Extrapolation.CLAMP);

    // Position: slide from mini player cover position to natural position
    const offsetX = interpolate(p, [0, 0.7], [targetTX, 0], Extrapolation.CLAMP);
    const offsetY = interpolate(p, [0, 0.7], [targetTY, 0], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: offsetX },
        { translateY: offsetY },
        { scale: coverScale },
      ],
    };
  });

  // Controls (byline, progress bar, buttons) fade in late
  const controlsAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      playerTransitionProgress.value,
      [0.65, 0.9],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // TopNav fade in
  const topNavAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      playerTransitionProgress.value,
      [0.7, 0.95],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Swipe-down gesture on full player to dismiss
  const dismissGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (event.translationY > 0) {
        // Convert downward drag to 1→0 progress
        const progress = 1 - Math.min(event.translationY / screenHeight, 1);
        playerTransitionProgress.value = progress;
      }
    })
    .onEnd((event) => {
      'worklet';
      const progress = playerTransitionProgress.value;
      const velocity = event.velocityY; // positive = downward

      // Quick swipe down or past threshold = dismiss
      const shouldDismiss = velocity > VELOCITY_THRESHOLD || (velocity > -VELOCITY_THRESHOLD && progress < (1 - SNAP_THRESHOLD));

      if (shouldDismiss) {
        playerTransitionProgress.value = withSpring(0, SPRING_CONFIG);
        runOnJS(closePlayer)();
      } else {
        playerTransitionProgress.value = withSpring(1, SPRING_CONFIG);
      }
    });

  // Back handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isPlayerVisible) {
        closePlayer();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [isPlayerVisible, closePlayer]);

  // Fix 6: Cleanup delta timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (deltaHideTimer.current) {
        clearTimeout(deltaHideTimer.current);
        deltaHideTimer.current = null;
      }
    };
  }, []);

  // Update slider value when position changes (but not while scrubbing)
  useEffect(() => {
    if (!isScrubbing) {
      const currentProgress = progressMode === 'book' ? bookProgress : chapterProgress;
      setSliderValue(currentProgress);
    }
  }, [bookProgress, chapterProgress, progressMode, isScrubbing]);

  // Reset sheet state when book changes to prevent stale UI
  const bookId = currentBook?.id;
  useEffect(() => {
    // Close any open sheets when switching books
    if (activeSheet) {
      setActiveSheet(null);
      setSheetVisible(false);
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(screenHeight);
    }
    // Also reset bookmark edit state
    setBookmarkModalMode(null);
    setEditingBookmark(null);
  }, [bookId, screenHeight]); // Only depend on bookId to avoid closing on other state changes

  // Delta popup helpers
  const animateDeltaFontSize = useCallback((delta: number) => {
    const targetSize = getDeltaFontSize(delta);
    Animated.spring(deltaFontSize, {
      toValue: targetSize,
      useNativeDriver: false, // fontSize can't use native driver
      tension: 100,
      friction: 10,
    }).start();
  }, [deltaFontSize]);

  const showDeltaPopup = useCallback((delta: number, autoHide = true) => {
    // Clear any existing hide timer
    if (deltaHideTimer.current) {
      clearTimeout(deltaHideTimer.current);
      deltaHideTimer.current = null;
    }

    // Accumulate delta when popup is already showing (rapid taps)
    setTimeDelta(prev => {
      const newDelta = (showDelta && autoHide) ? prev + delta : delta;
      animateDeltaFontSize(newDelta);
      return newDelta;
    });
    setShowDelta(true);

    // Fade in
    Animated.timing(deltaOpacity, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();

    // Auto-hide after delay
    if (autoHide) {
      deltaHideTimer.current = setTimeout(() => {
        hideDeltaPopup();
      }, 1200);
    }
  }, [deltaOpacity, animateDeltaFontSize, showDelta]);

  const hideDeltaPopup = useCallback(() => {
    Animated.timing(deltaOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowDelta(false);
      setTimeDelta(0);
      // Reset font size for next show
      deltaFontSize.setValue(scale(80));
    });
  }, [deltaOpacity, deltaFontSize]);

  // Slider handlers
  const handleSliderStart = useCallback(() => {
    setIsScrubbing(true);
    // Fix 2: Sync scrubbing state to audioService to prevent track switch spam
    audioService.setScrubbing(true);
    // Store starting position for delta calculation
    deltaStartPosition.current = position;
    // Show delta immediately (will update as user scrubs)
    showDeltaPopup(0, false);
  }, [position, showDeltaPopup]);

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
    // Calculate current position based on slider value
    let currentPos: number;
    const safeDuration = duration > 0 ? duration : 0;
    if (progressMode === 'book') {
      currentPos = value * safeDuration;
    } else {
      const chapterStart = chapters[chapterIndex]?.start || 0;
      const chapterEnd = chapters[chapterIndex]?.end || safeDuration;
      const chapterLen = chapterEnd - chapterStart;
      currentPos = chapterStart + value * chapterLen;
    }
    // Update delta and animate font size
    const delta = Number.isFinite(currentPos) ? currentPos - deltaStartPosition.current : 0;
    setTimeDelta(delta);
    animateDeltaFontSize(delta);
  }, [progressMode, duration, chapters, chapterIndex, animateDeltaFontSize]);

  const handleSliderComplete = useCallback(async (value: number) => {
    haptics.selection();

    let newPosition: number;
    if (progressMode === 'book') {
      // Fix 9: Round to 0.1s to avoid floating point precision issues
      newPosition = Math.round(value * duration * 10) / 10;
    } else {
      // Chapter mode - calculate position within the chapter
      const chapterStart = chapters[chapterIndex]?.start || 0;
      const chapterEnd = chapters[chapterIndex]?.end || duration;
      const chapterLen = chapterEnd - chapterStart;
      newPosition = Math.round((chapterStart + value * chapterLen) * 10) / 10;
    }

    // IMPORTANT: Seek FIRST and AWAIT it, then clear scrubbing state.
    // If we clear scrubbing before seek completes, the 100ms polling picks up
    // the old native position and snaps the UI back before the seek takes effect.
    await seekTo(newPosition);
    setIsScrubbing(false);
    audioService.setScrubbing(false);

    // Hide delta after a short delay
    if (deltaHideTimer.current) {
      clearTimeout(deltaHideTimer.current);
    }
    deltaHideTimer.current = setTimeout(() => {
      hideDeltaPopup();
    }, 800);
  }, [progressMode, duration, chapters, chapterIndex, seekTo, hideDeltaPopup]);

  // Navigate to Secret Library home (logo press)
  const handleLogoPress = useCallback(() => {
    haptics.selection();
    closePlayer();
    setTimeout(() => {
      navigation.navigate('Main', { screen: 'HomeTab' });
    }, 300);
  }, [closePlayer, navigation]);

  // Navigate to author detail
  const handleAuthorPress = useCallback(() => {
    if (authorId) {
      haptics.selection();
      closePlayer();
      setTimeout(() => {
        navigation.navigate('AuthorDetail', { authorId, authorName: author });
      }, 300);
    }
  }, [authorId, author, closePlayer, navigation]);

  // Navigate to narrator detail
  const handleNarratorPress = useCallback(() => {
    if (narratorName) {
      haptics.selection();
      closePlayer();
      setTimeout(() => {
        navigation.navigate('NarratorDetail', { narratorName });
      }, 300);
    }
  }, [narratorName, closePlayer, navigation]);

  // Navigate to book detail
  const handleTitlePress = useCallback(() => {
    if (currentBook?.id) {
      haptics.selection();
      closePlayer();
      setTimeout(() => {
        navigation.navigate('BookDetail', { id: currentBook.id });
      }, 300);
    }
  }, [currentBook?.id, closePlayer, navigation]);

  // Navigate to series detail
  const handleSeriesPress = useCallback(() => {
    if (seriesName) {
      haptics.selection();
      closePlayer();
      setTimeout(() => {
        navigation.navigate('SeriesDetail', { seriesName });
      }, 300);
    }
  }, [seriesName, closePlayer, navigation]);

  // Handlers
  const handlePlayPause = useCallback(() => {
    haptics.buttonPress();
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const handlePrev = useCallback(() => {
    haptics.selection();
    prevChapter();
  }, [prevChapter]);

  const handleNext = useCallback(() => {
    haptics.selection();
    nextChapter();
  }, [nextChapter]);

  const handleBookmark = useCallback(() => {
    haptics.success();
    // Add bookmark at current position
    addBookmark({
      title: `Bookmark at ${formatTime(position)}`,
      note: null,
      time: position,
      chapterTitle,
    });
  }, [addBookmark, position, chapterTitle]);

  const handleClose = useCallback(() => {
    haptics.selection();
    // Animate transition progress to 0, then set store state
    playerTransitionProgress.value = withTiming(0, { duration: 250 });
    // Small delay to let animation start before store update
    setTimeout(() => closePlayer(), 260);
  }, [closePlayer]);

  // Download handler - supports pause/resume
  const handleDownload = useCallback(async () => {
    if (!currentBook) return;

    // If downloading, pause it
    if (isDownloading && !isPaused) {
      haptics.toggle();
      await downloadManager.pauseDownload(currentBook.id);
      return;
    }

    // If paused, resume it
    if (isPaused) {
      haptics.toggle();
      await downloadManager.resumeDownload(currentBook.id);
      return;
    }

    // If pending (queued), cancel it
    if (isPending) {
      haptics.warning();
      await downloadManager.cancelDownload(currentBook.id);
      return;
    }

    // If not downloaded, queue it
    if (!isDownloaded) {
      haptics.success();
      queueDownload(currentBook);
    }
  }, [currentBook, isDownloaded, isDownloading, isPaused, isPending, queueDownload]);

  // Progress bar seek handler
  const handleSeek = useCallback((progress: number) => {
    if (duration > 0) {
      const newPosition = progress * duration;
      seekTo(newPosition);
    }
  }, [duration, seekTo]);

  // Skip controls
  const handleSkipBack = useCallback(() => {
    haptics.selection();
    skipBackward(skipBackInterval);
    showDeltaPopup(-skipBackInterval);
  }, [skipBackward, skipBackInterval, showDeltaPopup]);

  const handleSkipForward = useCallback(() => {
    haptics.selection();
    skipForward(skipForwardInterval);
    showDeltaPopup(skipForwardInterval);
  }, [skipForward, skipForwardInterval, showDeltaPopup]);

  // Double-tap on cover: left half = rewind, right half = fast-forward
  const lastCoverTap = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const coverRef = useRef<View>(null);
  const coverTapCircleLeft = useRef(new Animated.Value(0)).current;
  const coverTapCircleRight = useRef(new Animated.Value(0)).current;
  const coverTapScaleLeft = useRef(new Animated.Value(0)).current;
  const coverTapScaleRight = useRef(new Animated.Value(0)).current;
  const coverTapOffsetLeft = useRef(new Animated.Value(0)).current;
  const coverTapOffsetRight = useRef(new Animated.Value(0)).current;

  const flashCircle = useCallback((side: 'left' | 'right', tapY: number, coverHeight: number) => {
    const opacityAnim = side === 'left' ? coverTapCircleLeft : coverTapCircleRight;
    const scaleAnim = side === 'left' ? coverTapScaleLeft : coverTapScaleRight;
    const offsetAnim = side === 'left' ? coverTapOffsetLeft : coverTapOffsetRight;

    // Center the oval on the tap Y position
    // The oval is height=100% of cover, so offset = tapY - coverHeight/2
    offsetAnim.setValue(tapY - coverHeight / 2);

    // Reset to start state: visible and small
    opacityAnim.setValue(1);
    scaleAnim.setValue(0.3);

    // Ripple out: scale up while fading
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [coverTapCircleLeft, coverTapCircleRight, coverTapScaleLeft, coverTapScaleRight, coverTapOffsetLeft, coverTapOffsetRight]);

  const handleCoverPress = useCallback((evt: any) => {
    const now = Date.now();
    const tapX = evt.nativeEvent.locationX;
    const tapY = evt.nativeEvent.locationY;
    const prev = lastCoverTap.current;

    if (now - prev.time < 300) {
      // Double-tap detected — measure which half
      coverRef.current?.measure((_x, _y, width, height) => {
        if (tapX < width / 2) {
          flashCircle('left', tapY, height);
          handleSkipBack();
        } else {
          flashCircle('right', tapY, height);
          handleSkipForward();
        }
      });
      lastCoverTap.current = { time: 0, x: 0 }; // Reset to avoid triple-tap
    } else {
      lastCoverTap.current = { time: now, x: tapX };
    }
  }, [handleSkipBack, handleSkipForward, flashCircle]);

  // Sheet handlers - overlay fades in, panel slides up
  const openSheet = useCallback((sheet: ActiveSheet) => {
    haptics.selection();
    setActiveSheet(sheet);
    setSheetVisible(true);
    // Animate overlay fade in and sheet slide up together
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
    ]).start();
  }, [overlayOpacity, sheetTranslateY]);

  const closeSheet = useCallback(() => {
    // Animate overlay fade out and sheet slide down together
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveSheet(null);
      setSheetVisible(false);
    });
  }, [overlayOpacity, sheetTranslateY, screenHeight]);

  // Chapter selection handler
  const handleChapterSelect = useCallback((start: number) => {
    seekTo(start);
    closeSheet();
  }, [seekTo, closeSheet]);

  // Bookmark handlers for sheet
  const handleEditBookmark = useCallback((bookmark: Bookmark) => {
    setBookmarkModalMode('edit');
    setEditingBookmark(bookmark);
    setEditNote(bookmark.note || '');
    setEditTime(bookmark.time);
    closeSheet(); // Close the bookmarks sheet when editing
  }, [closeSheet]);

  const handleAddBookmarkWithDetails = useCallback(() => {
    setBookmarkModalMode('add');
    setEditingBookmark(null);
    setEditNote('');
    setEditTime(position); // Current playback position
    closeSheet(); // Close the bookmarks sheet
  }, [closeSheet, position]);

  const handleSaveBookmark = useCallback(() => {
    if (bookmarkModalMode === 'edit' && editingBookmark) {
      // Update existing bookmark
      updateBookmark(editingBookmark.id, { note: editNote.trim() || null });
      haptics.success();
    } else if (bookmarkModalMode === 'add') {
      // Create new bookmark
      addBookmark({
        title: `Bookmark at ${formatTime(editTime)}`,
        note: editNote.trim() || null,
        time: editTime,
        chapterTitle: chapterTitle || null,
      });
    }
    setBookmarkModalMode(null);
    setEditingBookmark(null);
    setEditNote('');
    setEditTime(0);
  }, [bookmarkModalMode, editingBookmark, editNote, editTime, updateBookmark, addBookmark, chapterTitle]);

  const handleCancelBookmarkModal = useCallback(() => {
    setBookmarkModalMode(null);
    setEditingBookmark(null);
    setEditNote('');
    setEditTime(0);
  }, []);

  const handleDeleteBookmark = useCallback((bookmark: Bookmark) => {
    removeBookmark(bookmark.id);
  }, [removeBookmark]);

  const handleDeleteEditingBookmark = useCallback(() => {
    if (editingBookmark) {
      removeBookmark(editingBookmark.id);
    }
    setBookmarkModalMode(null);
    setEditingBookmark(null);
    setEditNote('');
    setEditTime(0);
  }, [editingBookmark, removeBookmark]);

  // Time adjustment for add bookmark modal
  const adjustTime = useCallback((delta: number) => {
    setEditTime((prev) => Math.max(0, Math.min(duration, prev + delta)));
    haptics.selection();
  }, [duration]);

  // Only bail out if no book loaded — the player renders off-screen (translateY = screenHeight)
  // when transition progress = 0, so no visual difference but hooks stay alive
  if (!currentBook) {
    return Platform.OS === 'android' ? <View /> : null;
  }

  return (
    <GestureDetector gesture={dismissGesture}>
      <RAnimated.View
        style={[
          styles.container,
          containerAnimStyle,
        ]}
      >
        {/* Background: gradient feather (transparent top → solid bottom), then full solid */}
        <RAnimated.View style={[StyleSheet.absoluteFill, bgAnimStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', colors.white]}
            locations={[0, 0.45]}
            style={StyleSheet.absoluteFill}
          />
        </RAnimated.View>
        {/* Solid background layer that fills in fully at the end of the transition */}
        <RAnimated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }, bgSolidAnimStyle]}
          pointerEvents="none"
        />

        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.creamGray} />

        {/* Safe Area Top */}
        <View style={{ height: insets.top }} />

        {/* Header - fades in during transition */}
        <RAnimated.View style={topNavAnimStyle}>
          <TopNav
        variant={isDarkMode ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        logoAccessory={
          isDownloaded
            ? <CheckCircleIcon color="#F3B60C" size={16} />
            : <CloudStreamIcon color={colors.gray} size={16} />
        }
        style={{ backgroundColor: 'transparent', marginBottom: scale(8) }}
        includeSafeArea={false}
        pills={[
          {
            key: 'queue',
            label: 'Queue',
            icon: <ListIcon color={activeSheet === 'queue' ? colors.white : colors.black} size={16} />,
            active: activeSheet === 'queue',
            onPress: () => openSheet('queue'),
          },
          {
            key: 'bookmark',
            label: 'Bookmark',
            icon: <BookmarkIcon color={bookmarks.length > 0 ? colors.orange : (activeSheet === 'bookmarks' ? colors.white : colors.black)} size={16} />,
            active: activeSheet === 'bookmarks',
            onPress: handleBookmark,
            onLongPress: () => openSheet('bookmarks'),
          },
        ]}
          circleButtons={[
            {
              key: 'close',
              icon: <TopNavCloseIcon color={colors.black} size={16} />,
              onPress: handleClose,
            },
          ]}
        />
        </RAnimated.View>

        <View style={[styles.screen, contentStyle]}>
          {/* Main Content - New Layout */}
          <View style={styles.mainContent}>
            {/* 1. Cover Image - Full width, larger — scales up during transition */}
            <RAnimated.View style={coverAnimStyle}>
              {/* Double-tap left half = rewind, right half = fast-forward */}
              {/* Dims to 60% opacity when scrubbing time is displayed over it */}
              <Pressable
                ref={coverRef}
                style={styles.coverWrapper}
                onPress={handleCoverPress}
              >
            <View style={[styles.coverContainer, showDelta && { opacity: 0.6 }]}>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.cover}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Text style={styles.coverPlaceholderText}>
                    {title.substring(0, 3).toUpperCase()}
                  </Text>
                </View>
              )}
              {bookId && <CoverStars bookId={bookId} starSize={scale(48)} />}
            </View>

            {/* Time Delta Popup - overlays cover */}
            {showDelta && (
              <Animated.View style={[styles.deltaPopup, { opacity: deltaOpacity }]}>
                <Animated.Text style={[styles.deltaText, { fontSize: deltaFontSize, color: colors.black }]}>
                  {formatDeltaTime(timeDelta)}
                </Animated.Text>
              </Animated.View>
            )}

            {/* Double-tap ripple ovals — flash in small, ripple outward while fading */}
            <Animated.View
              pointerEvents="none"
              style={[styles.tapCircle, styles.tapCircleLeft, {
                opacity: coverTapCircleLeft,
                transform: [{ translateY: coverTapOffsetLeft }, { scaleX: 0.5 }, { scale: coverTapScaleLeft }],
              }]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.tapCircle, styles.tapCircleRight, {
                opacity: coverTapCircleRight,
                transform: [{ translateY: coverTapOffsetRight }, { scaleX: 0.5 }, { scale: coverTapScaleRight }],
              }]}
            />
          </Pressable>
            </RAnimated.View>

          {/* Controls section: byline, title — fades in during transition */}
          <RAnimated.View style={controlsAnimStyle}>
            {/* 2. Byline - By Author (left) · Narrated by Narrator (right) - justified to cover width */}
            <View style={styles.byline}>
            {/* Left side: By Author */}
            <View style={styles.bylineLeft}>
              <Text style={[styles.bylineText, { color: colors.gray }]}>By </Text>
              <TouchableOpacity
                onPress={authorId ? handleAuthorPress : undefined}
                activeOpacity={authorId ? 0.7 : 1}
              >
                <Text style={[styles.bylineLink, { color: colors.black }]}>{author}</Text>
              </TouchableOpacity>
            </View>
            {/* Right side: Narrated by Narrator */}
            {narratorName && (
              <View style={styles.bylineRight}>
                <Text style={[styles.bylineText, { color: colors.gray }]}>Narrated by </Text>
                <TouchableOpacity onPress={handleNarratorPress} activeOpacity={0.7}>
                  <Text style={[styles.bylineLink, { color: colors.black }]}>{narratorName}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 3. Title/Chapter Row */}
          <View style={styles.titleChapterRow}>
            {/* Left: Book Title */}
            <TouchableOpacity
              style={styles.titleContainer}
              onPress={handleTitlePress}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.bookTitle,
                  { fontFamily: titleFontFamily, fontWeight: titleFontWeight as any, color: colors.black }
                ]}
                numberOfLines={3}
              >
                {displayTitle}
              </Text>
            </TouchableOpacity>

            {/* Right: Chapter name */}
            <TouchableOpacity
              onPress={() => openSheet('chapters')}
              activeOpacity={0.7}
              style={styles.chapterTextContainer}
            >
              <Text style={[styles.chapterText, { color: colors.black }]} numberOfLines={3}>
                {chapterTitle}
              </Text>
            </TouchableOpacity>
            </View>
          </RAnimated.View>
          </View>

          {/* Bottom Controls Section — also fades in with transition */}
          <RAnimated.View style={controlsAnimStyle}>
            <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + scale(20) }]}>
          {/* Progress Bar - Slider with Bookmark Markers */}
          <View style={styles.progressBarContainer}>
            {/* Bookmark Markers (below slider, clickable) */}
            <View style={styles.bookmarkMarkersContainer} pointerEvents="box-none">
              {bookmarks.map((bookmark) => {
                const bmProgress = progressMode === 'book'
                  ? (duration > 0 ? bookmark.time / duration : 0)
                  : (chapterDuration > 0
                    ? (bookmark.time - (chapter?.start ?? 0)) / chapterDuration
                    : 0);
                // Only show markers that are within the current view (also filter NaN)
                if (!Number.isFinite(bmProgress) || bmProgress < 0 || bmProgress > 1) return null;
                return (
                  <TouchableOpacity
                    key={bookmark.id}
                    style={[
                      styles.bookmarkMarker,
                      { left: `${bmProgress * 100}%` },
                    ]}
                    onPress={() => {
                      haptics.selection();
                      seekTo(bookmark.time);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    {/* Vertical line (flagpole) */}
                    <View style={styles.bookmarkLine} />
                    {/* Triangle flag at top */}
                    <View style={styles.bookmarkFlag} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Slider */}
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={sliderValue}
              onSlidingStart={handleSliderStart}
              onValueChange={handleSliderChange}
              onSlidingComplete={handleSliderComplete}
              minimumTrackTintColor={colors.black}
              maximumTrackTintColor={colors.grayLine}
              thumbTintColor={colors.black}
            />
          </View>

          {/* Time Labels */}
          <View style={styles.progressTimes}>
            <TouchableOpacity
              onPress={() => setProgressMode(progressMode === 'book' ? 'chapter' : 'book')}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeText, { color: colors.gray }, isScrubbing && { color: colors.black, fontWeight: '600' }]}>
                {formatTime(
                  isScrubbing
                    ? (progressMode === 'book' ? sliderValue * duration : sliderValue * chapterDuration + (chapter?.start || 0))
                    : (progressMode === 'book' ? position : chapterPosition)
                )}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setProgressMode(progressMode === 'book' ? 'chapter' : 'book')}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeText, { color: colors.gray }]}>
                {formatTimeRemaining(
                  isScrubbing
                    ? (progressMode === 'book' ? duration - sliderValue * duration : chapterDuration - sliderValue * chapterDuration)
                    : (progressMode === 'book' ? timeRemaining : chapterDuration - chapterPosition)
                )}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 5-Button Controls Row: |< ⏪ ▶ ⏩ >| */}
          <View style={styles.controlsRow}>
            {/* Previous Chapter - no border */}
            <TouchableOpacity
              style={styles.skipChapterBtn}
              onPress={handlePrev}
              activeOpacity={0.6}
            >
              <SkipPrevIcon color={colors.black} size={28} />
            </TouchableOpacity>

            {/* Skip Back - with thin circle border */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleSkipBack}
              activeOpacity={0.6}
            >
              <RewindIcon color={colors.black} size={24} />
            </TouchableOpacity>

            {/* Play/Pause - Large white rounded pill */}
            <TouchableOpacity
              style={styles.playBtn}
              onPress={handlePlayPause}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size={28} color="#000000" />
              ) : isBuffering ? (
                <View style={styles.bufferingContainer}>
                  <ActivityIndicator size={48} color="#000000" style={styles.bufferingSpinner} />
                  {isPlaying ? (
                    <PauseIcon color="#000000" size={20} />
                  ) : (
                    <PlayIcon color="#000000" size={20} />
                  )}
                </View>
              ) : isPlaying ? (
                <PauseIcon color="#000000" size={36} />
              ) : (
                <PlayIcon color="#000000" size={36} />
              )}
            </TouchableOpacity>

            {/* Skip Forward - with thin circle border */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleSkipForward}
              activeOpacity={0.6}
            >
              <FastForwardIcon color={colors.black} size={24} />
            </TouchableOpacity>

            {/* Next Chapter - no border */}
            <TouchableOpacity
              style={styles.skipChapterBtn}
              onPress={handleNext}
              activeOpacity={0.6}
            >
              <SkipNextIcon color={colors.black} size={28} />
            </TouchableOpacity>
          </View>

          {/* Settings Row - Progress Mode toggle on left, Speed & Sleep on right */}
          <View style={styles.settingsRow}>
            {/* Progress Mode Toggle - Left side */}
            <TouchableOpacity
              style={styles.settingPill}
              onPress={() => setProgressMode(progressMode === 'book' ? 'chapter' : 'book')}
              activeOpacity={0.7}
            >
              <Text style={[styles.settingPillText, { color: colors.black }]}>
                {progressMode === 'book' ? 'Book' : 'Chapter'}
              </Text>
            </TouchableOpacity>

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* Speed */}
            <TouchableOpacity
              style={[styles.settingPill, activeSheet === 'speed' && { backgroundColor: colors.black }]}
              onPress={() => openSheet('speed')}
              activeOpacity={0.7}
            >
              <Text style={[styles.settingPillText, { color: activeSheet === 'speed' ? colors.white : colors.black }]}>
                {playbackRate.toFixed(1)}×
              </Text>
            </TouchableOpacity>

            {/* Sleep Timer */}
            <TouchableOpacity
              style={[
                styles.settingPill,
                (sleepTimer !== null || activeSheet === 'sleep') && { backgroundColor: colors.black }
              ]}
              onPress={() => openSheet('sleep')}
              activeOpacity={0.7}
            >
              <ClockIcon
                color={(sleepTimer !== null || activeSheet === 'sleep') ? colors.white : colors.black}
                size={14}
              />
              {sleepTimer !== null && (
                <Text style={[styles.settingPillText, { color: colors.white, marginLeft: scale(4) }]}>
                  {sleepTimer >= 3600
                    ? `${Math.floor(sleepTimer / 3600)}:${String(Math.floor((sleepTimer % 3600) / 60)).padStart(2, '0')}`
                    : sleepTimer >= 60
                      ? `${Math.floor(sleepTimer / 60)}m`
                      : `${sleepTimer}s`
                  }
                </Text>
              )}
            </TouchableOpacity>
            </View>
            </View>
          </RAnimated.View>
        </View>

        {/* Sheet Overlay - Centered popup */}
      {sheetVisible && (
        <View style={styles.sheetOverlay} pointerEvents="box-none">
          {/* Backdrop - fades in */}
          <Animated.View style={[styles.modalBackdrop, { opacity: overlayOpacity }]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeSheet}
            />
          </Animated.View>
          {/* Sheet - centered popup */}
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: colors.white,
                opacity: overlayOpacity,
                maxHeight: screenHeight * 0.80,
              },
              (activeSheet === 'queue' || activeSheet === 'chapters') && { maxHeight: screenHeight * 0.85 },
            ]}
          >
            {activeSheet === 'speed' && (
              <SpeedSheet onClose={closeSheet} />
            )}
            {activeSheet === 'sleep' && (
              <SleepTimerSheet onClose={closeSheet} />
            )}
            {activeSheet === 'queue' && (
              <QueuePanel onClose={closeSheet} />
            )}
            {activeSheet === 'chapters' && (
              <ChaptersSheet
                chapters={normalizedChapters}
                currentChapterIndex={chapterIndex}
                onChapterSelect={handleChapterSelect}
                onClose={closeSheet}
              />
            )}
            {activeSheet === 'bookmarks' && (
              <BookmarksSheet
                bookmarks={bookmarks}
                bookTitle={title}
                onClose={closeSheet}
                onSeekTo={seekTo}
                onEditBookmark={handleEditBookmark}
                onDeleteBookmark={(bookmark) => removeBookmark(bookmark.id)}
                onAddBookmark={handleBookmark}
                onAddBookmarkWithDetails={handleAddBookmarkWithDetails}
              />
            )}
          </Animated.View>
        </View>
      )}

      {/* Bookmark Add/Edit Modal */}
      <Modal
        visible={bookmarkModalMode !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancelBookmarkModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editModalContainer}
        >
          <TouchableOpacity
            style={styles.editModalOverlay}
            activeOpacity={1}
            onPress={handleCancelBookmarkModal}
          />
          <View style={[styles.editModalContent, { backgroundColor: colors.white }]}>
            <View style={[styles.editModalHandle, { backgroundColor: colors.grayLine }]} />

            {/* Header */}
            <View style={[styles.editModalHeader, { borderBottomColor: colors.black }]}>
              <Text style={[styles.editModalTitle, { color: colors.black }]}>
                {bookmarkModalMode === 'add' ? 'Add Bookmark' : 'Edit Bookmark'}
              </Text>
              <Text style={[styles.editModalTime, { color: colors.black }]}>
                {formatTime(editTime)}
              </Text>
            </View>

            {/* Time Adjustment (only for add mode) */}
            {bookmarkModalMode === 'add' && (
              <View style={styles.timeAdjustContainer}>
                <Text style={[styles.editNoteLabel, { color: colors.gray }]}>Position</Text>
                <View style={styles.timeAdjustRow}>
                  <TouchableOpacity
                    style={[styles.timeAdjustBtn, { borderColor: colors.grayLine, backgroundColor: colors.grayLight }]}
                    onPress={() => adjustTime(-30)}
                  >
                    <Text style={[styles.timeAdjustBtnText, { color: colors.black }]}>-30s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.timeAdjustBtn, { borderColor: colors.grayLine, backgroundColor: colors.grayLight }]}
                    onPress={() => adjustTime(-10)}
                  >
                    <Text style={[styles.timeAdjustBtnText, { color: colors.black }]}>-10s</Text>
                  </TouchableOpacity>
                  <View style={[styles.timeDisplay, { backgroundColor: colors.black }]}>
                    <Text style={[styles.timeDisplayText, { color: colors.white }]}>{formatTime(editTime)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.timeAdjustBtn, { borderColor: colors.grayLine, backgroundColor: colors.grayLight }]}
                    onPress={() => adjustTime(10)}
                  >
                    <Text style={[styles.timeAdjustBtnText, { color: colors.black }]}>+10s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.timeAdjustBtn, { borderColor: colors.grayLine, backgroundColor: colors.grayLight }]}
                    onPress={() => adjustTime(30)}
                  >
                    <Text style={[styles.timeAdjustBtnText, { color: colors.black }]}>+30s</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Chapter info (for edit mode) */}
            {bookmarkModalMode === 'edit' && editingBookmark?.chapterTitle && (
              <Text style={[styles.editModalChapter, { color: colors.gray }]} numberOfLines={1}>
                {editingBookmark.chapterTitle}
              </Text>
            )}

            {/* Chapter info (for add mode) */}
            {bookmarkModalMode === 'add' && chapterTitle && (
              <Text style={[styles.editModalChapter, { color: colors.gray }]} numberOfLines={1}>
                {chapterTitle}
              </Text>
            )}

            {/* Note input */}
            <View style={styles.editNoteContainer}>
              <Text style={[styles.editNoteLabel, { color: colors.gray }]}>Note (optional)</Text>
              <TextInput
                style={[styles.editNoteInput, { backgroundColor: colors.white, borderColor: colors.grayLine, color: colors.black }]}
                value={editNote}
                onChangeText={setEditNote}
                placeholder="Add a note..."
                placeholderTextColor={colors.gray}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Actions */}
            <View style={styles.editModalActions}>
              {bookmarkModalMode === 'edit' ? (
                <TouchableOpacity
                  style={styles.editDeleteBtn}
                  onPress={handleDeleteEditingBookmark}
                >
                  <Text style={[styles.editDeleteText, { color: colors.coral }]}>Delete</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <View style={styles.editModalActionsRight}>
                <TouchableOpacity
                  style={[styles.editCancelBtn, { borderColor: colors.grayLine, backgroundColor: colors.grayLight }]}
                  onPress={handleCancelBookmarkModal}
                >
                  <Text style={[styles.editCancelText, { color: colors.black }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editSaveBtn, { backgroundColor: colors.black }]}
                  onPress={handleSaveBookmark}
                >
                  <Text style={[styles.editSaveText, { color: colors.white }]}>
                    {bookmarkModalMode === 'add' ? 'Add' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </RAnimated.View>
    </GestureDetector>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  screen: {
    flex: 1,
    // paddingHorizontal is set dynamically via contentStyle for iPad support
  },

  // Main Content
  mainContent: {
    flex: 1,
  },

  // Cover - Full width, larger
  coverWrapper: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: scale(16),
    overflow: 'hidden',
  },
  tapCircle: {
    position: 'absolute',
    height: '60%',
    aspectRatio: 1,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    top: '20%',
  },
  tapCircleLeft: {
    left: '-30%',
  },
  tapCircleRight: {
    right: '-30%',
  },
  coverContainer: {
    width: '100%',
    height: '100%',
    borderRadius: scale(8),
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: staticColors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: scale(64),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.12)',
    letterSpacing: -2,
  },

  // Time Delta Popup - overlays cover
  deltaPopup: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: -scale(40) }],
  },
  deltaText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '400',
    color: staticColors.black,
    letterSpacing: -2,
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // Byline - By Author (left) · Narrated by Narrator (right) - justified to cover width
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  bylineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bylineRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bylineText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(11),
    color: staticColors.gray,
  },
  bylineLink: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(11),
    color: staticColors.black,
    textDecorationLine: 'underline',
  },

  // Title/Chapter Row
  titleChapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(20),
    gap: scale(16),
  },
  titleContainer: {
    flex: 1,
  },
  bookTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(32),
    fontWeight: '400',
    letterSpacing: -0.5,
    color: staticColors.black,
    lineHeight: scale(36),
  },
  chapterTextContainer: {
    maxWidth: scale(100),
    alignItems: 'flex-end',
  },
  chapterText: {
    fontSize: scale(16),
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '400',
    color: staticColors.black,
    textAlign: 'right',
    lineHeight: scale(20),
  },

  // Bottom Controls
  bottomInfo: {
    marginTop: 'auto',
  },
  progressBarContainer: {
    height: scale(40),
    justifyContent: 'center',
    marginBottom: scale(4),
    position: 'relative',
  },
  bookmarkMarkersContainer: {
    position: 'absolute',
    left: scale(8),
    right: scale(8),
    top: 0,
    bottom: 0,
    zIndex: -1,
    pointerEvents: 'box-none',
  },
  bookmarkMarker: {
    position: 'absolute',
    bottom: scale(22),
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: scale(-1),
  },
  bookmarkFlag: {
    width: 0,
    height: 0,
    borderTopWidth: scale(0),
    borderBottomWidth: scale(9),
    borderLeftWidth: scale(10),
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: staticColors.orange,
  },
  bookmarkLine: {
    width: scale(1),
    height: scale(30),
    backgroundColor: staticColors.orange,
  },
  slider: {
    width: '100%',
    height: scale(40),
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(24),
  },
  timeText: {
    fontSize: scale(13),
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  // 5-Button Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(4),
  },
  // Chapter skip buttons - no border, just icon
  skipChapterBtn: {
    width: scale(44),
    height: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Skip back/forward buttons - with thin circle border (matching header style)
  skipBtn: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Play button - large white rounded pill (always white regardless of theme)
  playBtn: {
    width: scale(100),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  bufferingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingSpinner: {
    position: 'absolute',
  },

  // Settings Row - Speed, Sleep, Progress Mode
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
    marginTop: scale(20),
  },
  settingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8),
    paddingHorizontal: scale(14),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  settingPillText: {
    fontSize: scale(12),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontWeight: '500',
  },

  // Sheet Overlay
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 200,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    backgroundColor: staticColors.creamGray,
    borderRadius: scale(16),
    width: '94%',
    overflow: 'hidden',
    marginBottom: scale(80),
  },
  sheetContainerTall: {
    // maxHeight is set dynamically based on screenHeight
  },

  // Bookmark Edit Modal
  editModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  editModalContent: {
    backgroundColor: staticColors.creamGray,
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    paddingHorizontal: scale(28),
    paddingBottom: scale(40),
  },
  editModalHandle: {
    width: scale(36),
    height: scale(4),
    backgroundColor: staticColors.grayLine,
    borderRadius: scale(2),
    alignSelf: 'center',
    marginTop: scale(12),
    marginBottom: scale(16),
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: scale(8),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: staticColors.black,
  },
  editModalTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(28),
    fontWeight: '400',
    color: staticColors.black,
  },
  editModalTime: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(13),
    fontWeight: '500',
    color: staticColors.black,
  },
  editModalChapter: {
    fontSize: scale(12),
    color: staticColors.gray,
    marginBottom: scale(20),
  },
  editNoteContainer: {
    marginBottom: scale(24),
  },
  editNoteLabel: {
    fontSize: scale(11),
    fontWeight: '600',
    color: staticColors.gray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: scale(8),
  },
  editNoteInput: {
    backgroundColor: staticColors.white,
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    borderRadius: scale(8),
    padding: scale(12),
    fontSize: scale(15),
    color: staticColors.black,
    minHeight: scale(100),
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editModalActionsRight: {
    flexDirection: 'row',
    gap: scale(12),
  },
  editDeleteBtn: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
  },
  editDeleteText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: staticColors.coral,
  },
  editCancelBtn: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    backgroundColor: staticColors.grayLight,
  },
  editCancelText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: staticColors.black,
  },
  editSaveBtn: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(24),
    backgroundColor: staticColors.black,
  },
  editSaveText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: staticColors.white,
  },

  // Time Adjustment (Add Bookmark)
  timeAdjustContainer: {
    marginBottom: scale(16),
  },
  timeAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    marginTop: scale(8),
  },
  timeAdjustBtn: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    backgroundColor: staticColors.grayLight,
    borderRadius: scale(4),
  },
  timeAdjustBtnText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  timeDisplay: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(16),
    backgroundColor: staticColors.black,
    borderRadius: scale(4),
    minWidth: scale(90),
    alignItems: 'center',
  },
  timeDisplayText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: staticColors.white,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
});

export default SecretLibraryPlayerScreen;
