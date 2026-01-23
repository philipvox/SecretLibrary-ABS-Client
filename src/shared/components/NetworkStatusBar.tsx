/**
 * src/shared/components/NetworkStatusBar.tsx
 *
 * Global network status indicator that shows:
 * 1. Offline state when no network connection
 * 2. Loading state during active requests
 *
 * Positioned at the top of the screen below the status bar.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { CloudOff, CloudDownload } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { scale, spacing, useTheme } from '@/shared/theme';

interface NetworkStatusBarProps {
  /**
   * Optional: Show loading state when true
   * Can be connected to global request state if needed
   */
  isLoading?: boolean;
}

export function NetworkStatusBar({ isLoading = false }: NetworkStatusBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [isOffline, setIsOffline] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const slideAnim = useState(() => new Animated.Value(-50))[0];

  // Monitor network state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  // Show/hide animation
  useEffect(() => {
    const shouldShow = isOffline || isLoading;

    if (shouldShow) {
      setShowBar(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowBar(false);
      });
    }
  }, [isOffline, isLoading, slideAnim]);

  // Return empty View on Android to prevent SafeAreaProvider crash
  if (!showBar) return Platform.OS === 'android' ? <View /> : null;

  const backgroundColor = isOffline ? colors.status.error : colors.accent.primary;
  const message = isOffline ? 'No internet connection' : 'Loading...';
  const StatusIcon = isOffline ? CloudOff : CloudDownload;
  // Use contrasting text color
  const textColor = isOffline ? colors.text.primary : colors.background.primary;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.xs,
          backgroundColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityLabel={message}
      accessibilityRole="alert"
    >
      <StatusIcon size={scale(14)} color={textColor} strokeWidth={2} />
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </Animated.View>
  );
}

/**
 * Hook to get network status
 * Use this in screens that need to show offline-specific UI
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  return isOnline;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    zIndex: 9999,
  },
  text: {
    fontSize: scale(12),
    fontWeight: '500',
  },
});
