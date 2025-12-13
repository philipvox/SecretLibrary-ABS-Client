/**
 * src/navigation/components/FloatingTabBar.tsx
 *
 * Floating 4-tab navigation bar: Browse | Library | Profile | Home
 * Dark pill-shaped bar with outline icons and labels
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { useShallow } from 'zustand/react/shallow';
import {
  colors,
  spacing,
  sizes,
  typography,
  wp,
} from '@/shared/theme';

// Design constants
const ICON_COLOR = colors.textPrimary;
const ICON_COLOR_INACTIVE = colors.textSecondary;
const ICON_SIZE = sizes.iconMd;
const BAR_HEIGHT = 82;
const BAR_BOTTOM_PADDING = 0; // Extra padding at bottom for touch UX

// Screen width for layout
const SCREEN_WIDTH = wp(100);

// Nav bar background using the provided SVG
const NavBarBackground: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <Image
    source={require('@/assets/svg/navigation/nav-background.svg')}
    style={[StyleSheet.absoluteFill, { width, height }]}
    contentFit="fill"
  />
);

// Browse icon (compass) - matches design
const BrowseIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = ICON_COLOR
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Outer circle */}
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.5} />
    {/* Inner diamond/compass pointer */}
    <Path
      d="M14.5 9.5L10.5 10.5L9.5 14.5L13.5 13.5L14.5 9.5Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Library icon (books) - matches design
const LibraryIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = ICON_COLOR
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Three book spines */}
    <Rect x="4" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth={1.5} />
    <Rect x="10" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth={1.5} />
    <Rect x="16" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth={1.5} />
  </Svg>
);

// Profile icon (person outline) - matches design
const ProfileIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = ICON_COLOR
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Head circle */}
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.5} />
    {/* Body arc */}
    <Path
      d="M4 20C4 16.6863 7.13401 14 11 14H13C16.866 14 20 16.6863 20 20"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

// Home icon (house outline) - matches design
const HomeIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = ICON_COLOR
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* House roof */}
    <Path
      d="M3 10.5L12 4L21 10.5"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* House body */}
    <Path
      d="M5 9.5V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V9.5"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Door */}
    <Path
      d="M10 20V15C10 14.4477 10.4477 14 11 14H13C13.5523 14 14 14.4477 14 15V20"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Search icon (magnifying glass)
const SearchIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = ICON_COLOR
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Magnifying glass circle */}
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={1.5} />
    {/* Handle */}
    <Path
      d="M16 16L20 20"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

type TabKey = 'browse' | 'library' | 'search' | 'profile' | 'home';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.FC<{ size?: number; color?: string }>;
  route: string;
  screen?: string;
}

const TABS: TabConfig[] = [
  { key: 'browse', label: 'Browse', icon: BrowseIcon, route: 'Main', screen: 'DiscoverTab' },
  { key: 'library', label: 'Library', icon: LibraryIcon, route: 'Main', screen: 'LibraryTab' },
  { key: 'search', label: 'Search', icon: SearchIcon, route: 'Search' },
  { key: 'profile', label: 'Profile', icon: ProfileIcon, route: 'Main', screen: 'ProfileTab' },
  { key: 'home', label: 'Home', icon: HomeIcon, route: 'Main', screen: 'HomeTab' },
];

function FloatingTabBarInner() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

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
      case 'LibraryTab':
        return 'library';
      case 'Search':
      case 'SearchScreen':
        return 'search';
      case 'ProfileTab':
        return 'profile';
      case 'HomeTab':
      case 'Main':
      default:
        return 'home';
    }
  }, [currentRouteName]);

  const handleTabPress = useCallback((tab: TabConfig) => {
    if (isPlayerVisible) closePlayer();
    if (tab.screen) {
      navigation.navigate(tab.route, { screen: tab.screen });
    } else {
      navigation.navigate(tab.route);
    }
  }, [isPlayerVisible, closePlayer, navigation]);

  const activeTab = getActiveTab();
  const bottomPadding = Math.max(insets.bottom, 16) + BAR_BOTTOM_PADDING;
  const totalBarHeight = BAR_HEIGHT + bottomPadding;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.bar, { paddingBottom: bottomPadding, minHeight: totalBarHeight }]}>
        <NavBarBackground width={SCREEN_WIDTH} height={totalBarHeight} />
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
                color={isActive ? ICON_COLOR : ICON_COLOR_INACTIVE}
              />
              <Text style={[
                styles.label,
                isActive && styles.labelActive
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
    if (this.state.hasError) return null;
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
    bottom: spacing.sm,
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
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 60,
    gap: spacing.sm,
  },
  label: {
    ...typography.labelSmall,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
