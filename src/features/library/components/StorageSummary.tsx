/**
 * src/features/library/components/StorageSummary.tsx
 *
 * Storage summary component showing download storage usage
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

interface StorageSummaryProps {
  usedBytes: number;
  onManagePress?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function StorageSummary({ usedBytes, onManagePress }: StorageSummaryProps) {
  if (usedBytes === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.infoRow}>
          <Ionicons name="folder-outline" size={scale(18)} color="rgba(255,255,255,0.6)" />
          <Text style={styles.label}>Storage</Text>
        </View>

        <View style={styles.valueRow}>
          <Text style={styles.value}>{formatBytes(usedBytes)} used</Text>
          {onManagePress && (
            <TouchableOpacity
              style={styles.manageButton}
              onPress={onManagePress}
              activeOpacity={0.7}
            >
              <Text style={styles.manageText}>Manage</Text>
              <Ionicons name="chevron-forward" size={14} color={ACCENT} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress bar showing approximate usage */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '30%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: scale(20),
    marginVertical: scale(16),
    padding: scale(16),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  label: {
    fontSize: scale(14),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  value: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.6)',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  manageText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: ACCENT,
  },
  progressBar: {
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },
});
