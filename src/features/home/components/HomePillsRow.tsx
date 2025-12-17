/**
 * src/features/home/components/HomePillsRow.tsx
 *
 * Sleep timer, queue, and playback speed pills for Home screen
 * Positioned at far left, center, and right edges below the CD disc
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, wp, moderateScale, radius } from '@/shared/theme';
import { useQueueCount } from '@/features/queue/stores/queueStore';

interface HomePillsRowProps {
  /** Current sleep timer remaining in seconds (null if off) */
  sleepTimer: number | null;
  /** Current playback speed */
  playbackSpeed: number;
  /** Callback when sleep pill is pressed */
  onSleepPress: () => void;
  /** Callback when speed pill is pressed */
  onSpeedPress: () => void;
  /** Callback when queue pill is pressed */
  onQueuePress: () => void;
  /** Whether to show the pills (hidden when no book loaded) */
  visible: boolean;
}

const ICON_SIZE = wp(3.5);
const ACCENT = colors.accent;

/**
 * Moon icon for sleep timer
 */
const MoonIcon = () => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 13 13" fill="none">
    <Path
      d="M13 7.08559C12.8861 8.31757 12.4238 9.49165 11.667 10.4704C10.9102 11.4492 9.89037 12.1923 8.72672 12.6126C7.56307 13.0329 6.30378 13.1131 5.09621 12.8439C3.88863 12.5746 2.78271 11.967 1.90785 11.0921C1.033 10.2173 0.425392 9.11137 0.156131 7.90379C-0.11313 6.69622 -0.0329082 5.43693 0.38741 4.27328C0.807727 3.10963 1.55076 2.08975 2.52955 1.33298C3.50835 0.576212 4.68243 0.113851 5.91441 0C5.19313 0.975819 4.84604 2.17811 4.93628 3.38821C5.02652 4.59831 5.54809 5.73582 6.40614 6.59386C7.26418 7.45191 8.40169 7.97348 9.61179 8.06372C10.8219 8.15396 12.0242 7.80687 13 7.08559Z"
      fill="white"
    />
  </Svg>
);

/**
 * Format sleep timer display
 */
function formatSleepTimer(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'Off';
  const mins = Math.ceil(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

export function HomePillsRow({
  sleepTimer,
  playbackSpeed,
  onSleepPress,
  onSpeedPress,
  onQueuePress,
  visible,
}: HomePillsRowProps) {
  const queueCount = useQueueCount();

  if (!visible) return null;

  const isSleepActive = sleepTimer !== null && sleepTimer > 0;
  const isSpeedModified = playbackSpeed !== 1;
  const hasQueueItems = queueCount > 0;

  return (
    <View style={styles.container}>
      {/* Sleep Timer Pill - Far Left */}
      <TouchableOpacity
        onPress={onSleepPress}
        style={styles.pill}
        activeOpacity={0.7}
        accessibilityLabel={isSleepActive
          ? `Sleep timer active, ${formatSleepTimer(sleepTimer)} remaining`
          : 'Set sleep timer'}
        accessibilityRole="button"
      >
        <MoonIcon />
        <Text style={[styles.pillText, isSleepActive && styles.pillTextActive]}>
          {formatSleepTimer(sleepTimer)}
        </Text>
      </TouchableOpacity>

      {/* Queue Pill - Absolutely centered on screen */}
      <View style={styles.queuePillWrapper}>
        <TouchableOpacity
          onPress={onQueuePress}
          style={styles.queuePill}
          activeOpacity={0.7}
          accessibilityLabel={hasQueueItems
            ? `Queue with ${queueCount} items`
            : 'Queue is empty'}
          accessibilityRole="button"
        >
          <Ionicons
            name="list"
            size={ICON_SIZE}
            color={hasQueueItems ? ACCENT : colors.textPrimary}
          />
          {hasQueueItems && (
            <Text style={[styles.pillText, styles.pillTextActive]}>
              {queueCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Playback Speed Pill - Far Right */}
      <TouchableOpacity
        onPress={onSpeedPress}
        style={styles.pill}
        activeOpacity={0.7}
        accessibilityLabel={`Playback speed ${playbackSpeed}x. Tap to change.`}
        accessibilityRole="button"
      >
        <Text style={[styles.pillText, isSpeedModified && styles.pillTextActive]}>
          {playbackSpeed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    marginTop: -wp(2),
    marginBottom: wp(4),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    paddingVertical: wp(2),
    paddingHorizontal: wp(3),
    gap: wp(1.5),
  },
  queuePillWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    paddingVertical: wp(2),
    paddingHorizontal: wp(3),
    gap: wp(1.5),
  },
  pillText: {
    color: colors.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  pillTextActive: {
    color: colors.accent,
  },
});

export default HomePillsRow;
