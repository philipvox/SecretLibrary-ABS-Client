/**
 * src/features/mood-discovery/components/QuickTuneBar.tsx
 *
 * Floating bar displaying active mood session info.
 * Shows current mood, pace, weight, world filters with edit/clear buttons.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MOODS, PACES, WEIGHTS, WORLDS, LENGTHS, MoodSession } from '../types';
import {
  useSessionInfo,
  formatTimeRemaining,
  getTimeRemainingFromExpiry,
} from '../stores/moodSessionStore';
import { Icon } from '@/shared/components/Icon';
import { spacing, radius, useTheme, type ThemeColors } from '@/shared/theme';
import { secretLibraryColors } from '@/shared/theme/secretLibrary';

interface QuickTuneBarProps {
  /** Active session to display */
  session: MoodSession;
  /** Callback to open full editor */
  onEditPress?: () => void;
  /** Callback when session is cleared */
  onClear?: () => void;
}

interface FilterChipProps {
  label: string;
  icon: string;
  iconSet: string;
  active?: boolean;
  colors: ThemeColors;
  accentColor: string;
  textOnAccent: string;
}

function FilterChip({ label, icon, iconSet, active = true, colors, accentColor, textOnAccent }: FilterChipProps) {
  return (
    <View style={[styles.filterChip, active && { backgroundColor: accentColor }]}>
      <Icon
        name={icon as any}
        size={14}
        color={active ? textOnAccent : colors.text.secondary}
      />
      <Text style={[styles.filterChipLabel, { color: colors.text.secondary }, active && { color: textOnAccent }]}>
        {label}
      </Text>
    </View>
  );
}

export function QuickTuneBar({
  session,
  onEditPress,
  onClear,
}: QuickTuneBarProps) {
  const { colors } = useTheme();
  const accent = secretLibraryColors.gold;
  const textOnAccent = colors.accent.textOnAccent;
  const { expiresAt, clearSession } = useSessionInfo();

  // Calculate time remaining locally to avoid infinite re-renders
  const [timeRemaining, setTimeRemaining] = useState(() =>
    getTimeRemainingFromExpiry(expiresAt)
  );

  // Update time remaining every minute
  useEffect(() => {
    setTimeRemaining(getTimeRemainingFromExpiry(expiresAt));

    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemainingFromExpiry(expiresAt));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearSession();
    onClear?.();
  };

  // Get config for current session values
  const moodConfig = MOODS.find((m) => m.id === session.mood);
  const paceConfig = session.pace !== 'any' ? PACES.find((p) => p.id === session.pace) : null;
  const weightConfig = session.weight !== 'any' ? WEIGHTS.find((w) => w.id === session.weight) : null;
  const worldConfig = session.world !== 'any' ? WORLDS.find((w) => w.id === session.world) : null;
  const lengthConfig = session.length !== 'any' ? LENGTHS.find((l) => l.id === session.length) : null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}
    >
      {/* Timer and Edit */}
      <View style={styles.header}>
        <View style={styles.timerContainer}>
          <Icon
            name="Clock"
            size={14}
            color={colors.text.tertiary}
          />
          <Text style={[styles.timerText, { color: colors.text.tertiary }]}>
            {formatTimeRemaining(timeRemaining)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {onEditPress && (
            <TouchableOpacity
              onPress={onEditPress}
              style={styles.editButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name="SlidersHorizontal"
                size={18}
                color={accent}
              />
              <Text style={[styles.editText, { color: accent }]}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="XCircle"
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips - scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {/* Primary mood chip */}
        {moodConfig && (
          <FilterChip
            label={moodConfig.label}
            icon={moodConfig.icon}
            iconSet={moodConfig.iconSet}
            active
            colors={colors}
            accentColor={accent}
            textOnAccent={textOnAccent}
          />
        )}

        {/* Pace chip */}
        {paceConfig && (
          <FilterChip
            label={paceConfig.label}
            icon={paceConfig.icon}
            iconSet={paceConfig.iconSet}
            colors={colors}
            accentColor={accent}
            textOnAccent={textOnAccent}
          />
        )}

        {/* Weight chip */}
        {weightConfig && (
          <FilterChip
            label={weightConfig.label}
            icon={weightConfig.icon}
            iconSet={weightConfig.iconSet}
            colors={colors}
            accentColor={accent}
            textOnAccent={textOnAccent}
          />
        )}

        {/* World chip */}
        {worldConfig && (
          <FilterChip
            label={worldConfig.label}
            icon={worldConfig.icon}
            iconSet={worldConfig.iconSet}
            colors={colors}
            accentColor={accent}
            textOnAccent={textOnAccent}
          />
        )}

        {/* Length chip */}
        {lengthConfig && (
          <FilterChip
            label={lengthConfig.label}
            icon={lengthConfig.icon}
            iconSet={lengthConfig.iconSet}
            colors={colors}
            accentColor={accent}
            textOnAccent={textOnAccent}
          />
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // backgroundColor set via themeColors in JSX
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    // borderColor set via themeColors in JSX
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerText: {
    fontSize: 12,
    // color set via themeColors in JSX
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: {
    fontSize: 13,
    // color set dynamically via accent in JSX
    fontWeight: '500',
  },
  clearButton: {
    padding: 2,
  },
  filtersContainer: {
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  filterChipLabel: {
    fontSize: 12,
    // color set via themeColors in JSX
    fontWeight: '500',
  },
});
