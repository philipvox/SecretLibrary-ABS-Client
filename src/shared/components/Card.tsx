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
import { theme } from '../theme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: keyof typeof theme.spacing;
  style?: ViewStyle;
}

/**
 * Card container component
 */
export function Card({
  children,
  onPress,
  variant = 'elevated',
  padding = 4,
  style,
}: CardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.base,
        styles[variant],
        { padding: theme.spacing[padding] },
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
    backgroundColor: theme.colors.card.background,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
  },
  elevated: {
    ...theme.elevation.small,
  },
  outlined: {
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  flat: {
    backgroundColor: theme.colors.background.secondary,
  },
});