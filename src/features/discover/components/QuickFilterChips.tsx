/**
 * src/features/discover/components/QuickFilterChips.tsx
 *
 * Quick filter chips using app design system.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, LAYOUT } from '@/features/home/homeDesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

interface QuickFilterChipsProps {
  chips: string[];
  selectedChip: string;
  onSelect: (chip: string) => void;
  showMoreButton?: boolean;
  onMorePress?: () => void;
}

interface ChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

const Chip = React.memo(function Chip({ label, isSelected, onPress }: ChipProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={[styles.chip, isSelected && styles.chipSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

export function QuickFilterChips({
  chips,
  selectedChip,
  onSelect,
}: QuickFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {chips.map((chip) => (
        <Chip
          key={chip}
          label={chip}
          isSelected={selectedChip === chip}
          onPress={() => onSelect(chip)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    marginBottom: scale(16),
  },
  container: {
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
    gap: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipSelected: {
    backgroundColor: COLORS.playButton,
  },
  chipText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
});
