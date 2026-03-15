/**
 * src/features/browse/components/ActionNeededSection.tsx
 *
 * Series gap alerts — shows when user is close to completing a series
 * but has missing books. White left border, max 2 items.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { SectionHeader } from './SectionHeader';
import { useSeriesGaps } from '../hooks/useSeriesGaps';

interface ActionNeededSectionProps {
  onSeriesPress: (seriesName: string) => void;
}

export const ActionNeededSection = React.memo(function ActionNeededSection({ onSeriesPress }: ActionNeededSectionProps) {
  const colors = useSecretLibraryColors();
  const { gaps } = useSeriesGaps();

  if (gaps.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader label="Action Needed" />
      {gaps.map((gap) => (
        <TouchableOpacity
          key={gap.seriesName}
          style={[styles.card, { borderLeftColor: colors.black }]}
          onPress={() => onSeriesPress(gap.seriesName)}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            <Text style={[styles.seriesName, { color: colors.black }]} numberOfLines={1}>
              {gap.seriesName}
            </Text>
            <Text style={[styles.statusText, { color: colors.gray }]}>
              YOU HAVE {gap.have} OF {gap.total} BOOKS · {gap.missing} MISSING
            </Text>
          </View>
          <View style={styles.action}>
            <Text style={[styles.actionText, { color: colors.gray }]}>VIEW GAP</Text>
            <ChevronRight size={12} color={colors.gray} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: scale(8),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    marginBottom: scale(8),
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderLeftWidth: 2,
    borderRadius: 2,
  },
  cardContent: {
    flex: 1,
    marginRight: scale(12),
  },
  seriesName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(14),
    marginBottom: scale(4),
  },
  statusText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
