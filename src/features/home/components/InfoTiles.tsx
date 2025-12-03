/**
 * src/features/home/components/InfoTiles.tsx
 *
 * Info tiles displaying book title, chapter, time, speed and sleep timer
 * Layout: Title/Chapter on left, Time/Speed/Timer on right
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, DIMENSIONS } from '../homeDesign';

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
  // Format sleep timer
  const formatSleepTimer = (minutes?: number | null): string | null => {
    if (!minutes || minutes <= 0) return null;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}m`;
    }
    return `${Math.round(minutes)}m`;
  };

  const sleepTimerText = formatSleepTimer(sleepTimerMinutes);
  const chapterDisplay = chapterNumber ? `Chpt. ${chapterNumber}` : chapter;

  return (
    <View style={styles.container}>
      {/* Left Column: Title & Chapter */}
      <View style={styles.leftColumn}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {chapterDisplay && (
          <Text style={styles.chapter} numberOfLines={1}>
            {chapterDisplay}
          </Text>
        )}
      </View>

      {/* Right Column: Time, Speed & Sleep Timer */}
      <View style={styles.rightColumn}>
        <Text style={styles.timeText}>{timeRemaining || '00:00:00'}</Text>
        <View style={styles.speedRow}>
          <Text style={styles.speedText}>{playbackSpeed.toFixed(2)}x</Text>
          {sleepTimerText && (
            <View style={styles.sleepTimerBadge}>
              <Text style={styles.sleepTimerText}>{sleepTimerText}</Text>
            </View>
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
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftColumn: {
    flex: 1,
    marginRight: 16,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  chapter: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Courier',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  sleepTimerBadge: {
    backgroundColor: COLORS.sleepTimerRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  sleepTimerText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
