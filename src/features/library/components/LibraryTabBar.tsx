/**
 * src/features/library/components/LibraryTabBar.tsx
 *
 * Tab bar component for MyLibraryScreen.
 * Uses home-style large text tabs.
 */

import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { scale, useTheme } from '@/shared/theme';
import { TabType, TAB_ORDER, TAB_LABELS } from '../types';

interface LibraryTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const LibraryTabBar = React.memo(function LibraryTabBar({
  activeTab,
  onTabChange,
}: LibraryTabBarProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabBar}
      style={styles.tabBarContainer}
    >
      {TAB_ORDER.map((tabId) => {
        const isActive = activeTab === tabId;
        return (
          <TouchableOpacity
            key={tabId}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTabChange(tabId);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={styles.textTab}
          >
            <Text style={[
              styles.textTabLabel,
              { color: isActive ? colors.text.primary : colors.text.tertiary },
            ]}>
              {TAB_LABELS[tabId]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  tabBarContainer: {
    marginBottom: scale(4),
    flexGrow: 0,
    flexShrink: 0,
  },
  tabBar: {
    paddingHorizontal: scale(16),
    gap: scale(16),
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  textTab: {
    paddingVertical: scale(2),
  },
  textTabLabel: {
    fontSize: scale(22),
    fontWeight: '400',
  },
});

export default LibraryTabBar;
