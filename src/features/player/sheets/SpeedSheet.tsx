/**
 * src/features/player/sheets/SpeedSheet.tsx
 *
 * Unified Playback Speed panel component (inline overlay style).
 * Use this component from any screen to control playback speed.
 * All state is managed via playerStore.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../stores/playerStore';
import { haptics } from '@/core/native/haptics';
import { colors, spacing, radius, wp, scale, layout } from '@/shared/theme';

// =============================================================================
// CONSTANTS
// =============================================================================

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

// =============================================================================
// TYPES
// =============================================================================

interface SpeedSheetProps {
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SpeedSheet({ onClose }: SpeedSheetProps) {
  // Player store state
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSpeedSelect = useCallback((speed: number) => {
    haptics.selection();
    setPlaybackRate(speed);
    onClose();
  }, [setPlaybackRate, onClose]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Playback Speed</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Current Speed Display */}
      <Text style={styles.currentSpeed}>{playbackRate}x</Text>

      {/* Speed Options Grid */}
      <View style={styles.optionsGrid}>
        {SPEED_OPTIONS.map((speed) => {
          const isActive = Math.abs(playbackRate - speed) < 0.01;
          return (
            <TouchableOpacity
              key={speed}
              style={[
                styles.optionButton,
                isActive && styles.optionButtonActive,
              ]}
              onPress={() => handleSpeedSelect(speed)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                isActive && styles.optionTextActive,
              ]}>
                {speed}x
              </Text>
              {speed === 1 && (
                <Text style={[
                  styles.optionLabel,
                  isActive && styles.optionLabelActive,
                ]}>
                  Normal
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Reset to 1x Button */}
      {playbackRate !== 1 && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => handleSpeedSelect(1)}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.resetButtonText}>Reset to Normal</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentSpeed: {
    fontSize: scale(42),
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionButton: {
    width: (wp(100) - 80) / 3,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: colors.accent,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.backgroundPrimary,
  },
  optionLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  optionLabelActive: {
    color: 'rgba(0,0,0,0.5)',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.cardBackground,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default SpeedSheet;
