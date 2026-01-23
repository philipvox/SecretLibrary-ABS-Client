/**
 * src/features/discover/components/MoodFilterPills.tsx
 *
 * Mood-aware filter display for the Browse screen.
 * Shows current mood session preferences with ability to edit or clear.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/shared/components/Icon';
import { scale, layout, radius, spacing, useTheme } from '@/shared/theme';
import {
  MoodSession,
  MOODS,
  PACES,
  WEIGHTS,
  WORLDS,
} from '@/features/mood-discovery/types';
import {
  useSessionInfo,
  getTimeRemainingFromExpiry,
} from '@/features/mood-discovery/stores/moodSessionStore';

// White styling for hero overlay

// ============================================================================
// TYPES
// ============================================================================

interface MoodFilterPillsProps {
  session: MoodSession;
  onEditPress?: () => void;
  onClear?: () => void;
}

interface FilterChipProps {
  label: string;
  icon: string;
  iconSet?: string;
  active?: boolean;
  activeColor?: string;
  onPress?: () => void;
}

// ============================================================================
// TIME FORMATTING
// ============================================================================

function formatCompactTime(ms: number): string {
  if (ms <= 0) return '0s';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatFullTime(ms: number): string {
  if (ms <= 0) return 'Expired';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

  return parts.join(', ');
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function FilterChip({ label, icon, active = false, activeColor }: FilterChipProps) {
  // These pills are on a dark/transparent overlay, so text is always white for visibility
  return (
    <View style={[
      styles.filterChip,
      active && activeColor && { backgroundColor: activeColor, borderColor: activeColor }
    ]}>
      <Icon
        name={icon as any}
        size={16}
        color="#FFFFFF"
      />
      <Text style={[styles.filterChipText, { color: '#FFFFFF' }]}>
        {label}
      </Text>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MoodFilterPills({
  session,
  onEditPress,
  onClear,
}: MoodFilterPillsProps) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { expiresAt, clearSession } = useSessionInfo();
  const [showTimerPopup, setShowTimerPopup] = useState(false);

  // Calculate time remaining locally
  const [timeRemaining, setTimeRemaining] = useState(() =>
    getTimeRemainingFromExpiry(expiresAt)
  );

  // Update interval based on remaining time
  useEffect(() => {
    setTimeRemaining(getTimeRemainingFromExpiry(expiresAt));

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    let intervalMs: number;
    if (hours > 0) {
      intervalMs = 60000;
    } else if (minutes > 0) {
      intervalMs = 10000;
    } else {
      intervalMs = 1000;
    }

    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemainingFromExpiry(expiresAt));
    }, intervalMs);

    return () => clearInterval(interval);
  }, [expiresAt, timeRemaining < 60000]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearSession();
    onClear?.();
  }, [clearSession, onClear]);

  const handleBrowseBy = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('GenresList');
  }, [navigation]);

  const handleTimerPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTimerPopup(true);
  }, []);

  // Get mood config
  const moodConfig = MOODS.find((m) => m.id === session.mood);
  const paceConfig = session.pace !== 'any' ? PACES.find((p) => p.id === session.pace) : null;
  const weightConfig = session.weight !== 'any' ? WEIGHTS.find((w) => w.id === session.weight) : null;
  const worldConfig = session.world !== 'any' ? WORLDS.find((w) => w.id === session.world) : null;

  return (
    <View style={styles.container}>
      {/* Header row: Timer, Edit, Clear, Browse By */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleTimerPress}
          style={styles.timerContainer}
          activeOpacity={0.7}
        >
          <Icon
            name="Clock"
            size={14}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={styles.timerText}>
            {formatCompactTime(timeRemaining)}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {/* Browse By button */}
          <TouchableOpacity
            onPress={handleBrowseBy}
            style={styles.browseByButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="LayoutGrid"
              size={18}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>

          {/* Edit button */}
          {onEditPress && (
            <TouchableOpacity
              onPress={onEditPress}
              style={styles.editButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name="SlidersHorizontal"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          )}

          {/* Clear button */}
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="XCircle"
              size={20}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips - scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {/* Primary mood chip */}
        {moodConfig && (
          <FilterChip
            label={moodConfig.label}
            icon={moodConfig.icon}
            iconSet={moodConfig.iconSet}
          />
        )}

        {/* Pace chip */}
        {paceConfig && (
          <FilterChip
            label={paceConfig.label}
            icon={paceConfig.icon}
            iconSet={paceConfig.iconSet}
          />
        )}

        {/* Weight chip */}
        {weightConfig && (
          <FilterChip
            label={weightConfig.label}
            icon={weightConfig.icon}
            iconSet={weightConfig.iconSet}
          />
        )}

        {/* World chip */}
        {worldConfig && (
          <FilterChip
            label={worldConfig.label}
            icon={worldConfig.icon}
            iconSet={worldConfig.iconSet}
          />
        )}
      </ScrollView>

      {/* Timer Info Popup */}
      <Modal
        visible={showTimerPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimerPopup(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTimerPopup(false)}
        >
          <View style={[styles.timerPopup, { backgroundColor: colors.background.secondary }]}>
            <View style={[styles.timerPopupIcon, { backgroundColor: colors.surface.card }]}>
              <Icon
                name="Clock"
                size={32}
                color={colors.text.primary}
              />
            </View>
            <Text style={[styles.timerPopupTitle, { color: colors.text.primary }]}>Mood Session</Text>
            <Text style={[styles.timerPopupTime, { color: colors.text.primary }]}>
              {formatFullTime(timeRemaining)}
            </Text>
            <Text style={[styles.timerPopupDescription, { color: colors.text.secondary }]}>
              Your mood preferences are temporary and will expire after 24 hours.
              This lets you discover books based on how you feel right now, not forever.
            </Text>
            <TouchableOpacity
              onPress={() => setShowTimerPopup(false)}
              style={[styles.timerPopupButton, { backgroundColor: colors.text.primary }]}
            >
              <Text style={[styles.timerPopupButtonText, { color: colors.background.primary }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.sm,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  timerText: {
    fontSize: scale(12),
    fontWeight: '600',
    // White text for dark overlay visibility
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  browseByButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  editText: {
    fontSize: scale(13),
    fontWeight: '600',
    // White text for dark overlay visibility
    color: '#FFFFFF',
  },
  clearButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  chipsContainer: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    borderRadius: radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    gap: spacing.sm,
  },
  // filterChipActive style is now applied dynamically via activeColor prop
  filterChipText: {
    fontSize: scale(14),
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  timerPopup: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  timerPopupIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timerPopupTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  timerPopupTime: {
    fontSize: scale(24),
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  timerPopupDescription: {
    fontSize: scale(14),
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: spacing.lg,
  },
  timerPopupButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  timerPopupButtonText: {
    fontSize: scale(15),
    fontWeight: '600',
  },
});
