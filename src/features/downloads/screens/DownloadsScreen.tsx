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
import * as FileSystem from 'expo-file-system/legacy';
import { useDownloads } from '@/core/hooks/useDownloads';
import { DownloadTask, downloadManager } from '@/core/services/downloadManager';
import { useCoverUrl } from '@/core/cache';
import { CoverStars } from '@/shared/components/CoverStars';
import { sqliteCache } from '@/core/services/sqliteCache';
import { LibraryItem } from '@/core/types';
import { haptics } from '@/core/native/haptics';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, wp, useTheme, ACCENT } from '@/shared/theme';

// Type for the theme colors object structure
type ThemeColors = ReturnType<typeof useTheme>['colors'];
import { Snackbar, useSnackbar, EmptyState } from '@/shared/components';

// ============================================================================
// DESIGN TOKENS - Base values, theme-specific colors passed via props/context
// ============================================================================

// Static accent-related colors (not theme dependent)
const STATIC_COLORS = {
  accent: ACCENT,
  storageUsed: ACCENT,
  progressFill: ACCENT,
  destructive: '#FF453A',
  success: '#30D158',
};

// Helper to create theme-aware COLORS object
function createColors(themeColors: ThemeColors) {
  return {
    ...STATIC_COLORS,
    background: themeColors.background.primary,
    storageFree: themeColors.border.default,
    progressTrack: themeColors.border.default,
    textPrimary: themeColors.text.primary,
    textSecondary: themeColors.text.secondary,
    textTertiary: themeColors.text.tertiary,
    cardBackground: themeColors.border.default,
    cardBorder: themeColors.border.default,
    statusBar: themeColors.statusBar,
  };
}

// Colors for StyleSheet defaults (theme-specific colors set via inline styles in JSX)

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

const ChevronIcon = ({ size = 20, color = '#666' }: { size?: number; color?: string }) => (
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
  colors: ReturnType<typeof createColors>;
}

function StorageCard({ usedBytes, onClearCache, cacheSize = 0, colors }: StorageCardProps) {
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  useEffect(() => {
    FileSystem.getFreeDiskStorageAsync()
      .then(setFreeBytes)
      .catch(() => setFreeBytes(null));
  }, [usedBytes]);

  const totalBytes = freeBytes ? freeBytes + usedBytes : null;
  const usagePercent = totalBytes ? Math.min((usedBytes / totalBytes) * 100, 100) : 1;

  return (
    <View style={[styles.storageCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <Text style={[styles.storageTitle, { color: colors.textPrimary }]}>Storage</Text>

      {/* Storage bar */}
      <View style={[styles.storageBar, { backgroundColor: colors.storageFree }]}>
        <View style={[styles.storageBarFill, { width: `${usagePercent}%` }]} />
      </View>

      {/* Labels */}
      <View style={styles.storageLabels}>
        <Text style={[styles.storageUsedLabel, { color: colors.textPrimary }]}>{formatBytes(usedBytes)} used</Text>
        <Text style={[styles.storageFreeLabel, { color: colors.textSecondary }]}>
          {freeBytes ? `${formatBytes(freeBytes)} free` : 'Calculating...'}
        </Text>
      </View>

      {/* Clear cache button */}
      {cacheSize > 0 && onClearCache && (
        <TouchableOpacity style={[styles.clearCacheButton, { borderTopColor: colors.cardBorder }]} onPress={onClearCache} activeOpacity={0.7}>
          <Text style={[styles.clearCacheText, { color: colors.textPrimary }]}>Clear Cache</Text>
          <Text style={[styles.clearCacheSize, { color: colors.textSecondary }]}>{formatBytes(cacheSize)}</Text>
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
  colors: ReturnType<typeof createColors>;
}

function ActiveDownloadRow({ download, onPause, onResume, onCancel, colors }: ActiveDownloadRowProps) {
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
    <View style={[styles.downloadRow, { backgroundColor: colors.cardBackground }]}>
      <View style={{ width: wp(15), height: wp(15), borderRadius: 6, overflow: 'hidden' }}>
        <Image source={coverUrl} style={styles.downloadCover} contentFit="cover" />
        <CoverStars bookId={download.itemId} starSize={scale(14)} />
      </View>

      <View style={styles.downloadInfo}>
        <Text style={[styles.downloadTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.downloadAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{author}</Text>

        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: colors.progressTrack }]}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        {/* Progress text */}
        <Text style={[styles.progressText, { color: colors.textTertiary }]}>
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
              <PlayIcon size={scale(18)} color={colors.accent} />
            ) : (
              <PauseIcon size={scale(18)} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={onCancel} activeOpacity={0.7}>
          <CloseIcon size={scale(18)} color={colors.destructive} />
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
  colors: ReturnType<typeof createColors>;
}

function DownloadedRow({ download, onPress, onDelete, colors }: DownloadedRowProps) {
  const [book, setBook] = useState<LibraryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const coverUrl = useCoverUrl(download.itemId);
  const swipeableRef = React.useRef<Swipeable>(null);

  useEffect(() => {
    setIsLoading(true);
    sqliteCache.getLibraryItem(download.itemId).then((item) => {
      setBook(item);
      setIsLoading(false);
    });
  }, [download.itemId]);

  const metadata = book?.media?.metadata as any;
  const title = isLoading ? 'Loading...' : (metadata?.title || 'Unknown Title');
  const author = metadata?.authorName || '';
  const downloadDate = download.completedAt ? new Date(download.completedAt) : new Date();

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
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
            onDelete();
          },
        },
      ]
    );
  }, [onDelete, title]);

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
      <TouchableOpacity style={[styles.downloadedRow, { backgroundColor: colors.cardBackground }]} onPress={onPress} activeOpacity={0.7}>
        <View style={{ width: wp(15), height: wp(15), borderRadius: 6, overflow: 'hidden' }}>
          <Image source={coverUrl} style={styles.downloadCover} contentFit="cover" />
          <CoverStars bookId={download.itemId} starSize={scale(14)} />
        </View>

        <View style={styles.downloadInfo}>
          <Text style={[styles.downloadTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.downloadAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
            {author} · {formatDate(downloadDate)}
          </Text>
        </View>

        <Text style={[styles.downloadSize, { color: colors.textSecondary }]}>{formatBytes(download.totalBytes || 0)}</Text>
        <ChevronIcon size={scale(18)} color={colors.textTertiary} />
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
  colors: ReturnType<typeof createColors>;
}

function SectionHeader({ title, count, actionLabel, onAction, actionColor, colors }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, { borderBottomColor: colors.cardBorder }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {title}{count !== undefined && ` (${count})`}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.sectionAction, { color: actionColor || colors.accent }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

export function DownloadsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const colors = createColors(themeColors);
  const { downloads, deleteDownload, pauseDownload, resumeDownload, cancelDownload } = useDownloads();

  // Snackbar for undo functionality
  const { snackbarProps, showUndo } = useSnackbar();

  // Pending deletion state for undo functionality
  const [pendingDeletion, setPendingDeletion] = React.useState<{
    items: DownloadTask[];
    timeoutId: NodeJS.Timeout | null;
  } | null>(null);

  // Get pending deletion item IDs for filtering
  const pendingDeletionIds = useMemo(() => {
    return new Set(pendingDeletion?.items.map(d => d.itemId) || []);
  }, [pendingDeletion]);

  // Categorize downloads (excluding pending deletions)
  const { downloading, queued, completed } = useMemo(() => {
    const downloading: DownloadTask[] = [];
    const queued: DownloadTask[] = [];
    const completed: DownloadTask[] = [];

    for (const d of downloads) {
      // Skip items pending deletion
      if (pendingDeletionIds.has(d.itemId)) continue;

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
  }, [downloads, pendingDeletionIds]);

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

  // Execute deletion of specific items (avoids stale closure by taking items directly)
  const executeDeleteItems = useCallback(async (items: typeof downloads) => {
    for (const item of items) {
      await deleteDownload(item.itemId);
    }
    setPendingDeletion(null);
  }, [deleteDownload]);

  // Undo pending deletion
  const handleUndoDeletion = useCallback(() => {
    if (pendingDeletion?.timeoutId) {
      clearTimeout(pendingDeletion.timeoutId);
    }
    setPendingDeletion(null);
    haptics.success();
  }, [pendingDeletion]);

  const handleDeleteAll = useCallback(() => {
    if (completed.length === 0) return;

    const totalSize = completed.reduce((sum, d) => sum + (d.totalBytes || 0), 0);
    const itemCount = completed.length;

    Alert.alert(
      'Delete All Downloads?',
      `This will remove ${itemCount} audiobook${itemCount !== 1 ? 's' : ''} (${formatBytes(totalSize)}). You can re-download them anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            haptics.destructiveConfirm();

            // Capture items NOW to avoid stale closure
            const itemsToDelete = [...completed];

            // Set up delayed deletion — pass items directly, don't read from state
            const timeoutId = setTimeout(() => {
              executeDeleteItems(itemsToDelete);
            }, 5500); // Slightly longer than snackbar duration

            setPendingDeletion({
              items: itemsToDelete,
              timeoutId,
            });

            // Show undo snackbar
            showUndo(
              `Deleted ${itemCount} download${itemCount !== 1 ? 's' : ''}`,
              () => {
                clearTimeout(timeoutId);
                setPendingDeletion(null);
                haptics.success();
              },
              5000
            );
          },
        },
      ]
    );
  }, [completed, executeDeleteItems, showUndo]);

  const handleBrowse = useCallback(() => {
    navigation.navigate('Main', { screen: 'DiscoverTab' });
  }, [navigation]);

  const handleSettings = useCallback(() => {
    navigation.navigate('StorageSettings');
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <BackIcon size={scale(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Downloads</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!hasDownloads ? (
        <EmptyState
          icon="download"
          title="No Downloads Yet"
          description="Download audiobooks to listen offline. They'll appear here."
          actionTitle="Browse Library"
          onAction={handleBrowse}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Storage Card */}
          <StorageCard usedBytes={totalUsedBytes} colors={colors} />

          {/* Downloading Section */}
          {downloading.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Downloading"
                count={downloading.length}
                actionLabel="Pause All"
                onAction={handlePauseAll}
                colors={colors}
              />
              {downloading.map((d) => (
                <ActiveDownloadRow
                  key={d.itemId}
                  download={d}
                  onPause={() => pauseDownload(d.itemId)}
                  onResume={() => resumeDownload(d.itemId)}
                  onCancel={() => handleCancelDownload(d.itemId)}
                  colors={colors}
                />
              ))}
            </View>
          )}

          {/* Queued Section */}
          {queued.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Queued" count={queued.length} colors={colors} />
              {queued.map((d) => (
                <ActiveDownloadRow
                  key={d.itemId}
                  download={d}
                  onPause={() => {}}
                  onResume={() => {}}
                  onCancel={() => handleCancelDownload(d.itemId)}
                  colors={colors}
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
                actionColor={colors.destructive}
                colors={colors}
              />
              {completed.map((d) => (
                <DownloadedRow
                  key={d.itemId}
                  download={d}
                  onPress={() => handleBookPress(d.itemId)}
                  onDelete={() => deleteDownload(d.itemId)}
                  colors={colors}
                />
              ))}
            </View>
          )}

          {/* Download Settings Link */}
          <TouchableOpacity style={[styles.settingsLink, { backgroundColor: colors.cardBackground }]} onPress={handleSettings} activeOpacity={0.7}>
            <SettingsIcon size={scale(20)} color={colors.textSecondary} />
            <View style={styles.settingsLinkContent}>
              <Text style={[styles.settingsLinkTitle, { color: colors.textPrimary }]}>Download Settings</Text>
              <Text style={[styles.settingsLinkSubtitle, { color: colors.textSecondary }]}>Quality, WiFi-only, storage location</Text>
            </View>
            <ChevronIcon color={colors.textTertiary} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Undo Snackbar */}
      <Snackbar {...snackbarProps} />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via colors.background in JSX
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
    // color set via colors.textPrimary in JSX
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
    // backgroundColor set via colors.cardBackground in JSX
    borderRadius: scale(12),
    borderWidth: 1,
    // borderColor set via colors.cardBorder in JSX
    padding: SPACING.cardPadding,
    marginBottom: SPACING.sectionGap,
  },
  storageTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    // color set via colors.textPrimary in JSX
    marginBottom: scale(12),
  },
  storageBar: {
    height: 8,
    // backgroundColor set via colors.storageFree in JSX
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: ACCENT, // Gold accent - intentional
    borderRadius: 4,
  },
  storageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageUsedLabel: {
    fontSize: scale(13),
    // color set via colors.textPrimary in JSX
  },
  storageFreeLabel: {
    fontSize: scale(13),
    // color set via colors.textSecondary in JSX
  },
  clearCacheButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    // borderTopColor set via colors.cardBorder in JSX
  },
  clearCacheText: {
    fontSize: scale(14),
    // color set via colors.textPrimary in JSX
  },
  clearCacheSize: {
    fontSize: scale(14),
    // color set via colors.textSecondary in JSX
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
    // borderBottomColor set via colors.cardBorder in JSX
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    // color set via colors.textPrimary in JSX
  },
  sectionAction: {
    fontSize: scale(13),
    fontWeight: '500',
    // color set dynamically in JSX
  },

  // Download rows
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set via colors.cardBackground in JSX
    borderRadius: scale(12),
    padding: SPACING.itemGap,
    marginBottom: scale(8),
    gap: scale(12),
  },
  downloadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set via colors.cardBackground in JSX
    borderRadius: scale(12),
    padding: SPACING.itemGap,
    marginBottom: scale(8),
    gap: scale(12),
  },
  downloadCover: {
    width: SPACING.coverSize,
    height: SPACING.coverSize,
    borderRadius: 6,
    backgroundColor: '#262626', // Placeholder fallback
  },
  downloadInfo: {
    flex: 1,
  },
  downloadTitle: {
    fontSize: scale(15),
    fontWeight: '600',
    // color set via colors.textPrimary in JSX
    marginBottom: 2,
  },
  downloadAuthor: {
    fontSize: scale(13),
    // color set via colors.textSecondary in JSX
    marginBottom: scale(6),
  },
  downloadSize: {
    fontSize: scale(13),
    // color set via colors.textSecondary in JSX
    marginRight: scale(4),
  },

  // Progress
  progressBar: {
    height: 4,
    // backgroundColor set via colors.progressTrack in JSX
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: scale(4),
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT, // Gold accent - intentional
    borderRadius: 2,
  },
  progressText: {
    fontSize: scale(12),
    // color set via colors.textTertiary in JSX
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
    backgroundColor: '#FF453A', // Destructive red - intentional
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: scale(8),
    borderRadius: scale(12),
    marginLeft: scale(8),
  },
  swipeDeleteText: {
    color: '#fff', // White on destructive red - intentional
    fontSize: scale(12),
    fontWeight: '600',
    marginTop: scale(4),
  },

  // Settings link
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set via colors.cardBackground in JSX
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
    // color set via colors.textPrimary in JSX
  },
  settingsLinkSubtitle: {
    fontSize: scale(13),
    // color set via colors.textSecondary in JSX
    marginTop: 2,
  },
});
