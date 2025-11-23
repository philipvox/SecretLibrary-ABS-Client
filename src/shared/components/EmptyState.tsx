/**
 * Empty state display
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface EmptyStateProps {
  message: string;
  icon?: string;
  description?: string;
}

/**
 * Display an empty state with icon and message
 */
export function EmptyState({
  message,
  icon = '📚',
  description,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
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
    fontSize: 64,
    marginBottom: theme.spacing[4],
  },
  message: {
    ...theme.textStyles.h3,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  description: {
    ...theme.textStyles.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    maxWidth: 300,
  },
});