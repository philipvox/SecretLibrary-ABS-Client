/**
 * Empty state display with optional action
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme';
import { Button } from './Button';

interface EmptyStateProps {
  /** Main message/title */
  title: string;
  /** Optional icon (emoji or React node) */
  icon?: React.ReactNode | string;
  /** Optional description below the title */
  description?: string;
  /** Action button title */
  actionTitle?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Whether to take full screen height */
  fullScreen?: boolean;
  /** Custom container style */
  style?: ViewStyle;
}

/**
 * Display an empty state with icon, message, and optional action
 */
export function EmptyState({
  title,
  icon = '📚',
  description,
  actionTitle,
  onAction,
  fullScreen = true,
  style,
}: EmptyStateProps) {
  const renderIcon = () => {
    if (typeof icon === 'string') {
      return <Text style={styles.iconEmoji}>{icon}</Text>;
    }
    return <View style={styles.iconContainer}>{icon}</View>;
  };

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen, style]}>
      {renderIcon()}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="secondary"
          size="medium"
          style={styles.actionButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[6],
  },
  fullScreen: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  iconEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing[4],
  },
  iconContainer: {
    marginBottom: theme.spacing[4],
  },
  title: {
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
    marginBottom: theme.spacing[4],
  },
  actionButton: {
    marginTop: theme.spacing[2],
    minWidth: 140,
  },
});