/**
 * src/core/errors/components/ErrorSheet.tsx
 *
 * Bottom sheet component for displaying detailed errors.
 * Shows error details and recovery actions.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { AlertCircle, RefreshCw, CloudOff, LogIn, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppError, ErrorSeverity, RecoveryStrategy } from '../types';
import { useTheme, scale, spacing, type ThemeColors } from '@/shared/theme';


interface ErrorSheetProps {
  error: AppError;
  visible: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionText?: string;
  showDetails?: boolean;
}

/**
 * Get severity-based colors from theme semantic tokens
 */
function getSeverityColors(severity: ErrorSeverity, colors: ThemeColors) {
  const severityMap = {
    low: { color: colors.semantic.info, bg: colors.semantic.infoLight },
    medium: { color: colors.semantic.warning, bg: colors.semantic.warningLight },
    high: { color: colors.semantic.error, bg: colors.semantic.errorLight },
    critical: { color: colors.semantic.error, bg: colors.semantic.error },
  };
  return severityMap[severity];
}

const RECOVERY_BUTTONS: Record<RecoveryStrategy, { text: string; Icon: LucideIcon } | null> = {
  retry: { text: 'Try Again', Icon: RefreshCw },
  offline: { text: 'Work Offline', Icon: CloudOff },
  reauth: { text: 'Log In Again', Icon: LogIn },
  manual: null,
  none: null,
};

export function ErrorSheet({
  error,
  visible,
  onDismiss,
  onRetry,
  onSecondaryAction,
  secondaryActionText,
  showDetails = __DEV__,
}: ErrorSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const severityColors = getSeverityColors(error.severity, colors);
  const recoveryButton = RECOVERY_BUTTONS[error.recovery];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay.medium }]} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.background.elevated }]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: severityColors.bg }]}>
              <AlertCircle size={32} color={severityColors.color} strokeWidth={2} />
            </View>
            <Text style={[styles.title, { color: colors.text.primary }]}>Something went wrong</Text>
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>{getCategoryLabel(error.category)}</Text>
          </View>

          {/* Message */}
          <View style={[styles.messageContainer, { backgroundColor: colors.background.secondary }]}>
            <Text style={[styles.message, { color: colors.text.secondary }]}>{error.userMessage}</Text>
          </View>

          {/* Debug Details (DEV only) */}
          {showDetails && (
            <View style={[styles.detailsContainer, { backgroundColor: colors.background.secondary }]}>
              <Text style={[styles.detailsTitle, { color: colors.text.tertiary }]}>Debug Info</Text>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text.tertiary }]}>Code:</Text>
                <Text style={[styles.detailValue, { color: colors.text.secondary }]}>{error.code}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text.tertiary }]}>Category:</Text>
                <Text style={[styles.detailValue, { color: colors.text.secondary }]}>{error.category}</Text>
              </View>
              {error.context && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.text.tertiary }]}>Context:</Text>
                  <Text style={[styles.detailValue, { color: colors.text.secondary }]}>
                    {typeof error.context === 'string'
                      ? error.context
                      : `${error.context.source}${error.context.action ? `:${error.context.action}` : ''}${error.context.screen ? `@${error.context.screen}` : ''}`}
                  </Text>
                </View>
              )}
              <Text style={[styles.technicalMessage, { color: colors.text.tertiary }]} numberOfLines={3}>
                {error.message}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {recoveryButton && onRetry && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: severityColors.color }]}
                onPress={onRetry}
              >
                <recoveryButton.Icon
                  size={20}
                  color={colors.text.inverse}
                  strokeWidth={2}
                  style={styles.buttonIcon}
                />
                <Text style={[styles.primaryButtonText, { color: colors.text.inverse }]}>{recoveryButton.text}</Text>
              </TouchableOpacity>
            )}

            {onSecondaryAction && secondaryActionText && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onSecondaryAction}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.accent.primary }]}>{secondaryActionText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
              <Text style={[styles.dismissButtonText, { color: colors.text.tertiary }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    network: 'Network Error',
    auth: 'Authentication Error',
    sync: 'Sync Error',
    download: 'Download Error',
    playback: 'Playback Error',
    database: 'Storage Error',
    validation: 'Validation Error',
    unknown: 'Error',
  };
  return labels[category] || 'Error';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // backgroundColor set via colors.overlay.medium
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: scale(36),
    height: scale(4),
    borderRadius: scale(2),
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: scale(20),
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: scale(14),
  },
  messageContainer: {
    borderRadius: scale(12),
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  message: {
    fontSize: scale(15),
    lineHeight: scale(22),
    textAlign: 'center',
  },
  detailsContainer: {
    borderRadius: scale(8),
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailsTitle: {
    fontSize: scale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: scale(12),
    width: scale(80),
  },
  detailValue: {
    fontSize: scale(12),
    flex: 1,
  },
  technicalMessage: {
    fontSize: scale(11),
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: scale(12),
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  primaryButtonText: {
    fontSize: scale(16),
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    fontSize: scale(15),
    fontWeight: '500',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  dismissButtonText: {
    fontSize: scale(15),
  },
});
