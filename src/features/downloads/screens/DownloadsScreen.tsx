/**
 * src/features/downloads/screens/DownloadsScreen.tsx
 *
 * Manage Downloads Screen - UX Research-backed implementation
 *
 * Features:
 * - Storage card with visual bar showing used/available space
 * - Downloading section with progress bars
 * - Queued section with cancel option
 * - Downloaded section with swipe-to-delete
 * - Clear cache functionality
 * - Empty state with CTA
 *
 * Based on NNGroup research and competitor patterns (Audible, Spotify, Netflix)
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import { useDownloads } from '@/core/hooks/useDownloads';
import { DownloadTask, downloadManager } from '@/core/services/downloadManager';
import { useCoverUrl } from '@/core/cache';
import { sqliteCache } from '@/core/services/sqliteCache';
import { LibraryItem } from '@/core/types';
import { haptics } from '@/core/native/haptics';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, wp } from '@/shared/theme';

// ============================================================================
// DESIGN TOKENS (from spec)
// ============================================================================

const COLORS = {
  accent: colors.accent,
  background: colors.backgroundPrimary,
  storageUsed: colors.accent,
  storageFree: 'rgba(255, 255, 255, 0.1)',
  progressFill: colors.accent,
  progressTrack: 'rgba(255, 255, 255, 0.1)',
  textPrimary: colors.textPrimary,
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textTertiary: 'rgba(255, 255, 255, 0.5)',
  cardBackground: 'rgba(255, 255, 255, 0.05)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  destructive: '#FF453A',
  success: '#30D158',
};

const SPACING = {
  pageHorizontal: wp(4),
  sectionGap: wp(6),
  cardPadding: wp(4),
  itemGap: wp(3),
  coverSize: wp(15),
};

// ============================================================================
// ICONS
// ============================================================================

const BackIcon = ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const DownloadIcon = ({ size = 64, color = COLORS.textTertiary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PauseIcon = ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M10 4H6v16h4V4zM18 4h-4v16h4V4z" fill={color} />
  </Svg>
);

const PlayIcon = ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 4l15 8-15 8V4z" fill={color} />
  </Svg>
);

const CloseIcon = ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const TrashIcon = ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ChevronIcon = ({ size = 20, color = COLORS.textTertiary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SettingsIcon = ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} />
  </Svg>
);

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s left`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min left`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m left`;
}

// ============================================================================
// STORAGE CARD COMPONENT
// ============================================================================

interface StorageCardProps {
  usedBytes: number;
  onClearCache?: () => void;
  cacheSize?: number;
}

function StorageCard({ usedBytes, onClearCache, cacheSize = 0 }: StorageCardProps) {
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  useEffect(() => {
    FileSystem.getFreeDiskStorageAsync()
      .then(setFreeBytes)
      .catch(() => setFreeBytes(null));
  }, [usedBytes]);

  const totalBytes = freeBytes ? freeBytes + usedBytes : null;
  const usagePercent = totalBytes ? Math.min((usedBytes / totalBytes) * 100, 100) : 1;

  return (
    <View style={styles.storageCard}>
      <Text style={styles.storageTitle}>Storage</Text>

      {/* Storage bar */}
      <View style={styles.storageBar}>
        <View style={[styles.storageBarFill, { width: `${usagePercent}%` }]} />
      </View>

      {/* Labels */}
      <View style={styles.storageLabels}>
        <Text style={styles.storageUsedLabel}>{formatBytes(usedBytes)} used</Text>
        <Text style={styles.storageFreeLabel}>
          {freeBytes ? `${formatBytes(freeBytes)} free` : 'Calculating...'}
        </Text>
      </View>

      {/* Clear cache button */}
      {cacheSize > 0 && onClearCache && (
        <TouchableOpacity style={styles.clearCacheButton} onPress={onClearCache} activeOpacity={0.7}>
          <Text style={styles.clearCacheText}>Clear Cache</Text>
          <Text style={styles.clearCacheSize}>{formatBytes(cacheSize)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// ACTIVE DOWNLOAD ROW COMPONENT
// ============================================================================

interface ActiveDownloadRowProps {
  download: DownloadTask;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function ActiveDownloadRow({ download, onPause, onResume, onCancel }: ActiveDownloadRowProps) {
  const [book, setBook] = useState<LibraryItem | null>(null);
  const coverUrl = useCoverUrl(download.itemId);

  useEffect(() => {
    sqliteCache.getLibraryItem(download.itemId).then(setBook);
  }, [download.itemId]);

  const metadata = book?.media?.metadata as any;
  const title = metadata?.title || 'Loading...';
  const author = metadata?.authorName || '';

  const progress = Math.round(download.progress * 100);
  const isPaused = download.status === 'paused';
  const isQueued = download.status === 'pending';

  // Estimate time remaining (rough calculation)
  const bytesRemaining = (download.totalBytes || 0) - (download.bytesDownloaded || 0);
  const estimatedSeconds = download.totalBytes > 0 ? (bytesRemaining / (download.totalBytes / 300)) : 0; // Assume ~300s for full download

  return (
    <View style={styles.downloadRow}>
      <Image source={coverUrl} style={styles.downloadCover} contentFit="cover" />

      <View style={styles.downloadInfo}>
        <Text style={styles.downloadTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.downloadAuthor} numberOfLines={1}>{author}</Text>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        {/* Progress text */}
        <Text style={styles.progressText}>
          {isQueued ? 'Waiting...' : (
            <>
              {formatBytes(download.bytesDownloaded || 0)} / {formatBytes(download.totalBytes || 0)}
              {!isPaused && estimatedSeconds > 0 && ` · ${formatTimeRemaining(estimatedSeconds)}`}
              {isPaused && ' · Paused'}
            </>
          )}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.downloadActions}>
        {!isQueued && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={isPaused ? onResume : onPause}
            activeOpacity={0.7}
          >
            {isPaused ? (
              <PlayIcon size={scale(18)} color={COLORS.accent} />
            ) : (
              <PauseIcon size={scale(18)} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={onCancel} activeOpacity={0.7}>
          <CloseIcon size={scale(18)} color={COLORS.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// DOWNLOADED ROW COMPONENT (with swipe-to-delete)
// ============================================================================

interface DownloadedRowProps {
  download: DownloadTask;
  onPress: () => void;
  onDelete: () => void;
}

function DownloadedRow({ download, onPress, onDelete }: DownloadedRowProps) {
  const [book, setBook] = useState<LibraryItem | null>(null);
  const coverUrl = useCoverUrl(download.itemId);
  const swipeableRef = React.useRef<Swipeable>(null);

  useEffect(() => {
    sqliteCache.getLibraryItem(download.itemId).then(setBook);
  }, [download.itemId]);

  const metadata = book?.media?.metadata as any;
  const title = metadata?.title || 'Unknown';
  const author = metadata?.authorName || '';
  const downloadDate = download.completedAt ? new Date(download.completedAt) : new Date();

  const handleDelete = useCallback(() => {
    haptics.warning();
    swipeableRef.current?.close();
    onDelete();
  }, [onDelete]);

  const renderRightActions = () => (
    <TouchableOpacity style={styles.swipeDeleteButton} onPress={handleDelete} activeOpacity={0.8}>
      <TrashIcon size={scale(22)} color="#fff" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      friction={2}
    >
      <TouchableOpacity style={styles.downloadedRow} onPress={onPress} activeOpacity={0.7}>
        <Image source={coverUrl} style={styles.downloadCover} contentFit="cover" />

        <View style={styles.downloadInfo}>
          <Text style={styles.downloadTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.downloadAuthor} numberOfLines={1}>
            {author} · {formatDate(downloadDate)}
          </Text>
        </View>

        <Text style={styles.downloadSize}>{formatBytes(download.totalBytes || 0)}</Text>
        <ChevronIcon size={scale(18)} />
      </TouchableOpacity>
    </Swipeable>
  );
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

interface SectionHeaderProps {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  actionColor?: string;
}

function SectionHeader({ title, count, actionLabel, onAction, actionColor = COLORS.accent }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {title}{count !== undefined && ` (${count})`}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.sectionAction, { color: actionColor }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.emptyState}>
      <DownloadIcon size={scale(64)} />
      <Text style={styles.emptyTitle}>No Downloads Yet</Text>
      <Text style={styles.emptyDescription}>
        Download audiobooks to listen offline.{'\n'}They'll appear here.
      </Text>
      <TouchableOpacity style={styles.browseButton} onPress={onBrowse} activeOpacity={0.7}>
        <Text style={styles.browseButtonText}>Browse Library</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

export function DownloadsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { downloads, deleteDownload, pauseDownload, resumeDownload, cancelDownload } = useDownloads();

  // Categorize downloads
  const { downloading, queued, completed } = useMemo(() => {
    const downloading: DownloadTask[] = [];
    const queued: DownloadTask[] = [];
    const completed: DownloadTask[] = [];

    for (const d of downloads) {
      if (d.status === 'downloading' || d.status === 'paused') {
        downloading.push(d);
      } else if (d.status === 'pending') {
        queued.push(d);
      } else if (d.status === 'complete') {
        completed.push(d);
      }
    }

    // Sort completed by size (largest first per spec)
    completed.sort((a, b) => (b.totalBytes || 0) - (a.totalBytes || 0));

    return { downloading, queued, completed };
  }, [downloads]);

  const totalUsedBytes = useMemo(() => {
    return completed.reduce((sum, d) => sum + (d.totalBytes || 0), 0);
  }, [completed]);

  const hasDownloads = downloads.length > 0;
  const hasActiveDownloads = downloading.length > 0 || queued.length > 0;

  // Handlers
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleBookPress = useCallback((itemId: string) => {
    navigation.navigate('BookDetail', { id: itemId });
  }, [navigation]);

  const handleDeleteDownload = useCallback((itemId: string, title: string) => {
    Alert.alert(
      'Delete Download',
      `Remove "${title}" from downloads? You can re-download it anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.warning();
            deleteDownload(itemId);
          },
        },
      ]
    );
  }, [deleteDownload]);

  const handleCancelDownload = useCallback((itemId: string) => {
    haptics.warning();
    cancelDownload(itemId);
  }, [cancelDownload]);

  const handlePauseAll = useCallback(() => {
    downloading.forEach(d => pauseDownload(d.itemId));
  }, [downloading, pauseDownload]);

  const handleDeleteAll = useCallback(() => {
    if (completed.length === 0) return;

    const totalSize = completed.reduce((sum, d) => sum + (d.totalBytes || 0), 0);

    Alert.alert(
      'Delete All Downloads?',
      `This will remove ${completed.length} audiobook${completed.length !== 1 ? 's' : ''} (${formatBytes(totalSize)}). You can re-download them anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            haptics.warning();
            await downloadManager.clearAllDownloads();
          },
        },
      ]
    );
  }, [completed]);

  const handleBrowse = useCallback(() => {
    navigation.navigate('Main', { screen: 'DiscoverTab' });
  }, [navigation]);

  const handleSettings = useCallback(() => {
    navigation.navigate('StorageSettings');
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <BackIcon size={scale(24)} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!hasDownloads ? (
        <EmptyState onBrowse={handleBrowse} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Storage Card */}
          <StorageCard usedBytes={totalUsedBytes} />

          {/* Downloading Section */}
          {downloading.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Downloading"
                count={downloading.length}
                actionLabel="Pause All"
                onAction={handlePauseAll}
              />
              {downloading.map((d) => (
                <ActiveDownloadRow
                  key={d.itemId}
                  download={d}
                  onPause={() => pauseDownload(d.itemId)}
                  onResume={() => resumeDownload(d.itemId)}
                  onCancel={() => handleCancelDownload(d.itemId)}
                />
              ))}
            </View>
          )}

          {/* Queued Section */}
          {queued.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Queued" count={queued.length} />
              {queued.map((d, index) => (
                <ActiveDownloadRow
                  key={d.itemId}
                  download={d}
                  onPause={() => {}}
                  onResume={() => {}}
                  onCancel={() => handleCancelDownload(d.itemId)}
                />
              ))}
            </View>
          )}

          {/* Downloaded Section */}
          {completed.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Downloaded"
                count={completed.length}
                actionLabel="Delete All"
                onAction={handleDeleteAll}
                actionColor={COLORS.destructive}
              />
              {completed.map((d) => (
                <DownloadedRow
                  key={d.itemId}
                  download={d}
                  onPress={() => handleBookPress(d.itemId)}
                  onDelete={() => deleteDownload(d.itemId)}
                />
              ))}
            </View>
          )}

          {/* Download Settings Link */}
          <TouchableOpacity style={styles.settingsLink} onPress={handleSettings} activeOpacity={0.7}>
            <SettingsIcon size={scale(20)} color={COLORS.textSecondary} />
            <View style={styles.settingsLinkContent}>
              <Text style={styles.settingsLinkTitle}>Download Settings</Text>
              <Text style={styles.settingsLinkSubtitle}>Quality, WiFi-only, storage location</Text>
            </View>
            <ChevronIcon />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: scale(17),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerSpacer: {
    width: scale(40),
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.pageHorizontal,
  },

  // Storage Card
  storageCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.sectionGap,
  },
  storageTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: scale(12),
  },
  storageBar: {
    height: 8,
    backgroundColor: COLORS.storageFree,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: COLORS.storageUsed,
    borderRadius: 4,
  },
  storageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageUsedLabel: {
    fontSize: scale(13),
    color: COLORS.textPrimary,
  },
  storageFreeLabel: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
  },
  clearCacheButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  clearCacheText: {
    fontSize: scale(14),
    color: COLORS.textPrimary,
  },
  clearCacheSize: {
    fontSize: scale(14),
    color: COLORS.textSecondary,
  },

  // Section
  section: {
    marginBottom: SPACING.sectionGap,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.itemGap,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sectionAction: {
    fontSize: scale(13),
    fontWeight: '500',
  },

  // Download rows
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: scale(12),
    padding: SPACING.itemGap,
    marginBottom: scale(8),
    gap: scale(12),
  },
  downloadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: scale(12),
    padding: SPACING.itemGap,
    marginBottom: scale(8),
    gap: scale(12),
  },
  downloadCover: {
    width: SPACING.coverSize,
    height: SPACING.coverSize,
    borderRadius: 6,
    backgroundColor: '#262626',
  },
  downloadInfo: {
    flex: 1,
  },
  downloadTitle: {
    fontSize: scale(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  downloadAuthor: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
    marginBottom: scale(6),
  },
  downloadSize: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
    marginRight: scale(4),
  },

  // Progress
  progressBar: {
    height: 4,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: scale(4),
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.progressFill,
    borderRadius: 2,
  },
  progressText: {
    fontSize: scale(12),
    color: COLORS.textTertiary,
  },

  // Actions
  downloadActions: {
    flexDirection: 'row',
    gap: scale(4),
  },
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Swipe delete
  swipeDeleteButton: {
    backgroundColor: COLORS.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: scale(8),
    borderRadius: scale(12),
    marginLeft: scale(8),
  },
  swipeDeleteText: {
    color: '#fff',
    fontSize: scale(12),
    fontWeight: '600',
    marginTop: scale(4),
  },

  // Settings link
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: scale(12),
    padding: SPACING.cardPadding,
    marginTop: scale(8),
    gap: scale(12),
  },
  settingsLinkContent: {
    flex: 1,
  },
  settingsLinkTitle: {
    fontSize: scale(15),
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  settingsLinkSubtitle: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontSize: scale(17),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptyDescription: {
    fontSize: scale(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: scale(24),
  },
  browseButton: {
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: scale(24),
  },
  browseButtonText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: COLORS.accent,
  },
});
