/**
 * src/features/browse/components/BrowseTabBar.tsx
 *
 * Three-tab bar below BrowseTopNav: For You, Discover, Collections.
 * Active tab: white text + 2px underline. Inactive: gray text.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { secretLibraryColors as colors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { BrowseTab, useBrowseTabStore } from '../stores/browseTabStore';

const TABS: { key: BrowseTab; label: string }[] = [
  { key: 'forYou', label: 'For You' },
  { key: 'discover', label: 'Discover' },
  { key: 'collections', label: 'Curated' },
];

export function BrowseTabBar() {
  const activeTab = useBrowseTabStore((s) => s.activeTab);
  const setActiveTab = useBrowseTabStore((s) => s.setActiveTab);

  const handlePress = useCallback((tab: BrowseTab) => {
    if (tab === activeTab) return;
    Haptics.selectionAsync();
    setActiveTab(tab);
  }, [activeTab, setActiveTab]);

  return (
    <View style={styles.container}>
      {TABS.map(({ key, label }) => {
        const isActive = key === activeTab;
        return (
          <Pressable
            key={key}
            style={styles.tab}
            onPress={() => handlePress(key)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {label}
            </Text>
            {isActive && <View style={styles.underline} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.black,
    paddingHorizontal: 16,
    paddingTop: scale(2),
    paddingBottom: scale(6),
    gap: scale(24),
  },
  tab: {
    paddingVertical: scale(6),
    alignItems: 'center',
  },
  tabText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(13),
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.white,
    borderRadius: 1,
  },
});
