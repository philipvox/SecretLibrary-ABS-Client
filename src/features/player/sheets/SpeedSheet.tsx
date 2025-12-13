/**
 * src/features/player/sheets/SpeedSheet.tsx
 *
 * Unified Playback Speed bottom sheet component.
 * Use this component from any screen to control playback speed.
 * All state is managed via playerStore.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../stores/playerStore';
import { haptics } from '@/core/native/haptics';
import { colors, spacing, radius, wp, layout } from '@/shared/theme';

// =============================================================================
// CONSTANTS
// =============================================================================

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

// =============================================================================
// TYPES
// =============================================================================

interface SpeedSheetProps {
  visible: boolean;
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SpeedSheet({ visible, onClose }: SpeedSheetProps) {
  const insets = useSafeAreaInsets();

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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Playback Speed</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#FFF" />
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
              <Ionicons name="refresh-outline" size={18} color="#FFF" />
              <Text style={styles.resetButtonText}>Reset to Normal</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.backgroundTertiary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentSpeed: {
    fontSize: 48,
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
