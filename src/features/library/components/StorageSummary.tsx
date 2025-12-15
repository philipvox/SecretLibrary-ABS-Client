/**
 * src/features/library/components/StorageSummary.tsx
 *
 * Enhanced storage summary component with:
 * - Visual progress bar showing device storage usage
 * - Book count
 * - Available space indicator
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { colors, scale } from '@/shared/theme';

const ACCENT = colors.accent;

interface StorageSummaryProps {
  usedBytes: number;
  bookCount?: number;
  onManagePress?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function StorageSummary({ usedBytes, bookCount = 0, onManagePress }: StorageSummaryProps) {
  const [availableBytes, setAvailableBytes] = useState<number | null>(null);

  useEffect(() => {
    async function fetchStorageInfo() {
      try {
        const info = await FileSystem.getFreeDiskStorageAsync();
        setAvailableBytes(info);
      } catch {
        // Fallback if we can't get storage info
        setAvailableBytes(null);
      }
    }
    fetchStorageInfo();
  }, []);

  if (usedBytes === 0) return null;

  // Calculate percentage of device storage used by downloads
  const totalStorage = availableBytes ? availableBytes + usedBytes : null;
  const usagePercent = totalStorage ? Math.min((usedBytes / totalStorage) * 100, 100) : 5;

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.iconLabel}>
          <Ionicons name="cloud-download" size={scale(16)} color={ACCENT} />
          <Text style={styles.headerText}>Downloaded</Text>
        </View>
        <Text style={styles.usedText}>{formatBytes(usedBytes)}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${usagePercent}%` }]} />
        </View>
      </View>

      {/* Details row */}
      <View style={styles.detailsRow}>
        <Text style={styles.detailText}>
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
          {availableBytes && ` · ${formatBytes(availableBytes)} available`}
        </Text>
        {onManagePress && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={onManagePress}
            activeOpacity={0.7}
          >
            <Text style={styles.manageText}>Manage</Text>
            <Ionicons name="chevron-forward" size={scale(12)} color={ACCENT} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: scale(20),
    marginVertical: scale(16),
    padding: scale(14),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(10),
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  headerText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  usedText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: ACCENT,
  },
  progressContainer: {
    marginBottom: scale(10),
  },
  progressBar: {
    height: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scale(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(3),
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailText: {
    fontSize: scale(12),
    color: colors.textSecondary,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  manageText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: ACCENT,
  },
});
