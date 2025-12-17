/**
 * src/features/player/components/PlayerModule.tsx
 *
 * Unified player component used on both home screen and player screen.
 * Contains: InfoTiles, Cover artwork, Playback controls, Action buttons (download/heart)
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Pressable, Text } from 'react-native';
import { useCoverUrl } from '@/core/cache';
import type { LibraryItem } from '@/core/types';
import { CoverArtwork } from '@/features/home/components/CoverArtwork';
import { InfoTiles } from '@/features/home/components/InfoTiles';
import { PlaybackControls } from '@/features/home/components/PlaybackControls';
import { ProgressBar } from './ProgressBar';
import { HeartButton, CircularDownloadButton } from '@/shared/components';
import { colors, scale, layout } from '@/shared/theme';


export interface PlayerModuleProgress {
  currentTime: number;
  duration: number;
  progress: number;
  isFinished: boolean;
  lastUpdate: number;
}

export interface PlayerModuleProps {
  book: LibraryItem;
  progress: PlayerModuleProgress | null;
  isPlaying: boolean;
  playbackSpeed: number;
  sleepTimer: number | null;

  // Cover interactions
  onCoverPress?: () => void;
  onCoverLongPress?: () => void;

  // Loading state
  isLoading?: boolean;

  // Playback controls
  onPlay: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  onSkipBackPressIn?: () => void;
  onSkipBackPressOut?: () => void;
  onSkipForwardPressIn?: () => void;
  onSkipForwardPressOut?: () => void;

  // Info tile interactions
  onSpeedPress?: () => void;
  onSleepPress?: () => void;
  onChapterPress?: () => void;
  onTimePress?: () => void;

  // Action buttons
  onDownloadPress?: () => void;

  // Seeking state
  isSeeking?: boolean;
  seekDelta?: number;
  seekDirection?: 'forward' | 'backward' | null;

  // Panel mode (for when speed/sleep/chapters panel is open)
  panelMode?: string;
  panelContent?: React.ReactNode;
  onClosePanel?: () => void;

  // Variant for styling differences
  variant?: 'home' | 'fullscreen';
}

export function PlayerModule({
  book,
  progress,
  isPlaying,
  isLoading = false,
  playbackSpeed,
  sleepTimer,
  onCoverPress,
  onCoverLongPress,
  onPlay,
  onSkipBack,
  onSkipForward,
  onSkipBackPressIn,
  onSkipBackPressOut,
  onSkipForwardPressIn,
  onSkipForwardPressOut,
  onSpeedPress,
  onSleepPress,
  onChapterPress,
  onTimePress,
  onDownloadPress,
  isSeeking,
  seekDelta,
  seekDirection,
  panelMode,
  panelContent,
  onClosePanel,
  variant = 'home',
}: PlayerModuleProps) {
  const coverUrl = useCoverUrl(book.id);
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Untitled';

  // Extract series sequence number from seriesName (e.g., "Dresden Files #17")
  const seriesSequence = useMemo(() => {
    const seriesName = metadata?.seriesName || '';
    const seqMatch = seriesName.match(/#([\d.]+)/);
    return seqMatch ? seqMatch[1] : undefined;
  }, [metadata?.seriesName]);

  // Get current chapter info
  const chapters = (book.media as any)?.chapters || [];
  const chapterNumber = useMemo(() => {
    if (chapters.length && progress) {
      const currentTime = progress.currentTime;
      const currentChapter = chapters.find((ch: any, i: number) => {
        const nextChapter = chapters[i + 1];
        const chapterEnd = nextChapter?.start || progress.duration;
        return currentTime >= ch.start && currentTime < chapterEnd;
      });
      if (currentChapter) {
        return chapters.indexOf(currentChapter) + 1;
      }
    }
    // Check extended progress properties
    const extendedProgress = progress as any;
    if (extendedProgress?.currentChapter !== undefined) {
      return extendedProgress.currentChapter + 1;
    }
    return 1;
  }, [chapters, progress]);

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate current time (counting UP)
  const currentTimeDisplay = useMemo(() => {
    if (!progress) return '00:00:00';
    return formatTime(Math.max(0, progress.currentTime));
  }, [progress]);

  // Sleep timer in minutes
  const sleepTimerMinutes = sleepTimer ?? 0;

  // Cover size based on variant
  const coverSize = variant === 'fullscreen' ? scale(280) : scale(220);

  return (
    <View style={styles.container}>
      {/* Info Tiles - TOP */}
      <View style={panelMode && panelMode !== 'none' ? styles.infoContainerPanel : styles.infoContainer}>
        <InfoTiles
          title={title}
          chapterNumber={chapterNumber}
          timeRemaining={currentTimeDisplay}
          sleepTimerMinutes={sleepTimerMinutes}
          playbackSpeed={playbackSpeed}
          onSpeedPress={onSpeedPress}
          onSleepPress={onSleepPress}
          onChapterPress={onChapterPress}
          onTimePress={onTimePress}
          isSeeking={isSeeking}
          seekDelta={seekDelta}
          seekDirection={seekDirection}
          isPlaying={isPlaying}
        />
      </View>

      {/* Panel OR Cover+Controls */}
      {panelMode && panelMode !== 'none' && panelContent ? (
        <View style={styles.panelContainer}>
          <TouchableOpacity
            style={styles.panelCloseButton}
            onPress={onClosePanel}
            accessibilityLabel="Close panel"
            accessibilityRole="button"
          >
            <Text style={styles.panelCloseText}>✕</Text>
          </TouchableOpacity>
          {panelContent}
        </View>
      ) : (
        <>
          {/* Cover - tap for details, long press for player */}
          <Pressable
            style={styles.coverContainer}
            onPress={onCoverPress}
            onLongPress={onCoverLongPress}
            delayLongPress={400}
            accessibilityLabel={`${title} cover`}
            accessibilityRole="button"
            accessibilityHint="Tap for details. Long press for full player."
          >
            <CoverArtwork
              coverUrl={coverUrl}
              size={coverSize}
              seriesSequence={seriesSequence}
            />
          </Pressable>

          {/* Progress Bar - always visible for system status visibility (NN/g #1) */}
          <View style={styles.progressBarContainer}>
            <ProgressBar
              textColor={colors.textSecondary}
              trackColor={colors.progressTrack}
              fillColor={colors.textPrimary}
            />
          </View>

          {/* Playback Controls */}
          <View style={styles.controlsContainer}>
            <PlaybackControls
              isPlaying={isPlaying}
              isLoading={isLoading}
              onPlay={onPlay}
              onPause={onPlay}
              onSkipForward={onSkipForward}
              onSkipBackward={onSkipBack}
              onSkipForwardPressIn={onSkipForwardPressIn}
              onSkipForwardPressOut={onSkipForwardPressOut}
              onSkipBackwardPressIn={onSkipBackPressIn}
              onSkipBackwardPressOut={onSkipBackPressOut}
            />
          </View>

          {/* Action buttons row */}
          <View style={styles.actionButtonsRow}>
            <CircularDownloadButton
              book={book}
              size={scale(40)}
            />
            <HeartButton
              bookId={book.id}
              size={scale(18)}
              style={styles.actionButton}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: scale(382),
  },
  infoContainer: {
    width: '100%',
    marginBottom: scale(42),
  },
  infoContainerPanel: {
    width: '100%',
    marginBottom: scale(16),
  },
  coverContainer: {
    alignItems: 'center',
    zIndex: 100,
  },
  progressBarContainer: {
    width: '100%',
    marginTop: scale(16),
    paddingHorizontal: scale(10),
  },
  panelContainer: {
    width: '100%',
    minHeight: scale(300),
    paddingHorizontal: scale(10),
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(16),
    width: '100%',
    paddingHorizontal: scale(10),
  },
  // NN/g: Minimum 44×44px touch target for panel close
  panelCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  panelCloseText: {
    color: colors.textSecondary,
    fontSize: scale(20),
    fontWeight: '300',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scale(20),
    width: '100%',
    paddingHorizontal: scale(50),
  },
  // NN/g: Minimum 44×44px touch target for action buttons
  actionButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
