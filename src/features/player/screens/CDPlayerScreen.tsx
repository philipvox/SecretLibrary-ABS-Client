/**
 * src/features/player/screens/CDPlayerScreen.tsx
 *
 * Full-screen audiobook player with cover art and timeline controls.
 * Features scrolling chapter timeline, book progress view, and
 * modern glass-morphic UI with light/dark theme support.
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
  ScrollView,
  UIManager,
  Platform,
  InteractionManager,
  TextInput,
  Keyboard,
  Dimensions,
  BackHandler,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import ReanimatedAnimated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  X,
  Volume2,
  Check,
  CheckCircle,
  Cloud,
  Download,
  Play,
  Layers,
  Hourglass,
  Bookmark,
  Settings,
  Trash2,
  Moon,
  Gauge,
  ArrowDown,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { useNavigation } from '@react-navigation/native';

import { usePlayerStore, useCurrentChapterIndex } from '../stores/playerStore';
import { useSnapToChapterSettings } from '../stores/settingsStore';
import { SleepTimerSheet, SpeedSheet } from '../sheets';
import { QueuePanel } from '@/features/queue/components/QueuePanel';
import { useQueueCount, useQueueStore } from '@/features/queue/stores/queueStore';
import { useReducedMotion } from 'react-native-reanimated';
import { useCoverUrl } from '@/core/cache';
import { useIsOfflineAvailable, useDownloads, useDownloadStatus } from '@/core/hooks/useDownloads';
import { useRenderTracker, useLifecycleTracker } from '@/utils/perfDebug';
import { useFpsMonitor, fpsMonitor } from '@/utils/runtimeMonitor';
import { useNormalizedChapters } from '@/shared/hooks';
// CoverPlayButton removed - using long-press + pan on timeline instead
import { haptics } from '@/core/native/haptics';
import { useTimelineHaptics, Chapter as HapticChapter } from '../hooks/useTimelineHaptics';
import { useContinuousSeeking } from '../hooks/useContinuousSeeking';
import { useBookmarkActions } from '../hooks/useBookmarkActions';
import { getCachedTicks, generateAndCacheTicks, TimelineTick, ChapterInput } from '../services/tickCache';
import { getVisibleTicks } from '../utils/tickGenerator';
import { audioService } from '../services/audioService';
import { colors, spacing, radius, scale, wp, hp, layout } from '@/shared/theme';
import { useThemeStore } from '@/shared/theme/themeStore';
import { logger } from '@/shared/utils/logger';
import { useToast } from '@/shared/hooks/useToast';
import { useScreenLoadTime } from '@/core/hooks/useScreenLoadTime';

// Extracted utilities
import { formatTime, formatTimeHHMMSS, formatTimeVerbose, formatSleepCountdown } from '../utils/timeFormatters';
import { usePlayerColors } from '../utils/playerTheme';
// Extracted components
import { CircularProgress } from '../components/CircularProgress';
import {
  MoonIcon,
  RewindIcon,
  FastForwardIcon,
  DownArrowIcon,
  BookmarkFlagIcon,
  SettingsIconCircle,
} from '../components/PlayerIcons';
import { ChapterListItem } from '../components/ChapterListItem';
import { ChaptersSheet, SettingsSheet, BookmarksSheet, type Bookmark as BookmarkType } from '../components/sheets';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  COVER_SIZE,
  ACCENT_COLOR,
  SPEED_QUICK_OPTIONS,
  SLEEP_QUICK_OPTIONS,
  TIMELINE_WIDTH,
  TIMELINE_MARKER_RADIUS,
  TIMELINE_MAJOR_TICK_HEIGHT,
  TIMELINE_MINOR_TICK_HEIGHT,
  CHAPTER_MARKER_X,
  CHAPTER_MARKER_CIRCLE_SIZE,
  CHAPTER_TICK_HEIGHT,
  TEN_MIN_TICK_HEIGHT,
  ONE_MIN_TICK_HEIGHT,
  FIFTEEN_SEC_TICK_HEIGHT,
  CHAPTER_LABEL_Y,
  MINUTES_PER_SCREEN,
  PIXELS_PER_SECOND,
  CHAPTER_TIMELINE_TOTAL_HEIGHT,
  CHAPTER_TICKS_AREA_HEIGHT,
  CHAPTER_MARKER_LINE_HEIGHT,
  EDGE_ZONE,
  SPEED_MODE_LABELS,
} from '../constants/playerConstants';

// =============================================================================
// TYPES
// =============================================================================

type SheetType = 'none' | 'chapters' | 'settings' | 'queue' | 'sleep' | 'speed' | 'bookmarks';
type ProgressMode = 'chapter' | 'book';

// =============================================================================
// Timeline Progress Bar
// =============================================================================

interface TimelineChapter {
  start: number;
  end: number;
  displayTitle?: string;
}

interface TimelineBookmark {
  id: string;
  time: number; // seconds
}

interface TimelineProgressBarProps {
  position: number;
  duration: number;
  chapters: TimelineChapter[];
  onSeek: (position: number) => void;
  /** Bookmarks to display as flags on the timeline */
  bookmarks?: TimelineBookmark[];
  /** Library item ID for tick caching */
  libraryItemId?: string;
}

const TimelineProgressBar = React.memo(({ position, duration, chapters, onSeek, bookmarks = [] }: TimelineProgressBarProps) => {
  // Get theme colors
  const themeColors = usePlayerColors();

  // Normalize position to 0-1 based on chapters (equal width per chapter)
  const normalizedProgress = useMemo(() => {
    if (duration <= 0) return 0;

    // If no chapters, treat whole book as one chapter
    if (!chapters.length) {
      return position / duration;
    }

    // Find current chapter
    let currentChapterIndex = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (position >= chapters[i].start) {
        currentChapterIndex = i;
        break;
      }
    }

    const chapter = chapters[currentChapterIndex];
    const chapterDuration = chapter.end - chapter.start;
    const positionInChapter = position - chapter.start;
    const chapterProgress = chapterDuration > 0 ? positionInChapter / chapterDuration : 0;

    // Each chapter takes equal width (1/numChapters)
    const chapterWidth = 1 / chapters.length;
    return (currentChapterIndex * chapterWidth) + (chapterProgress * chapterWidth);
  }, [position, duration, chapters]);

  const markerPosition = useSharedValue(normalizedProgress * TIMELINE_WIDTH);
  const isDragging = useSharedValue(false);

  // Update marker when progress changes (but not while dragging)
  useEffect(() => {
    if (!isDragging.value) {
      markerPosition.value = normalizedProgress * TIMELINE_WIDTH;
    }
  }, [normalizedProgress]);

  // Generate tick marks based on chapters
  // NOTE: Using chapters.length as explicit dependency to ensure re-render when chapters load
  const ticks = useMemo(() => {
    const tickArray: { x: number; isMajor: boolean }[] = [];

    // Treat 0 chapters as 1 chapter (whole book)
    const effectiveChapters = chapters.length || 1;
    const chapterWidth = TIMELINE_WIDTH / effectiveChapters;

    // Adaptive density
    const minorTickMode: 'full' | 'half' | 'none' =
      chapterWidth >= 20 ? 'full' :
      chapterWidth >= 12 ? 'half' :
      'none';

    for (let chapterIndex = 0; chapterIndex < effectiveChapters; chapterIndex++) {
      const chapterStartX = chapterIndex * chapterWidth;

      // Major tick at chapter start
      tickArray.push({ x: chapterStartX, isMajor: true });

      // Minor ticks based on density mode
      if (minorTickMode === 'full') {
        for (let i = 1; i <= 3; i++) {
          tickArray.push({ x: chapterStartX + (chapterWidth * i * 0.25), isMajor: false });
        }
      } else if (minorTickMode === 'half') {
        tickArray.push({ x: chapterStartX + (chapterWidth * 0.5), isMajor: false });
      }
    }

    // Final major tick at end
    tickArray.push({ x: TIMELINE_WIDTH, isMajor: true });

    return tickArray;
  }, [chapters, chapters.length]);

  // Convert normalized progress back to actual position
  const normalizedToPosition = useCallback((normalized: number): number => {
    if (duration <= 0) return 0;

    if (!chapters.length) {
      return normalized * duration;
    }

    const chapterWidth = 1 / chapters.length;
    const chapterIndex = Math.min(Math.floor(normalized / chapterWidth), chapters.length - 1);
    const progressInChapter = (normalized - (chapterIndex * chapterWidth)) / chapterWidth;

    const chapter = chapters[chapterIndex];
    const chapterDuration = chapter.end - chapter.start;
    return chapter.start + (progressInChapter * chapterDuration);
  }, [chapters, duration]);

  const handleSeek = useCallback((normalizedProgress: number) => {
    const clampedProgress = Math.max(0, Math.min(1, normalizedProgress));
    const newPosition = normalizedToPosition(clampedProgress);
    onSeek(newPosition);
  }, [normalizedToPosition, onSeek]);

  // Pan gesture for scrubbing (book view only)
  const scrubGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      isDragging.value = true;
    })
    .onUpdate((event) => {
      'worklet';
      const newX = Math.max(0, Math.min(TIMELINE_WIDTH, event.x));
      markerPosition.value = newX;
    })
    .onEnd((event) => {
      'worklet';
      isDragging.value = false;
      const newProgress = Math.max(0, Math.min(1, event.x / TIMELINE_WIDTH));
      runOnJS(handleSeek)(newProgress);
    });

  // Tap gesture for seeking
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      'worklet';
      const newX = Math.max(0, Math.min(TIMELINE_WIDTH, event.x));
      markerPosition.value = newX;
      const newProgress = newX / TIMELINE_WIDTH;
      runOnJS(handleSeek)(newProgress);
    });

  const combinedGesture = Gesture.Race(scrubGesture, tapGesture);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: markerPosition.value - TIMELINE_MARKER_RADIUS }],
  }));

  // Find which tick is closest to marker for highlight
  const currentTickIndex = useMemo(() => {
    if (!ticks.length) return -1;
    const markerX = normalizedProgress * TIMELINE_WIDTH;
    let closestIndex = 0;
    let closestDistance = Math.abs(ticks[0].x - markerX);
    for (let i = 1; i < ticks.length; i++) {
      const distance = Math.abs(ticks[i].x - markerX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  }, [ticks, normalizedProgress]);

  // Convert bookmark times to X positions (normalized like the marker)
  const bookmarkPositions = useMemo(() => {
    if (!bookmarks.length || duration <= 0) return [];

    return bookmarks.map((bookmark) => {
      const time = Math.round(bookmark.time); // Round to nearest second

      // Convert time to normalized progress (same logic as normalizedProgress)
      let normalized = 0;
      if (!chapters.length) {
        normalized = time / duration;
      } else {
        let chapterIndex = 0;
        for (let i = chapters.length - 1; i >= 0; i--) {
          if (time >= chapters[i].start) {
            chapterIndex = i;
            break;
          }
        }
        const chapter = chapters[chapterIndex];
        const chapterDuration = chapter.end - chapter.start;
        const positionInChapter = time - chapter.start;
        const chapterProgress = chapterDuration > 0 ? positionInChapter / chapterDuration : 0;
        const chapterWidth = 1 / chapters.length;
        normalized = (chapterIndex * chapterWidth) + (chapterProgress * chapterWidth);
      }

      return {
        id: bookmark.id,
        x: Math.max(0, Math.min(TIMELINE_WIDTH, normalized * TIMELINE_WIDTH)),
      };
    });
  }, [bookmarks, duration, chapters]);

  // Flag dimensions for book view - stem reaches full height like red marker line
  const CONTAINER_HEIGHT = TIMELINE_MARKER_RADIUS * 2 + TIMELINE_MAJOR_TICK_HEIGHT + 4;
  const FLAG_PENNANT_WIDTH = scale(20);  // Width of the flag part
  const FLAG_PENNANT_HEIGHT = scale(10); // Height of the flag part
  const FLAG_POLE_WIDTH = 2;
  const FLAG_COLOR = '#0146F5';          // Solid blue for flag
  const STEM_COLOR = '#64B5F6';          // Light blue for stem

  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={timelineStyles.container}>
        {/* Bookmark flags - render before marker so marker appears on top */}
        {bookmarkPositions.map((bm) => (
          <View
            key={bm.id}
            style={[
              timelineStyles.bookmarkFlag,
              { left: bm.x - FLAG_POLE_WIDTH / 2 },
            ]}
          >
            <Svg width={FLAG_PENNANT_WIDTH + FLAG_POLE_WIDTH} height={CONTAINER_HEIGHT} viewBox={`0 0 ${FLAG_PENNANT_WIDTH + FLAG_POLE_WIDTH} ${CONTAINER_HEIGHT}`}>
              {/* Stem - full height like red center line */}
              <Line
                x1={FLAG_POLE_WIDTH / 2}
                y1={0}
                x2={FLAG_POLE_WIDTH / 2}
                y2={CONTAINER_HEIGHT}
                stroke={STEM_COLOR}
                strokeWidth={FLAG_POLE_WIDTH}
              />
              {/* Flag - notched pennant shape (based on Flag.svg) */}
              <Path
                d={`M${FLAG_POLE_WIDTH} 0 H${FLAG_POLE_WIDTH + FLAG_PENNANT_WIDTH} L${FLAG_POLE_WIDTH + FLAG_PENNANT_WIDTH * 0.78} ${FLAG_PENNANT_HEIGHT / 2} L${FLAG_POLE_WIDTH + FLAG_PENNANT_WIDTH} ${FLAG_PENNANT_HEIGHT} H${FLAG_POLE_WIDTH} Z`}
                fill={FLAG_COLOR}
              />
            </Svg>
          </View>
        ))}

        {/* Red marker circle */}
        <ReanimatedAnimated.View style={[timelineStyles.marker, markerStyle]}>
          <View style={timelineStyles.markerInner} />
        </ReanimatedAnimated.View>

        {/* Tick marks */}
        <Svg width={TIMELINE_WIDTH} height={TIMELINE_MAJOR_TICK_HEIGHT + 4} style={timelineStyles.ticks}>
          {ticks.map((tick, index) => {
            const isCurrentTick = index === currentTickIndex;
            return (
              <Line
                key={index}
                x1={tick.x}
                y1={tick.isMajor ? 0 : TIMELINE_MAJOR_TICK_HEIGHT - TIMELINE_MINOR_TICK_HEIGHT}
                x2={tick.x}
                y2={TIMELINE_MAJOR_TICK_HEIGHT}
                stroke={isCurrentTick ? themeColors.tickActive : themeColors.tickDefault}
                strokeWidth={1}
            />
          );
        })}
        </Svg>
      </View>
    </GestureDetector>
  );
});

const timelineStyles = StyleSheet.create({
  container: {
    width: TIMELINE_WIDTH,
    height: TIMELINE_MARKER_RADIUS * 2 + TIMELINE_MAJOR_TICK_HEIGHT + 4,
    alignSelf: 'center',
  },
  marker: {
    position: 'absolute',
    top: 0,
    width: TIMELINE_MARKER_RADIUS * 2,
    height: TIMELINE_MARKER_RADIUS * 2,
    borderRadius: TIMELINE_MARKER_RADIUS,
    backgroundColor: '#F50101',
    zIndex: 10,
    shadowColor: '#F50101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  markerInner: {
    width: '100%',
    height: '100%',
    borderRadius: TIMELINE_MARKER_RADIUS,
    backgroundColor: '#F50101',
  },
  ticks: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  bookmarkFlag: {
    position: 'absolute',
    top: 0, // Stem starts from top, reaches bottom
    zIndex: 5,
  },
});

// =============================================================================
// Chapter Timeline Progress Bar (Scrolling Chapter View)
// =============================================================================

const ChapterTimelineProgressBar = React.memo(({ position, duration, chapters, onSeek, bookmarks = [], libraryItemId }: TimelineProgressBarProps) => {
  // Get theme colors
  const themeColors = usePlayerColors();

  // Calculate total timeline width based on duration
  // IMPORTANT: This is the LOGICAL width, not the actual SVG canvas size
  // The SVG uses a smaller viewport to avoid "bitmap too large" crashes on Android
  const timelineWidth = useMemo(() => {
    return Math.max(TIMELINE_WIDTH, duration * PIXELS_PER_SECOND);
  }, [duration]);

  // Cached ticks state
  const [cachedTicks, setCachedTicks] = useState<TimelineTick[] | null>(null);
  const [ticksLoading, setTicksLoading] = useState(true);

  // Load or generate ticks
  useEffect(() => {
    if (duration <= 0 || chapters.length === 0) {
      setTicksLoading(false);
      return;
    }

    let mounted = true;

    const loadTicks = async () => {
      let ticks: TimelineTick[] | null = null;

      // Try to get cached ticks if we have libraryItemId
      if (libraryItemId) {
        ticks = await getCachedTicks(libraryItemId);
      }

      if (!ticks) {
        // Generate ticks (and cache if we have libraryItemId)
        const chapterInputs: ChapterInput[] = chapters.map(ch => ({
          start: ch.start,
          end: ch.end,
          displayTitle: ch.displayTitle,
        }));
        ticks = await generateAndCacheTicks(libraryItemId || 'temp', duration, chapterInputs, !!libraryItemId);
      }

      if (mounted) {
        setCachedTicks(ticks);
        setTicksLoading(false);
      }
    };

    loadTicks();

    return () => {
      mounted = false;
    };
  }, [libraryItemId, duration, chapters]);

  // Timeline offset to keep current position at center (time-based)
  // IMPORTANT: Initialize with correct offset based on position to prevent jump on first render
  const initialOffset = useMemo(() => {
    const positionX = position * PIXELS_PER_SECOND;
    return -positionX + CHAPTER_MARKER_X;
  }, []); // Only calculate once on mount
  const timelineOffset = useSharedValue(initialOffset);
  const lastPosition = useRef(position);
  const lastOffsetUpdate = useRef(0);

  // Position-based update (for playback - when NOT direct scrubbing)
  // Direct scrubbing updates timelineOffset directly in the pan gesture
  // NOTE: Throttled to 10fps (100ms) to reduce unnecessary work
  useEffect(() => {
    // Skip position updates during direct scrubbing to prevent conflicts
    if (isDirectScrubbing) return;

    // Throttle updates to 10fps (100ms) - smooth enough for timeline
    const now = Date.now();
    if (now - lastOffsetUpdate.current < 100) return;

    const positionX = position * PIXELS_PER_SECOND;
    const newOffset = -positionX + CHAPTER_MARKER_X;

    // Calculate how much position changed
    const positionDelta = Math.abs(position - lastPosition.current);
    lastPosition.current = position;

    // All position changes are instant - no animation
    if (positionDelta > 0.1) {
      lastOffsetUpdate.current = now;
      timelineOffset.value = newOffset;
    }
  }, [position, isDirectScrubbing]);

  // Handle seek from tap or scrub
  const handleSeek = useCallback((seconds: number) => {
    const clampedPosition = Math.max(0, Math.min(duration, seconds));
    onSeek(clampedPosition);
  }, [duration, onSeek]);

  // ============================================================================
  // DIRECT SCRUB MODE (Long-press + Pan)
  // ============================================================================

  // Haptic feedback
  const timelineHaptics = useTimelineHaptics();

  // Snap-to-chapter settings
  const snapSettings = useSnapToChapterSettings();

  // Convert chapters to haptic chapter format
  const hapticChapters: HapticChapter[] = useMemo(() => {
    return chapters.map((ch, index) => ({
      index,
      startTime: ch.start,
      endTime: ch.end,
      title: ch.title,
    }));
  }, [chapters]);

  // Calculate snap position (finds nearest chapter boundary within threshold)
  const calculateSnapPosition = useCallback((rawPosition: number): { position: number; didSnap: boolean } => {
    if (!snapSettings.enabled) return { position: rawPosition, didSnap: false };

    let nearestBoundary = rawPosition;
    let nearestDistance = Infinity;

    for (const chapter of chapters) {
      const distance = Math.abs(rawPosition - chapter.start);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBoundary = chapter.start;
      }
    }

    // Snap if within threshold
    if (nearestDistance <= snapSettings.threshold) {
      return { position: nearestBoundary, didSnap: true };
    }

    return { position: rawPosition, didSnap: false };
  }, [chapters, snapSettings.enabled, snapSettings.threshold]);

  // Scrub state
  const [isDirectScrubbing, setIsDirectScrubbing] = useState(false);
  const [showScrubTooltip, setShowScrubTooltip] = useState(false);
  const [scrubSpeedMode, setScrubSpeedMode] = useState<'normal' | 'half' | 'quarter' | 'fine' | 'fast'>('normal');
  const [scrubViewPosition, setScrubViewPosition] = useState(position); // For tick windowing
  const scrubStartOffset = useSharedValue(0);
  const scrubStartX = useSharedValue(0);
  const scrubStartY = useSharedValue(0);
  const scrubCurrentPosition = useSharedValue(0);
  const lastScrubPosition = useRef(position);
  const lastScrubViewUpdate = useRef(0);

  // Edge auto-scroll (accumulated offset approach - no interval)
  const EDGE_ZONE = 80; // pixels from edge to trigger auto-scroll
  const screenWidth = Dimensions.get('window').width;
  const edgeScrollAccumulator = useSharedValue(0);

  // Speed mode labels
  const SPEED_MODE_LABELS: Record<string, string> = {
    normal: '',
    half: 'HALF SPEED',
    quarter: 'QUARTER SPEED',
    fine: 'FINE',
    fast: 'FAST (2×)',
  };

  // Calculate speed multiplier from vertical offset
  const getSpeedMultiplier = useCallback((dy: number): { multiplier: number; mode: 'normal' | 'half' | 'quarter' | 'fine' | 'fast' } => {
    if (dy > 120) return { multiplier: 0.1, mode: 'fine' };
    if (dy > 80) return { multiplier: 0.25, mode: 'quarter' };
    if (dy > 40) return { multiplier: 0.5, mode: 'half' };
    if (dy < -40) return { multiplier: 2.0, mode: 'fast' };
    return { multiplier: 1.0, mode: 'normal' };
  }, []);

  // Track if we were playing before scrubbing (to resume after)
  const wasPlayingBeforeScrub = useRef(false);

  // Enter direct scrub mode
  // NOTE: Uses getState() to avoid callback recreation on position updates
  const enterDirectScrub = useCallback(() => {
    const state = usePlayerStore.getState();
    const currentPosition = state.position;

    // Pause playback during scrubbing for better UX
    wasPlayingBeforeScrub.current = state.isPlaying;
    if (state.isPlaying) {
      state.pause();
    }

    setIsDirectScrubbing(true);
    setShowScrubTooltip(false); // No tooltip needed - immediate drag mode
    setScrubSpeedMode('normal');
    setScrubViewPosition(currentPosition); // Initialize scrub view position
    timelineHaptics.triggerModeChange('enter');
    timelineHaptics.resetTracking();
    lastScrubPosition.current = currentPosition;
    // Tell audioService we're scrubbing - enables skipNextSmartRewind to prevent
    // position jump on play after scrubbing while paused
    audioService.setScrubbing(true);
  }, [timelineHaptics]);

  // Exit direct scrub mode
  const exitDirectScrub = useCallback(async (finalSeconds: number) => {
    setIsDirectScrubbing(false);
    setShowScrubTooltip(false);
    setScrubSpeedMode('normal');
    setScrubViewPosition(finalSeconds); // Update to final position

    // Check for snap-to-chapter
    const { position: snapPosition, didSnap } = calculateSnapPosition(finalSeconds);

    if (didSnap) {
      timelineHaptics.triggerSnap();
    }

    timelineHaptics.triggerModeChange('exit');
    // End scrubbing mode BEFORE seeking - this clears pending track switches
    // and prepares for the final seek
    audioService.setScrubbing(false);

    handleSeek(snapPosition);

    // Resume playback if we were playing before scrubbing
    if (wasPlayingBeforeScrub.current) {
      // Small delay to let seek complete before resuming
      setTimeout(() => {
        usePlayerStore.getState().play();
      }, 150);
    }
  }, [handleSeek, timelineHaptics, calculateSnapPosition]);

  // Check haptics during scrub
  const checkScrubHaptics = useCallback((newPositionSec: number) => {
    timelineHaptics.checkChapterCrossing(lastScrubPosition.current, newPositionSec, hapticChapters);
    timelineHaptics.checkMinuteCrossing(lastScrubPosition.current, newPositionSec);
    timelineHaptics.checkEdgeReached(newPositionSec, duration);
    lastScrubPosition.current = newPositionSec;
  }, [hapticChapters, duration, timelineHaptics]);

  // Hide tooltip when dragging starts
  const hideScrubTooltip = useCallback(() => {
    setShowScrubTooltip(false);
  }, []);

  // Throttled update of scrub view position (for tick windowing)
  const updateScrubViewPosition = useCallback((newSeconds: number) => {
    const now = Date.now();
    // Only update every 200ms to avoid excessive re-renders
    if (now - lastScrubViewUpdate.current > 200) {
      lastScrubViewUpdate.current = now;
      setScrubViewPosition(newSeconds);
    }
  }, []);

  // FPS monitoring during scrubbing
  useEffect(() => {
    if (isDirectScrubbing) {
      fpsMonitor.start('scrubbing');
    } else {
      fpsMonitor.stop();
    }
  }, [isDirectScrubbing]);

  // Tap-to-seek disabled - only drag scrubbing is allowed
  // This prevents accidental position jumps when touching the timeline

  // Pan gesture for direct scrubbing (immediate - no long-press required)
  const scrubPanGesture = Gesture.Pan()
    .minDistance(10) // Small threshold to distinguish from accidental touches
    .onStart((event) => {
      'worklet';
      // Store starting values
      scrubStartOffset.value = timelineOffset.value;
      scrubStartX.value = event.x;
      scrubStartY.value = event.y;
      edgeScrollAccumulator.value = 0;

      // Calculate starting position in seconds
      const startSeconds = (-timelineOffset.value + CHAPTER_MARKER_X) / PIXELS_PER_SECOND;
      scrubCurrentPosition.value = startSeconds;

      runOnJS(enterDirectScrub)();
    })
    .onUpdate((event) => {
      'worklet';
      const dx = event.x - scrubStartX.value;
      const dy = event.y - scrubStartY.value;
      const absX = event.absoluteX;

      // Hide tooltip once dragging starts (movement > 5px)
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        runOnJS(hideScrubTooltip)();
      }

      // Calculate sensitivity based on vertical offset (fine-scrub) - inline for worklet
      let multiplier = 1.0;
      let mode: 'normal' | 'half' | 'quarter' | 'fine' | 'fast' = 'normal';
      if (dy > 120) {
        multiplier = 0.1;
        mode = 'fine';
      } else if (dy > 80) {
        multiplier = 0.25;
        mode = 'quarter';
      } else if (dy > 40) {
        multiplier = 0.5;
        mode = 'half';
      } else if (dy < -40) {
        multiplier = 2.0;
        mode = 'fast';
      }

      // Update speed mode display
      runOnJS(setScrubSpeedMode)(mode);

      // Edge auto-scroll: accumulate when finger is near edge
      // Uses exponential curve for smooth acceleration
      const EDGE_SCROLL_MAX_SPEED = 20;
      if (absX < EDGE_ZONE) {
        // Left edge - scroll backward (increase offset = earlier time)
        const edgeDepth = (EDGE_ZONE - absX) / EDGE_ZONE; // 0 to 1
        // Exponential curve: slow at start, fast at edge
        const easedDepth = edgeDepth * edgeDepth * edgeDepth; // cubic easing
        edgeScrollAccumulator.value += EDGE_SCROLL_MAX_SPEED * easedDepth;
      } else if (absX > screenWidth - EDGE_ZONE) {
        // Right edge - scroll forward (decrease offset = later time)
        const edgeDepth = (absX - (screenWidth - EDGE_ZONE)) / EDGE_ZONE; // 0 to 1
        // Exponential curve: slow at start, fast at edge
        const easedDepth = edgeDepth * edgeDepth * edgeDepth; // cubic easing
        edgeScrollAccumulator.value -= EDGE_SCROLL_MAX_SPEED * easedDepth;
      }

      // Direct 1:1 mapping with sensitivity adjustment + edge scroll
      const adjustedDx = dx * multiplier;
      const newOffset = scrubStartOffset.value - adjustedDx + edgeScrollAccumulator.value;

      // Clamp to valid range
      const minOffset = -timelineWidth + CHAPTER_MARKER_X;
      const maxOffset = CHAPTER_MARKER_X;
      timelineOffset.value = Math.max(minOffset, Math.min(maxOffset, newOffset));

      // Calculate new position in seconds for haptics
      const newSeconds = (-timelineOffset.value + CHAPTER_MARKER_X) / PIXELS_PER_SECOND;
      scrubCurrentPosition.value = newSeconds;

      // Check for haptic feedback (chapter/minute crossings)
      runOnJS(checkScrubHaptics)(newSeconds);

      // Update view position for tick windowing (throttled)
      runOnJS(updateScrubViewPosition)(newSeconds);
    })
    .onEnd(() => {
      'worklet';
      // Reset edge scroll accumulator
      edgeScrollAccumulator.value = 0;

      // Calculate final position
      const finalSeconds = scrubCurrentPosition.value;
      const clampedSeconds = Math.max(0, Math.min(duration, finalSeconds));

      runOnJS(exitDirectScrub)(clampedSeconds);
    });

  // Single gesture: just pan for scrubbing (tap-to-seek disabled)
  const combinedGesture = scrubPanGesture;

  // Animated style for scrolling timeline
  const timelineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: timelineOffset.value },
    ],
  }));

  // Effective position for tick windowing (use scrub position when scrubbing)
  const effectivePosition = isDirectScrubbing ? scrubViewPosition : position;

  // Window size: 60 minutes each direction (120 min total)
  const VISIBLE_WINDOW_SECONDS = 60 * 60;

  // Get visible ticks from cache (fast - just filtering)
  const ticks = useMemo(() => {
    if (!cachedTicks) return [];
    return getVisibleTicks(cachedTicks, effectivePosition, VISIBLE_WINDOW_SECONDS);
  }, [cachedTicks, effectivePosition]);

  // SVG viewport - use a reasonable fixed size to avoid "bitmap too large" crash on Android
  // The parent view handles scrolling via translateX, so SVG just needs to be large enough
  // for the visible content. We use 2x the visible window to ensure smooth scrolling.
  const SVG_VIEWPORT_SECONDS = VISIBLE_WINDOW_SECONDS * 2; // 2 hours worth
  const svgViewportWidth = SVG_VIEWPORT_SECONDS * PIXELS_PER_SECOND;
  // Calculate offset: where the viewport starts in absolute time
  const viewportStartTime = Math.max(0, effectivePosition - SVG_VIEWPORT_SECONDS / 2);

  const svgHeight = CHAPTER_TICKS_AREA_HEIGHT;
  const ticksY = CHAPTER_LABEL_Y + scale(4);

  const getTickHeight = (tier: 'chapter' | 'tenMin' | 'oneMin' | 'fifteenSec') => {
    switch (tier) {
      case 'chapter': return CHAPTER_TICK_HEIGHT;
      case 'tenMin': return TEN_MIN_TICK_HEIGHT;
      case 'oneMin': return ONE_MIN_TICK_HEIGHT;
      case 'fifteenSec': return FIFTEEN_SEC_TICK_HEIGHT;
    }
  };

  // Bookmark flag dimensions for chapter view - stem reaches full height
  const CHAPTER_FLAG_PENNANT_WIDTH = scale(24);  // Width of the flag part
  const CHAPTER_FLAG_PENNANT_HEIGHT = scale(12); // Height of the flag part
  const CHAPTER_FLAG_POLE_WIDTH = 2;
  const CHAPTER_FLAG_COLOR = '#0146F5';          // Solid blue for flag
  const CHAPTER_STEM_COLOR = '#64B5F6';          // Light blue for stem

  // Calculate bookmark positions within visible window (relative to viewport start)
  const visibleBookmarks = useMemo(() => {
    if (!bookmarks.length) return [];
    const minTime = Math.max(0, effectivePosition - VISIBLE_WINDOW_SECONDS);
    const maxTime = Math.min(duration, effectivePosition + VISIBLE_WINDOW_SECONDS);

    return bookmarks
      .filter((bm) => {
        const time = Math.round(bm.time);
        return time >= minTime && time <= maxTime;
      })
      .map((bm) => ({
        id: bm.id,
        // Position relative to viewport start, not absolute
        x: (Math.round(bm.time) - viewportStartTime) * PIXELS_PER_SECOND,
      }));
  }, [bookmarks, effectivePosition, duration, viewportStartTime]);

  return (
    <View style={chapterTimelineStyles.outerContainer}>
      {/* Marker line - positioned at bottom, extends up */}
      <View style={chapterTimelineStyles.markerLine} />
      <View style={chapterTimelineStyles.markerDot} />

      {/* "DRAG TO SCRUB" tooltip (shown when long-press activates, hidden when dragging) */}
      {showScrubTooltip && (
        <View style={chapterTimelineStyles.scrubTooltip}>
          <Text style={chapterTimelineStyles.scrubTooltipText}>DRAG TO SCRUB</Text>
        </View>
      )}

      {/* Speed mode indicator (shown during direct scrub when not normal speed) */}
      {isDirectScrubbing && !showScrubTooltip && scrubSpeedMode !== 'normal' && (
        <View style={chapterTimelineStyles.speedIndicator}>
          <Text style={chapterTimelineStyles.speedIndicatorText}>
            {SPEED_MODE_LABELS[scrubSpeedMode]}
          </Text>
        </View>
      )}

      {/* Scrolling timeline area */}
      <GestureDetector gesture={combinedGesture}>
        <View style={chapterTimelineStyles.container}>
          <ReanimatedAnimated.View style={[chapterTimelineStyles.timeline, { width: timelineWidth }, timelineStyle]}>
            {/* SVG viewport wrapper - positioned at viewport start within the full timeline
                This avoids "bitmap too large" crash on Android by using a smaller SVG canvas
                positioned at the correct offset instead of a single massive canvas */}
            <View style={{ position: 'absolute', left: viewportStartTime * PIXELS_PER_SECOND }}>
              <Svg width={svgViewportWidth} height={svgHeight}>
              {/* Ticks - four tiers */}
              {/* tick.time is in seconds, convert to pixels relative to viewport start */}
              {ticks.map((tick, index) => {
                // Position relative to viewport start to fit within capped SVG width
                const tickX = (tick.time - viewportStartTime) * PIXELS_PER_SECOND;
                const tickHeight = getTickHeight(tick.tier);
                const tickY = ticksY + CHAPTER_TICK_HEIGHT - tickHeight;
                const isChapter = tick.tier === 'chapter';
                const hasMinuteLabel = tick.tier === 'oneMin' || tick.tier === 'tenMin';
                return (
                  <React.Fragment key={index}>
                    <Line
                      x1={tickX}
                      y1={tickY}
                      x2={tickX}
                      y2={ticksY + CHAPTER_TICK_HEIGHT}
                      stroke={themeColors.tickDefault}
                      strokeWidth={isChapter ? 2.5 : 1}
                    />
                    {tick.label && isChapter && (
                      <SvgText
                        x={tickX}
                        y={CHAPTER_LABEL_Y}
                        fontSize={scale(11)}
                        fill={themeColors.textPrimary}
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {tick.label.length > 20 ? tick.label.slice(0, 18) + '…' : tick.label}
                      </SvgText>
                    )}
                    {tick.label && hasMinuteLabel && (
                      <SvgText
                        x={tickX}
                        y={tickY - scale(6)}
                        fontSize={scale(10)}
                        fill={themeColors.textSecondary}
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {tick.label}
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Bookmark flags - rendered within the scrolling SVG */}
              {visibleBookmarks.map((bm) => (
                <React.Fragment key={`bookmark-${bm.id}`}>
                  {/* Stem - full height like red center line */}
                  <Line
                    x1={bm.x}
                    y1={0}
                    x2={bm.x}
                    y2={svgHeight}
                    stroke={CHAPTER_STEM_COLOR}
                    strokeWidth={CHAPTER_FLAG_POLE_WIDTH}
                  />
                  {/* Flag - notched pennant shape (based on Flag.svg) */}
                  <Path
                    d={`M${bm.x} 0 H${bm.x + CHAPTER_FLAG_PENNANT_WIDTH} L${bm.x + CHAPTER_FLAG_PENNANT_WIDTH * 0.78} ${CHAPTER_FLAG_PENNANT_HEIGHT / 2} L${bm.x + CHAPTER_FLAG_PENNANT_WIDTH} ${CHAPTER_FLAG_PENNANT_HEIGHT} H${bm.x} Z`}
                    fill={CHAPTER_FLAG_COLOR}
                  />
                </React.Fragment>
              ))}
              </Svg>
            </View>
          </ReanimatedAnimated.View>
        </View>
      </GestureDetector>
    </View>
  );
});

const chapterTimelineStyles = StyleSheet.create({
  outerContainer: {
    width: TIMELINE_WIDTH,
    height: CHAPTER_TIMELINE_TOTAL_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    position: 'absolute',
    top: scale(115), // Moved down ~115px to position over timeline ticks
    left: CHAPTER_MARKER_X - CHAPTER_MARKER_CIRCLE_SIZE / 2,
    alignItems: 'center',
    zIndex: 10,
  },
  markerCircle: {
    width: CHAPTER_MARKER_CIRCLE_SIZE,
    height: CHAPTER_MARKER_CIRCLE_SIZE,
    borderRadius: CHAPTER_MARKER_CIRCLE_SIZE / 2,
    backgroundColor: '#F50101',
  },
  markerLine: {
    position: 'absolute',
    bottom: 0, // Anchored at bottom of timeline
    left: CHAPTER_MARKER_X - 1, // Center horizontally (line is 2px wide)
    width: 2,
    height: CHAPTER_TICKS_AREA_HEIGHT, // Extend up through ticks area
    backgroundColor: '#F50101',
    zIndex: 5,
  },
  markerDot: {
    position: 'absolute',
    bottom: CHAPTER_TICKS_AREA_HEIGHT - 3, // At top of line, centered
    left: CHAPTER_MARKER_X - 3, // Center the 6px dot
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F50101',
    zIndex: 6,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    width: TIMELINE_WIDTH,
    height: CHAPTER_TICKS_AREA_HEIGHT,
    overflow: 'hidden',
  },
  timeline: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
  },
  speedIndicator: {
    position: 'absolute',
    top: scale(40),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(8),
    zIndex: 20,
  },
  speedIndicatorText: {
    color: '#FFFFFF',
    fontSize: scale(13),
    fontWeight: '600',
    textAlign: 'center',
  },
  scrubTooltip: {
    position: 'absolute',
    top: scale(40),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(8),
    zIndex: 20,
  },
  scrubTooltipText: {
    color: '#FFFFFF',
    fontSize: scale(13),
    fontWeight: '600',
    textAlign: 'center',
  },
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CDPlayerScreen() {
  useScreenLoadTime('CDPlayerScreen');

  // Performance tracking (dev only)
  if (__DEV__) {
    useRenderTracker('CDPlayerScreen');
    useLifecycleTracker('CDPlayerScreen');
  }

  // FPS monitoring for the full player screen
  useFpsMonitor('fullPlayer');

  const insets = useSafeAreaInsets();

  // Memoize insets-based styles to avoid inline object recreation
  const safeAreaStyles = useMemo(() => ({
    topSpacer: { height: insets.top },
    bottomSpacer: { height: insets.bottom },
  }), [insets.top, insets.bottom]);

  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const wasVisibleRef = useRef(false); // Track previous visibility to prevent stutter

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
    bookmarks,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlayerVisible: s.isPlayerVisible,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      bookmarks: s.bookmarks,
      // NOTE: position removed - causes excessive re-renders (2x/sec)
      // Use usePlaybackPosition() hook below for position-dependent UI
      duration: s.duration,
      playbackRate: s.playbackRate,
      // NOTE: sleepTimer moved to separate subscription below to reduce re-renders
      chapters: s.chapters,
    }))
  );

  // Sleep timer - separate subscription with coarse granularity
  // Only re-render when displayed value changes (every ~10 seconds or minute boundary)
  const sleepTimer = usePlayerStore((s) => {
    if (!s.sleepTimer) return null;
    // For timers > 5 minutes, round to nearest minute to reduce re-renders
    if (s.sleepTimer > 300) return Math.ceil(s.sleepTimer / 60) * 60;
    // For timers <= 5 minutes, round to nearest 10 seconds for countdown display
    return Math.ceil(s.sleepTimer / 10) * 10;
  });

  // Position-dependent state - optimized to only trigger re-render on whole-second changes
  // This dramatically reduces re-renders from ~2/sec to ~1/sec during playback
  const position = usePlayerStore(
    (s) => Math.floor(s.isSeeking ? s.seekPosition : s.position),
    (a, b) => a === b // Strict equality - only re-render when floored value changes
  );

  // Formatted position string - recalculates only when position changes (already floored)
  const formattedPosition = useMemo(
    () => formatTimeHHMMSS(position),
    [position]
  );
  const formattedDuration = useMemo(
    () => formatTimeHHMMSS(duration),
    [duration]
  );

  // Actions - batched into single subscription for efficiency
  const {
    closePlayer,
    play,
    pause,
    setPlaybackRate,
    setSleepTimer,
    clearSleepTimer,
    seekTo,
    nextChapter,
    prevChapter,
    addBookmark,
  } = usePlayerStore(
    useShallow((s) => ({
      closePlayer: s.closePlayer,
      play: s.play,
      pause: s.pause,
      setPlaybackRate: s.setPlaybackRate,
      setSleepTimer: s.setSleepTimer,
      clearSleepTimer: s.clearSleepTimer,
      seekTo: s.seekTo,
      nextChapter: s.nextChapter,
      prevChapter: s.prevChapter,
      addBookmark: s.addBookmark,
    }))
  );

  // Skip interval settings (separate - have default value logic)
  const skipForwardInterval = usePlayerStore((s) => s.skipForwardInterval ?? 30);
  const skipBackInterval = usePlayerStore((s) => s.skipBackInterval ?? 15);

  // NOTE: sleepTimerState hook removed - was unused and could cause re-renders during countdown
  // sleepTimer is already available from the main useShallow selector above

  const chapterIndex = useCurrentChapterIndex();
  // NOTE: bookProgress removed - was unused and caused extra re-renders on every position tick
  const coverUrl = useCoverUrl(currentBook?.id || '');
  const { isAvailable: isDownloaded } = useIsOfflineAvailable(currentBook?.id || '');
  const { queueDownload } = useDownloads();
  const { isDownloading, progress: downloadProgress } = useDownloadStatus(currentBook?.id || '');
  const queueCount = useQueueCount();
  const clearQueue = useQueueStore((s) => s.clearQueue);
  const { showError } = useToast();

  // Handle starting download for current book
  const handleStartDownload = useCallback(async () => {
    if (!currentBook || isDownloaded) return;
    try {
      await queueDownload(currentBook);
      haptics.success();
    } catch (err) {
      logger.warn('[CDPlayerScreen] Failed to start download:', err);
      showError('Failed to start download. Please try again.');
    }
  }, [currentBook, isDownloaded, queueDownload]);

  // Accessibility: respect reduced motion preference
  const reducedMotion = useReducedMotion();

  // Theme colors
  const themeColors = usePlayerColors();
  const isDarkMode = useThemeStore((s) => s.mode === 'dark');

  // Local state
  const [activeSheet, setActiveSheet] = useState<SheetType>('none');
  const [progressMode, setProgressMode] = useState<ProgressMode>('chapter');

  // Deferred initialization - wait for navigation animation to complete
  // This improves perceived performance by not blocking the initial render
  const [interactionsReady, setInteractionsReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setInteractionsReady(true);
    });
    return () => handle.cancel();
  }, []);

  // Book metadata
  const metadata = currentBook?.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const description = metadata?.description || '';
  // Narrator: try narratorName, then narrators array
  const narrator = metadata?.narratorName ||
    (metadata?.narrators?.length > 0
      ? metadata.narrators.map((n: any) => typeof n === 'string' ? n : n.name).filter(Boolean).join(', ')
      : '');
  const currentChapter = chapters[chapterIndex];

  // Get normalized chapter names based on user settings
  const normalizedChapters = useNormalizedChapters(chapters, { bookTitle: title });
  const currentNormalizedChapter = normalizedChapters[chapterIndex];

  // Chapters with display titles for timeline
  const timelineChapters: TimelineChapter[] = useMemo(() => {
    return chapters.map((ch, index) => ({
      start: ch.start,
      end: ch.end,
      displayTitle: normalizedChapters[index]?.displayTitle,
    }));
  }, [chapters, normalizedChapters]);

  // Format sleep timer display - live countdown with seconds
  const formatSleepTimer = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return 'Off';

    // For timers > 1 hour, show hours and minutes
    if (seconds >= 3600) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }

    // For timers > 5 minutes, show minutes and seconds
    if (seconds >= 300) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // For timers <= 5 minutes, show live countdown MM:SS
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  
  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Use capture phase to grab gestures before children
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Only capture if swiping down significantly and mostly vertical
        return gestureState.dy > 30 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 30 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const screenHeight = Dimensions.get('window').height;
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Animate slide out then close
          Animated.timing(slideAnim, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            closePlayer();
            slideAnim.setValue(0);
          });
        } else {
          // Snap back with spring
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Instant open - no animation
  React.useEffect(() => {
    if (isPlayerVisible && currentBook) {
      if (!wasVisibleRef.current) {
        slideAnim.setValue(0);
      }
      wasVisibleRef.current = true;
    } else {
      wasVisibleRef.current = false;
    }
  }, [isPlayerVisible, currentBook?.id]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleClose = useCallback(() => {
    setActiveSheet('none');
    closePlayer();
  }, [closePlayer]);

  // Sheet navigation callbacks - stable references to avoid inline function recreation
  const closeSheet = useCallback(() => setActiveSheet('none'), []);
  const openChapters = useCallback(() => setActiveSheet('chapters'), []);
  const openSettings = useCallback(() => setActiveSheet('settings'), []);
  const openQueue = useCallback(() => setActiveSheet('queue'), []);
  const openBookmarks = useCallback(() => setActiveSheet('bookmarks'), []);

  // Android hardware back button support
  useEffect(() => {
    if (!isPlayerVisible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If a sheet is open, close it first
      if (activeSheet !== 'none') {
        setActiveSheet('none');
        return true;
      }
      // Otherwise close the player
      handleClose();
      return true;
    });

    return () => backHandler.remove();
  }, [isPlayerVisible, activeSheet, handleClose]);

  // Navigate to book details
  const handleTitlePress = useCallback(() => {
    if (!currentBook) return;
    haptics.selection();
    handleClose();
    navigation.navigate('BookDetail', { id: currentBook.id });
  }, [currentBook, handleClose, navigation]);

  // Chapter select
  const handleChapterSelect = useCallback((chapterStart: number) => {
    haptics.selection();
    seekTo?.(chapterStart);
    setActiveSheet('none');
  }, [seekTo]);

  // Skip backward using configured interval
  // NOTE: Uses getState() to avoid callback recreation on position updates
  const handleSkipBack = useCallback(() => {
    haptics.skip();  // Use category-specific haptic for playback controls
    const currentPos = usePlayerStore.getState().position;
    const newPosition = Math.max(0, currentPos - skipBackInterval);
    seekTo?.(newPosition);
  }, [skipBackInterval, seekTo]);

  // Skip forward using configured interval
  // NOTE: Uses getState() to avoid callback recreation on position updates
  const handleSkipForward = useCallback(() => {
    haptics.skip();  // Use category-specific haptic for playback controls
    const state = usePlayerStore.getState();
    const newPosition = Math.min(state.duration, state.position + skipForwardInterval);
    seekTo?.(newPosition);
  }, [skipForwardInterval, seekTo]);

  // Long-press: Skip to previous chapter
  const handlePrevChapter = useCallback(() => {
    haptics.chapterChange();  // Use chapter-specific haptic
    prevChapter?.();
  }, [prevChapter]);

  // Long-press: Skip to next chapter
  const handleNextChapter = useCallback(() => {
    haptics.chapterChange();  // Use chapter-specific haptic
    nextChapter?.();
  }, [nextChapter]);

  // Play/pause toggle
  // NOTE: Uses getState() to avoid callback recreation on position/isPlaying updates
  const handlePlayPause = useCallback(() => {
    const { isPlaying: playing } = usePlayerStore.getState();
    if (playing) {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  // ==========================================================================
  // CONTINUOUS SEEKING (hold to scrub) - extracted to hook
  // ==========================================================================
  const {
    handleRewindPressIn,
    handleFastForwardPressIn,
    handleSeekPressOut,
    handleSkipBackWithCheck,
    handleSkipForwardWithCheck,
  } = useContinuousSeeking({
    seekTo,
    handleSkipBack,
    handleSkipForward,
  });

  // ==========================================================================
  // BOOKMARK ACTIONS - extracted to hook
  // ==========================================================================
  const {
    showBookmarkPill,
    bookmarkPillAnim,
    showNoteInput,
    noteInputValue,
    editingBookmarkId,
    setNoteInputValue,
    setShowNoteInput,
    setEditingBookmarkId,
    deletedBookmark,
    handleAddBookmark,
    handleAddNoteFromPill,
    handleSaveNote,
    handleDeleteBookmark,
    handleUndoDelete,
  } = useBookmarkActions({
    chapters,
    chapterIndex,
    bookmarks,
    addBookmark,
  });

  // ==========================================================================
  // MAIN RENDER
  // (Sheets extracted to components/sheets/)
  // ==========================================================================

  if (!isPlayerVisible || !currentBook) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: themeColors.background,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle={themeColors.statusBar} />

      {/* Background blur layer */}
      <View style={styles.backgroundContainer}>
        {coverUrl && (
          <Image
            source={coverUrl}
            style={StyleSheet.absoluteFill}
            blurRadius={25}
            contentFit="cover"
          />
        )}
        {/* BlurView for Android (blurRadius only works on iOS) */}
        <BlurView
          intensity={25}
          tint={isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* Gradient feathers to background color */}
        <LinearGradient
          colors={isDarkMode
            ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,1)']
            : ['rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', '#FFFFFF']}
          locations={[0, 0.2, 0.3, 0.45]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Header spacer for safe area */}
      <View style={safeAreaStyles.topSpacer} />

      {/* Buffering indicator - only show when streaming (not for downloaded files) */}
      {isBuffering && !isDownloaded && (
        <View style={[styles.bufferingBadgeContainer, { top: scale(200) }]}>
          <View style={styles.bufferingBadge}>
            <Hourglass size={scale(10)} color="#FFF" strokeWidth={2} />
            <Text style={styles.bufferingBadgeText}>Buffering...</Text>
          </View>
        </View>
      )}


      {/* Content area */}
      <View style={[styles.contentArea, { marginTop: scale(-60) }]}>
        {/* Overview Section - hidden for now */}
        {false && description ? (
          <View style={styles.overviewSection}>
            <Text style={styles.overviewTitle}>Overview</Text>
            <View style={styles.overviewDivider} />
            <Text style={styles.overviewText} numberOfLines={5}>
              {description}
            </Text>
          </View>
        ) : null}

        {/* Cover at top */}
        <View style={styles.standardCoverContainerFull}>
            {coverUrl ? (
              <Image
                source={coverUrl}
                style={styles.standardCoverFull}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.standardCoverFull, { backgroundColor: '#333' }]} />
            )}
            {/* Speed badge when not 1.0x */}
            {playbackRate !== 1 && (
              <View style={styles.speedBadgeStandard}>
                <Text style={styles.speedBadgeOnDiscText}>{playbackRate}x</Text>
              </View>
            )}

            {/* Top-left: Source indicator (downloaded/downloading/streaming) */}
            {isDownloaded ? (
              <View style={styles.coverOverlayTopLeft}>
                <Check size={scale(24)} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            ) : isDownloading ? (
              <View style={styles.coverOverlayTopLeft}>
                <CircularProgress progress={downloadProgress} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.coverOverlayTopLeft}
                onPress={handleStartDownload}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Download for offline"
              >
                <View style={styles.downloadCircleFilled}>
                  <Download size={scale(18)} color="#000000" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            )}

            {/* Top-center: Down arrow (close) - white stroke with shadow */}
            <TouchableOpacity
              style={styles.coverOverlayTopCenter}
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close player"
            >
              <View style={styles.coverOverlayArrowShadow}>
                <DownArrowIcon color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Top-right: Settings */}
            <TouchableOpacity
              style={styles.coverOverlayTopRight}
              onPress={openSettings}
              activeOpacity={0.7}
            >
              <SettingsIconCircle color="#FFFFFF" />
            </TouchableOpacity>

            {/* Bottom overlay buttons - Queue (left) and Bookmark (right) */}
            <View style={styles.coverOverlayButtons}>
              <TouchableOpacity
                onPress={openQueue}
                style={styles.coverOverlayButton}
                activeOpacity={0.7}
                accessibilityLabel={queueCount > 0 ? `Queue with ${queueCount} items` : 'Queue empty'}
                accessibilityRole="button"
              >
                <Layers size={scale(18)} color="#000000" strokeWidth={2} />
                {queueCount > 0 && (
                  <View style={styles.coverButtonBadge}>
                    <Text style={styles.coverButtonBadgeText}>{queueCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddBookmark}
                style={styles.coverOverlayButton}
                activeOpacity={0.7}
                accessibilityLabel="Add bookmark"
                accessibilityRole="button"
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: bookmarkPillAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [1, 1.2, 1],
                        }),
                      },
                    ],
                  }}
                >
                  {showBookmarkPill ? (
                    <Check size={scale(18)} color="#22C55E" strokeWidth={2.5} />
                  ) : (
                    <Bookmark size={scale(18)} color="#000000" strokeWidth={2} />
                  )}
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

        {/* Title and metadata */}
          <View style={styles.standardTitleSection}>
            <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
              <Text
                style={[styles.standardTitle, { color: themeColors.textPrimary }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {title}
              </Text>
            </TouchableOpacity>
            <View style={styles.standardMetaRow}>
              <View style={styles.standardMetaCell}>
                <Text style={[styles.standardMetaLabel, { color: themeColors.textTertiary }]}>Written By</Text>
                <TouchableOpacity
                  onPress={() => {
                    const authors = author.split(',').map(a => a.trim()).filter(Boolean);
                    const navigateToAuthor = (authorName: string) => {
                      handleClose();
                      setTimeout(() => {
                        (navigation as any).navigate('AuthorDetail', { authorName });
                      }, 100);
                    };
                    if (authors.length === 1) {
                      navigateToAuthor(authors[0]);
                    } else if (authors.length > 1) {
                      if (Platform.OS === 'ios') {
                        ActionSheetIOS.showActionSheetWithOptions(
                          {
                            options: ['Cancel', ...authors],
                            cancelButtonIndex: 0,
                            title: 'Select Author',
                          },
                          (buttonIndex) => {
                            if (buttonIndex > 0) {
                              navigateToAuthor(authors[buttonIndex - 1]);
                            }
                          }
                        );
                      } else {
                        Alert.alert(
                          'Select Author',
                          undefined,
                          [
                            ...authors.map(a => ({
                              text: a,
                              onPress: () => navigateToAuthor(a),
                            })),
                            { text: 'Cancel', style: 'cancel' as const },
                          ]
                        );
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.standardMetaValue, { color: themeColors.textSecondary }]} numberOfLines={2}>{author}</Text>
                </TouchableOpacity>
              </View>
              {narrator ? (
                <View style={styles.standardMetaCell}>
                  <Text style={[styles.standardMetaLabel, { color: themeColors.textTertiary }]}>Narrated By</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const narrators = narrator.split(',').map(n => n.trim()).filter(Boolean);
                      const navigateToNarrator = (narratorName: string) => {
                        handleClose();
                        setTimeout(() => {
                          (navigation as any).navigate('NarratorDetail', { narratorName });
                        }, 100);
                      };
                      if (narrators.length === 1) {
                        navigateToNarrator(narrators[0]);
                      } else if (narrators.length > 1) {
                        if (Platform.OS === 'ios') {
                          ActionSheetIOS.showActionSheetWithOptions(
                            {
                              options: ['Cancel', ...narrators],
                              cancelButtonIndex: 0,
                              title: 'Select Narrator',
                            },
                            (buttonIndex) => {
                              if (buttonIndex > 0) {
                                navigateToNarrator(narrators[buttonIndex - 1]);
                              }
                            }
                          );
                        } else {
                          Alert.alert(
                            'Select Narrator',
                            undefined,
                            [
                              ...narrators.map(n => ({
                                text: n,
                                onPress: () => navigateToNarrator(n),
                              })),
                              { text: 'Cancel', style: 'cancel' as const },
                            ]
                          );
                        }
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.standardMetaValue, { color: themeColors.textSecondary }]} numberOfLines={2}>{narrator}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>

        {/* Chapter title & time */}
        <View style={styles.standardChapterRowTop}>
          <TouchableOpacity onPress={openChapters} style={styles.standardChapterTouch}>
            <Text style={[styles.standardChapterTextTop, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {currentNormalizedChapter?.displayTitle || `Chapter ${chapterIndex + 1}`}
            </Text>
          </TouchableOpacity>
          <Text style={styles.standardChapterTimeTop}>
            {formattedPosition} / {formattedDuration}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressWrapper, styles.progressWrapperStandard, { bottom: insets.bottom + scale(88) }]}>
          {progressMode === 'book' ? (
            // Book mode: Full timeline with chapter-normalized segments
            <TimelineProgressBar
              key={`timeline-book-${chapters.length}`}
              position={position}
              duration={duration}
              chapters={chapters}
              onSeek={seekTo}
              bookmarks={bookmarks}
            />
          ) : (
            // Chapter mode: Scrolling timeline with long-press + pan scrubbing
            <ChapterTimelineProgressBar
              key={`timeline-chapter-${chapters.length}`}
              position={position}
              duration={duration}
              chapters={timelineChapters}
              onSeek={seekTo}
              bookmarks={bookmarks}
              libraryItemId={currentBook?.id}
            />
          )}
        </View>

        {/* Player Controls - at bottom */}
        <View style={[styles.standardControlsBar, { backgroundColor: themeColors.buttonBackground, bottom: insets.bottom }]}>
            {/* Skip Back - tap to skip, hold to scrub */}
            <TouchableOpacity
              style={styles.standardControlButton}
              onPress={handleSkipBackWithCheck}
              onPressIn={handleRewindPressIn}
              onPressOut={handleSeekPressOut}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityLabel={`Skip back ${skipBackInterval} seconds, hold to scrub`}
              accessibilityRole="button"
            >
              <RewindIcon color={themeColors.buttonText} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.standardControlDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />

            {/* Play/Pause - or Sleep Timer when active */}
            <TouchableOpacity
              style={styles.standardControlButton}
              onPress={handlePlayPause}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              accessibilityRole="button"
            >
              {sleepTimer ? (
                <View style={styles.sleepTimerControl}>
                  {/* Small play/pause icon */}
                  {isPlaying ? (
                    <Svg width={scale(14)} height={scale(14)} viewBox="0 0 24 24" fill="none">
                      <Rect x="6" y="5" width="4" height="14" fill="#E53935" />
                      <Rect x="14" y="5" width="4" height="14" fill="#E53935" />
                    </Svg>
                  ) : (
                    <Svg width={scale(14)} height={scale(14)} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M8 5.14v13.72a1 1 0 001.5.86l10.14-6.86a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
                        fill="#E53935"
                      />
                    </Svg>
                  )}
                  {/* Time remaining in red bold - live seconds countdown */}
                  <Text style={styles.sleepTimerText}>
                    {formatSleepCountdown(sleepTimer)}
                  </Text>
                </View>
              ) : isPlaying ? (
                <Svg width={scale(28)} height={scale(28)} viewBox="0 0 24 24" fill="none">
                  <Rect x="6" y="5" width="4" height="14" fill="#E53935" />
                  <Rect x="14" y="5" width="4" height="14" fill="#E53935" />
                </Svg>
              ) : (
                <Svg width={scale(28)} height={scale(28)} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M8 5.14v13.72a1 1 0 001.5.86l10.14-6.86a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
                    fill="#E53935"
                  />
                </Svg>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.standardControlDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />

            {/* Skip Forward - tap to skip, hold to scrub */}
            <TouchableOpacity
              style={styles.standardControlButton}
              onPress={handleSkipForwardWithCheck}
              onPressIn={handleFastForwardPressIn}
              onPressOut={handleSeekPressOut}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityLabel={`Skip forward ${skipForwardInterval} seconds, hold to scrub`}
              accessibilityRole="button"
            >
              <FastForwardIcon color={themeColors.buttonText} />
            </TouchableOpacity>
          </View>

        {/* Bottom padding */}
        <View style={safeAreaStyles.bottomSpacer} />
      </View>

      {/* Inline Bottom Sheets (chapters, settings, queue, sleep, speed) */}
      {activeSheet !== 'none' && activeSheet !== 'speedPanel' && activeSheet !== 'sleepPanel' && (
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={closeSheet}
        >
          <View style={[styles.sheetContainer, { marginBottom: insets.bottom + scale(90) }]}>
            {activeSheet === 'chapters' && (
              <ChaptersSheet
                themeColors={themeColors}
                isDarkMode={isDarkMode}
                chapters={normalizedChapters}
                currentChapterIndex={chapterIndex}
                onChapterSelect={handleChapterSelect}
                onClose={closeSheet}
              />
            )}
            {activeSheet === 'settings' && (
              <SettingsSheet
                themeColors={themeColors}
                isDarkMode={isDarkMode}
                progressMode={progressMode}
                setProgressMode={setProgressMode}
                playbackRate={playbackRate}
                setPlaybackRate={setPlaybackRate}
                sleepTimer={sleepTimer}
                setSleepTimer={setSleepTimer}
                clearSleepTimer={clearSleepTimer}
                bookmarksCount={bookmarks.length}
                queueCount={queueCount}
                clearQueue={clearQueue}
                onOpenBookmarks={() => setActiveSheet('bookmarks')}
                onClose={closeSheet}
              />
            )}
            {activeSheet === 'queue' && (
              <QueuePanel
                onClose={() => setActiveSheet('none')}
                maxHeight={SCREEN_HEIGHT * 0.6}
              />
            )}
            {activeSheet === 'sleep' && (
              <SleepTimerSheet onClose={() => setActiveSheet('none')} />
            )}
            {activeSheet === 'speed' && (
              <SpeedSheet onClose={() => setActiveSheet('none')} />
            )}
            {activeSheet === 'bookmarks' && (
              <BookmarksSheet
                themeColors={themeColors}
                isDarkMode={isDarkMode}
                bookmarks={bookmarks}
                coverUrl={coverUrl}
                onGoBack={openSettings}
                onClose={closeSheet}
                onSeekTo={seekTo}
                onEditBookmark={(bookmark: BookmarkType) => {
                  setEditingBookmarkId(bookmark.id);
                  setNoteInputValue(bookmark.note || '');
                  setShowNoteInput(true);
                }}
                onDeleteBookmark={handleDeleteBookmark}
              />
            )}
          </View>
        </TouchableOpacity>
      )}


      {/* Bookmark Deleted Toast with Undo - Modernist white/black */}
      {deletedBookmark && (
        <View style={[styles.bookmarkToast, styles.bookmarkDeletedToast, { bottom: insets.bottom + scale(100) }]}>
          <Trash2 size={20} color="#000000" strokeWidth={2} />
          <Text style={styles.bookmarkToastText}>Bookmark deleted</Text>
          <TouchableOpacity onPress={handleUndoDelete}>
            <Text style={styles.bookmarkToastAction}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note Input Modal - Modernist white/black */}
      {showNoteInput && (
        <TouchableOpacity
          style={styles.noteInputOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            setShowNoteInput(false);
          }}
        >
          <View
            style={[styles.noteInputContainer, { paddingBottom: insets.bottom + scale(24) }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle bar */}
            <View style={styles.noteInputHandle} />

            <View style={styles.noteInputHeader}>
              <Text style={styles.noteInputTitle}>Add Note</Text>
              <TouchableOpacity
                onPress={() => setShowNoteInput(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color="#000000" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.noteInput}
              value={noteInputValue}
              onChangeText={setNoteInputValue}
              placeholder="What makes this moment special?"
              placeholderTextColor="#999999"
              multiline
              autoFocus
              maxLength={500}
            />
            <View style={styles.noteInputFooter}>
              <Text style={styles.noteCharCount}>{noteInputValue.length}/500</Text>
              <TouchableOpacity style={styles.noteInputSaveButton} onPress={handleSaveNote}>
                <Text style={styles.noteInputSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

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
    backgroundColor: colors.backgroundPrimary,
  },
  containerStandard: {
    backgroundColor: '#FFFFFF',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  topGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: hp(35), // Goes down to about halfway of cover
    zIndex: 5,
  },
  arrowCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  arrowButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8),
  },
  arrowButtonCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8),
  },
  headerSpacer: {
    width: scale(44),  // Same as settings button
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 0,
    zIndex: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: scale(22),
    marginBottom: scale(4),
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: scale(28),
  },
  sourceIconCircle: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIconCircleWhite: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIconCircleWhiteFilled: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Disc overlay positions for CD mode
  discOverlayTopLeft: {
    position: 'absolute',
    top: scale(16),
    left: scale(16),
    zIndex: 25, // Higher than center to ensure touch priority
  },
  discOverlayTopRight: {
    position: 'absolute',
    top: scale(16),
    right: scale(16),
    zIndex: 25, // Higher than center to ensure touch priority
  },
  discOverlayCenter: {
    position: 'absolute',
    top: scale(16),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  sourceText: {
    color: colors.textTertiary,
    fontSize: scale(11),
    fontWeight: '500',
  },
  sourceTextDownloaded: {
    color: colors.success,
  },
  settingsButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: scale(15),
    fontWeight: '500',
    textAlign: 'center',
  },
  author: {
    color: colors.textTertiary,
    fontSize: scale(14),
    fontWeight: '400',
    marginTop: scale(6),
    textAlign: 'center',
  },
  // Standard player mode styles (white background, dark text)
  titleStandard: {
    color: '#000',
  },
  authorStandard: {
    color: 'rgba(0,0,0,0.6)',
  },
  // Standard player - Book Detail style title/author (absolute positioning)
  standardTitleSection: {
    position: 'absolute',
    top: scale(448), // Below cover (100 + 320 + 10 padding)
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  standardTitle: {
    fontSize: scale(32),
    fontWeight: '700',
    color: '#000',
    marginBottom: scale(12),
    textAlign: 'center',
  },
  standardMetaRow: {
    flexDirection: 'row',
    gap: scale(20),
    width: '80%',
  },
  standardMetaCell: {
    flex: 1,
    alignItems: 'center',
  },
  standardMetaLabel: {
    fontSize: scale(12),
    fontWeight: '500',
    color: 'rgba(0,0,0,0.4)',
    textTransform: 'capitalize',
    marginBottom: scale(2),
    textAlign: 'center',
  },
  standardMetaValue: {
    fontSize: scale(14),
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  sourceTextStandard: {
    color: 'rgba(0,0,0,0.5)',
  },
  contentArea: {
    flex: 1,
    zIndex: 10,
    paddingTop: scale(10),
  },
  overviewSection: {
    paddingHorizontal: scale(22),
    marginBottom: scale(10),
  },
  overviewTitle: {
    color: colors.textPrimary,
    fontSize: scale(13),
    fontWeight: '400',
    letterSpacing: 0,
    marginBottom: scale(10),
  },
  overviewDivider: {
    height: 1,
    backgroundColor: colors.overlay.medium,
    borderRadius: scale(14),
    marginBottom: scale(5),
  },
  overviewText: {
    color: colors.textSecondary,
    fontSize: scale(12),
    lineHeight: scale(18),
    fontWeight: '400',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(22),
    marginTop: scale(6),
    marginBottom: scale(8),
  },
  infoRowCentered: {
    position: 'absolute',
    bottom: scale(20), // Above the marker dot
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  chapterCentered: {
    color: colors.textSecondary,
    fontSize: scale(14),
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: scale(4),
  },
  chapterTimeCentered: {
    color: colors.accent,
    fontSize: scale(18),
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    textAlign: 'center',
  },
  chapter: {
    color: colors.textSecondary,
    fontSize: scale(13),
    letterSpacing: 0.28,
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  time: {
    color: colors.textTertiary,
    fontSize: scale(13),
    letterSpacing: 0.28,
    fontVariant: ['tabular-nums'],
  },
  chapterRemaining: {
    color: colors.accent,
    fontSize: scale(14),
    letterSpacing: 0.28,
    fontVariant: ['tabular-nums'],
    fontWeight: '400',
  },
  // Standard player mode (white background) - dark text
  chapterStandard: {
    color: 'rgba(0,0,0,0.6)',
  },
  chapterRemainingStandard: {
    color: '#E53935', // Keep accent red for remaining time
  },
  progressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(6),
  },
  progressTimeText: {
    color: colors.textTertiary,
    fontSize: scale(9),
    letterSpacing: 0.18,
    fontVariant: ['tabular-nums'],
  },
  progressTimeTextStandard: {
    color: 'rgba(0,0,0,0.5)',
  },
  progressWrapper: {
    paddingHorizontal: scale(22),
    marginBottom: scale(4),
  },
  progressWrapperStandard: {
    position: 'absolute',
    // bottom is set dynamically with insets.bottom + scale(80)
    left: 0,
    right: 0,
    paddingHorizontal: 0,
  },
  progressContainer: {
    height: scale(16),
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  progressTrack: {
    height: scale(2),
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: scale(14),
    position: 'relative',
    overflow: 'hidden',
  },
  progressBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(80,80,80,0.5)',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: scale(2),
    backgroundColor: colors.progressFill,
    borderRadius: scale(14),
  },
  chapterMarker: {
    position: 'absolute',
    top: scale(6),
    width: 1,
    height: scale(4),
    backgroundColor: colors.textMuted,
    zIndex: 5,
  },
  progressShadow: {
    display: 'none', // Hide shadow for thin bar
  },
  progressThumb: {
    position: 'absolute',
    top: 0,
    width: scale(16),
    height: scale(16),
    backgroundColor: colors.accent,
    borderRadius: scale(8),
    shadowColor: colors.backgroundPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pillsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: scale(22),
  },
  pillsColumn: {
    flexDirection: 'column',
    gap: scale(8),
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: scale(14),
    paddingVertical: scale(8),
    paddingHorizontal: scale(14),
    minHeight: scale(36),
    position: 'relative',
    overflow: 'hidden',
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(80,80,80,0.5)',
  },
  pillText: {
    color: colors.textPrimary,
    fontSize: scale(14),
  },
  pillTextActive: {
    color: colors.accent,
  },
  pillTextSmall: {
    color: colors.textPrimary,
    fontSize: scale(13),
  },
  speedPill: {
    minWidth: scale(40),
    paddingHorizontal: scale(12),
  },
  queuePill: {
    minWidth: scale(40),
    paddingHorizontal: scale(12),
  },
  queueBadge: {
    backgroundColor: colors.accent,
    borderRadius: scale(8),
    paddingHorizontal: scale(5),
    paddingVertical: scale(1),
    marginLeft: scale(2),
  },
  queueBadgeText: {
    fontSize: scale(10),
    fontWeight: '700',
    color: colors.backgroundPrimary,
  },
  scrubButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonBorder: {
    width: scale(76),
    height: scale(76),
    borderRadius: scale(38),
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay.light,
    overflow: 'visible',
  },
  // Standard player mode - scrub button above progress bar
  standardScrubContainer: {
    alignItems: 'center',
    marginBottom: scale(0),
  },
  standardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  standardTimeText: {
    color: '#000',
    fontSize: scale(24),
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  standardTimeSeparator: {
    color: 'rgba(0,0,0,0.3)',
    fontSize: scale(24),
    fontWeight: '300',
    marginHorizontal: scale(8),
  },
  playButtonBorderStandard: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderColor: '#000',
  },
  controlsRowStandard: {
    justifyContent: 'center',
    gap: scale(60),
  },
  skipButtonStandard: {
    opacity: 1,
  },
  skipButtonLabelStandard: {
    color: 'rgba(0,0,0,0.5)',
  },
  // Standard player 3-button control bar (absolute positioning at bottom)
  standardControlsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    height: scale(72),
  },
  standardControlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: scale(48),
  },
  standardControlDivider: {
    width: 1,
    height: scale(32),
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  // Standard player chapter row above progress bar
  standardChapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(22),
    marginBottom: scale(0),
  },
  standardChapterTouch: {
    alignSelf: 'center',
  },
  standardChapterText: {
    color: '#000',
    fontSize: scale(14),
    fontWeight: '400',
  },
  standardChapterTime: {
    color: '#E53935',
    fontSize: scale(14),
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  // Standard player chapter row - centered directly above marker
  standardChapterRowTop: {
    position: 'absolute',
    bottom: scale(255), // Well above the timeline marker
    left: 0,
    right: 0,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  standardChapterTextTop: {
    fontSize: scale(20),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: scale(4),
  },
  standardChapterTimeTop: {
    color: '#FFFFFF',
    fontSize: scale(10),
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  // Centered cover for standard player - absolute positioning
  standardCoverContainerFull: {
    position: 'absolute',
    top: scale(70),
    left: (wp(100) - COVER_SIZE) / 2,
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    // Drop shadow like book detail page
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  standardCoverFull: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
  },
  // Cover overlay positions for top icons
  coverOverlayTopLeft: {
    position: 'absolute',
    top: scale(12),
    left: scale(12),
    zIndex: 25, // Higher than center to ensure touch priority
  },
  coverOverlayTopRight: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    zIndex: 25, // Higher than center to ensure touch priority
  },
  coverOverlayTopCenter: {
    position: 'absolute',
    top: scale(12),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  coverOverlayCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // White filled circle for download button
  downloadCircleFilled: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverOverlayArrowShadow: {
    // White stroke arrow with drop shadow, no circle background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  // Cover overlay buttons (queue left, bookmark right)
  coverOverlayButtons: {
    position: 'absolute',
    bottom: scale(16), // Closer to bottom edge for smaller cover
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
  },
  coverOverlayButton: {
    width: scale(44),
    height: scale(44),
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius:scale(44),
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  coverButtonBadge: {
    position: 'absolute',
    top: -scale(4),
    right: -scale(4),
    backgroundColor: colors.accent,
    borderRadius: scale(10),
    minWidth: scale(18),
    height: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(4),
  },
  coverButtonBadgeText: {
    color: '#000',
    fontSize: scale(10),
    fontWeight: '700',
  },

  // Bottom Sheet styles
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  // Sheet container - no background (individual sheets set their own)
  sheetContainer: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    borderBottomLeftRadius: scale(24),
    borderBottomRightRadius: scale(24),
    overflow: 'hidden',
  },
  fullScreenPanel: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sheet: {
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    paddingTop: scale(20),
    paddingBottom: scale(24),
  },
  chaptersSheet: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(20),
  },
  sheetTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.5,
  },
  sheetClose: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Options Grid (Speed)
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    width: (SCREEN_WIDTH - 80) / 3,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: colors.accent,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.backgroundPrimary,
  },

  // Options List (Sleep)
  optionsList: {
    gap: 4,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  listOptionActive: {
    backgroundColor: colors.accentSubtle,
  },
  listOptionText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  listOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },

  // Chapters List - Modernist white/black
  chaptersList: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
  },
  chapterItemActive: {
    backgroundColor: '#F0F0F0',
  },
  chapterNumber: {
    width: scale(28),
    fontSize: scale(14),
    color: '#999999',
  },
  chapterInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  chapterTitle: {
    fontSize: scale(15),
    color: '#000000',
    marginBottom: 2,
  },
  chapterTitleActive: {
    color: '#000000',
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: scale(12),
    color: '#666666',
  },

  // Settings Sheet - Modernist white/black
  settingsSection: {
    marginBottom: scale(20),
  },
  settingsSectionTitle: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#888888',
    marginBottom: scale(14),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsOptions: {
    gap: 4,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  settingsOptionActive: {
    backgroundColor: colors.accentSubtle,
  },
  settingsOptionText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  settingsOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  settingsOptionValue: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Speed grid for Standard Player settings
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  speedGridOption: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    minWidth: scale(60),
    alignItems: 'center',
  },
  speedGridOptionActive: {
    backgroundColor: colors.accent,
  },
  speedGridText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.textPrimary,
  },
  speedGridTextActive: {
    color: '#000',
    fontWeight: '700',
  },

  // Settings panel - new two-column layout
  settingsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  settingsColumn: {
    flex: 1,
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  toggleOption: {
    flex: 1,
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    borderRadius: scale(10),
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#000000',
  },
  toggleOptionText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#333333',
  },
  toggleOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  speedOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  speedQuickOption: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(10),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedQuickOptionActive: {
    backgroundColor: colors.accent,
  },
  speedQuickText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.textPrimary,
  },
  speedQuickTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  speedGearButton: {
    padding: scale(8),
    marginLeft: 2,
  },
  sleepTimerStatus: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.accent,
    marginLeft: 'auto',
  },
  sleepOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  sleepQuickOption: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sleepQuickOptionActive: {
    backgroundColor: colors.accent,
  },
  sleepQuickText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.textPrimary,
  },
  sleepQuickTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  sleepCustomButton: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sleepCustomText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sleepOffButton: {
    padding: scale(8),
  },
  // Modernist unified settings styles
  settingStatusText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#000000',
    marginLeft: 'auto',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: scale(12),
  },
  quickOption: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(8),
    backgroundColor: '#F0F0F0',
  },
  quickOptionActive: {
    backgroundColor: '#000000',
  },
  quickOptionText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#333333',
  },
  quickOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customInputContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: scale(54),
  },
  customInput: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#000000',
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    textAlign: 'center',
  },
  offButtonSmall: {
    padding: scale(4),
    marginLeft: scale(8),
  },
  settingsActionsColumn: {
    gap: scale(10),
    marginTop: scale(12),
  },
  settingsActionButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: scale(12),
    backgroundColor: '#F0F0F0',
  },
  // Sleep timer in play button
  sleepTimerControl: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepTimerText: {
    fontSize: scale(14),
    fontWeight: '700',
    color: '#E53935',
    marginTop: scale(2),
  },
  settingsActionsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: scale(12),
  },
  settingsActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: scale(12),
    backgroundColor: '#F0F0F0',
  },
  settingsActionButtonDisabled: {
    opacity: 0.4,
  },
  settingsActionText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#000000',
  },
  settingsActionTextDisabled: {
    color: '#999999',
  },
  settingsActionBadge: {
    backgroundColor: '#000000',
    borderRadius: scale(10),
    minWidth: scale(22),
    height: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(6),
  },
  settingsActionBadgeText: {
    fontSize: scale(11),
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Bookmarks sheet styles - Modernist white/black
  sheetBackButton: {
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
  },
  sheetBackText: {
    fontSize: scale(14),
    color: '#666666',
  },
  bookmarksScrollView: {
    maxHeight: hp(40),
  },
  bookmarksEmpty: {
    alignItems: 'center',
    paddingVertical: scale(48),
  },
  bookmarksEmptyText: {
    fontSize: scale(17),
    fontWeight: '600',
    color: '#000000',
    marginTop: scale(20),
  },
  bookmarksEmptySubtext: {
    fontSize: scale(14),
    color: '#666666',
    marginTop: scale(10),
    textAlign: 'center',
    paddingHorizontal: scale(20),
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bookmarkInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  bookmarkTitle: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#000000',
  },
  bookmarkChapter: {
    fontSize: scale(13),
    color: '#333333',
    fontWeight: '500',
    marginTop: 2,
  },
  bookmarkTime: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000000',
    marginTop: scale(2),
  },
  bookmarksEmptyHint: {
    fontSize: scale(13),
    color: '#999999',
    marginTop: scale(6),
    textAlign: 'center',
    paddingHorizontal: scale(20),
  },
  // Enhanced bookmark cards - Modernist white/black
  bookmarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bookmarkCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkCover: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(6),
    marginRight: spacing.md,
  },
  bookmarkNote: {
    fontSize: scale(13),
    fontStyle: 'italic',
    color: '#666666',
    marginTop: scale(4),
  },
  bookmarkDate: {
    fontSize: scale(12),
    color: '#999999',
    marginTop: scale(4),
  },
  bookmarkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginLeft: spacing.md,
  },
  bookmarkPlayButton: {
    padding: scale(10),
    backgroundColor: '#F0F0F0',
    borderRadius: scale(20),
  },
  bookmarkDeleteButton: {
    padding: scale(10),
  },
  // Bookmark pill - grows from bookmark button on cover
  bookmarkPill: {
    position: 'absolute',
    top: scale(100) + scale(320) - scale(16) - scale(22), // Aligned with bookmark button
    right: scale(16) + scale(44) + scale(8), // To the left of bookmark button
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: scale(10),
    paddingLeft: scale(14),
    paddingRight: scale(6),
    borderRadius: scale(24),
    gap: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  bookmarkPillText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000000',
  },
  bookmarkPillNoteButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: scale(6),
    paddingHorizontal: scale(12),
    borderRadius: scale(16),
  },
  bookmarkPillNoteText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#666666',
  },
  // Bookmark toast (for delete undo)
  // Modernist Toast - Clean white/black design
  bookmarkToast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: scale(18),
    paddingHorizontal: scale(20),
    borderRadius: scale(16),
    gap: scale(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  bookmarkDeletedToast: {
    // Same white design for consistency
  },
  bookmarkToastText: {
    flex: 1,
    fontSize: scale(16),
    fontWeight: '500',
    color: '#000000',
    letterSpacing: -0.2,
  },
  bookmarkToastAction: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#000000',
    textDecorationLine: 'underline',
  },
  bookmarkToastClose: {
    padding: scale(6),
    marginLeft: scale(4),
  },
  // Modernist Note Input Modal - Clean white/black design
  noteInputOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  noteInputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scale(28),
    borderTopRightRadius: scale(28),
    paddingTop: scale(12),
    paddingHorizontal: scale(24),
    paddingBottom: scale(20),
  },
  noteInputHandle: {
    alignSelf: 'center',
    width: scale(36),
    height: scale(4),
    backgroundColor: '#E0E0E0',
    borderRadius: scale(2),
    marginBottom: scale(20),
  },
  noteInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(24),
  },
  noteInputTitle: {
    fontSize: scale(22),
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.5,
  },
  noteInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: scale(16),
    paddingVertical: scale(18),
    paddingHorizontal: scale(18),
    fontSize: scale(17),
    color: '#000000',
    minHeight: scale(140),
    textAlignVertical: 'top',
    lineHeight: scale(24),
  },
  noteInputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scale(20),
  },
  noteCharCount: {
    fontSize: scale(13),
    color: '#999999',
    fontWeight: '400',
  },
  noteInputSaveButton: {
    backgroundColor: '#000000',
    paddingVertical: scale(14),
    paddingHorizontal: scale(32),
    borderRadius: scale(24),
  },
  noteInputSaveText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // Controls Row with Skip Buttons at edges
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(30),
    marginTop: scale(8),
  },
  skipButton: {
    width: scale(48),
    height: scale(60),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    opacity: 0.8,
  },
  skipButtonLabel: {
    color: colors.textTertiary,
    fontSize: scale(11),
    fontWeight: '500',
    marginTop: scale(2),
  },
  // Scrub Speed Scale
  scrubScaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(30),
    marginTop: scale(16),
  },
  scrubScaleItem: {
    alignItems: 'center',
  },
  scrubScaleText: {
    color: 'rgba(91,91,91,0.7)',
    fontSize: scale(10),
    fontVariant: ['tabular-nums'],
    marginBottom: scale(4),
  },
  scrubScaleLine: {
    width: 1,
    height: scale(12),
    backgroundColor: 'rgba(60,60,60,0.8)',
  },

  // Playing badge for reduced motion mode
  playingBadge: {
    position: 'absolute',
    bottom: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: colors.accent,
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  playingBadgeText: {
    color: colors.backgroundPrimary,
    fontSize: scale(11),
    fontWeight: '700',
  },

  // Speed badge on disc
  speedBadgeOnDisc: {
    position: 'absolute',
    top: scale(20),
    right: scale(20),
    backgroundColor: colors.accent,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
  },
  speedBadgeOnDiscText: {
    color: colors.backgroundPrimary,
    fontSize: scale(11),
    fontWeight: '700',
  },

  // Buffering badge container - positioned absolutely above all layers
  bufferingBadgeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    elevation: 50,
  },
  bufferingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bufferingBadgeText: {
    color: colors.textSecondary,
    fontSize: scale(11),
    fontWeight: '500',
  },

  // Timer countdown indicator
  timerCountdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  timerActiveDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: colors.accent,
  },

  // Standard Player Mode styles
  standardCoverContainer: {
    alignItems: 'center',
    marginTop: scale(8),
    marginBottom: scale(12),
  },
  standardCover: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  speedBadgeStandard: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    backgroundColor: colors.accent,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
  },
  standardPillsPosition: {
    position: 'relative',
    top: 0,
    marginTop: scale(10),
    marginBottom: scale(10),
  },
});

export default CDPlayerScreen;
