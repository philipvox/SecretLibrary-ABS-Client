/**
 * src/features/player/components/PanelContainer.tsx
 * 
 * Container for player panels with independent sizing from cover
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Icon } from '@/shared/components/Icon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Panel configuration - adjust these to customize panel sizes
export const PANEL_CONFIG = {
  // Horizontal margins from screen edge
  marginHorizontal: 16,
  // Top position (from top of screen)
  topOffset: 120,
  // Bottom padding (from bottom of screen, before safe area)
  bottomPadding: 100,
  // Border radius
  borderRadius: 24,
  // Padding inside panel
  innerPadding: 16,
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
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  content: {
    flex: 1,
  },
});

export default PanelContainer;