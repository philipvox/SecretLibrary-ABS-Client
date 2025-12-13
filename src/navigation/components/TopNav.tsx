/**
 * src/navigation/components/TopNav.tsx
 *
 * Persistent top navigation bar visible across all screens.
 * Contains: Profile, Discover, Queue indicator, Your Library pill
 * Has gradient backdrop for contrast over content.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { useQueue } from '@/features/queue/stores/queueStore';
import { useShallow } from 'zustand/react/shallow';
import {
  colors,
  spacing,
  radius,
  typography,
  scale,
  layout,
} from '@/shared/theme';

// Height of the nav content (without safe area)
export const TOP_NAV_CONTENT_HEIGHT = 52;

// Gradient extends below nav for fade effect
const GRADIENT_EXTEND = 30;

function TopNavInner() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Track current route for active states
  const [currentRouteName, setCurrentRouteName] = useState('HomeTab');

  // Queue state
  const queue = useQueue();
  const hasQueue = queue.length > 0;

  // Player state - check if player is visible (full screen)
  const { isPlayerVisible } = usePlayerStore(
    useShallow((s) => ({
      isPlayerVisible: s.isPlayerVisible,
    }))
  );

  // Listen for navigation state changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      try {
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
      } catch {
        // Ignore navigation state errors
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Determine active states (computed after all hooks)
  const isProfile = currentRouteName === 'ProfileTab';
  const isDiscover = currentRouteName === 'DiscoverTab' || currentRouteName === 'BrowseScreen';
  const isLibrary = currentRouteName === 'LibraryTab';
  const isHome = currentRouteName === 'HomeTab' || currentRouteName === 'Main';
  const totalHeight = insets.top + TOP_NAV_CONTENT_HEIGHT;

  // Navigation handlers
  const handleProfilePress = useCallback(() => {
    navigation.navigate('Main', { screen: 'ProfileTab' });
  }, [navigation]);

  const handleDiscoverPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'DiscoverTab' });
  }, [navigation]);

  const handleLibraryPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'LibraryTab' });
  }, [navigation]);

  const handleQueuePress = useCallback(() => {
    navigation.navigate('QueueScreen');
  }, [navigation]);

  // Hide TopNav when full-screen player is open (after all hooks)
  if (isPlayerVisible) return null;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Gradient backdrop - extends below nav for fade */}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        locations={[0, 0.7, 1]}
        style={[styles.gradient, { height: totalHeight + GRADIENT_EXTEND }]}
        pointerEvents="none"
      />

      {/* Nav content */}
      <View style={[styles.navRow, { paddingTop: insets.top + 8 }]}>
        {/* Left side: Profile & Discover */}
        <View style={styles.leftGroup}>
          <TouchableOpacity
            style={[styles.iconButton, isProfile && styles.iconButtonActive]}
            onPress={handleProfilePress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isProfile ? 'person' : 'person-outline'}
              size={22}
              color={isProfile ? colors.accent : colors.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, isDiscover && styles.iconButtonActive]}
            onPress={handleDiscoverPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDiscover ? 'compass' : 'compass-outline'}
              size={22}
              color={isDiscover ? colors.accent : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Right side: Queue indicator & Library pill */}
        <View style={styles.rightGroup}>
          {/* Queue indicator - shows when queue has items */}
          {hasQueue && (
            <TouchableOpacity style={styles.queueButton} onPress={handleQueuePress} activeOpacity={0.7}>
              <Ionicons name="list" size={14} color="#000" />
              <Text style={styles.queueText}>{queue.length}</Text>
            </TouchableOpacity>
          )}

          {/* Your Library pill */}
          <TouchableOpacity
            style={[styles.libraryButton, isLibrary && styles.libraryButtonActive]}
            onPress={handleLibraryPress}
            activeOpacity={0.7}
          >
            <Text style={[styles.libraryButtonText, isLibrary && styles.libraryButtonTextActive]}>
              Your Library
            </Text>
            <View style={styles.libraryIcon}>
              <View style={[styles.libraryIconBack, isLibrary && styles.libraryIconBackActive]} />
              <View style={[styles.libraryIconFront, isLibrary && styles.libraryIconFrontActive]} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Error boundary wrapper
class TopNavErrorBoundary extends React.Component<
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
    console.log('[TopNav] Caught error:', error.message);
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

export function TopNav() {
  return (
    <TopNavErrorBoundary>
      <TopNavInner />
    </TopNavErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: spacing.md,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: layout.minTouchTarget / 2,
  },
  iconButtonActive: {
    backgroundColor: colors.accentSubtle,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  queueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  queueText: {
    ...typography.labelMedium,
    fontWeight: '700',
    color: colors.backgroundPrimary,
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  libraryButtonActive: {
    backgroundColor: colors.accent,
  },
  libraryButtonText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  libraryButtonTextActive: {
    color: colors.backgroundPrimary,
    fontWeight: '600',
  },
  libraryIcon: {
    width: 14,
    height: 16,
    position: 'relative',
  },
  libraryIconBack: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 10,
    height: 14,
    borderRadius: radius.xxs,
    borderWidth: 1,
    borderColor: colors.textTertiary,
    backgroundColor: 'transparent',
  },
  libraryIconBackActive: {
    borderColor: 'rgba(0,0,0,0.3)',
  },
  libraryIconFront: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10,
    height: 14,
    borderRadius: radius.xxs,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    backgroundColor: colors.cardBackground,
  },
  libraryIconFrontActive: {
    borderColor: colors.backgroundPrimary,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
