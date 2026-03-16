/**
 * src/features/home/components/EmptySection.tsx
 *
 * Empty state component for Home screen sections
 * Provides consistent styling for empty Continue Listening, Queue, Series sections
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  spacing,
  radius,
  scale,
  layout,
  useTheme,
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
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text.secondary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.text.tertiary }]}>{description}</Text>
      {ctaLabel && onCTAPress && (
        <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.background.elevated }]} onPress={onCTAPress}>
          <Text style={[styles.ctaText, { color: colors.accent.primary }]}>{ctaLabel}</Text>
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
    // color set via themeColors.textSecondary in JSX
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: scale(12),
    // color set via themeColors.textTertiary in JSX
    textAlign: 'center',
    lineHeight: scale(18),
    maxWidth: scale(280),
  },
  ctaButton: {
    marginTop: spacing.md,
    // backgroundColor set via themeColors.card in JSX
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  ctaText: {
    fontSize: scale(12),
    fontWeight: '600',
    // color set via colors.accent.primary in JSX
  },
});
