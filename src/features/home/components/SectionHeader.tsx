/**
 * src/features/home/components/SectionHeader.tsx
 *
 * Section header with title and "View All" button
 * Figma: Bold 14px title, regular 14px View All
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../homeDesign';
import { SectionHeaderProps } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

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
    paddingHorizontal: scale(29),
    marginBottom: scale(15),
  },
  title: {
    fontFamily: 'System',
    fontSize: scale(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  viewAll: {
    fontFamily: 'System',
    fontSize: scale(14),
    fontWeight: '400',
    color: COLORS.textPrimary,
  },
});
