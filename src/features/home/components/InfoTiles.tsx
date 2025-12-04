/**
 * src/features/home/components/InfoTiles.tsx
 *
 * Info tiles with black pill backgrounds
 * Left: Title + Chapter | Right: Time + Speed + Sleep Timer
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../homeDesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

interface InfoTilesProps {
  title: string;
  chapter?: string;
  chapterNumber?: number;
  timeRemaining?: string;
  sleepTimerMinutes?: number | null;
  playbackSpeed?: number;
}

export function InfoTiles({
  title,
  chapter,
  chapterNumber,
  timeRemaining,
  sleepTimerMinutes,
  playbackSpeed = 1,
}: InfoTilesProps) {
  const formatSleepTimer = (minutes?: number | null): string | null => {
    if (!minutes || minutes <= 0) return null;
    return `${Math.round(minutes)}m`;
  };

  const sleepTimerText = formatSleepTimer(sleepTimerMinutes);
  const chapterDisplay = chapterNumber ? `Chpt.\n${chapterNumber}` : chapter;

  return (
    <View style={styles.container}>
      {/* Left Pill: Title & Chapter */}
      <View style={styles.leftPill}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {chapterDisplay && (
          <Text style={styles.chapter}>
            {chapterDisplay}
          </Text>
        )}
      </View>

      {/* Right Pill: Time, Speed & Sleep Timer */}
      <View style={styles.rightPill}>
        <Text style={styles.timeText}>{timeRemaining || '00:00:00'}</Text>
        <View style={styles.bottomRow}>
          <Text style={styles.speedText}>{playbackSpeed.toFixed(2)}x</Text>
          {sleepTimerText && (
            <Text style={styles.sleepTimerText}>{sleepTimerText}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(4),
  },
  leftPill: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#000000',
    borderRadius: 5,
    paddingHorizontal: scale(11),
    paddingVertical: scale(7),
    minHeight: scale(61),
  },
  rightPill: {
    backgroundColor: '#000000',
    borderRadius: 5,
    paddingHorizontal: scale(11),
    paddingVertical: scale(5),
    minHeight: scale(61),
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontFamily: 'Courier',
    fontSize: scale(20),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(21),
  },
  chapter: {
    fontFamily: 'Courier',
    fontSize: scale(20),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(21),
    textAlign: 'right',
  },
  timeText: {
    fontFamily: 'Courier',
    fontSize: scale(20),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(21),
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  speedText: {
    fontFamily: 'Courier',
    fontSize: scale(20),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(21),
  },
  sleepTimerText: {
    fontFamily: 'Courier',
    fontSize: scale(20),
    fontWeight: '400',
    color: '#F12802',
    lineHeight: scale(21),
  },
});
