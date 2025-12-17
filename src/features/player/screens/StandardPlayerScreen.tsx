/**
 * src/features/player/screens/StandardPlayerScreen.tsx
 *
 * Standard audiobook player with familiar Audible-like design.
 * Features static album cover, traditional scrubber, and standard transport controls.
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { usePlayerStore, useCurrentChapterIndex, useBookProgress, useSleepTimerState } from '../stores/playerStore';
import { SleepTimerSheet, SpeedSheet } from '../sheets';
import { QueuePanel } from '@/features/queue/components/QueuePanel';
import { useQueueCount } from '@/features/queue/stores/queueStore';
import { useCoverUrl } from '@/core/cache';
import { haptics } from '@/core/native/haptics';
import { colors, scale, wp, hp, radius, spacing } from '@/shared/theme';

// =============================================================================
// CONSTANTS
// =============================================================================

const SCREEN_WIDTH = wp(100);
const COVER_SIZE = SCREEN_WIDTH * 0.85;

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

const formatSleepTimer = (seconds: number): string => {
  if (seconds <= 0) return 'Off';
  const m = Math.ceil(seconds / 60);
  return `${m}m`;
};

// =============================================================================
// MOON ICON COMPONENT
// =============================================================================

const MoonIcon = () => (
  <Ionicons name="moon-outline" size={scale(14)} color="#fff" />
);

// =============================================================================
// STANDARD PLAYER SCREEN
// =============================================================================

const StandardPlayerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Player state from store
  const currentBook = usePlayerStore((s) => s.currentBook);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const chapters = usePlayerStore((s) => s.chapters);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const skipForward = usePlayerStore((s) => s.skipForward);
  const skipBackward = usePlayerStore((s) => s.skipBackward);
  const skipForwardInterval = usePlayerStore((s) => s.skipForwardInterval ?? 30);
  const skipBackInterval = usePlayerStore((s) => s.skipBackInterval ?? 15);

  // Hooks
  const currentChapterIndex = useCurrentChapterIndex();
  const bookProgress = useBookProgress();
  const { sleepTimer } = useSleepTimerState();
  const coverUrl = useCoverUrl(currentBook?.id || '');
  const queueCount = useQueueCount();

  // Sheet states
  type SheetType = 'none' | 'sleep' | 'speed' | 'queue';
  const [activeSheet, setActiveSheet] = useState<SheetType>('none');

  // Book metadata
  const metadata = currentBook?.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const authorName = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const narratorName = metadata?.narratorName || metadata?.narrators?.[0] || null;

  // Progress calculation
  const progress = duration > 0 ? position / duration : 0;
  const currentChapter = chapters?.[currentChapterIndex];

  // Scrubber state
  const scrubberProgress = useSharedValue(progress);
  const isScrubbing = useSharedValue(false);
  const scrubberWidth = useRef(COVER_SIZE);

  // Update scrubber when not dragging
  React.useEffect(() => {
    if (!isScrubbing.value) {
      scrubberProgress.value = progress;
    }
  }, [progress, isScrubbing.value]);

  // Handle seek
  const handleSeek = useCallback((newProgress: number) => {
    const newPosition = newProgress * duration;
    seekTo(newPosition);
    haptics.impact('light');
  }, [duration, seekTo]);

  // Haptic feedback wrapper for worklet
  const triggerHaptic = useCallback(() => {
    haptics.impact('light');
  }, []);

  // Scrubber gesture
  const scrubGesture = Gesture.Pan()
    .onStart(() => {
      isScrubbing.value = true;
      runOnJS(triggerHaptic)();
    })
    .onUpdate((event) => {
      const newProgress = Math.max(0, Math.min(1, (event.x) / scrubberWidth.current));
      scrubberProgress.value = newProgress;
    })
    .onEnd(() => {
      isScrubbing.value = false;
      runOnJS(handleSeek)(scrubberProgress.value);
    });

  // Animated thumb style
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${scrubberProgress.value * 100}%`,
    transform: [{ scale: withSpring(isScrubbing.value ? 1.4 : 1, { damping: 15 }) }],
  }));

  // Animated progress bar style
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${scrubberProgress.value * 100}%`,
  }));

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
    haptics.impact('light');
  }, [isPlaying, play, pause]);

  // Handle skip
  const handleSkipBack = useCallback(() => {
    skipBackward(skipBackInterval);
    haptics.impact('light');
  }, [skipBackward, skipBackInterval]);

  const handleSkipForward = useCallback(() => {
    skipForward(skipForwardInterval);
    haptics.impact('light');
  }, [skipForward, skipForwardInterval]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle settings navigation
  const handleSettings = useCallback(() => {
    (navigation as any).navigate('PlaybackSettings');
  }, [navigation]);

  // Handle chapter tap - for now just provides feedback
  const handleChapterTap = useCallback(() => {
    // TODO: Show chapters list
    haptics.impact('light');
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background - Blurred cover */}
      {coverUrl && (
        <Image
          source={coverUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={50}
        />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-down" size={scale(28)} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSettings}
            accessibilityLabel="Player settings"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={scale(24)} color="white" />
          </TouchableOpacity>
        </View>

        {/* Cover Art */}
        <View style={styles.coverContainer}>
          {coverUrl ? (
            <Image
              source={coverUrl}
              style={styles.cover}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`Cover art for ${title}`}
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="book-outline" size={scale(60)} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          {/* Speed badge */}
          {playbackRate !== 1 && (
            <View style={styles.speedBadge}>
              <Text style={styles.speedBadgeText}>{playbackRate}x</Text>
            </View>
          )}
        </View>

        {/* Metadata */}
        <View style={styles.metadata}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
          {narratorName && (
            <Text style={styles.narrator} numberOfLines={1}>Narrated by {narratorName}</Text>
          )}
        </View>

        {/* Progress Bar / Scrubber */}
        <View style={styles.progressContainer}>
          <GestureDetector gesture={scrubGesture}>
            <View style={styles.progressTrackContainer}>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFilled, progressBarStyle]} />
              </View>
              <Animated.View style={[styles.progressThumb, thumbStyle]} />
            </View>
          </GestureDetector>

          <View style={styles.timeRow}>
            <Text style={styles.timeElapsed}>{formatTime(position)}</Text>
            <Text style={styles.timeRemaining}>-{formatTime(duration - position)}</Text>
          </View>
        </View>

        {/* Chapter Info */}
        <TouchableOpacity
          style={styles.chapterInfo}
          onPress={handleChapterTap}
          accessibilityLabel={`Chapter ${currentChapterIndex + 1} of ${chapters?.length || 0}`}
          accessibilityHint="Tap to view chapters"
        >
          <Text style={styles.chapterNumber}>
            Chapter {currentChapterIndex + 1} of {chapters?.length || '—'}
          </Text>
          {currentChapter?.title && (
            <Text style={styles.chapterTitle} numberOfLines={1}>
              "{currentChapter.title}"
            </Text>
          )}
        </TouchableOpacity>

        {/* Transport Controls */}
        <View style={styles.transport}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipBack}
            accessibilityLabel={`Skip back ${skipBackInterval} seconds`}
            accessibilityRole="button"
          >
            <Ionicons name="play-back" size={scale(44)} color="white" />
            <Text style={styles.skipLabel}>{skipBackInterval}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityRole="button"
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={scale(36)}
              color={colors.backgroundPrimary}
              style={!isPlaying && { marginLeft: scale(4) }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipForward}
            accessibilityLabel={`Skip forward ${skipForwardInterval} seconds`}
            accessibilityRole="button"
          >
            <Ionicons name="play-forward" size={scale(44)} color="white" />
            <Text style={styles.skipLabel}>{skipForwardInterval}</Text>
          </TouchableOpacity>
        </View>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveSheet('sleep')}
            accessibilityLabel="Sleep timer"
          >
            <MoonIcon />
            <Text style={[styles.actionLabel, (sleepTimer ?? 0) > 0 ? styles.actionLabelActive : null]}>
              {sleepTimer && sleepTimer > 0 ? formatSleepTimer(sleepTimer) : 'Sleep'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveSheet('speed')}
            accessibilityLabel="Playback speed"
          >
            <Ionicons name="speedometer-outline" size={scale(18)} color="white" />
            <Text style={[styles.actionLabel, playbackRate !== 1 && styles.actionLabelActive]}>
              {playbackRate}x
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleChapterTap}
            accessibilityLabel="Chapters"
          >
            <Ionicons name="list-outline" size={scale(18)} color="white" />
            <Text style={styles.actionLabel}>Chapters</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveSheet('queue')}
            accessibilityLabel="Queue"
          >
            <View>
              <Ionicons name="albums-outline" size={scale(18)} color={queueCount > 0 ? colors.accent : 'white'} />
              {queueCount > 0 && (
                <View style={styles.queueBadge}>
                  <Text style={styles.queueBadgeText}>{queueCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.actionLabel}>Queue</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer to push content up */}
        <View style={{ flex: 1 }} />
      </View>

      {/* Bottom safe area padding */}
      <View style={{ height: insets.bottom + scale(20), backgroundColor: 'transparent' }} />

      {/* Inline Bottom Sheets (sleep, speed, queue) */}
      {activeSheet !== 'none' && (
        <View style={styles.queueOverlay}>
          <TouchableOpacity
            style={styles.queueBackdrop}
            activeOpacity={1}
            onPress={() => setActiveSheet('none')}
            accessibilityLabel="Close sheet"
          />
          <View style={styles.queueContainer}>
            {activeSheet === 'sleep' && (
              <SleepTimerSheet onClose={() => setActiveSheet('none')} />
            )}
            {activeSheet === 'speed' && (
              <SpeedSheet onClose={() => setActiveSheet('none')} />
            )}
            {activeSheet === 'queue' && (
              <QueuePanel
                onClose={() => setActiveSheet('none')}
                maxHeight={hp(60)}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(7.5), // 7.5% margins for 85% content width
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: scale(56),
  },
  headerButton: {
    width: scale(44),
    height: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cover
  coverContainer: {
    alignItems: 'center',
    marginTop: scale(8),
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: scale(12),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBadge: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    backgroundColor: colors.accent,
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  speedBadgeText: {
    color: colors.backgroundPrimary,
    fontSize: scale(12),
    fontWeight: '700',
  },

  // Metadata
  metadata: {
    alignItems: 'center',
    marginTop: scale(24),
    paddingHorizontal: scale(16),
  },
  title: {
    fontSize: scale(22),
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
  },
  author: {
    fontSize: scale(17),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: scale(4),
  },
  narrator: {
    fontSize: scale(14),
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: scale(4),
  },

  // Progress / Scrubber
  progressContainer: {
    marginTop: scale(28),
    width: COVER_SIZE,
    alignSelf: 'center',
  },
  progressTrackContainer: {
    height: scale(24),
    justifyContent: 'center',
  },
  progressTrack: {
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFilled: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: scale(2),
  },
  progressThumb: {
    position: 'absolute',
    top: scale(4),
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: 'white',
    marginLeft: -scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scale(8),
  },
  timeElapsed: {
    fontSize: scale(13),
    fontVariant: ['tabular-nums'],
    color: 'rgba(255,255,255,0.7)',
  },
  timeRemaining: {
    fontSize: scale(13),
    fontVariant: ['tabular-nums'],
    color: colors.accent,
  },

  // Chapter Info
  chapterInfo: {
    alignItems: 'center',
    marginTop: scale(20),
    minHeight: scale(44),
    justifyContent: 'center',
    paddingHorizontal: scale(16),
  },
  chapterNumber: {
    fontSize: scale(14),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  chapterTitle: {
    fontSize: scale(16),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: scale(4),
    textAlign: 'center',
  },

  // Transport Controls
  transport: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(28),
    gap: scale(40),
  },
  skipButton: {
    width: scale(64),
    height: scale(64),
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    position: 'absolute',
    bottom: scale(8),
    fontSize: scale(11),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  playButton: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Action Bar
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: scale(32),
    paddingHorizontal: scale(8),
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(56),
    paddingVertical: scale(8),
  },
  actionLabel: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.6)',
    marginTop: scale(4),
  },
  actionLabelActive: {
    color: colors.accent,
  },
  queueBadge: {
    position: 'absolute',
    top: -scale(4),
    right: -scale(8),
    backgroundColor: colors.accent,
    borderRadius: scale(8),
    minWidth: scale(16),
    height: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueBadgeText: {
    fontSize: scale(10),
    fontWeight: '700',
    color: colors.backgroundPrimary,
  },

  // Queue overlay
  queueOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  queueBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.medium,
  },
  queueContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
});

export default StandardPlayerScreen;
