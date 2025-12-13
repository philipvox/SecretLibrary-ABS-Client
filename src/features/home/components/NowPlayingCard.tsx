/**
 * src/features/home/components/NowPlayingCard.tsx
 *
 * Now Playing card for home screen - wrapper around PlayerModule
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { NowPlayingCardProps } from '../types';
import { PlayerModule } from '@/features/player/components/PlayerModule';
import { scale } from '@/shared/theme';

export function NowPlayingCard({
  book,
  progress,
  isPlaying,
  isLoading,
  playbackSpeed,
  sleepTimer,
  onPress,
  onCoverPress,
  onPlay,
  onSkipBack,
  onSkipForward,
  onSkipBackPressIn,
  onSkipBackPressOut,
  onSkipForwardPressIn,
  onSkipForwardPressOut,
  onSpeedPress,
  onSleepPress,
  onDownloadPress,
  onClosePanel,
  onLongPress,
  onChapterPress,
  onTimePress,
  isSeeking,
  seekDelta,
  seekDirection,
  panelMode,
  panelContent,
}: NowPlayingCardProps & {
  onCoverPress?: () => void;
  onSkipBackPressIn?: () => void;
  onSkipBackPressOut?: () => void;
  onSkipForwardPressIn?: () => void;
  onSkipForwardPressOut?: () => void;
  onSpeedPress?: () => void;
  onSleepPress?: () => void;
  onDownloadPress?: () => void;
  onClosePanel?: () => void;
  onLongPress?: () => void;
  onChapterPress?: () => void;
  onTimePress?: () => void;
  isSeeking?: boolean;
  isLoading?: boolean;
  seekDelta?: number;
  seekDirection?: 'forward' | 'backward' | null;
  panelMode?: string;
  panelContent?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.95}
    >
      <PlayerModule
        book={book}
        progress={progress}
        isPlaying={isPlaying}
        isLoading={isLoading}
        playbackSpeed={playbackSpeed}
        sleepTimer={sleepTimer}
        onCoverPress={onCoverPress}
        onCoverLongPress={onLongPress}
        onPlay={onPlay}
        onSkipBack={onSkipBack}
        onSkipForward={onSkipForward}
        onSkipBackPressIn={onSkipBackPressIn}
        onSkipBackPressOut={onSkipBackPressOut}
        onSkipForwardPressIn={onSkipForwardPressIn}
        onSkipForwardPressOut={onSkipForwardPressOut}
        onSpeedPress={onSpeedPress}
        onSleepPress={onSleepPress}
        onChapterPress={onChapterPress}
        onTimePress={onTimePress}
        onDownloadPress={onDownloadPress}
        isSeeking={isSeeking}
        seekDelta={seekDelta}
        seekDirection={seekDirection}
        panelMode={panelMode}
        panelContent={panelContent}
        onClosePanel={onClosePanel}
        variant="home"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: scale(382),
  },
});
