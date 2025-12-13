/**
 * src/core/errors/components/ErrorToast.tsx
 *
 * Toast notification component for error messages.
 * Displays brief, non-blocking error notifications.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppError, ErrorSeverity } from '../types';

interface ErrorToastProps {
  error: AppError;
  onDismiss: () => void;
  onAction?: () => void;
  duration?: number;
}

const SEVERITY_COLORS: Record<ErrorSeverity, string> = {
  low: '#4a9eff',
  medium: '#ff9800',
  high: '#ff4444',
  critical: '#d32f2f',
};

const SEVERITY_ICONS: Record<ErrorSeverity, keyof typeof Ionicons.glyphMap> = {
  low: 'information-circle',
  medium: 'warning',
  high: 'alert-circle',
  critical: 'close-circle',
};

export function ErrorToast({
  error,
  onDismiss,
  onAction,
  duration = 4000,
}: ErrorToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  const color = SEVERITY_COLORS[error.severity];
  const icon = SEVERITY_ICONS[error.severity];
  const hasAction = error.recovery === 'retry' || onAction;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.toast, { borderLeftColor: color }]}>
        <Ionicons name={icon} size={22} color={color} style={styles.icon} />

        <View style={styles.content}>
          <Text style={styles.message} numberOfLines={2}>
            {error.userMessage}
          </Text>
        </View>

        <View style={styles.actions}>
          {hasAction && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                onAction?.();
                dismiss();
              }}
            >
              <Text style={[styles.actionText, { color }]}>
                {error.recovery === 'retry' ? 'Retry' : 'Fix'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.dismissButton} onPress={dismiss}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 4,
  },
});
