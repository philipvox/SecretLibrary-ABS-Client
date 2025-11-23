/**
 * Loading spinner with consistent styling
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface LoadingSpinnerProps {
  text?: string;
  size?: 'small' | 'large';
  color?: string;
}

/**
 * Display a loading spinner with optional text message
 */
export function LoadingSpinner({
  text,
  size = 'large',
  color = theme.colors.primary[500],
}: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
    padding: theme.spacing[6],
  },
  text: {
    ...theme.textStyles.body,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing[3],
    textAlign: 'center',
  },
});