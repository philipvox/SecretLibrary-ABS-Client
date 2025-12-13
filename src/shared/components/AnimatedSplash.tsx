/**
 * src/shared/components/AnimatedSplash.tsx
 *
 * Animated splash screen shown during app initialization.
 * Provides smooth transition from native splash to main app.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, wp } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const ACCENT = colors.accent;
const BG_COLOR = colors.backgroundTertiary;
const LOADING_BAR_WIDTH = SCREEN_WIDTH * 0.5;

interface AnimatedSplashProps {
  onReady: () => void;
  minDisplayTime?: number;
}

export function AnimatedSplash({ onReady, minDisplayTime = 400 }: AnimatedSplashProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const hasCalledOnReady = useRef(false);

  const fadeOutAndComplete = useCallback(() => {
    if (hasCalledOnReady.current) return;
    hasCalledOnReady.current = true;

    // Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onReady();
    });
  }, [fadeAnim, onReady]);

  useEffect(() => {
    // Start pulse animation for logo
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Start progress bar animation
    const progressAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );
    progressAnimation.start();

    // Minimum display time before allowing fade out
    const timer = setTimeout(() => {
      fadeOutAndComplete();
    }, minDisplayTime);

    return () => {
      clearTimeout(timer);
      pulseAnimation.stop();
      progressAnimation.stop();
    };
  }, [minDisplayTime, fadeOutAndComplete, pulseAnim, progressAnim]);

  // Interpolate progress bar width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LOADING_BAR_WIDTH * 0.2, LOADING_BAR_WIDTH * 0.8],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
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
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
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
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
});
