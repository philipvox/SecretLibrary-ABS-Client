/**
 * src/features/discover/components/DismissToast.tsx
 *
 * Toast component that shows when a book is dismissed,
 * with an undo button to restore it.
 */

import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { scale, spacing, radius, useTheme } from '@/shared/theme';
import { useDismissedItemsStore, useLastDismissed } from '@/features/recommendations/stores/dismissedItemsStore';

const TOAST_DURATION = 5000; // 5 seconds
const ANIMATION_DURATION = 300;

interface DismissToastProps {
  onUndone?: () => void;
}

export function DismissToast({ onUndone }: DismissToastProps) {
  const { colors } = useTheme();
  const lastDismissed = useLastDismissed();
  const undoLastDismissal = useDismissedItemsStore((s) => s.undoLastDismissal);

  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  const hideToast = useCallback(() => {
    translateY.value = withTiming(100, { duration: ANIMATION_DURATION });
    opacity.value = withTiming(0, { duration: ANIMATION_DURATION });
  }, []);

  const handleUndo = useCallback(() => {
    undoLastDismissal();
    hideToast();
    onUndone?.();
  }, [undoLastDismissal, hideToast, onUndone]);

  useEffect(() => {
    if (lastDismissed) {
      // Show toast
      translateY.value = withTiming(0, { duration: ANIMATION_DURATION });
      opacity.value = withTiming(1, { duration: ANIMATION_DURATION });

      // Auto-hide after duration
      translateY.value = withDelay(
        TOAST_DURATION,
        withTiming(100, { duration: ANIMATION_DURATION })
      );
      opacity.value = withDelay(
        TOAST_DURATION,
        withTiming(0, { duration: ANIMATION_DURATION })
      );
    }
  }, [lastDismissed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!lastDismissed) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={[styles.toast, { backgroundColor: colors.background.secondary }]}>
        <Text style={[styles.message, { color: colors.text.primary }]}>
          Removed from recommendations
        </Text>
        <TouchableOpacity
          style={styles.undoButton}
          onPress={handleUndo}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.undoText, { color: colors.accent.primary }]}>
            Undo
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100, // Above mini player
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    fontSize: scale(14),
    fontWeight: '500',
    flex: 1,
  },
  undoButton: {
    marginLeft: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  undoText: {
    fontSize: scale(14),
    fontWeight: '700',
  },
});
