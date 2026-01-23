/**
 * src/shared/components/SyncStatusBanner.tsx
 *
 * Banner showing sync status with manual retry capability.
 * P3 Fix - Provides visibility into sync failures and recovery option.
 *
 * Shows:
 * - When offline with pending syncs
 * - When sync has failed with retry button
 * - Hides when everything is synced
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useSyncStatus, useSyncStatusStore } from '@/core/stores/syncStatusStore';
import { useColors } from '@/shared/theme/themeStore';
import { scale, spacing } from '@/shared/theme';

interface SyncStatusBannerProps {
  /** Show even when no issues (for debugging) */
  alwaysShow?: boolean;
}

export function SyncStatusBanner({ alwaysShow = false }: SyncStatusBannerProps) {
  const colors = useColors();
  const { pendingCount, isSyncing, isOnline, lastError } = useSyncStatus();
  const retrySync = useSyncStatusStore((s) => s.retrySync);

  const handleRetry = useCallback(() => {
    retrySync();
  }, [retrySync]);

  // Determine if we should show the banner
  const hasIssues = !isOnline || lastError || pendingCount > 0;

  // Return empty View on Android to prevent SafeAreaProvider crash
  if (!hasIssues && !alwaysShow) {
    return Platform.OS === 'android' ? <View /> : null;
  }

  // Determine banner content based on state
  let icon: React.ReactNode;
  let message: string;
  let showRetry = false;
  let backgroundColor: string;

  if (!isOnline) {
    icon = <CloudOff size={scale(16)} color={colors.text.secondary} />;
    message = pendingCount > 0
      ? `Offline • ${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} pending sync`
      : 'Offline';
    backgroundColor = colors.surface.card;
    showRetry = false; // Can't retry when offline
  } else if (isSyncing) {
    icon = <ActivityIndicator size="small" color={colors.accent.primary} />;
    message = 'Syncing...';
    backgroundColor = colors.surface.card;
    showRetry = false;
  } else if (lastError) {
    icon = <AlertCircle size={scale(16)} color={colors.semantic.error} />;
    message = pendingCount > 0
      ? `Sync failed • ${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} pending`
      : 'Sync failed';
    backgroundColor = colors.semantic.errorLight;
    showRetry = true;
  } else if (pendingCount > 0) {
    icon = <Cloud size={scale(16)} color={colors.accent.primary} />;
    message = `${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} pending sync`;
    backgroundColor = colors.surface.card;
    showRetry = true;
  } else {
    // All synced (only shown if alwaysShow is true)
    icon = <Cloud size={scale(16)} color={colors.text.secondary} />;
    message = 'All synced';
    backgroundColor = colors.surface.card;
    showRetry = false;
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        {icon}
        <Text style={[styles.message, { color: colors.text.primary }]}>
          {message}
        </Text>
      </View>

      {showRetry && (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.accent.primary }]}
          onPress={handleRetry}
          disabled={isSyncing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RefreshCw size={scale(14)} color={colors.text.inverse} />
          <Text style={[styles.retryText, { color: colors.text.inverse }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: scale(8),
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  message: {
    fontSize: scale(13),
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: scale(6),
  },
  retryText: {
    fontSize: scale(12),
    fontWeight: '600',
    // color set dynamically via inline style using colors.text.inverse
  },
});

export default SyncStatusBanner;
