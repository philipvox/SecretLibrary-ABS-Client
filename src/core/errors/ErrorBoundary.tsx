/**
 * src/core/errors/ErrorBoundary.tsx
 *
 * React Error Boundary component for catching render errors.
 * Provides fallback UI and error reporting.
 */

import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { errorService, wrapError } from './errorService';
import { AppError } from './types';
import { useTheme, accentColors, scale, spacing } from '@/shared/theme';


interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component */
  fallback?: ReactNode | ((error: AppError, retry: () => void) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: AppError) => void;
  /** Context identifier for error tracking */
  context?: string;
  /** Level: 'screen' shows full-screen, 'component' shows inline error */
  level?: 'screen' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { onError, context } = this.props;

    // Wrap and handle the error
    const appError = wrapError(error, {
      context: context || 'ErrorBoundary',
      details: {
        componentStack: errorInfo.componentStack,
      },
    });

    this.setState({ error: appError });

    // Handle through error service
    errorService.handle(appError, { context });

    // Call optional callback
    onError?.(appError);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { children, fallback, level = 'component' } = this.props;
    const { hasError, error } = this.state;

    if (hasError && error) {
      // Custom fallback
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, this.handleRetry);
        }
        return fallback;
      }

      // Default fallback
      return level === 'screen' ? (
        <ScreenErrorView error={error} onRetry={this.handleRetry} />
      ) : (
        <ComponentErrorView error={error} onRetry={this.handleRetry} />
      );
    }

    return children;
  }
}

/**
 * Full-screen error view for screen-level errors
 */
function ScreenErrorView({ error, onRetry }: { error: AppError; onRetry: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background.primary }]}>
      <AlertCircle size={64} color={colors.status.error} strokeWidth={1.5} />
      <Text style={[styles.screenTitle, { color: colors.text.primary }]}>Something went wrong</Text>
      <Text style={[styles.screenMessage, { color: colors.text.secondary }]}>{error.userMessage}</Text>

      <TouchableOpacity style={[styles.retryButton, { backgroundColor: accentColors.gold }]} onPress={onRetry}>
        <RefreshCw size={20} color={colors.background.primary} strokeWidth={2} />
        <Text style={[styles.retryButtonText, { color: colors.background.primary }]}>Try Again</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <View style={[styles.devInfo, { backgroundColor: colors.background.elevated }]}>
          <Text style={[styles.devText, { color: colors.text.tertiary }]}>Code: {error.code}</Text>
          <Text style={[styles.devText, { color: colors.text.tertiary }]}>Category: {error.category}</Text>
          <Text style={[styles.devText, { color: colors.text.tertiary }]} numberOfLines={3}>
            {error.message}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Inline error view for component-level errors
 */
function ComponentErrorView({ error, onRetry }: { error: AppError; onRetry: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.componentContainer, { backgroundColor: `${colors.status.warning}15` }]}>
      <View style={styles.componentContent}>
        <AlertTriangle size={24} color={colors.status.warning} strokeWidth={2} />
        <View style={styles.componentText}>
          <Text style={[styles.componentMessage, { color: colors.text.secondary }]} numberOfLines={2}>
            {error.userMessage}
          </Text>
          <TouchableOpacity onPress={onRetry}>
            <Text style={[styles.componentRetry, { color: accentColors.gold }]}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/**
 * HOC to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options} context={options?.context || displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}

const styles = StyleSheet.create({
  // Screen-level error
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(24),
  },
  screenTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  screenMessage: {
    fontSize: scale(14),
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: scale(24),
    gap: spacing.sm,
  },
  retryButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
  },
  devInfo: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: scale(8),
    width: '100%',
    maxWidth: scale(300),
  },
  devText: {
    fontSize: scale(11),
    marginBottom: spacing.xs,
  },

  // Component-level error
  componentContainer: {
    borderRadius: scale(8),
    padding: spacing.md,
    margin: spacing.sm,
  },
  componentContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  componentText: {
    flex: 1,
  },
  componentMessage: {
    fontSize: scale(13),
    marginBottom: spacing.xs,
  },
  componentRetry: {
    fontSize: scale(12),
    fontWeight: '500',
  },
});
