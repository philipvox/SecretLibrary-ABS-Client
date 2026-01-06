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
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Download,
  Wifi,
  Library,
  RefreshCw,
  Trash2,
  Info,
  type LucideIcon,
} from 'lucide-react-native';
import { useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useLibraryCache } from '@/core/cache';
import { networkMonitor } from '@/core/services/networkMonitor';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { accentColors, scale, typography, fontWeight, spacing } from '@/shared/theme';
import { useColors, ThemeColors } from '@/shared/theme';
import { logger } from '@/shared/utils/logger';

const ACCENT = accentColors.gold;

// Helper to create theme-aware colors from nested ThemeColors
function createColors(c: ThemeColors) {
  return {
    accent: ACCENT,
    background: c.background.secondary,
    text: c.text.primary,
    textSecondary: c.text.secondary,
    textTertiary: c.text.tertiary,
    card: c.border.default,
    border: c.border.default,
    iconBg: c.border.default,
    danger: '#ff4b4b', // Intentional: destructive action color
    dangerBg: 'rgba(255,75,75,0.15)',
  };
}

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
  Icon: LucideIcon;
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  note?: string;
  danger?: boolean;
  colors: ReturnType<typeof createColors>;
}

function SettingsRow({
  Icon,
  label,
  value,
  valueColor,
  onPress,
  switchValue,
  onSwitchChange,
  note,
  danger,
  colors,
}: SettingsRowProps) {
  const content = (
    <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }, danger && { backgroundColor: colors.dangerBg }]}>
          <Icon
            size={scale(18)}
            color={danger ? colors.danger : colors.textSecondary}
            strokeWidth={2}
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.text }, danger && { color: colors.danger }]}>{label}</Text>
          {note ? <Text style={[styles.rowNote, { color: colors.textTertiary }]}>{note}</Text> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.accent }, valueColor ? { color: valueColor } : null]}>
            {value}
          </Text>
        ) : null}
        {onSwitchChange !== undefined ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: colors.border, true: ACCENT }}
            thumbColor="#fff"
          />
        ) : null}
        {onPress ? (
          <ChevronRight size={scale(18)} color={colors.textTertiary} strokeWidth={2} />
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
function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof createColors> }) {
  return <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>{title}</Text>;
}

// Storage Meter Component
function StorageMeter({ used, label, colors }: { used: number; label: string; colors: ReturnType<typeof createColors> }) {
  return (
    <View style={styles.storageMeter}>
      <View style={styles.storageIcon}>
        <Folder size={scale(24)} color={colors.accent} strokeWidth={2} />
      </View>
      <View style={styles.storageInfo}>
        <Text style={[styles.storageValue, { color: colors.text }]}>{formatBytes(used)}</Text>
        <Text style={[styles.storageLabel, { color: colors.textTertiary }]}>{label}</Text>
      </View>
    </View>
  );
}

export function StorageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const themeColors = useColors();
  const colors = createColors(themeColors);

  // Downloads data
  const { downloads } = useDownloads();
  const completedDownloads = downloads.filter(d => d.status === 'complete');
  const downloadCount = completedDownloads.length;
  const totalStorage = completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);

  // Library cache
  const { refreshCache } = useLibraryCache();
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [isClearingDownloads, setIsClearingDownloads] = useState(false);

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

    if (isClearingDownloads) return;

    Alert.alert(
      'Clear All Downloads',
      `This will remove all ${downloadCount} downloaded book${downloadCount !== 1 ? 's' : ''} and free up ${formatBytes(totalStorage)}. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearingDownloads(true);
            try {
              await downloadManager.clearAllDownloads();
              Alert.alert('Success', 'All downloads have been cleared.');
            } catch (error) {
              logger.error('[StorageSettings] Failed to clear downloads:', error);
              Alert.alert('Error', 'Failed to clear downloads. Please try again.');
            } finally {
              setIsClearingDownloads(false);
            }
          },
        },
      ]
    );
  }, [downloadCount, totalStorage, isClearingDownloads]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={scale(24)} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Storage</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Storage Overview */}
        <View style={[styles.storageOverview, { backgroundColor: colors.card }]}>
          <StorageMeter used={totalStorage} label={`${downloadCount} downloaded book${downloadCount !== 1 ? 's' : ''}`} colors={colors} />
        </View>

        {/* Downloads Section */}
        <View style={styles.section}>
          <SectionHeader title="Downloads" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={Download}
              label="Manage Downloads"
              value={`${downloadCount} book${downloadCount !== 1 ? 's' : ''}`}
              onPress={handleManageDownloads}
              colors={colors}
            />
            <SettingsRow
              Icon={Wifi}
              label="WiFi Only"
              switchValue={wifiOnlyEnabled}
              onSwitchChange={handleWifiOnlyToggle}
              note="Pause downloads when not on WiFi"
              colors={colors}
            />
            <SettingsRow
              Icon={Library}
              label="Auto-Download Series"
              switchValue={autoDownloadSeriesEnabled}
              onSwitchChange={handleAutoDownloadSeriesToggle}
              note="Queue next book at 80% progress"
              colors={colors}
            />
          </View>
        </View>

        {/* Cache Section */}
        <View style={styles.section}>
          <SectionHeader title="Cache" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={RefreshCw}
              label="Refresh Library Cache"
              value={isRefreshingCache ? 'Refreshing...' : undefined}
              valueColor={colors.textTertiary}
              onPress={handleRefreshCache}
              note="Re-sync books and series from server"
              colors={colors}
            />
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={styles.section}>
          <SectionHeader title="Danger Zone" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={Trash2}
              label="Clear All Downloads"
              onPress={isClearingDownloads ? undefined : handleClearAllDownloads}
              value={isClearingDownloads ? 'Clearing...' : undefined}
              valueColor={colors.textTertiary}
              note={`Free up ${formatBytes(totalStorage)}`}
              danger
              colors={colors}
            />
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.textTertiary} strokeWidth={2} />
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
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
    // backgroundColor set via colors.background in JSX
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontWeight: fontWeight.semibold,
    // color set via colors.text in JSX
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
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    padding: spacing.xl,
    // backgroundColor set via colors.card in JSX
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
    backgroundColor: 'rgba(193,244,12,0.15)', // Intentional: accent highlight
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageInfo: {
    marginLeft: spacing.lg,
  },
  storageValue: {
    ...typography.displayMedium,
    fontWeight: fontWeight.bold,
    // color set via colors.text in JSX
  },
  storageLabel: {
    ...typography.bodyMedium,
    // color set via colors.textTertiary in JSX
    marginTop: scale(2),
  },
  // Sections
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.semibold,
    // color set via colors.textTertiary in JSX
    letterSpacing: 0.5,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    marginHorizontal: spacing.lg,
    // backgroundColor set via colors.card in JSX
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    // borderBottomColor set via colors.border in JSX
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
    // backgroundColor set via colors.iconBg in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.medium,
    // color set via colors.text in JSX
  },
  rowNote: {
    ...typography.bodySmall,
    // color set via colors.textTertiary in JSX
    marginTop: scale(2),
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.medium,
    // color set via colors.accent in JSX
  },
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  infoText: {
    flex: 1,
    ...typography.bodySmall,
    // color set via colors.textTertiary in JSX
    lineHeight: scale(18),
  },
});
