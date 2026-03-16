/**
 * src/features/browse/components/BrowseTopNav.tsx
 *
 * Top navigation bar for the Browse screen.
 * Logo left, tag filter + close right. No tabs.
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';
import { Tag } from 'lucide-react-native';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { TopNav, TopNavCloseIcon, TopNavSearchIcon } from '@/shared/components';
import { useContentFilterStore } from '../stores/contentFilterStore';

// Shelf icon — matches the home page discover icon
const _ShelfIcon = ({ color = '#fff' }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
    <Rect x={3} y={4} width={4} height={14} rx={1} />
    <Rect x={9} y={6} width={4} height={12} rx={1} />
    <Rect x={15} y={3} width={4} height={15} rx={1} />
    <Rect x={2} y={19} width={20} height={2} rx={0.5} />
  </Svg>
);

// List/rows icon — horizontal lines
const RowsIcon = ({ color = '#fff' }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
    <Circle cx={3} cy={6} r={1.5} />
    <Circle cx={3} cy={12} r={1.5} />
    <Circle cx={3} cy={18} r={1.5} />
    <Rect x={7} y={5} width={14} height={2} rx={1} />
    <Rect x={7} y={11} width={14} height={2} rx={1} />
    <Rect x={7} y={17} width={14} height={2} rx={1} />
  </Svg>
);

interface BrowseTopNavProps {
  onClose?: () => void;
  onLogoPress?: () => void;
  onLogoLongPress?: () => void;
  onTagFilterPress?: () => void;
  onSearchPress?: () => void;
  onViewAllBooks?: () => void;
}

export function BrowseTopNav({ onClose, onLogoPress, onLogoLongPress, onTagFilterPress, onSearchPress, onViewAllBooks }: BrowseTopNavProps) {
  const selectedTags = useContentFilterStore((s) => s.selectedTags);
  const selectedGenres = useContentFilterStore((s) => s.selectedGenres);
  const lengthRange = useContentFilterStore((s) => s.lengthRange);

  const tagFilterCount = selectedTags.length + selectedGenres.length + (lengthRange ? 1 : 0);

  return (
    <View style={styles.container}>
      <TopNav
        variant="dark"
        showLogo={true}
        onLogoPress={onLogoPress}
        onLogoLongPress={onLogoLongPress}
        style={{ backgroundColor: 'transparent' }}
        includeSafeArea={false}
        circleButtons={[
          {
            key: 'search',
            icon: <TopNavSearchIcon color={staticColors.white} size={16} />,
            onPress: onSearchPress,
          },
          {
            key: 'allBooks',
            icon: <RowsIcon color={staticColors.white} />,
            onPress: onViewAllBooks,
          },
          {
            key: 'tags',
            icon: (
              <View style={styles.tagPillInner}>
                <Tag size={16} color={staticColors.white} strokeWidth={1.5} />
                {tagFilterCount > 0 && (
                  <Text style={styles.filterCount}>{tagFilterCount}</Text>
                )}
              </View>
            ),
            onPress: onTagFilterPress,
          },
          {
            key: 'close',
            icon: <TopNavCloseIcon color={staticColors.cream} size={16} />,
            onPress: onClose,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  tagPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  filterCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: staticColors.white,
    fontWeight: '600',
  },
});
