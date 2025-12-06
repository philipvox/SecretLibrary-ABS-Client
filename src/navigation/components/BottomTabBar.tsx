/**
 * src/navigation/components/BottomTabBar.tsx
 *
 * 5-tab bottom navigation bar following NN/g best practices:
 * - Icon + text label for each tab (improves discoverability)
 * - Active state with accent color (#C8FF00)
 * - Touch targets minimum 48×48px per tab
 * - Fixed at bottom with safe area handling
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design constants
const TAB_BAR_HEIGHT = 56;
const ACCENT_COLOR = '#C8FF00';
const INACTIVE_COLOR = '#808080';
const BACKGROUND_COLOR = 'rgba(0, 0, 0, 0.85)';

// Tab configuration - NN/g: Clear labels indicate purpose
// Library → Downloads: Shows downloaded books (ready to play offline)
// Browse → Discover: Browse full server library to find new books
const TABS = [
  { name: 'HomeTab', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'LibraryTab', label: 'Downloads', icon: 'download-outline', activeIcon: 'download' },
  { name: 'Search', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
  { name: 'DiscoverTab', label: 'Discover', icon: 'compass-outline', activeIcon: 'compass' },
  { name: 'ProfileTab', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
] as const;

interface BottomTabBarProps {
  currentRoute: string;
  onNavigate: (routeName: string) => void;
  /** Additional bottom offset for mini player */
  bottomOffset?: number;
}

export function BottomTabBar({ currentRoute, onNavigate, bottomOffset = 0 }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 16);

  return (
    <View style={[styles.wrapper, { paddingBottom: safeBottom, bottom: bottomOffset }]}>
      <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
        <View style={styles.tabContainer}>
          {TABS.map((tab) => {
            const isActive = currentRoute === tab.name ||
              // Handle nested routes - Search is a stack screen, not a tab
              (tab.name === 'HomeTab' && currentRoute === 'Main');

            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tab}
                onPress={() => onNavigate(tab.name)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={24}
                  color={isActive ? ACCENT_COLOR : INACTIVE_COLOR}
                />
                <Text style={[styles.label, isActive && styles.labelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: BACKGROUND_COLOR,
  },
  blurContainer: {
    overflow: 'hidden',
  },
  tabContainer: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    // Minimum touch target: 48×48px (NN/g recommendation)
    minWidth: 48,
    minHeight: 48,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: INACTIVE_COLOR,
    marginTop: 2,
  },
  labelActive: {
    color: ACCENT_COLOR,
    fontWeight: '600',
  },
});
