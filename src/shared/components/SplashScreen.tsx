/**
 * src/shared/components/SplashScreen.tsx
 *
 * Loading screen displayed while checking authentication status.
 * Dark theme matching app aesthetic.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#CCFF00';
const BG_COLOR = '#1a1a1a';
const LOADING_BAR_WIDTH = SCREEN_WIDTH * 0.5;

export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Progress bar animation (use native driver for better performance)
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  // Interpolate to actual pixel width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LOADING_BAR_WIDTH * 0.2, LOADING_BAR_WIDTH * 0.8],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Logo area */}
      <View style={styles.logoContainer}>
        <Animated.View style={[styles.logoCircle, { opacity: pulseAnim }]}>
          <Text style={styles.logoIcon}>🎧</Text>
        </Animated.View>
        <Text style={styles.title}>audiobookshelf</Text>
      </View>

      {/* Loading indicator */}
      <View style={styles.loadingContainer}>
        <View style={styles.loadingBar}>
          <Animated.View
            style={[
              styles.loadingProgress,
              { width: progressWidth },
            ]}
          />
        </View>
        <Text style={styles.loadingText}>Loading</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    alignItems: 'center',
    width: LOADING_BAR_WIDTH,
  },
  loadingBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
});
