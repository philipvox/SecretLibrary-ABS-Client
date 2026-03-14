/**
 * src/shared/components/ToastContainer.tsx
 *
 * Global toast display component — narrow centered pill design.
 * Add this to your root navigator to render toasts from useToast().
 *
 * Features:
 * - Centered pill shape (rounded ends, narrow height)
 * - Slide-in animation from top
 * - Swipe-to-dismiss (horizontal pan gesture)
 * - Optional "Undo" button (golden orange) when toast.onUndo is set
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react-native';
import { useToastStore, Toast, ToastType } from '@/shared/hooks/useToast';
import { scale, spacing, useTheme } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';

// ============================================================================
// CONSTANTS
// ============================================================================

const TOAST_ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SWIPE_THRESHOLD = 80;
const UNDO_COLOR = '#E8A020';

// ============================================================================
// TOAST ITEM COMPONENT
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { colors } = useTheme();
  const Icon = TOAST_ICONS[toast.type];
  const translateX = useSharedValue(0);

  const toastColorMap: Record<ToastType, string> = {
    success: colors.semantic.success,
    error: colors.semantic.error,
    warning: colors.semantic.warning,
    info: colors.semantic.info,
  };
  const iconColor = toastColorMap[toast.type];

  const handleDismiss = () => onDismiss();

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * 400, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: 1 - Math.min(Math.abs(translateX.value) / 200, 0.5),
  }));

  const handleUndo = () => {
    toast.onUndo?.();
    onDismiss();
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        entering={SlideInUp.duration(250)}
        exiting={FadeOut.duration(200)}
        style={[
          styles.toast,
          { backgroundColor: 'rgba(40,40,40,0.95)' },
          animatedStyle,
        ]}
      >
        <Icon size={scale(14)} color={iconColor} />
        <Text style={styles.message} numberOfLines={1}>
          {toast.message}
        </Text>
        {toast.onUndo && (
          <TouchableOpacity
            onPress={handleUndo}
            style={styles.undoButton}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <Text style={styles.undoText}>Undo</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

// ============================================================================
// CONTAINER COMPONENT
// ============================================================================

export const ToastContainer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return Platform.OS === 'android' ? <View /> : null;

  return (
    <View
      style={[styles.container, { top: insets.top + spacing.sm }]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    gap: spacing.xs,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scale(32),
    paddingHorizontal: scale(14),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: scale(6),
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  message: {
    color: '#FFFFFF',
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  undoButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  undoText: {
    color: UNDO_COLOR,
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default ToastContainer;
