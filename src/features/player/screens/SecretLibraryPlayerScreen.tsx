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
  StatusBar,
  Animated,
  PanResponder,
  Dimensions,
  BackHandler,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PlayIcon, PauseIcon } from '../components/PlayerIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import Slider from '@react-native-community/slider';

import { useNavigation } from '@react-navigation/native';
import { TopNav, TopNavCloseIcon } from '@/shared/components';
import { usePlayerStore, useCurrentChapterIndex } from '../stores/playerStore';
import { useSleepTimerStore } from '../stores/sleepTimerStore';
import { useBookmarksStore, useBookmarks, type Bookmark } from '../stores/bookmarksStore';
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
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
// MIGRATED: Now using new spine system via adapter
import { getTypographyForGenres, getSeriesStyle } from '@/features/home/utils/spine/adapter';

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COVER_SIZE = scale(200);

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
  if (!seconds || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeRemaining(seconds: number): string {
  if (!seconds || seconds < 0) return '-00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `-${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDeltaTime(seconds: number): string {
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

function splitTitle(title: string): { line1: string; line2: string } {
  // Try to split at natural break points
  const words = title.split(' ');
  if (words.length <= 2) {
    return { line1: words[0] || '', line2: words.slice(1).join(' ') || '' };
  }

  // Split roughly in half by word count
  const midPoint = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, midPoint).join(' '),
    line2: words.slice(midPoint).join(' '),
  };
}

function formatChapterTitle(title: string): { firstLine: string; rest: string } {
  // Add line break after every 2 words
  const words = title.split(' ');
  if (words.length <= 2) {
    return { firstLine: title, rest: '' };
  }

  const lines: string[] = [];
  for (let i = 0; i < words.length; i += 2) {
    lines.push(words.slice(i, i + 2).join(' '));
  }
  return {
    firstLine: lines[0],
    rest: lines.slice(1).join('\n'),
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SecretLibraryPlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  // Sheet state - no sheet open by default
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;  // Start hidden
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;  // Start at closed position

  // Progress mode: 'book' shows full book progress, 'chapter' shows current chapter progress
  const [progressMode, setProgressMode] = useState<'book' | 'chapter'>('book');

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
    playbackRate,
    chapters,
    skipForwardInterval,
    skipBackInterval,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlayerVisible: s.isPlayerVisible,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      duration: s.duration,
      playbackRate: s.playbackRate,
      chapters: s.chapters,
      skipForwardInterval: s.skipForwardInterval,
      skipBackInterval: s.skipBackInterval,
    }))
  );

  // Sleep timer subscription - real-time countdown (1 sec updates)
  const sleepTimer = useSleepTimerStore((s) => s.sleepTimer);

  // Position
  const position = usePlayerStore(
    (s) => Math.floor(s.isSeeking ? s.seekPosition : s.position)
  );

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
  const coverUrl = useCoverUrl(currentBook?.id || '');
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

  // Chapter progress
  const chapter = chapters[chapterIndex];
  const chapterPosition = chapter ? position - chapter.start : 0;
  const chapterDuration = chapter ? chapter.end - chapter.start : 0;
  const chapterProgress = chapterDuration > 0 ? chapterPosition / chapterDuration : 0;

  // Book progress
  const bookProgress = duration > 0 ? position / duration : 0;
  const timeRemaining = duration - position;

  // Title for display (no longer splitting - just show normally)
  // The splitTitle function was creating spine-like stacking which isn't appropriate for player

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
  // Extract ONLY font properties from cached typography
  // DO NOT use spine-specific properties like stacking, transforms, or orientations
  const titleFontFamily = spineTypography?.fontFamily || Platform.select({ ios: 'Georgia', android: 'serif' });
  const titleFontWeight = spineTypography?.titleWeight || spineTypography?.fontWeight || '400';

  // Display title as-is (no uppercase transform - that's for spines only)
  const displayTitle = title;

  // Animation for slide in/out
  useEffect(() => {
    if (isPlayerVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isPlayerVisible, slideAnim]);

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

  // Pan responder for swipe down
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 30 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SCREEN_HEIGHT * 0.3 || gestureState.vy > 0.5) {
          closePlayer();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

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
      sheetTranslateY.setValue(SCREEN_HEIGHT);
    }
    // Also reset bookmark edit state
    setBookmarkModalMode(null);
    setEditingBookmark(null);
  }, [bookId]); // Only depend on bookId to avoid closing on other state changes

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

    setTimeDelta(delta);
    setShowDelta(true);

    // Animate font size
    animateDeltaFontSize(delta);

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
  }, [deltaOpacity, animateDeltaFontSize]);

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
    // Store starting position for delta calculation
    deltaStartPosition.current = position;
    // Show delta immediately (will update as user scrubs)
    showDeltaPopup(0, false);
  }, [position, showDeltaPopup]);

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
    // Calculate current position based on slider value
    let currentPos: number;
    if (progressMode === 'book') {
      currentPos = value * duration;
    } else {
      const chapterStart = chapters[chapterIndex]?.start || 0;
      const chapterEnd = chapters[chapterIndex]?.end || duration;
      const chapterLen = chapterEnd - chapterStart;
      currentPos = chapterStart + value * chapterLen;
    }
    // Update delta and animate font size
    const delta = currentPos - deltaStartPosition.current;
    setTimeDelta(delta);
    animateDeltaFontSize(delta);
  }, [progressMode, duration, chapters, chapterIndex, animateDeltaFontSize]);

  const handleSliderComplete = useCallback((value: number) => {
    setIsScrubbing(false);
    haptics.selection();

    let newPosition: number;
    if (progressMode === 'book') {
      newPosition = value * duration;
    } else {
      // Chapter mode - calculate position within the chapter
      const chapterStart = chapters[chapterIndex]?.start || 0;
      const chapterEnd = chapters[chapterIndex]?.end || duration;
      const chapterLen = chapterEnd - chapterStart;
      newPosition = chapterStart + value * chapterLen;
    }
    seekTo(newPosition);

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
    closePlayer();
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
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveSheet(null);
      setSheetVisible(false);
    });
  }, [overlayOpacity, sheetTranslateY]);

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

  // Don't render if not visible
  // Return empty View on Android to prevent SafeAreaProvider crash
  if (!isPlayerVisible || !currentBook) {
    return Platform.OS === 'android' ? <View /> : null;
  }

  // Chapter number formatted (01, 02, etc.)
  const chapterNumber = String(chapterIndex + 1).padStart(2, '0');

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.white, transform: [{ translateY: slideAnim }] },
      ]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.creamGray} />

      {/* Safe Area Top */}
      <View style={{ height: insets.top, backgroundColor: colors.white }} />

      {/* Header - outside screen padding for proper alignment */}
      <TopNav
        variant={isDarkMode ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: 'transparent', marginBottom: scale(16) }}
        includeSafeArea={false}
        pills={[
          {
            key: 'download',
            label: isDownloaded
              ? 'Saved'
              : isPaused
              ? 'Paused'
              : isPending
              ? 'Queued'
              : isDownloading
              ? `${Math.round(downloadProgress * 100)}%`
              : 'Save',
            icon: <DownloadIcon color={isDownloaded || isDownloading || isPaused ? colors.white : colors.black} size={12} />,
            active: isDownloaded || isDownloading || isPaused,
            onPress: handleDownload,
          },
          {
            key: 'speed',
            label: `${playbackRate.toFixed(1)}×`,
            active: activeSheet === 'speed',
            onPress: () => openSheet('speed'),
          },
          {
            key: 'sleep',
            label: sleepTimer !== null
              ? (sleepTimer >= 60 ? `${Math.floor(sleepTimer / 60)}m` : `${sleepTimer}s`)
              : '',
            icon: <ClockIcon color={sleepTimer !== null || activeSheet === 'sleep' ? colors.white : colors.black} size={14} />,
            active: sleepTimer !== null || activeSheet === 'sleep',
            onPress: () => openSheet('sleep'),
          },
          {
            key: 'queue',
            label: '',
            icon: <ListIcon color={activeSheet === 'queue' ? colors.white : colors.black} size={14} />,
            active: activeSheet === 'queue',
            onPress: () => openSheet('queue'),
          },
        ]}
        circleButtons={[
          {
            key: 'close',
            icon: <TopNavCloseIcon color={colors.black} size={14} />,
            onPress: handleClose,
          },
        ]}
      />

      <View style={styles.screen}>
        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Series Name - Above title (clickable) */}
          {seriesName && (
            <TouchableOpacity onPress={handleSeriesPress} activeOpacity={0.7}>
              <Text style={[styles.seriesLabel, { color: colors.gray }]}>
                {seriesName.toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}

          {/* Title Block */}
          <View style={styles.titleBlock}>
            {/* Title and Author - flowing text with genre-based typography */}
            {/* adjustsFontSizeToFit scales down long titles to fit the container */}
            <Text
              style={styles.titleFlow}
              adjustsFontSizeToFit
              numberOfLines={3}
              minimumFontScale={0.5}
            >
              {/* Title - displayed normally (no spine-like stacking) */}
              <Text
                style={[
                  styles.titleLine,
                  { fontFamily: titleFontFamily, fontWeight: titleFontWeight as any, color: colors.black }
                ]}
                onPress={handleTitlePress}
                suppressHighlighting
              >
                {displayTitle}{' '}
              </Text>
              {/* Author - inline with title */}
              <Text
                style={[
                  styles.titleLine,
                  styles.authorInline,
                  {
                    fontFamily: titleFontFamily,
                    fontStyle: 'italic',
                    color: colors.gray,
                  }
                ]}
                onPress={authorId ? handleAuthorPress : undefined}
                suppressHighlighting
              >
                {author}
              </Text>
            </Text>

            {/* Bookmark Button - Tap to add, Long-press to view all */}
            <TouchableOpacity
              style={styles.bookmarkBtn}
              onPress={handleBookmark}
              onLongPress={() => openSheet('bookmarks')}
              delayLongPress={300}
            >
              <BookmarkIcon color={bookmarks.length > 0 ? colors.orange : colors.black} size={32} />
              {bookmarks.length > 0 && (
                <View style={styles.bookmarkBadge}>
                  <Text style={styles.bookmarkBadgeText}>{bookmarks.length}</Text>
                </View>
              )}
            </TouchableOpacity>

          </View>

          {/* Cover Wrapper */}
          <View style={styles.coverWrapper}>
            {/* Cover and Narrator container */}
            <View style={styles.coverAndNarrator}>
              {/* Cover Image */}
              <View style={styles.coverContainer}>
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
              </View>

              {/* Narrator - under cover, left aligned */}
              <Text style={[styles.narratorText, { color: colors.gray }]}>
                {narratorName ? `Read by ${narratorName}` : ''}
              </Text>
            </View>

            {/* Time Delta Popup */}
            {showDelta && (
              <Animated.View style={[styles.deltaPopup, { opacity: deltaOpacity }]}>
                <Animated.Text style={[styles.deltaText, { fontSize: deltaFontSize, color: colors.black }]}>
                  {formatDeltaTime(timeDelta)}
                </Animated.Text>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Bottom Info */}
        <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + scale(20) }]}>
          {/* Chapter Title with Navigation */}
          <View style={styles.chapterNavContainer}>
            {/* Navigation buttons row */}
            <View style={styles.chapterNavRow}>
              <TouchableOpacity
                style={styles.chapterNavBtn}
                onPress={handlePrev}
                activeOpacity={0.6}
              >
                <SkipPrevIcon color={colors.black} size={20} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chapterNavBtn}
                onPress={handleNext}
                activeOpacity={0.6}
              >
                <SkipNextIcon color={colors.black} size={20} />
              </TouchableOpacity>
            </View>

            {/* Chapter title */}
            <TouchableOpacity
              style={styles.chapterTitleLarge}
              onPress={() => openSheet('chapters')}
              activeOpacity={0.7}
            >
              <Text style={[styles.chapterLargeFirst, { color: colors.black }]}>
                {formatChapterTitle(chapterTitle).firstLine}
              </Text>
              {formatChapterTitle(chapterTitle).rest ? (
                <Text style={[styles.chapterLarge, { color: colors.black }]} numberOfLines={2}>
                  {formatChapterTitle(chapterTitle).rest}
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>

          {/* Progress Bar - Slider with Bookmark Markers */}
          <View style={styles.progressBarContainer}>
            {/* Bookmark Markers (below slider, clickable) */}
            <View style={styles.bookmarkMarkersContainer} pointerEvents="box-none">
              {bookmarks.map((bookmark) => {
                const bmProgress = progressMode === 'book'
                  ? bookmark.time / duration
                  : chapter
                    ? (bookmark.time - chapter.start) / chapterDuration
                    : 0;
                // Only show markers that are within the current view
                if (bmProgress < 0 || bmProgress > 1) return null;
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
            <Text style={[styles.timeText, { color: colors.gray }, isScrubbing && { color: colors.black, fontWeight: '600' }]}>
              {formatTime(
                isScrubbing
                  ? (progressMode === 'book' ? sliderValue * duration : sliderValue * chapterDuration + (chapter?.start || 0))
                  : (progressMode === 'book' ? position : chapterPosition)
              )}
            </Text>
            <Text style={[styles.timeText, { color: colors.gray }]}>
              {formatTimeRemaining(
                isScrubbing
                  ? (progressMode === 'book' ? duration - sliderValue * duration : chapterDuration - sliderValue * chapterDuration)
                  : (progressMode === 'book' ? timeRemaining : chapterDuration - chapterPosition)
              )}
            </Text>
          </View>

          {/* Controls Row - Toggle on left, Buttons on right */}
          <View style={styles.controlsRow}>
            {/* Progress Mode Toggle */}
            <TouchableOpacity
              style={styles.progressModeToggle}
              onPress={() => setProgressMode(progressMode === 'book' ? 'chapter' : 'book')}
              activeOpacity={0.7}
            >
              <Text style={[styles.progressModeText, { color: colors.black }]}>
                {progressMode === 'book' ? 'Book' : 'Chapter'}
              </Text>
            </TouchableOpacity>

            {/* Controls - Pill Style */}
            <View style={styles.controls}>
              {/* Sleep Timer Countdown */}
              {sleepTimer !== null && (
                <TouchableOpacity
                  style={styles.sleepTimerCountdown}
                  onPress={() => openSheet('sleep')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sleepTimerCountdownText, { color: colors.orange }]}>
                    {sleepTimer >= 3600
                      ? `${Math.floor(sleepTimer / 3600)}:${String(Math.floor((sleepTimer % 3600) / 60)).padStart(2, '0')}:${String(sleepTimer % 60).padStart(2, '0')}`
                      : `${Math.floor(sleepTimer / 60)}:${String(sleepTimer % 60).padStart(2, '0')}`
                    }
                  </Text>
                </TouchableOpacity>
              )}

              {/* Skip Back */}
              <TouchableOpacity style={[styles.ctrlPill, { borderColor: colors.black }]} onPress={handleSkipBack}>
                <RewindIcon color={colors.black} size={14} />
                <Text style={[styles.ctrlPillText, { color: colors.black }]}>{skipBackInterval}</Text>
              </TouchableOpacity>

              {/* Skip Forward */}
              <TouchableOpacity style={[styles.ctrlPill, { borderColor: colors.black }]} onPress={handleSkipForward}>
                <FastForwardIcon color={colors.black} size={14} />
                <Text style={[styles.ctrlPillText, { color: colors.black }]}>{skipForwardInterval}</Text>
              </TouchableOpacity>

              {/* Play/Pause - Filled (on right) */}
              <TouchableOpacity
                style={[styles.ctrlPill, styles.ctrlPillFilled, { backgroundColor: colors.black }]}
                onPress={handlePlayPause}
              >
                {isLoading ? (
                  <ActivityIndicator size={16} color={colors.white} />
                ) : isBuffering ? (
                  <View style={styles.bufferingContainer}>
                    <ActivityIndicator size={28} color={colors.white} style={styles.bufferingSpinner} />
                    {isPlaying ? (
                      <PauseIcon color={colors.white} size={12} />
                    ) : (
                      <PlayIcon color={colors.white} size={12} />
                    )}
                  </View>
                ) : isPlaying ? (
                  <PauseIcon color={colors.white} size={16} />
                ) : (
                  <PlayIcon color={colors.white} size={16} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Sheet Overlay - Fade in backdrop, slide up panel */}
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
          {/* Sheet - slides up */}
          <Animated.View
            style={[
              styles.sheetContainer,
              { paddingBottom: insets.bottom, backgroundColor: colors.white, transform: [{ translateY: sheetTranslateY }] },
              (activeSheet === 'queue' || activeSheet === 'chapters') && styles.sheetContainerTall,
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
    </Animated.View>
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
    backgroundColor: staticColors.creamGray,
    zIndex: 100,
  },
  screen: {
    flex: 1,
    paddingHorizontal: scale(28),
  },

  // Main Content
  mainContent: {
    flex: 1,
    paddingTop: scale(12),
  },

  // Series Label - Above title
  seriesLabel: {
    fontSize: scale(9),
    letterSpacing: 2,
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginTop: scale(-24),
    marginBottom: scale(8),
  },

  // Title Block
  titleBlock: {
    position: 'relative',
    marginBottom: scale(8),
    paddingRight: scale(40), // Space for bookmark button
  },
  titleFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  titleLine: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(48),
    fontWeight: '400',
    letterSpacing: -1,
    color: staticColors.black,
    lineHeight: scale(48) * 0.95,
  },
  titleItalic: {
    fontStyle: 'italic',
  },
  authorInline: {
    color: staticColors.gray,
  },
  bookmarkBtn: {
    position: 'absolute',
    right: 0,
    top: scale(4),
    padding: scale(2),
  },
  bookmarkBadge: {
    position: 'absolute',
    top: -scale(2),
    right: -scale(6),
    minWidth: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: staticColors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(4),
  },
  bookmarkBadgeText: {
    fontSize: scale(10),
    fontWeight: '700',
    color: staticColors.white,
  },

  // Cover
  coverWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: scale(12),
    position: 'relative',
  },

  // Time Delta Popup
  deltaPopup: {
    position: 'absolute',
    top: COVER_SIZE + scale(60),
    left: 0,
    alignItems: 'flex-start',
  },
  deltaText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '400',
    color: staticColors.black,
    letterSpacing: -2,
  },

  coverAndNarrator: {
    width: COVER_SIZE,
    alignItems: 'flex-start',
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
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
    fontSize: scale(48),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.12)',
    letterSpacing: -2,
  },

  // Chapter Title with Navigation - above progress bar
  chapterNavContainer: {
    alignItems: 'flex-end',
    marginBottom: scale(16),
  },
  chapterNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(24),
    marginBottom: scale(4),
  },
  chapterNavBtn: {
    padding: scale(10),
  },
  chapterTitleLarge: {
    alignItems: 'flex-end',
  },
  chapterLargeFirst: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(28),
    fontWeight: '400',
    color: staticColors.black,
    textAlign: 'right',
    lineHeight: scale(26),
  },
  chapterLarge: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(28),
    fontWeight: '400',
    fontStyle: 'italic',
    color: staticColors.black,
    textAlign: 'right',
    lineHeight: scale(26),
  },

  // Narrator - under cover, left aligned
  narratorText: {
    marginTop: scale(8),
    fontSize: scale(11),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    color: staticColors.gray,
    minHeight: scale(14),
  },

  // Bottom Info
  bottomInfo: {
    marginTop: 'auto',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressModeText: {
    fontSize: scale(11),
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    textDecorationLine: 'underline',
  },
  progressModeActive: {
    color: staticColors.black,
    fontWeight: '600',
  },
  progressModeSeparator: {
    fontSize: scale(12),
    color: staticColors.grayLine,
    marginHorizontal: scale(2),
  },
  progressBarContainer: {
    height: scale(40),
    justifyContent: 'center',
    marginBottom: scale(4),
    position: 'relative',
  },
  bookmarkMarkersContainer: {
    position: 'absolute',
    left: scale(8), // Account for slider padding
    right: scale(8),
    top: 0,
    bottom: 0,
    zIndex: -1,
    pointerEvents: 'box-none',
  },
  bookmarkMarker: {
    position: 'absolute',
    bottom: scale(22), // Bottom of line aligns with progress bar track
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: scale(-1), // Align line with position
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
    marginBottom: scale(20),
  },
  timeText: {
    fontSize: scale(11),
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  timeTextActive: {
    color: staticColors.black,
    fontWeight: '600',
  },
  // Sleep timer countdown - in controls row
  sleepTimerCountdown: {
    paddingHorizontal: scale(8),
    justifyContent: 'center',
  },
  sleepTimerCountdownText: {
    fontSize: scale(11),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontWeight: '600',
  },

  // Controls - Pill Style, Right Aligned
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: scale(6),
  },
  ctrlPill: {
    height: scale(36),
    paddingHorizontal: scale(14),
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: staticColors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
  },
  ctrlPillFilled: {
    backgroundColor: staticColors.black,
    paddingHorizontal: scale(18),
  },
  ctrlPillText: {
    fontSize: scale(12),
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    color: staticColors.black,
  },
  bufferingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingSpinner: {
    position: 'absolute',
  },

  // Sheet Overlay
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    backgroundColor: staticColors.creamGray,
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  sheetContainerTall: {
    maxHeight: SCREEN_HEIGHT * 0.92,
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
