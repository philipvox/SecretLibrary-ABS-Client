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

export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

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

    // Loading dots animation
    Animated.loop(
      Animated.timing(dotAnim, {
        toValue: 3,
        duration: 1500,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  // Loading dots
  const dots = dotAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['', '.', '..', '...'],
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
              {
                width: pulseAnim.interpolate({
                  inputRange: [0.3, 1],
                  outputRange: ['20%', '80%'],
                }),
              },
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
    width: SCREEN_WIDTH * 0.5,
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
