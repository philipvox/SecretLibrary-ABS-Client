/**
 * Card component for content containers
 *
 * Used for book cards, list items, info sections
 */

import React, { ReactNode } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {
  colors,
  spacing,
  radius,
  elevation,
} from '@/shared/theme';

type SpacingKey = keyof typeof spacing;

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: SpacingKey;
  style?: ViewStyle;
}

/**
 * Card container component
 */
export function Card({
  children,
  onPress,
  variant = 'elevated',
  padding = 'lg',
  style,
}: CardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.base,
        styles[variant],
        { padding: spacing[padding] },
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  elevated: {
    ...elevation.small,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  flat: {
    backgroundColor: colors.backgroundSecondary,
  },
});