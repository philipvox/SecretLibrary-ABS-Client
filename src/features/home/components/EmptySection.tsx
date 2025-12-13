/**
 * src/features/home/components/EmptySection.tsx
 *
 * Empty state component for Home screen sections
 * Provides consistent styling for empty Continue Listening, Queue, Series sections
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  colors,
  spacing,
  radius,
  scale,
  layout,
} from '@/shared/theme';

interface EmptySectionProps {
  title: string;
  description: string;
  ctaLabel?: string;
  onCTAPress?: () => void;
}

export function EmptySection({
  title,
  description,
  ctaLabel,
  onCTAPress,
}: EmptySectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {ctaLabel && onCTAPress && (
        <TouchableOpacity style={styles.ctaButton} onPress={onCTAPress}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: scale(12),
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: scale(18),
    maxWidth: scale(280),
  },
  ctaButton: {
    marginTop: spacing.md,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  ctaText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.accent,
  },
});
