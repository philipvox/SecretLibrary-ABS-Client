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
import { CloudDownload, ChevronRight } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { scale } from '@/shared/theme';
import { useColors } from '@/shared/theme/themeStore';

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
  const colors = useColors();
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
    <View style={[styles.container, {
      backgroundColor: colors.surface.card,
      borderColor: colors.border.light,
    }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.iconLabel}>
          <CloudDownload size={scale(16)} color={colors.text.accent} strokeWidth={2} />
          <Text style={[styles.headerText, { color: colors.text.primary }]}>
            Downloaded
          </Text>
        </View>
        <Text style={[styles.usedText, { color: colors.text.accent }]}>
          {formatBytes(usedBytes)}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.progress.track }]}>
          <View style={[styles.progressFill, {
            width: `${usagePercent}%`,
            backgroundColor: colors.progress.fill,
          }]} />
        </View>
      </View>

      {/* Details row */}
      <View style={styles.detailsRow}>
        <Text style={[styles.detailText, { color: colors.text.secondary }]}>
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
          {availableBytes && ` · ${formatBytes(availableBytes)} available`}
        </Text>
        {onManagePress && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={onManagePress}
            activeOpacity={0.7}
          >
            <Text style={[styles.manageText, { color: colors.text.accent }]}>
              Manage
            </Text>
            <ChevronRight size={scale(12)} color={colors.text.accent} strokeWidth={2} />
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
    borderRadius: scale(12),
    borderWidth: 1,
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
  },
  usedText: {
    fontSize: scale(14),
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: scale(10),
  },
  progressBar: {
    height: scale(6),
    borderRadius: scale(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(3),
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailText: {
    fontSize: scale(12),
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  manageText: {
    fontSize: scale(12),
    fontWeight: '500',
  },
});
