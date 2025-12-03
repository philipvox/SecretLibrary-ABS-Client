/**
 * src/features/home/components/SectionHeader.tsx
 *
 * Section header with title and optional "View All" action
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../homeDesign';
import { SectionHeaderProps } from '../types';

export function SectionHeader({
  title,
  onViewAll,
  showViewAll = true,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {showViewAll && onViewAll && (
        <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: LAYOUT.sectionHeaderMarginTop,
    paddingBottom: LAYOUT.sectionHeaderMarginBottom,
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
  },
  title: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.textPrimary,
  },
  viewAll: {
    ...TYPOGRAPHY.viewAll,
    color: COLORS.playButton,
  },
});
