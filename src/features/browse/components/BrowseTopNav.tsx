/**
 * src/features/browse/components/BrowseTopNav.tsx
 *
 * Top navigation bar for the Browse screen.
 * Logo left, tag filter + close right. No tabs.
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Tag } from 'lucide-react-native';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { TopNav, TopNavCloseIcon } from '@/shared/components';
import { useContentFilterStore } from '../stores/contentFilterStore';

interface BrowseTopNavProps {
  onClose?: () => void;
  onLogoPress?: () => void;
  onLogoLongPress?: () => void;
  onTagFilterPress?: () => void;
}

export function BrowseTopNav({ onClose, onLogoPress, onLogoLongPress, onTagFilterPress }: BrowseTopNavProps) {
  const selectedTags = useContentFilterStore((s) => s.selectedTags);
  const selectedGenres = useContentFilterStore((s) => s.selectedGenres);
  const lengthRange = useContentFilterStore((s) => s.lengthRange);

  const tagFilterCount = selectedTags.length + selectedGenres.length + (lengthRange ? 1 : 0);

  return (
    <View style={[styles.container, { backgroundColor: staticColors.black }]}>
      <TopNav
        variant="dark"
        showLogo={true}
        onLogoPress={onLogoPress}
        onLogoLongPress={onLogoLongPress}
        style={{ backgroundColor: 'transparent' }}
        includeSafeArea={false}
        circleButtons={[
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
    backgroundColor: staticColors.black,
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
