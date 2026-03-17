/**
 * src/features/browse/components/SectionHeader.tsx
 *
 * Standardized section header for all Browse tab sections.
 * Caps monospace label + optional serif bold heading + optional count + VIEW ALL.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';

interface SectionHeaderProps {
  /** Caps monospace label (e.g., "BECAUSE YOU FINISHED") */
  label: string;
  /** Bold serif heading below the label */
  heading?: string;
  /** Count shown after label in white accent */
  count?: number;
  /** VIEW ALL callback — shows "VIEW ALL ›" link */
  onViewAll?: () => void;
  /** Override heading color (for dark backgrounds) */
  headingColor?: string;
  /** Override label color (for dark backgrounds) */
  labelColor?: string;
}

export const SectionHeader = React.memo(function SectionHeader({ label, heading, count, onViewAll, headingColor, labelColor }: SectionHeaderProps) {
  const colors = useSecretLibraryColors();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: labelColor || colors.gray }]}>{label}</Text>
          {count !== undefined && (
            <Text style={[styles.count, { color: colors.black }]}> · {count}</Text>
          )}
        </View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.viewAll, { color: colors.gray }]}>VIEW ALL ›</Text>
          </TouchableOpacity>
        )}
      </View>
      {heading && (
        <Text style={[styles.heading, { color: headingColor || colors.black }]}>{heading}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: scale(36),
    paddingBottom: scale(16),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    opacity: 0.6,
  },
  count: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  viewAll: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    opacity: 0.6,
  },
  heading: {
    fontFamily: secretLibraryFonts.playfair.bold,
    fontSize: scale(18),
    fontWeight: '700',
    marginTop: scale(4),
  },
});
