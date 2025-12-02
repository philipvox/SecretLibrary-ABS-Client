/**
 * Glass morphism card with blur effect
 *
 * Creates a translucent card with backdrop blur effect for modern UI
 */

import React, { ReactNode } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '../../theme';

interface GlassCardProps {
  children: ReactNode;
  onPress?: () => void;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  padding?: keyof typeof theme.spacing;
  borderRadius?: keyof typeof theme.radius;
  style?: ViewStyle;
}

/**
 * Glass morphism card with blur effect
 */
export function GlassCard({
  children,
  onPress,
  intensity = 40,
  tint = 'dark',
  padding = 4,
  borderRadius = 'large',
  style,
}: GlassCardProps) {
  const Container = onPress ? TouchableOpacity : View;
  const radius = theme.radius[borderRadius];

  // On Android, BlurView may not work as expected, use fallback
  const useBlur = Platform.OS === 'ios';

  const content = (
    <View style={[styles.content, { padding: theme.spacing[padding] }]}>
      {children}
    </View>
  );

  if (useBlur) {
    return (
      <Container
        style={[styles.container, { borderRadius: radius }, style]}
        onPress={onPress}
        activeOpacity={onPress ? 0.8 : 1}
      >
        <BlurView
          intensity={intensity}
          tint={tint}
          style={[styles.blur, { borderRadius: radius }]}
        >
          {content}
        </BlurView>
      </Container>
    );
  }

  // Android fallback - semi-transparent background
  return (
    <Container
      style={[
        styles.container,
        styles.fallback,
        { borderRadius: radius },
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      {content}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  blur: {
    overflow: 'hidden',
  },
  content: {
    // Content styling handled by children
  },
  fallback: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
