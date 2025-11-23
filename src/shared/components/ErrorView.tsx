/**
 * Error display with retry functionality
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Button } from './Button';

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
  icon?: string;
}

/**
 * Display an error message with optional retry button
 */
export function ErrorView({ message, onRetry, icon = '⚠️' }: ErrorViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button
          title="Retry"
          onPress={onRetry}
          variant="primary"
          size="medium"
          style={styles.button}
        />
      )}
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
  icon: {
    fontSize: 48,
    marginBottom: theme.spacing[4],
  },
  message: {
    ...theme.textStyles.body,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[6],
  },
  button: {
    minWidth: 120,
  },
});