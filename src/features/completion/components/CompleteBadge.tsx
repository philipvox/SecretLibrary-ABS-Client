/**
 * src/features/completion/components/CompleteBadge.tsx
 *
 * Visual badge indicator for books marked as complete.
 * Shows a checkmark overlay on book covers.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsComplete } from '../stores/completionStore';
import { colors, scale } from '@/shared/theme';

const ACCENT = colors.accent;

interface CompleteBadgeProps {
  bookId: string;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

/**
 * CompleteBadge - Shows a checkmark badge when a book is marked complete
 *
 * Use this component as an overlay on book cover images.
 * Position it absolutely in the corner of the cover.
 */
export function CompleteBadge({ bookId, size = 'medium', style }: CompleteBadgeProps) {
  const isComplete = useIsComplete(bookId);

  if (!isComplete) {
    return null;
  }

  const sizeConfig = {
    small: {
      container: scale(18),
      icon: scale(12),
      borderRadius: scale(9),
    },
    medium: {
      container: scale(24),
      icon: scale(16),
      borderRadius: scale(12),
    },
    large: {
      container: scale(32),
      icon: scale(20),
      borderRadius: scale(16),
    },
  };

  const config = sizeConfig[size];

  return (
    <View
      style={[
        styles.badge,
        {
          width: config.container,
          height: config.container,
          borderRadius: config.borderRadius,
        },
        style,
      ]}
    >
      <Ionicons name="checkmark" size={config.icon} color="#000" />
    </View>
  );
}

/**
 * CompleteBadgeOverlay - Full corner overlay with background blur effect
 *
 * Use this for a more prominent completion indicator.
 */
export function CompleteBadgeOverlay({ bookId, size = 'medium', style }: CompleteBadgeProps) {
  const isComplete = useIsComplete(bookId);

  if (!isComplete) {
    return null;
  }

  const sizeConfig = {
    small: {
      container: scale(20),
      icon: scale(14),
    },
    medium: {
      container: scale(28),
      icon: scale(18),
    },
    large: {
      container: scale(36),
      icon: scale(22),
    },
  };

  const config = sizeConfig[size];

  return (
    <View style={[styles.overlay, style]}>
      <View
        style={[
          styles.overlayBadge,
          {
            width: config.container,
            height: config.container,
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={config.icon} color={ACCENT} />
      </View>
    </View>
  );
}

/**
 * CompleteBanner - Horizontal banner overlay for list items
 *
 * Use this for compact list views where a corner badge might be too subtle.
 */
export function CompleteBanner({ bookId, style }: Omit<CompleteBadgeProps, 'size'>) {
  const isComplete = useIsComplete(bookId);

  if (!isComplete) {
    return null;
  }

  return (
    <View style={[styles.banner, style]}>
      <Ionicons name="checkmark-circle" size={scale(12)} color="#000" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Simple badge
  badge: {
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  // Overlay badge (positioned in corner)
  overlay: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
    zIndex: 10,
  },
  overlayBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Horizontal banner
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: ACCENT,
    paddingVertical: scale(3),
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: scale(6),
    borderBottomRightRadius: scale(6),
  },
});
