/**
 * src/shared/components/ErrorView.tsx
 *
 * Error display with retry functionality.
 * NN/g: Clear error messages with actionable recovery options.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  colors,
  spacing,
  radius,
  layout,
  typography,
  scale,
} from '@/shared/theme';

// Icon components
const WifiOffIcon = ({ size = 48, color = colors.error }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M1 9l2 2a14.5 14.5 0 0118 0l2-2A17.5 17.5 0 001 9z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M5 13l2 2a9.5 9.5 0 0110 0l2-2a12.5 12.5 0 00-14 0z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="19" r="1" fill={color} />
    <Path
      d="M2 2l20 20"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

const AlertIcon = ({ size = 48, color = colors.error }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M12 9v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Circle cx="12" cy="17" r="1" fill={color} />
  </Svg>
);

const ServerIcon = ({ size = 48, color = colors.error }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 5a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"
      stroke={color}
      strokeWidth={2}
    />
    <Path
      d="M2 15a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"
      stroke={color}
      strokeWidth={2}
    />
    <Circle cx="6" cy="7" r="1" fill={color} />
    <Circle cx="6" cy="17" r="1" fill={color} />
  </Svg>
);

export type ErrorType = 'network' | 'server' | 'auth' | 'notFound' | 'generic';

interface ErrorViewProps {
  /** Error type determines icon and default messaging */
  type?: ErrorType;
  /** Main error title */
  title?: string;
  /** Detailed error message */
  message?: string;
  /** Primary action (usually retry) */
  onRetry?: () => void;
  /** Primary action label */
  retryLabel?: string;
  /** Secondary action (e.g., go back, go home) */
  onSecondaryAction?: () => void;
  /** Secondary action label */
  secondaryLabel?: string;
  /** Whether retry is currently loading */
  isRetrying?: boolean;
}

// NN/g: Error messages should be specific and offer clear solutions
const ERROR_CONTENT: Record<ErrorType, { icon: React.ReactNode; title: string; message: string }> = {
  network: {
    icon: <WifiOffIcon size={scale(56)} />,
    title: 'No Internet Connection',
    message: 'Check your Wi-Fi or cellular connection and try again.',
  },
  server: {
    icon: <ServerIcon size={scale(56)} />,
    title: 'Server Unavailable',
    message: 'The server is not responding. It may be down for maintenance.',
  },
  auth: {
    icon: <AlertIcon size={scale(56)} />,
    title: 'Session Expired',
    message: 'Please sign in again to continue.',
  },
  notFound: {
    icon: <AlertIcon size={scale(56)} />,
    title: 'Content Not Found',
    message: 'This item may have been moved or deleted.',
  },
  generic: {
    icon: <AlertIcon size={scale(56)} />,
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
};

/**
 * Display an error message with retry and secondary action options.
 * NN/g: Visibility of system status + error prevention
 */
export function ErrorView({
  type = 'generic',
  title,
  message,
  onRetry,
  retryLabel = 'Try Again',
  onSecondaryAction,
  secondaryLabel = 'Go Back',
  isRetrying = false,
}: ErrorViewProps) {
  // Auto-detect offline state
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  // Use offline content if we detect no connection
  const effectiveType = isOffline ? 'network' : type;
  const content = ERROR_CONTENT[effectiveType];

  const displayTitle = title || content.title;
  const displayMessage = message || content.message;

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        {content.icon}
      </View>

      {/* Title */}
      <Text style={styles.title}>{displayTitle}</Text>

      {/* Message */}
      <Text style={styles.message}>{displayMessage}</Text>

      {/* Actions */}
      <View style={styles.actions}>
        {onRetry && (
          <Pressable
            style={[styles.primaryButton, isRetrying && styles.buttonDisabled]}
            onPress={onRetry}
            disabled={isRetrying}
          >
            <Text style={styles.primaryButtonText}>
              {isRetrying ? 'Retrying...' : retryLabel}
            </Text>
          </Pressable>
        )}

        {onSecondaryAction && (
          <Pressable
            style={styles.secondaryButton}
            onPress={onSecondaryAction}
          >
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        )}
      </View>

      {/* Offline indicator */}
      {isOffline && (
        <View style={styles.offlineIndicator}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>Offline</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    padding: spacing.xxl,
  },
  iconContainer: {
    marginBottom: spacing.xl,
    opacity: 0.9,
  },
  title: {
    ...typography.displaySmall,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: scale(280),
    marginBottom: spacing['3xl'],
  },
  actions: {
    gap: spacing.md,
    width: '100%',
    maxWidth: scale(240),
  },
  // NN/g: 44px minimum touch targets
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.card,
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.labelLarge,
    fontWeight: '600',
    color: colors.backgroundPrimary,
  },
  secondaryButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.card,
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
  },
  secondaryButtonText: {
    ...typography.labelLarge,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: spacing.xl,
  },
  offlineDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: colors.error,
    marginRight: spacing.xs,
  },
  offlineText: {
    ...typography.labelMedium,
    color: colors.error,
  },
});
