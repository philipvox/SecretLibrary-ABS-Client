/**
 * src/features/home/components/InfoTiles.tsx
 *
 * Info tiles with black pill backgrounds and blur shadow effect
 * Left Pill (240x61): Title (left) | Chapter (right) - with blur shadow
 * Right Pill (135x61): Time (top) | Speed (bottom-left) | Sleep Timer (bottom-right, red)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, scale } from '@/shared/theme';

interface InfoTilesProps {
  title: string;
  chapter?: string;
  chapterNumber?: number;
  timeRemaining?: string;
  sleepTimerMinutes?: number | null;
  playbackSpeed?: number;
  onSpeedPress?: () => void;
  onSleepPress?: () => void;
  onChapterPress?: () => void;
  onTimePress?: () => void;
  isSeeking?: boolean;
  seekDelta?: number;
  seekDirection?: 'forward' | 'backward' | null;
  isPlaying?: boolean;
}

// 8-bit pixel play icon component
function PixelPlayIcon() {
  const pixelSize = scale(3);
  return (
    <View style={pixelPlayStyles.container}>
      {/* Row 1: 1 pixel */}
      <View style={pixelPlayStyles.row}>
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
      </View>
      {/* Row 2: 2 pixels */}
      <View style={pixelPlayStyles.row}>
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
      </View>
      {/* Row 3: 3 pixels */}
      <View style={pixelPlayStyles.row}>
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
      </View>
      {/* Row 4: 2 pixels */}
      <View style={pixelPlayStyles.row}>
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
      </View>
      {/* Row 5: 1 pixel */}
      <View style={pixelPlayStyles.row}>
        <View style={[pixelPlayStyles.pixel, { width: pixelSize, height: pixelSize }]} />
      </View>
    </View>
  );
}

const pixelPlayStyles = StyleSheet.create({
  container: {
    marginLeft: scale(6),
  },
  row: {
    flexDirection: 'row',
  },
  pixel: {
    backgroundColor: '#FFFFFF',
    // Glow effect
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
});

// Format seek delta for display (same as PlayerScreen)
const formatSeekDelta = (seconds: number): string => {
  const absSeconds = Math.abs(seconds);
  const sign = seconds >= 0 ? '+' : '-';
  if (absSeconds < 60) {
    return `${sign}${Math.round(absSeconds)}s`;
  }
  const mins = Math.floor(absSeconds / 60);
  const secs = Math.round(absSeconds % 60);
  return secs > 0 ? `${sign}${mins}m ${secs}s` : `${sign}${mins}m`;
};

export function InfoTiles({
  title,
  chapter,
  chapterNumber,
  timeRemaining,
  sleepTimerMinutes,
  playbackSpeed = 1,
  onSpeedPress,
  onSleepPress,
  onChapterPress,
  onTimePress,
  isSeeking,
  seekDelta,
  seekDirection,
  isPlaying = false,
}: InfoTilesProps) {
  const formatSleepTimer = (minutes?: number | null): string => {
    if (minutes === null || minutes === undefined || minutes === 0) return '∞';
    // If value seems to be in seconds (> 120), convert it
    const mins = minutes > 120 ? Math.round(minutes / 60) : Math.round(minutes);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const sleepTimerText = formatSleepTimer(sleepTimerMinutes);
  
  // Format chapter as two lines: "Chpt." and number
  const chapterLine1 = 'Chpt.';
  const chapterLine2 = chapterNumber?.toString() || chapter || '1';

  // Format speed with 2 decimal places
  const speedText = `${playbackSpeed.toFixed(2)}x`;

  return (
    <View style={styles.container}>
      {/* Left Pill: Title & Chapter */}
      <View style={styles.leftPill}>
        {/* Blur shadow layer (behind text) */}
        <View style={styles.blurLayer} pointerEvents="none">
          <Text style={[styles.titleText, styles.blurText]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.chapterContainer}>
            <Text style={[styles.chapterText, styles.blurText]}>{chapterLine1}</Text>
            <Text style={[styles.chapterText, styles.blurText]}>{chapterLine2}</Text>
          </View>
        </View>
        
        {/* Actual text layer */}
        <Text style={styles.titleText} numberOfLines={2}>
          {title}
        </Text>
        <TouchableOpacity
          style={styles.chapterContainer}
          onPress={onChapterPress}
          disabled={!onChapterPress}
          activeOpacity={0.7}
        >
          <Text style={styles.chapterText}>{chapterLine1}</Text>
          <Text style={styles.chapterText}>{chapterLine2}</Text>
        </TouchableOpacity>
      </View>

      {/* Right Pill: Time, Speed & Sleep Timer */}
      <View style={styles.rightPill}>
        {/* Show seek delta when seeking, otherwise show time remaining */}
        <TouchableOpacity
          style={styles.timeRow}
          onPress={onTimePress}
          disabled={!onTimePress}
          activeOpacity={0.7}
        >
          {isSeeking && seekDelta !== undefined && seekDelta !== 0 ? (
            <Text style={[styles.timeText, styles.seekDeltaText]}>
              {formatSeekDelta(seekDelta)}
            </Text>
          ) : (
            <Text style={styles.timeText}>{timeRemaining || '00:00:00'}</Text>
          )}
          {isPlaying && !isSeeking && <PixelPlayIcon />}
        </TouchableOpacity>
        <View style={styles.bottomRow}>
          <TouchableOpacity onPress={onSpeedPress} disabled={!onSpeedPress}>
            <Text style={styles.speedText}>{speedText}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSleepPress} disabled={!onSleepPress}>
            <Text style={styles.sleepTimerText}>{sleepTimerText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Smaller font size for mini player
const FONT_SIZE = 16;
const LINE_HEIGHT = 17;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: scale(6),
  },
  // Left pill: 236x55 - no background
  leftPill: {
    width: scale(236),
    height: scale(55),
    paddingHorizontal: scale(11),
    paddingVertical: scale(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Blur shadow effect behind text (glow)
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: scale(11),
    paddingVertical: scale(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.6,
  },
  blurText: {
    // Strong glow effect
    textShadowColor: 'rgba(255, 255, 255, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  // Right pill: 135x55 - no background
  rightPill: {
    width: scale(135),
    height: scale(55),
    paddingHorizontal: scale(11),
    paddingVertical: scale(6),
    justifyContent: 'space-between',
  },
  titleText: {
    flex: 1,
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: colors.textPrimary,
    lineHeight: scale(LINE_HEIGHT),
    // Subtle glow on main text
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  chapterContainer: {
    alignItems: 'flex-end',
  },
  chapterText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: colors.textPrimary,
    lineHeight: scale(LINE_HEIGHT),
    textAlign: 'right',
    // Subtle glow
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: colors.textPrimary,
    lineHeight: scale(LINE_HEIGHT),
    // Subtle glow
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  seekDeltaText: {
    color: colors.accent, // Golden yellow like PlayerScreen
    textShadowColor: 'rgba(244, 182, 12, 1)',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speedText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: colors.textPrimary,
    lineHeight: scale(LINE_HEIGHT),
    // Subtle glow
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  sleepTimerText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: colors.sleepTimer,
    lineHeight: scale(LINE_HEIGHT),
    // Red glow for timer
    textShadowColor: 'rgba(241, 40, 2, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
