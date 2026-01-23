/**
 * src/navigation/components/FloatingTabBar.tsx
 *
 * Bottom tab navigation bar: Home | Library | Search | Browse | Profile
 * Clean white background with black icons and labels
 * Active tab uses black color with underline indicator
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { useShallow } from 'zustand/react/shallow';
import { spacing, useTheme } from '@/shared/theme';
import { darkColors } from '@/shared/theme/colors';
import { useNavigationWithLoading } from '@/shared/hooks';

// =============================================================================
// THEME COLORS - Uses theme tokens from colors.ts
// =============================================================================

function useNavColors() {
  const { colors } = useTheme();

  return {
    background: colors.nav.background,
    iconActive: colors.nav.active,
    iconInactive: colors.nav.inactive,
    labelActive: colors.nav.active,
    labelInactive: colors.nav.inactive,
  };
}

// Design constants
const ICON_SIZE = 20; // Slightly smaller for cleaner look
// Platform-appropriate bar heights (iOS: 49pt, Android: 56dp)
// Using 52 as a balanced cross-platform value
const BAR_HEIGHT = 52;
const BAR_BOTTOM_PADDING = 8; // Minimal extra padding, safe area handles the rest
// Note: Icon color is provided by useNavColors() hook - see themeColors.iconInactive

// Home icon (house with door) - from design
const HomeIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = darkColors.nav.inactive, // Default for SSR/initial render
}) => (
  <Svg width={size} height={size} viewBox="0 0 13 15" fill="none">
    <Path
      d="M4.5 14.5V7.5H8.5V14.5M0.5 5.4L6.5 0.5L12.5 5.4V13.1C12.5 13.4713 12.3595 13.8274 12.1095 14.0899C11.8594 14.3525 11.5203 14.5 11.1667 14.5H1.83333C1.47971 14.5 1.14057 14.3525 0.890524 14.0899C0.640476 13.8274 0.5 13.4713 0.5 13.1V5.4Z"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Search icon (magnifying glass) - from design
const SearchIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = darkColors.nav.inactive,
}) => (
  <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <Path
      d="M13.25 13.25L10.1687 10.1687M11.8333 6.16667C11.8333 9.29628 9.29628 11.8333 6.16667 11.8333C3.03705 11.8333 0.5 9.29628 0.5 6.16667C0.5 3.03705 3.03705 0.5 6.16667 0.5C9.29628 0.5 11.8333 3.03705 11.8333 6.16667Z"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Browse icon (compass) - from design
const BrowseIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = darkColors.nav.inactive,
}) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path
      d="M8 15.5C12.1421 15.5 15.5 12.1421 15.5 8C15.5 3.85786 12.1421 0.5 8 0.5C3.85786 0.5 0.5 3.85786 0.5 8C0.5 12.1421 3.85786 15.5 8 15.5Z"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M11.18 4.82L9.59 9.59L4.82 11.18L6.41 6.41L11.18 4.82Z"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Profile icon (person outline) - from design
const ProfileIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = darkColors.nav.inactive,
}) => (
  <Svg width={size} height={size} viewBox="0 0 14 15" fill="none">
    <Path
      d="M13.5 13.8333C13.5 12.9493 13.1576 12.1014 12.5481 11.4763C11.9386 10.8512 11.112 10.5 10.25 10.5H3.75C2.88805 10.5 2.0614 10.8512 1.4519 11.4763C0.84241 12.1014 0.5 12.9493 0.5 13.8333M10.25 3.83333C10.25 5.67428 8.79493 7.16667 7 7.16667C5.20508 7.16667 3.75 5.67428 3.75 3.83333C3.75 1.99238 5.20508 0.5 7 0.5C8.79493 0.5 10.25 1.99238 10.25 3.83333Z"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Library icon (open book)
const LibraryIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = darkColors.nav.inactive,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

type TabKey = 'browse' | 'search' | 'profile' | 'home' | 'library';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.FC<{ size?: number; color?: string }>;
  route: string;
  screen?: string;
}

const TABS: TabConfig[] = [
  { key: 'home', label: 'Home', icon: HomeIcon, route: 'Main', screen: 'HomeTab' },
  { key: 'library', label: 'Library', icon: LibraryIcon, route: 'Main', screen: 'LibraryTab' },
  { key: 'browse', label: 'Browse', icon: BrowseIcon, route: 'Main', screen: 'DiscoverTab' },
  { key: 'search', label: 'Search', icon: SearchIcon, route: 'Search' },
  { key: 'profile', label: 'Profile', icon: ProfileIcon, route: 'Main', screen: 'ProfileTab' },
];

function FloatingTabBarInner() {
  const insets = useSafeAreaInsets();
  const { navigateWithLoading, navigation } = useNavigationWithLoading();
  const themeColors = useNavColors();

  // Use useShallow to prevent infinite re-renders
  const { isPlayerVisible } = usePlayerStore(
    useShallow((s) => ({
      isPlayerVisible: s.isPlayerVisible,
    }))
  );
  const closePlayer = usePlayerStore((s) => s.closePlayer);
  const [currentRouteName, setCurrentRouteName] = useState('HomeTab');

  // Listen for navigation state changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      const state = navigation.getState();
      if (state) {
        const route = state.routes[state.index];
        if (route.state) {
          const nestedState = route.state as any;
          const nestedRoute = nestedState.routes?.[nestedState.index];
          setCurrentRouteName(nestedRoute?.name || route.name);
        } else {
          setCurrentRouteName(route.name);
        }
      }
    });
    return unsubscribe;
  }, [navigation]);

  const getActiveTab = useCallback((): TabKey => {
    switch (currentRouteName) {
      case 'DiscoverTab':
      case 'BrowseScreen':
        return 'browse';
      case 'Search':
      case 'SearchScreen':
        return 'search';
      case 'ProfileTab':
        return 'profile';
      case 'LibraryTab':
      case 'MyLibraryScreen':
        return 'library';
      case 'HomeTab':
      case 'Main':
      default:
        return 'home';
    }
  }, [currentRouteName]);

  const handleTabPress = useCallback((tab: TabConfig) => {
    if (isPlayerVisible) closePlayer();

    // Show loading overlay for heavy screens (browse tab)
    if (tab.key === 'browse') {
      if (tab.screen) {
        navigateWithLoading(tab.route, { screen: tab.screen });
      } else {
        navigateWithLoading(tab.route);
      }
      return;
    }

    // Direct navigation for other tabs
    if (tab.screen) {
      navigation.navigate(tab.route, { screen: tab.screen });
    } else {
      navigation.navigate(tab.route);
    }
  }, [isPlayerVisible, closePlayer, navigation, navigateWithLoading]);

  const activeTab = getActiveTab();
  const bottomPadding = Math.max(insets.bottom, 16) + BAR_BOTTOM_PADDING;
  const totalBarHeight = BAR_HEIGHT + bottomPadding;

  // Hide tab bar on full-screen modal routes or when player is open
  // Return empty View on Android to prevent SafeAreaProvider crash
  const hiddenRoutes = ['ReadingHistoryWizard', 'MoodDiscovery', 'MoodResults', 'PreferencesOnboarding'];
  if (hiddenRoutes.includes(currentRouteName) || isPlayerVisible) {
    return Platform.OS === 'android' ? <View /> : null;
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.bar, { paddingBottom: bottomPadding, minHeight: totalBarHeight, backgroundColor: themeColors.background }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const IconComponent = tab.icon;

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.6}
            >
              <IconComponent
                size={ICON_SIZE}
                color={isActive ? themeColors.iconActive : themeColors.iconInactive}
              />
              <Text style={[
                styles.label,
                { color: themeColors.labelInactive },
                isActive && { color: themeColors.labelActive, fontWeight: '600' }
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Error boundary wrapper
class FloatingTabBarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.log('[FloatingTabBar] Caught error:', error.message);
  }

  componentDidUpdate() {
    if (this.state.hasError) {
      setTimeout(() => this.setState({ hasError: false }), 100);
    }
  }

  render() {
    if (this.state.hasError) {
      return Platform.OS === 'android' ? <View /> : null;
    }
    return this.props.children;
  }
}

export function FloatingTabBar() {
  return (
    <FloatingTabBarErrorBoundary>
      <FloatingTabBarInner />
    </FloatingTabBarErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: BAR_HEIGHT,
    paddingHorizontal: spacing.sm,
    paddingTop: 0,
    // backgroundColor set dynamically via themeColors.background
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 48, // Minimum touch target (Material Design)
    gap: 6, // More space between icon and label
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    // color set dynamically via themeColors.labelInactive
    letterSpacing: 0.2,
  },
  // labelActive color set dynamically via themeColors.labelActive
});
