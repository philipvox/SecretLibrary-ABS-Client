/**
 * src/features/profile/screens/StorageSettingsScreen.tsx
 *
 * Dedicated screen for storage settings: downloads, cache, WiFi-only, auto-download.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useLibraryCache } from '@/core/cache';
import { networkMonitor } from '@/core/services/networkMonitor';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale } from '@/shared/theme';

const ACCENT = colors.accent;

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Settings Row Component
interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  note?: string;
  danger?: boolean;
}

function SettingsRow({
  icon,
  label,
  value,
  valueColor,
  onPress,
  switchValue,
  onSwitchChange,
  note,
  danger,
}: SettingsRowProps) {
  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconContainer, danger && styles.iconContainerDanger]}>
          <Ionicons
            name={icon}
            size={scale(18)}
            color={danger ? '#ff4b4b' : 'rgba(255,255,255,0.8)'}
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
          {note ? <Text style={styles.rowNote}>{note}</Text> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>
            {value}
          </Text>
        ) : null}
        {onSwitchChange !== undefined ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: ACCENT }}
            thumbColor="#fff"
          />
        ) : null}
        {onPress ? (
          <Ionicons name="chevron-forward" size={scale(18)} color="rgba(255,255,255,0.3)" />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Section Header Component
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// Storage Meter Component
function StorageMeter({ used, label }: { used: number; label: string }) {
  return (
    <View style={styles.storageMeter}>
      <View style={styles.storageIcon}>
        <Ionicons name="folder" size={scale(24)} color={ACCENT} />
      </View>
      <View style={styles.storageInfo}>
        <Text style={styles.storageValue}>{formatBytes(used)}</Text>
        <Text style={styles.storageLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function StorageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Downloads data
  const { downloads } = useDownloads();
  const completedDownloads = downloads.filter(d => d.status === 'complete');
  const downloadCount = completedDownloads.length;
  const totalStorage = completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);

  // Library cache
  const { refreshCache } = useLibraryCache();
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

  // Network settings
  const [wifiOnlyEnabled, setWifiOnlyEnabled] = useState(networkMonitor.isWifiOnlyEnabled());
  const [autoDownloadSeriesEnabled, setAutoDownloadSeriesEnabled] = useState(
    networkMonitor.isAutoDownloadSeriesEnabled()
  );

  const handleWifiOnlyToggle = useCallback(async (enabled: boolean) => {
    setWifiOnlyEnabled(enabled);
    await networkMonitor.setWifiOnlyEnabled(enabled);
  }, []);

  const handleAutoDownloadSeriesToggle = useCallback(async (enabled: boolean) => {
    setAutoDownloadSeriesEnabled(enabled);
    await networkMonitor.setAutoDownloadSeriesEnabled(enabled);
  }, []);

  const handleRefreshCache = useCallback(async () => {
    if (isRefreshingCache) return;

    setIsRefreshingCache(true);
    try {
      await refreshCache();
      Alert.alert('Success', 'Library cache refreshed successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh library cache.');
    } finally {
      setIsRefreshingCache(false);
    }
  }, [isRefreshingCache, refreshCache]);

  const handleManageDownloads = useCallback(() => {
    navigation.navigate('Downloads');
  }, [navigation]);

  const handleClearAllDownloads = useCallback(() => {
    if (downloadCount === 0) {
      Alert.alert('No Downloads', 'There are no downloaded books to clear.');
      return;
    }

    Alert.alert(
      'Clear All Downloads',
      `This will remove all ${downloadCount} downloaded book${downloadCount !== 1 ? 's' : ''} and free up ${formatBytes(totalStorage)}. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement clear all downloads
            Alert.alert('Coming Soon', 'This feature will be available in a future update.');
          },
        },
      ]
    );
  }, [downloadCount, totalStorage]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Storage</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Storage Overview */}
        <View style={styles.storageOverview}>
          <StorageMeter used={totalStorage} label={`${downloadCount} downloaded book${downloadCount !== 1 ? 's' : ''}`} />
        </View>

        {/* Downloads Section */}
        <View style={styles.section}>
          <SectionHeader title="Downloads" />
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="download-outline"
              label="Manage Downloads"
              value={`${downloadCount} book${downloadCount !== 1 ? 's' : ''}`}
              onPress={handleManageDownloads}
            />
            <SettingsRow
              icon="wifi-outline"
              label="WiFi Only"
              switchValue={wifiOnlyEnabled}
              onSwitchChange={handleWifiOnlyToggle}
              note="Pause downloads when not on WiFi"
            />
            <SettingsRow
              icon="library-outline"
              label="Auto-Download Series"
              switchValue={autoDownloadSeriesEnabled}
              onSwitchChange={handleAutoDownloadSeriesToggle}
              note="Queue next book at 80% progress"
            />
          </View>
        </View>

        {/* Cache Section */}
        <View style={styles.section}>
          <SectionHeader title="Cache" />
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="refresh-outline"
              label="Refresh Library Cache"
              value={isRefreshingCache ? 'Refreshing...' : undefined}
              valueColor="rgba(255,255,255,0.5)"
              onPress={handleRefreshCache}
              note="Re-sync books and series from server"
            />
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={styles.section}>
          <SectionHeader title="Danger Zone" />
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="trash-outline"
              label="Clear All Downloads"
              onPress={handleClearAllDownloads}
              note={`Free up ${formatBytes(totalStorage)}`}
              danger
            />
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={scale(16)} color="rgba(255,255,255,0.4)" />
          <Text style={styles.infoText}>
            Downloads are stored locally on your device. Clearing downloads will not affect your listening progress, which is synced with the server.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: scale(40),
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: SCREEN_BOTTOM_PADDING,
  },
  // Storage Overview
  storageOverview: {
    marginHorizontal: scale(16),
    marginBottom: scale(24),
    padding: scale(20),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(16),
  },
  storageMeter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    backgroundColor: 'rgba(193,244,12,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageInfo: {
    marginLeft: scale(16),
  },
  storageValue: {
    fontSize: scale(24),
    fontWeight: '700',
    color: '#fff',
  },
  storageLabel: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },
  // Sections
  section: {
    marginBottom: scale(24),
  },
  sectionHeader: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginHorizontal: scale(20),
    marginBottom: scale(8),
  },
  sectionCard: {
    marginHorizontal: scale(16),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerDanger: {
    backgroundColor: 'rgba(255,75,75,0.15)',
  },
  rowContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  rowLabel: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#fff',
  },
  rowLabelDanger: {
    color: '#ff4b4b',
  },
  rowNote: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  rowValue: {
    fontSize: scale(14),
    color: ACCENT,
    fontWeight: '500',
  },
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
    marginHorizontal: scale(20),
    marginTop: scale(8),
  },
  infoText: {
    flex: 1,
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.4)',
    lineHeight: scale(18),
  },
});
