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
  spacing,
  radius,
  layout,
  typography,
  scale,
  useTheme,
} from '@/shared/theme';

// Icon components - color defaults provided by component, not by icons
const WifiOffIcon = ({ size = 48, color }: { size?: number; color: string }) => (
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

const AlertIcon = ({ size = 48, color }: { size?: number; color: string }) => (
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

const ServerIcon = ({ size = 48, color }: { size?: number; color: string }) => (
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
const ERROR_CONTENT: Record<ErrorType, { iconType: 'wifi' | 'server' | 'alert'; title: string; message: string }> = {
  network: {
    iconType: 'wifi',
    title: 'No Internet Connection',
    message: 'Check your Wi-Fi or cellular connection and try again.',
  },
  server: {
    iconType: 'server',
    title: 'Server Unavailable',
    message: 'The server is not responding. It may be down for maintenance.',
  },
  auth: {
    iconType: 'alert',
    title: 'Session Expired',
    message: 'Please sign in again to continue.',
  },
  notFound: {
    iconType: 'alert',
    title: 'Content Not Found',
    message: 'This item may have been moved or deleted.',
  },
  generic: {
    iconType: 'alert',
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
};

// Helper to get icon component with theme color
function getErrorIcon(iconType: 'wifi' | 'server' | 'alert', color: string) {
  const size = scale(56);
  switch (iconType) {
    case 'wifi':
      return <WifiOffIcon size={size} color={color} />;
    case 'server':
      return <ServerIcon size={size} color={color} />;
    case 'alert':
    default:
      return <AlertIcon size={size} color={color} />;
  }
}

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
  const { colors } = useTheme();

  // Auto-detect offline state
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  // Use offline content if we detect no connection
  const effectiveType = isOffline ? 'network' : type;
  const content = ERROR_CONTENT[effectiveType];

  const displayTitle = title || content.title;
  const displayMessage = message || content.message;

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        {getErrorIcon(content.iconType, colors.status.error)}
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.text.primary }]}>{displayTitle}</Text>

      {/* Message */}
      <Text style={[styles.message, { color: colors.text.secondary }]}>{displayMessage}</Text>

      {/* Actions */}
      <View style={styles.actions}>
        {onRetry && (
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.accent.primary }, isRetrying && styles.buttonDisabled]}
            onPress={onRetry}
            disabled={isRetrying}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background.primary }]}>
              {isRetrying ? 'Retrying...' : retryLabel}
            </Text>
          </Pressable>
        )}

        {onSecondaryAction && (
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: colors.background.secondary }]}
            onPress={onSecondaryAction}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text.secondary }]}>{secondaryLabel}</Text>
          </Pressable>
        )}
      </View>

      {/* Offline indicator */}
      {isOffline && (
        <View style={[styles.offlineIndicator, { backgroundColor: `${colors.status.error}25` }]}>
          <View style={[styles.offlineDot, { backgroundColor: colors.status.error }]} />
          <Text style={[styles.offlineText, { color: colors.status.error }]}>Offline</Text>
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
    padding: spacing.xxl,
  },
  iconContainer: {
    marginBottom: spacing.xl,
    opacity: 0.9,
  },
  title: {
    ...typography.displaySmall,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodyMedium,
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
  },
  secondaryButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.card,
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.labelLarge,
    fontWeight: '500',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xl,
  },
  offlineDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
    marginRight: spacing.xs,
  },
  offlineText: {
    ...typography.labelMedium,
  },
});
