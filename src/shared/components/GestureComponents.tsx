/**
 * src/shared/components/GestureComponents.tsx
 *
 * Gesture-optimized components using react-native-gesture-handler
 * and react-native-reanimated for smooth 60fps interactions.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { theme } from '../theme';

// ============================================================================
// SWIPEABLE CONTAINER
// ============================================================================

interface SwipeableProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
  style?: ViewStyle;
}

/**
 * Container that detects horizontal swipes
 * Great for skip forward/backward in player
 */
export function Swipeable({
  children,
  onSwipeLeft,
  onSwipeRight,
  swipeThreshold = 50,
  style,
}: SwipeableProps) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // Limit movement with rubber band effect
      const clampedX = event.translationX * 0.5;
      translateX.value = startX.value + clampedX;
    })
    .onEnd((event) => {
      if (event.translationX > swipeThreshold && onSwipeRight) {
        runOnJS(onSwipeRight)();
      } else if (event.translationX < -swipeThreshold && onSwipeLeft) {
        runOnJS(onSwipeLeft)();
      }
      translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

// ============================================================================
// PRESSABLE WITH SCALE FEEDBACK
// ============================================================================

interface ScalePressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  scaleValue?: number;
  style?: ViewStyle;
  disabled?: boolean;
}

/**
 * Pressable with smooth scale animation feedback
 * More performant than Animated.View with regular Pressable
 */
export function ScalePressable({
  children,
  onPress,
  onLongPress,
  scaleValue = 0.95,
  style,
  disabled = false,
}: ScalePressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      scale.value = withTiming(scaleValue, { duration: 100 });
      opacity.value = withTiming(0.8, { duration: 100 });
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withTiming(1, { duration: 150 });
    })
    .onEnd(() => {
      if (onPress) {
        runOnJS(onPress)();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(!disabled && !!onLongPress)
    .minDuration(500)
    .onStart(() => {
      if (onLongPress) {
        runOnJS(onLongPress)();
      }
    });

  const composed = Gesture.Race(tapGesture, longPressGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

// ============================================================================
// PULL TO REFRESH HEADER
// ============================================================================

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  refreshThreshold?: number;
}

/**
 * Custom pull to refresh with smooth animation
 */
export function PullToRefresh({
  children,
  onRefresh,
  refreshThreshold = 80,
}: PullToRefreshProps) {
  const translateY = useSharedValue(0);
  const isRefreshing = useSharedValue(false);

  const handleRefresh = useCallback(async () => {
    await onRefresh();
    isRefreshing.value = false;
    translateY.value = withSpring(0);
  }, [onRefresh]);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0 && !isRefreshing.value) {
        // Rubber band effect
        translateY.value = Math.pow(event.translationY, 0.8);
      }
    })
    .onEnd(() => {
      if (translateY.value > refreshThreshold && !isRefreshing.value) {
        isRefreshing.value = true;
        translateY.value = withSpring(refreshThreshold);
        runOnJS(handleRefresh)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const indicatorStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateY.value,
      [0, refreshThreshold],
      [0, 360],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      translateY.value,
      [0, refreshThreshold / 2],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotate: `${rotation}deg` }],
      opacity,
    };
  });

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[styles.refreshIndicator, indicatorStyle]}>
        <View style={styles.refreshSpinner} />
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1 }, containerStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// DOUBLE TAP TO SEEK
// ============================================================================

interface DoubleTapSeekProps {
  children: React.ReactNode;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
  seekAmount?: number;
  style?: ViewStyle;
}

/**
 * YouTube-style double tap to seek forward/backward
 */
export function DoubleTapSeek({
  children,
  onSeekForward,
  onSeekBackward,
  style,
}: DoubleTapSeekProps) {
  const leftOpacity = useSharedValue(0);
  const rightOpacity = useSharedValue(0);
  const leftScale = useSharedValue(0.5);
  const rightScale = useSharedValue(0.5);

  const showLeftFeedback = useCallback(() => {
    leftOpacity.value = withTiming(1, { duration: 100 });
    leftScale.value = withSpring(1);
    setTimeout(() => {
      leftOpacity.value = withTiming(0, { duration: 200 });
      leftScale.value = withTiming(0.5, { duration: 200 });
    }, 300);
  }, []);

  const showRightFeedback = useCallback(() => {
    rightOpacity.value = withTiming(1, { duration: 100 });
    rightScale.value = withSpring(1);
    setTimeout(() => {
      rightOpacity.value = withTiming(0, { duration: 200 });
      rightScale.value = withTiming(0.5, { duration: 200 });
    }, 300);
  }, []);

  const leftTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      if (onSeekBackward) {
        runOnJS(onSeekBackward)();
        runOnJS(showLeftFeedback)();
      }
    });

  const rightTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      if (onSeekForward) {
        runOnJS(onSeekForward)();
        runOnJS(showRightFeedback)();
      }
    });

  const leftStyle = useAnimatedStyle(() => ({
    opacity: leftOpacity.value,
    transform: [{ scale: leftScale.value }],
  }));

  const rightStyle = useAnimatedStyle(() => ({
    opacity: rightOpacity.value,
    transform: [{ scale: rightScale.value }],
  }));

  return (
    <View style={[styles.doubleTapContainer, style]}>
      <GestureDetector gesture={leftTap}>
        <View style={styles.doubleTapZone}>
          <Animated.View style={[styles.seekFeedback, leftStyle]}>
            <View style={styles.seekIcon}>
              {/* Backward icon placeholder */}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.doubleTapCenter}>{children}</View>

      <GestureDetector gesture={rightTap}>
        <View style={styles.doubleTapZone}>
          <Animated.View style={[styles.seekFeedback, rightStyle]}>
            <View style={styles.seekIcon}>
              {/* Forward icon placeholder */}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  refreshIndicator: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshSpinner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.primary[500],
    borderTopColor: 'transparent',
  },
  doubleTapContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  doubleTapZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doubleTapCenter: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekFeedback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekIcon: {
    width: 32,
    height: 32,
  },
});

export { GestureHandlerRootView };
