/**
 * src/features/player/screens/SimplePlayerScreen.tsx
 *
 * Simplified full-screen player following standard UX patterns.
 * Key improvements over PlayerScreen:
 * - Standard layout (cover, info, scrubber, controls, actions)
 * - Explicit labeled buttons (no hidden tap targets)
 * - Bottom sheets for settings instead of inline panels
 * - Direct actions (no temp state, changes apply immediately)
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { usePlayerStore, useCurrentChapterIndex, useBookProgress, useSleepTimerState } from '../stores/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { haptics } from '@/core/native/haptics';
import { ChapterProgressBar } from '../components/ChapterProgressBar';
import { getSeriesName, getSeriesWithSequence } from '@/shared/utils/metadata';
import { colors, spacing, radius, wp, hp, layout } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);

// =============================================================================
// TYPES
// =============================================================================

type SheetType = 'none' | 'speed' | 'sleep' | 'chapters';

// =============================================================================
// CONSTANTS
// =============================================================================

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SLEEP_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: 'End of chapter', value: -1 },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatTime = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatTimeRemaining = (seconds: number): string => {
  if (!seconds || seconds < 0) return '-0:00';
  return `-${formatTime(seconds)}`;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SimplePlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Store state - use useShallow to prevent infinite re-renders from object reference changes
  const {
    currentBook,
    isPlayerVisible,
    isPlaying,
    isLoading,
    position,
    duration,
    playbackRate,
    sleepTimer,
    chapters,
    progressMode,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlayerVisible: s.isPlayerVisible,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      position: s.position,
      duration: s.duration,
      playbackRate: s.playbackRate,
      sleepTimer: s.sleepTimer,
      chapters: s.chapters,
      progressMode: s.progressMode,
    }))
  );

  // Actions - these are stable functions so we can select them directly
  const closePlayer = usePlayerStore((s) => s.closePlayer);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const clearSleepTimer = usePlayerStore((s) => s.clearSleepTimer);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const skipForward = usePlayerStore((s) => s.skipForward);
  const skipBackward = usePlayerStore((s) => s.skipBackward);
  const nextChapter = usePlayerStore((s) => s.nextChapter);
  const prevChapter = usePlayerStore((s) => s.prevChapter);
  const setProgressMode = usePlayerStore((s) => s.setProgressMode);

  // Sleep timer state with shake detection info
  const sleepTimerState = useSleepTimerState();

  const chapterIndex = useCurrentChapterIndex();
  const progress = useBookProgress();
  const coverUrl = useCoverUrl(currentBook?.id || '');

  // Local state
  const [activeSheet, setActiveSheet] = useState<SheetType>('none');

  // Book metadata
  const metadata = currentBook?.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const currentChapter = chapters[chapterIndex];

  // Series info
  const seriesName = getSeriesName(currentBook);
  const seriesWithSequence = getSeriesWithSequence(currentBook);

  // Time calculations
  const timeRemaining = duration - position;
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  // Pan responder for swipe down
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animation on open
  React.useEffect(() => {
    if (isPlayerVisible && currentBook) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [isPlayerVisible, currentBook?.id]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleClose = useCallback(() => {
    setActiveSheet('none');
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => closePlayer());
  }, [closePlayer, slideAnim]);

  const handlePlayPause = useCallback(async () => {
    haptics.playbackToggle();
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, pause, play]);

  const handleSkipBack = useCallback(async () => {
    haptics.skip();
    await skipBackward?.(30);
  }, [skipBackward]);

  const handleSkipForward = useCallback(async () => {
    haptics.skip();
    await skipForward?.(30);
  }, [skipForward]);

  const handlePrevChapter = useCallback(async () => {
    haptics.chapterChange();
    await prevChapter?.();
  }, [prevChapter]);

  const handleNextChapter = useCallback(async () => {
    haptics.chapterChange();
    await nextChapter?.();
  }, [nextChapter]);

  // Speed - apply immediately (no temp state)
  const handleSpeedSelect = useCallback((speed: number) => {
    haptics.selection();
    setPlaybackRate?.(speed);
    setActiveSheet('none');
  }, [setPlaybackRate]);

  // Sleep - apply immediately (no temp state)
  const handleSleepSelect = useCallback((minutes: number) => {
    haptics.selection();
    if (minutes === 0) {
      clearSleepTimer?.();
    } else {
      setSleepTimer?.(minutes);
    }
    setActiveSheet('none');
  }, [setSleepTimer, clearSleepTimer]);

  // Chapter select
  const handleChapterSelect = useCallback((chapterStart: number) => {
    haptics.selection();
    seekTo?.(chapterStart);
    setActiveSheet('none');
  }, [seekTo]);

  // Navigate to series
  const handleSeriesPress = useCallback(() => {
    if (!seriesName) return;
    haptics.selection();
    handleClose();
    // Small delay to let the close animation finish
    setTimeout(() => {
      navigation.navigate('SeriesDetail', { seriesName });
    }, 250);
  }, [seriesName, handleClose, navigation]);

  // Navigate to book details
  const handleTitlePress = useCallback(() => {
    if (!currentBook) return;
    haptics.selection();
    handleClose();
    // Small delay to let the close animation finish
    setTimeout(() => {
      navigation.navigate('BookDetail', { id: currentBook.id });
    }, 250);
  }, [currentBook, handleClose, navigation]);

  // Scrubber
  const handleScrub = useCallback((percent: number) => {
    const newPosition = (percent / 100) * duration;
    seekTo?.(newPosition);
  }, [duration, seekTo]);

  // Toggle progress mode
  const handleToggleProgressMode = useCallback(() => {
    haptics.selection();
    setProgressMode?.(progressMode === 'bar' ? 'chapters' : 'bar');
  }, [progressMode, setProgressMode]);

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const renderSpeedSheet = () => (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Playback Speed</Text>
        <TouchableOpacity onPress={() => setActiveSheet('none')} style={styles.sheetClose}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.optionsGrid}>
        {SPEED_OPTIONS.map((speed) => (
          <TouchableOpacity
            key={speed}
            style={[
              styles.optionButton,
              playbackRate === speed && styles.optionButtonActive,
            ]}
            onPress={() => handleSpeedSelect(speed)}
          >
            <Text style={[
              styles.optionText,
              playbackRate === speed && styles.optionTextActive,
            ]}>
              {speed}x
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSleepSheet = () => {
    const currentSleepMins = sleepTimer ? Math.ceil(sleepTimer / 60) : 0;
    return (
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Sleep Timer</Text>
          <TouchableOpacity onPress={() => setActiveSheet('none')} style={styles.sheetClose}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.optionsList}>
          {SLEEP_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.listOption,
                currentSleepMins === option.value && styles.listOptionActive,
              ]}
              onPress={() => handleSleepSelect(option.value)}
            >
              <Text style={[
                styles.listOptionText,
                currentSleepMins === option.value && styles.listOptionTextActive,
              ]}>
                {option.label}
              </Text>
              {currentSleepMins === option.value && (
                <Ionicons name="checkmark" size={20} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderChaptersSheet = () => (
    <View style={[styles.sheet, styles.chaptersSheet]}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Chapters</Text>
        <TouchableOpacity onPress={() => setActiveSheet('none')} style={styles.sheetClose}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.chaptersList}>
        {chapters.map((chapter: any, index: number) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.chapterItem,
              index === chapterIndex && styles.chapterItemActive,
            ]}
            onPress={() => handleChapterSelect(chapter.start)}
          >
            <Text style={styles.chapterNumber}>{index + 1}</Text>
            <View style={styles.chapterInfo}>
              <Text
                style={[
                  styles.chapterTitle,
                  index === chapterIndex && styles.chapterTitleActive,
                ]}
                numberOfLines={1}
              >
                {chapter.title || `Chapter ${index + 1}`}
              </Text>
              <Text style={styles.chapterDuration}>
                {formatTime(chapter.end - chapter.start)}
              </Text>
            </View>
            {index === chapterIndex && (
              <Ionicons name="volume-high" size={16} color={colors.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  if (!isPlayerVisible || !currentBook) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle="light-content" />

      {/* Background - same pattern as HomeScreen */}
      <View style={StyleSheet.absoluteFill}>
        {coverUrl && (
          <Image
            source={coverUrl}
            style={StyleSheet.absoluteFill}
            blurRadius={50}
            contentFit="cover"
          />
        )}
        {/* BlurView overlay for Android (blurRadius only works on iOS) */}
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.swipeIndicator} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Now Playing
          </Text>
          <View style={styles.headerButton} />
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Cover Art */}
        <View style={styles.coverContainer}>
          <Image source={coverUrl} style={styles.cover} contentFit="cover" />
        </View>

        {/* Book Info */}
        <View style={styles.bookInfo}>
          <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
            <Text style={styles.bookTitle} numberOfLines={2}>{title}</Text>
          </TouchableOpacity>
          <Text style={styles.bookAuthor} numberOfLines={1}>{author}</Text>
          {seriesWithSequence && (
            <TouchableOpacity
              style={styles.seriesBadge}
              onPress={handleSeriesPress}
              activeOpacity={0.7}
            >
              <Ionicons name="library-outline" size={12} color={colors.accent} />
              <Text style={styles.seriesText} numberOfLines={1}>
                {seriesWithSequence}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          {currentChapter && (
            <Text style={styles.chapterName} numberOfLines={1}>
              {currentChapter.title || `Chapter ${chapterIndex + 1}`}
            </Text>
          )}
        </View>

        {/* Progress Bar - Toggle between standard scrubber and chapter view */}
        <TouchableOpacity onPress={handleToggleProgressMode} activeOpacity={0.8}>
          {progressMode === 'chapters' && chapters.length > 1 ? (
            <ChapterProgressBar
              chapters={chapters}
              position={position}
              duration={duration}
              onChapterPress={(start) => seekTo?.(start)}
            />
          ) : (
            <View style={styles.scrubberContainer}>
              <View style={styles.scrubberTrack}>
                <View style={[styles.scrubberFill, { width: `${progressPercent}%` }]} />
                <View style={[styles.scrubberThumb, { left: `${progressPercent}%` }]} />
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{formatTimeRemaining(timeRemaining)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Progress mode toggle hint */}
        {chapters.length > 1 && (
          <TouchableOpacity
            onPress={handleToggleProgressMode}
            style={styles.progressModeToggle}
          >
            <Ionicons
              name={progressMode === 'chapters' ? 'git-commit-outline' : 'menu-outline'}
              size={16}
              color="rgba(255,255,255,0.5)"
            />
            <Text style={styles.progressModeText}>
              {progressMode === 'chapters' ? 'Tap for timeline' : 'Tap for chapters'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Main Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={handlePrevChapter} style={styles.controlButton}>
            <Ionicons name="play-skip-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipBack} style={styles.controlButton}>
            <View style={styles.skipButtonContent}>
              <Ionicons name="play-back" size={32} color={colors.textPrimary} />
              <Text style={styles.skipLabel}>30</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePlayPause}
            style={styles.playButton}
            disabled={isLoading}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={40}
              color={colors.backgroundPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipForward} style={styles.controlButton}>
            <View style={styles.skipButtonContent}>
              <Ionicons name="play-forward" size={32} color={colors.textPrimary} />
              <Text style={styles.skipLabel}>30</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNextChapter} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions - LABELED BUTTONS */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveSheet('speed')}
          >
            <Ionicons name="speedometer-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.actionLabel}>{playbackRate}x</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveSheet('sleep')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="moon-outline" size={22} color={sleepTimer ? colors.accent : colors.textPrimary} />
              {sleepTimerState.isShakeDetectionActive && (
                <View style={styles.shakeBadge}>
                  <Ionicons name="phone-portrait-outline" size={10} color={colors.backgroundPrimary} />
                </View>
              )}
            </View>
            <Text style={[styles.actionLabel, sleepTimer !== null && sleepTimer > 0 && styles.actionLabelActive]}>
              {sleepTimer && sleepTimer > 0 ? `${Math.ceil(sleepTimer / 60)}m` : 'Sleep'}
            </Text>
            {sleepTimerState.isShakeDetectionActive && (
              <Text style={styles.shakeHint}>Shake +15m</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveSheet('chapters')}
          >
            <Ionicons name="list-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.actionLabel}>Chapters</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheets */}
      {activeSheet !== 'none' && (
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setActiveSheet('none')}
        >
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 20 }]}>
            {activeSheet === 'speed' && renderSpeedSheet()}
            {activeSheet === 'sleep' && renderSleepSheet()}
            {activeSheet === 'chapters' && renderChaptersSheet()}
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

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  swipeIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  headerButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },

  // Cover
  coverContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  cover: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundTertiary,
  },

  // Book Info
  bookInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  bookTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  bookAuthor: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  seriesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.accentSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  seriesText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    maxWidth: 200,
  },
  chapterName: {
    fontSize: 14,
    color: colors.textTertiary,
  },

  // Scrubber
  scrubberContainer: {
    marginBottom: spacing.xl,
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: colors.progressTrack,
    borderRadius: 2,
    position: 'relative',
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.progressFill,
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textPrimary,
    marginLeft: -8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
    gap: spacing.md,
  },
  controlButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonContent: {
    alignItems: 'center',
  },
  skipLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: -4,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing['3xl'],
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 60,
  },
  actionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionLabelActive: {
    color: colors.accent,
  },
  actionIconContainer: {
    position: 'relative',
  },
  shakeBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shakeHint: {
    fontSize: 9,
    color: colors.accent,
    marginTop: 2,
  },

  // Progress mode toggle
  progressModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  progressModeText: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Bottom Sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  sheet: {
    padding: spacing.lg,
  },
  chaptersSheet: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
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
    gap: spacing.sm,
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
    gap: spacing.xs,
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

  // Chapters List
  chaptersList: {
    gap: 2,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  chapterItemActive: {
    backgroundColor: colors.accentSubtle,
  },
  chapterNumber: {
    width: 28,
    fontSize: 14,
    color: colors.textTertiary,
  },
  chapterInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  chapterTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  chapterTitleActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});

export default SimplePlayerScreen;
