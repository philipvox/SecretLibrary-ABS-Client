/**
 * src/features/home/components/SectionHeader.tsx
 *
 * Section header with title and "View All" button
 * NN/g UX: Clear visual hierarchy with larger, more prominent section titles
 * Touch targets: minimum 44×44px for "View All" button
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { scale } from '@/shared/theme';
import { useThemeColors } from '@/shared/theme/themeStore';
import { SectionHeaderProps } from '../types';

// NN/g: Larger section headers for clear content hierarchy
const SECTION_PADDING = scale(20);

export function SectionHeader({
  title,
  onViewAll,
  showViewAll = true,
}: SectionHeaderProps) {
  const themeColors = useThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
      {showViewAll && onViewAll && (
        <TouchableOpacity
          onPress={onViewAll}
          style={styles.viewAllButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.viewAll, { color: themeColors.textSecondary }]}>View All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline', // Align text baselines for proper visual alignment
    paddingHorizontal: SECTION_PADDING,
    marginBottom: scale(12),
  },
  title: {
    // NN/g: Larger, bolder section titles for visual hierarchy
    fontSize: scale(18),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  viewAllButton: {
    // NN/g: Minimum 44×44px touch target
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  viewAll: {
    fontSize: scale(14),
    fontWeight: '500',
  },
});
