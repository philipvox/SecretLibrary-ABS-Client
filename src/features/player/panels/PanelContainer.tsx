/**
 * src/features/player/components/PanelContainer.tsx
 * 
 * Container for player panels with independent sizing from cover
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Icon } from '@/shared/components/Icon';
import { wp, hp, spacing, radius, elevation } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);

// Panel configuration - adjust these to customize panel sizes
export const PANEL_CONFIG = {
  // Horizontal margins from screen edge
  marginHorizontal: spacing.lg,
  // Top position (from top of screen)
  topOffset: 120,
  // Bottom padding (from bottom of screen, before safe area)
  bottomPadding: 100,
  // Border radius
  borderRadius: radius.xxl,
  // Padding inside panel
  innerPadding: spacing.lg,
};

// Calculate panel dimensions
export const PANEL_WIDTH = SCREEN_WIDTH - (PANEL_CONFIG.marginHorizontal * 2);
export const PANEL_MAX_HEIGHT = SCREEN_HEIGHT - PANEL_CONFIG.topOffset - PANEL_CONFIG.bottomPadding;

interface PanelContainerProps {
  visible: boolean;
  onClose: () => void;
  backgroundColor: string;
  isLight: boolean;
  children: React.ReactNode;
  // Optional overrides
  height?: number | 'auto';
  topOffset?: number;
}

export function PanelContainer({
  visible,
  onClose,
  backgroundColor,
  isLight,
  children,
  height = 'auto',
  topOffset = PANEL_CONFIG.topOffset,
}: PanelContainerProps) {
  const closeIconColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { 
        duration: 200,
        easing: Easing.out(Easing.ease),
      }),
      transform: [
        {
          scale: withTiming(visible ? 1 : 0.95, {
            duration: 200,
            easing: Easing.out(Easing.ease),
          }),
        },
      ],
    };
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {
          backgroundColor,
          top: topOffset,
          height: height === 'auto' ? undefined : height,
          maxHeight: PANEL_MAX_HEIGHT,
        },
      ]}
    >
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="close" size={24} color={closeIconColor} set="ionicons" />
      </TouchableOpacity>

      {/* Panel content */}
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: PANEL_CONFIG.marginHorizontal,
    right: PANEL_CONFIG.marginHorizontal,
    borderRadius: PANEL_CONFIG.borderRadius,
    padding: PANEL_CONFIG.innerPadding,
    overflow: 'hidden',
    ...elevation.large,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
});

export default PanelContainer;