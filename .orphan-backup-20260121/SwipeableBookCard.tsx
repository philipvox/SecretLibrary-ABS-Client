/**
 * src/features/discover/components/SwipeableBookCard.tsx
 *
 * Wrapper component that enables swipe-to-dismiss functionality.
 * Swipe left to reveal "Not Interested" action.
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { scale, spacing, radius } from '@/shared/theme';
import { useDismissedItemsStore } from '@/features/recommendations/stores/dismissedItemsStore';

const SWIPE_THRESHOLD = 80;
const DISMISS_VELOCITY = 500;

interface SwipeableBookCardProps {
  bookId: string;
  children: React.ReactNode;
  onDismiss?: (bookId: string) => void;
  enabled?: boolean;
}

export function SwipeableBookCard({
  bookId,
  children,
  onDismiss,
  enabled = true,
}: SwipeableBookCardProps) {
  const translateX = useSharedValue(0);
  const isDismissing = useSharedValue(false);

  const dismissItem = useDismissedItemsStore((s) => s.dismissItem);

  const handleDismiss = useCallback(() => {
    dismissItem(bookId, 'not_interested');
    onDismiss?.(bookId);
  }, [bookId, dismissItem, onDismiss]);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      // Only allow left swipe (negative translateX)
      if (event.translationX < 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const shouldDismiss =
        translateX.value < -SWIPE_THRESHOLD ||
        event.velocityX < -DISMISS_VELOCITY;

      if (shouldDismiss) {
        isDismissing.value = true;
        translateX.value = withTiming(-Dimensions.get('window').width, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: isDismissing.value
      ? interpolate(
          Math.abs(translateX.value),
          [SWIPE_THRESHOLD, Dimensions.get('window').width],
          [1, 0],
          Extrapolation.CLAMP
        )
      : 1,
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          Math.abs(translateX.value),
          [0, SWIPE_THRESHOLD],
          [0.5, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Background action indicator */}
      <Animated.View style={[styles.actionContainer, actionStyle]}>
        <View style={styles.dismissAction}>
          <Text style={styles.dismissIcon}>✕</Text>
          <Text style={styles.dismissText}>Not{'\n'}Interested</Text>
        </View>
      </Animated.View>

      {/* Swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  actionContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.md,
  },
  dismissAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissIcon: {
    fontSize: scale(24),
    color: '#EF4444', // Red
    marginBottom: spacing.xs,
  },
  dismissText: {
    fontSize: scale(10),
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
  },
});
