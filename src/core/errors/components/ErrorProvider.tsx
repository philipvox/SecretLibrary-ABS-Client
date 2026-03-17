/**
 * src/core/errors/components/ErrorProvider.tsx
 *
 * Global error provider and context for error handling.
 * Manages error display (toasts, sheets) across the app.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { errorService } from '../errorService';
import { AppError, ErrorSeverity } from '../types';
import { ErrorToast } from './ErrorToast';
import { ErrorSheet } from './ErrorSheet';

interface ErrorContextValue {
  /** Show an error toast notification */
  showError: (error: AppError | Error | string) => void;
  /** Show a detailed error sheet */
  showErrorSheet: (
    error: AppError,
    options?: {
      onRetry?: () => void;
      onSecondaryAction?: () => void;
      secondaryActionText?: string;
    }
  ) => void;
  /** Dismiss all error displays */
  dismissAll: () => void;
  /** Current error count for debugging */
  errorCount: number;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

interface ErrorProviderProps {
  children: ReactNode;
  /** Max number of toasts to show at once */
  maxToasts?: number;
  /** Whether to subscribe to global error service */
  subscribeToGlobalErrors?: boolean;
  /** Severity threshold for auto-showing toasts (default: 'medium') */
  autoShowThreshold?: ErrorSeverity;
}

interface ToastItem {
  id: string;
  error: AppError;
  onAction?: () => void;
}

interface SheetItem {
  error: AppError;
  onRetry?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionText?: string;
}

const SEVERITY_ORDER: Record<ErrorSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function ErrorProvider({
  children,
  maxToasts = 3,
  subscribeToGlobalErrors = true,
  autoShowThreshold = 'medium',
}: ErrorProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sheet, setSheet] = useState<SheetItem | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  // Convert any error to AppError
  const toAppError = useCallback((error: AppError | Error | string): AppError => {
    if (typeof error === 'string') {
      return errorService.createError({
        code: 'USER_ERROR',
        message: error,
        category: 'unknown',
        severity: 'medium',
        recovery: 'none',
        userMessage: error,
      });
    }
    if ('code' in error && 'category' in error) {
      return error as AppError;
    }
    return errorService.wrap(error);
  }, []);

  // Show error toast
  const showError = useCallback(
    (error: AppError | Error | string) => {
      const appError = toAppError(error);
      const id = `${Date.now()}-${Math.random()}`;

      setErrorCount((c) => c + 1);

      setToasts((current) => {
        // Remove oldest if at max
        const newToasts = current.length >= maxToasts ? current.slice(1) : current;
        return [...newToasts, { id, error: appError }];
      });
    },
    [toAppError, maxToasts]
  );

  // Show error sheet
  const showErrorSheet = useCallback(
    (
      error: AppError,
      options?: {
        onRetry?: () => void;
        onSecondaryAction?: () => void;
        secondaryActionText?: string;
      }
    ) => {
      setSheet({
        error,
        onRetry: options?.onRetry,
        onSecondaryAction: options?.onSecondaryAction,
        secondaryActionText: options?.secondaryActionText,
      });
    },
    []
  );

  // Dismiss all
  const dismissAll = useCallback(() => {
    setToasts([]);
    setSheet(null);
  }, []);

  // Dismiss a specific toast
  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  // Dismiss sheet
  const dismissSheet = useCallback(() => {
    setSheet(null);
  }, []);

  // Subscribe to global error service
  useEffect(() => {
    if (!subscribeToGlobalErrors) return;

    const unsubscribe = errorService.subscribe(
      (error) => {
        // Only auto-show if severity meets threshold
        const shouldShow =
          SEVERITY_ORDER[error.severity] >= SEVERITY_ORDER[autoShowThreshold];

        if (shouldShow) {
          // Critical errors get a sheet, others get a toast
          if (error.severity === 'critical') {
            showErrorSheet(error);
          } else {
            showError(error);
          }
        }
      },
      {
        // Don't auto-show low severity errors
        severities: ['medium', 'high', 'critical'],
      }
    );

    return unsubscribe;
  }, [subscribeToGlobalErrors, autoShowThreshold, showError, showErrorSheet]);

  return (
    <ErrorContext.Provider
      value={{
        showError,
        showErrorSheet,
        dismissAll,
        errorCount,
      }}
    >
      {children}

      {/* Toast notifications */}
      {toasts.map((toast, _index) => (
        <ErrorToast
          key={toast.id}
          error={toast.error}
          onDismiss={() => dismissToast(toast.id)}
          onAction={toast.onAction}
        />
      ))}

      {/* Error sheet */}
      {sheet && (
        <ErrorSheet
          error={sheet.error}
          visible={true}
          onDismiss={dismissSheet}
          onRetry={sheet.onRetry}
          onSecondaryAction={sheet.onSecondaryAction}
          secondaryActionText={sheet.secondaryActionText}
        />
      )}
    </ErrorContext.Provider>
  );
}

/**
 * Hook to access error display functions
 */
export function useErrorDisplay() {
  const context = useContext(ErrorContext);

  if (!context) {
    throw new Error('useErrorDisplay must be used within an ErrorProvider');
  }

  return context;
}

/**
 * Hook to show a simple error toast
 */
export function useShowError() {
  const { showError } = useErrorDisplay();
  return showError;
}
