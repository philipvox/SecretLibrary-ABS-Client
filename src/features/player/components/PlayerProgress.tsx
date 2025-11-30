/**
 * src/features/player/components/PlayerProgress.tsx
 */

import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { formatSleepTimer } from '../utils';

interface PlayerProgressProps {
  progress: number;
  chapterProgress: number;
  chapterIndex: number;
  totalChapters: number;
  progressMode: 'bar' | 'chapters';
  sleepTimer: number | null;
  cardColor: string;
  onSleepPress: () => void;
  onSettingsPress: () => void;
  onProgressScrub: (percent: number) => void;
  onChapterScrub: (percent: number) => void;
  bottomInset: number;
}

export function PlayerProgress({
  progress,
  chapterProgress,
  chapterIndex,
  totalChapters,
  progressMode,
  sleepTimer,
  cardColor,
  onSleepPress,
  onSettingsPress,
  onProgressScrub,
  onChapterScrub,
  bottomInset,
}: PlayerProgressProps) {
  const [barWidth, setBarWidth] = useState(200);
  const currentProgress = progressMode === 'bar' ? progress : chapterProgress;

  const handlePress = (e: any) => {
    const x = e.nativeEvent.locationX;
    const percent = Math.max(0, Math.min(1, x / barWidth));
    
    if (progressMode === 'bar') {
      onProgressScrub(percent);
    } else {
      onChapterScrub(percent);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomInset + 8 }]}>
      {/* Sleep button */}
      <TouchableOpacity style={styles.sideButton} onPress={onSleepPress}>
        {sleepTimer !== null ? (
          <Text style={styles.sleepCountdown}>{formatSleepTimer(sleepTimer)}</Text>
        ) : (
          <Icon name="moon" size={24} color="rgba(255,255,255,0.7)" set="ionicons" />
        )}
      </TouchableOpacity>

      {/* Progress bar */}
      <Pressable
        style={styles.progressContainer}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        onPress={handlePress}
      >
        <View style={styles.progressTrack} />
        <View 
          style={[
            styles.progressFill, 
            { width: `${currentProgress * 100}%`, backgroundColor: cardColor }
          ]} 
        />
        <View 
          style={[
            styles.progressMarker,
            { left: `${currentProgress * 100}%` }
          ]} 
        />
        {progressMode === 'chapters' && (
          <View style={styles.chapterIndicator}>
            <Text style={styles.chapterIndicatorText}>
              Ch {chapterIndex}/{totalChapters}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Settings button */}
      <TouchableOpacity style={styles.sideButton} onPress={onSettingsPress}>
        <Icon name="settings" size={24} color="rgba(255,255,255,0.7)" set="ionicons" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  sideButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sleepCountdown: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF9500',
    fontVariant: ['tabular-nums'],
  },
  progressContainer: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
  },
  progressMarker: {
    position: 'absolute',
    width: 4,
    height: 24,
    backgroundColor: '#FF3B30',
    borderRadius: 2,
    marginLeft: -2,
    top: 10,
  },
  chapterIndicator: {
    position: 'absolute',
    right: 0,
    top: -2,
  },
  chapterIndicatorText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
});

export default PlayerProgress;