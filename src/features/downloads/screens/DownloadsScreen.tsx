/**
 * src/features/downloads/screens/DownloadsScreen.tsx
 *
 * Manage Downloads Screen — Secret Library themed
 *
 * Features:
 * - Storage bar showing used/available space
 * - Downloading section with progress bars
 * - Queued section with cancel option
 * - Downloaded section with swipe-to-delete
 * - Link to Data & Storage settings
 * - Empty state with CTA
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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Pause,
  Play,
  X,
  Trash2,
  ChevronRight,
  Settings,
  HardDrive,
} from 'lucide-react-native';
import { useDownloads } from '@/core/hooks/useDownloads';
import { DownloadTask } from '@/core/services/downloadManager';
import { useCoverUrl } from '@/core/cache';
import { CoverStars } from '@/shared/components/CoverStars';
import { sqliteCache } from '@/core/services/sqliteCache';
import { LibraryItem } from '@/core/types';
import { haptics } from '@/core/native/haptics';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { Snackbar, useSnackbar, EmptyState } from '@/shared/components';
import { SettingsHeader } from '@/features/profile/components/SettingsHeader';

// ============================================================================
// CONSTANTS
// ============================================================================

const COVER_SIZE = scale(56);
const ACCENT_COLOR = '#F3B60C';

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

function StorageCard({ usedBytes }: { usedBytes: number }) {
  const colors = useSecretLibraryColors();
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  useEffect(() => {
    FileSystem.getFreeDiskStorageAsync()
      .then(setFreeBytes)
      .catch(() => setFreeBytes(null));
  }, [usedBytes]);

  const totalBytes = freeBytes ? freeBytes + usedBytes : null;
  const usagePercent = totalBytes ? Math.min((usedBytes / totalBytes) * 100, 100) : 1;

  return (
    <View style={[styles.storageCard, { borderBottomColor: colors.borderLight }]}>
      <View style={styles.storageHeader}>
        <HardDrive size={scale(16)} color={colors.gray} strokeWidth={1.5} />
        <Text style={[styles.storageTitle, { color: colors.black }]}>Storage</Text>
      </View>

      {/* Storage bar */}
      <View style={[styles.storageBar, { backgroundColor: colors.borderLight }]}>
        <View style={[styles.storageBarFill, { width: `${usagePercent}%` }]} />
      </View>

      {/* Labels */}
      <View style={styles.storageLabels}>
        <Text style={[styles.storageLabel, { color: colors.black }]}>
          {formatBytes(usedBytes)} used
        </Text>
        <Text style={[styles.storageLabel, { color: colors.gray }]}>
          {freeBytes ? `${formatBytes(freeBytes)} free` : 'Calculating...'}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// ACTIVE DOWNLOAD ROW COMPONENT
// ============================================================================

function ActiveDownloadRow({
  download,
  onPause,
  onResume,
  onCancel,
}: {
  download: DownloadTask;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const colors = useSecretLibraryColors();
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

  const bytesRemaining = (download.totalBytes || 0) - (download.bytesDownloaded || 0);
  const estimatedSeconds = download.totalBytes > 0 ? (bytesRemaining / (download.totalBytes / 300)) : 0;

  return (
    <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
      <View style={styles.coverContainer}>
        <Image source={coverUrl} style={styles.cover} contentFit="cover" />
        <CoverStars bookId={download.itemId} starSize={scale(12)} />
      </View>

      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: colors.black }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.gray }]} numberOfLines={1}>{author}</Text>

        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: colors.borderLight }]}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <Text style={[styles.progressText, { color: colors.gray }]}>
          {isQueued ? 'Waiting...' : (
            <>
              {formatBytes(download.bytesDownloaded || 0)} / {formatBytes(download.totalBytes || 0)}
              {!isPaused && estimatedSeconds > 0 && ` · ${formatTimeRemaining(estimatedSeconds)}`}
              {isPaused && ' · Paused'}
            </>
          )}
        </Text>
      </View>

      <View style={styles.rowActions}>
        {!isQueued && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={isPaused ? onResume : onPause}
            activeOpacity={0.7}
          >
            {isPaused ? (
              <Play size={scale(16)} color={colors.black} strokeWidth={1.5} />
            ) : (
              <Pause size={scale(16)} color={colors.gray} strokeWidth={1.5} />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={onCancel} activeOpacity={0.7}>
          <X size={scale(16)} color="#ff4b4b" strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// DOWNLOADED ROW COMPONENT (with swipe-to-delete)
// ============================================================================

function DownloadedRow({
  download,
  onPress,
  onDelete,
}: {
  download: DownloadTask;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useSecretLibraryColors();
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
      <Trash2 size={scale(18)} color="#fff" strokeWidth={1.5} />
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
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.borderLight, backgroundColor: colors.grayLight }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.coverContainer}>
          <Image source={coverUrl} style={styles.cover} contentFit="cover" />
          <CoverStars bookId={download.itemId} starSize={scale(12)} />
        </View>

        <View style={styles.rowInfo}>
          <Text style={[styles.rowTitle, { color: colors.black }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.gray }]} numberOfLines={1}>
            {author} · {formatDate(downloadDate)}
          </Text>
        </View>

        <Text style={[styles.rowSize, { color: colors.gray }]}>{formatBytes(download.totalBytes || 0)}</Text>
        <ChevronRight size={scale(16)} color={colors.gray} strokeWidth={1.5} />
      </TouchableOpacity>
    </Swipeable>
  );
}

// ============================================================================
// DOWNLOAD SECTION HEADER
// ============================================================================

function DownloadSectionHeader({
  title,
  count,
  actionLabel,
  onAction,
  actionColor,
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  actionColor?: string;
}) {
  const colors = useSecretLibraryColors();

  return (
    <View style={[styles.sectionHeader, { borderBottomColor: colors.borderLight }]}>
      <Text style={[styles.sectionTitle, { color: colors.gray }]}>
        {title}{count !== undefined ? ` (${count})` : ''}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.sectionAction, { color: actionColor || colors.black }]}>{actionLabel}</Text>
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
  const colors = useSecretLibraryColors();
  const { downloads, deleteDownload, pauseDownload, resumeDownload, cancelDownload } = useDownloads();

  const { snackbarProps, showUndo } = useSnackbar();

  const [pendingDeletion, setPendingDeletion] = React.useState<{
    items: DownloadTask[];
    timeoutId: NodeJS.Timeout | null;
  } | null>(null);

  const pendingDeletionIds = useMemo(() => {
    return new Set(pendingDeletion?.items.map(d => d.itemId) || []);
  }, [pendingDeletion]);

  const { downloading, queued, completed } = useMemo(() => {
    const downloading: DownloadTask[] = [];
    const queued: DownloadTask[] = [];
    const completed: DownloadTask[] = [];

    for (const d of downloads) {
      if (pendingDeletionIds.has(d.itemId)) continue;

      if (d.status === 'downloading' || d.status === 'paused') {
        downloading.push(d);
      } else if (d.status === 'pending') {
        queued.push(d);
      } else if (d.status === 'complete') {
        completed.push(d);
      }
    }

    completed.sort((a, b) => (b.totalBytes || 0) - (a.totalBytes || 0));
    return { downloading, queued, completed };
  }, [downloads, pendingDeletionIds]);

  const totalUsedBytes = useMemo(() => {
    return completed.reduce((sum, d) => sum + (d.totalBytes || 0), 0);
  }, [completed]);

  const hasDownloads = downloads.length > 0;

  // Handlers
  const handleBookPress = useCallback((itemId: string) => {
    navigation.navigate('BookDetail', { id: itemId });
  }, [navigation]);

  const handleCancelDownload = useCallback((itemId: string) => {
    haptics.warning();
    cancelDownload(itemId);
  }, [cancelDownload]);

  const handlePauseAll = useCallback(() => {
    downloading.forEach(d => pauseDownload(d.itemId));
  }, [downloading, pauseDownload]);

  const executeDeleteItems = useCallback(async (items: typeof downloads) => {
    for (const item of items) {
      await deleteDownload(item.itemId);
    }
    setPendingDeletion(null);
  }, [deleteDownload]);

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
            const itemsToDelete = [...completed];
            const timeoutId = setTimeout(() => {
              executeDeleteItems(itemsToDelete);
            }, 5500);

            setPendingDeletion({ items: itemsToDelete, timeoutId });

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
    navigation.navigate('DataStorageSettings');
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.grayLight}
      />
      <SettingsHeader title="Downloads" />

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
          <StorageCard usedBytes={totalUsedBytes} />

          {/* Downloading Section */}
          {downloading.length > 0 && (
            <View style={styles.section}>
              <DownloadSectionHeader
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
              <DownloadSectionHeader title="Queued" count={queued.length} />
              {queued.map((d) => (
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
              <DownloadSectionHeader
                title="Downloaded"
                count={completed.length}
                actionLabel="Delete All"
                onAction={handleDeleteAll}
                actionColor="#ff4b4b"
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

          {/* Data & Storage Settings Link */}
          <TouchableOpacity
            style={[styles.settingsLink, { borderBottomColor: colors.borderLight }]}
            onPress={handleSettings}
            activeOpacity={0.7}
          >
            <View style={[styles.settingsIconContainer, { backgroundColor: colors.white }]}>
              <Settings size={scale(18)} color={colors.gray} strokeWidth={1.5} />
            </View>
            <View style={styles.settingsLinkContent}>
              <Text style={[styles.settingsLinkTitle, { color: colors.black }]}>Data & Storage Settings</Text>
              <Text style={[styles.settingsLinkSubtitle, { color: colors.gray }]}>Quality, WiFi-only, storage location</Text>
            </View>
            <ChevronRight size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          </TouchableOpacity>
        </ScrollView>
      )}

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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Storage Card
  storageCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  storageTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  storageBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: ACCENT_COLOR,
    borderRadius: 3,
  },
  storageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10.5),
  },

  // Section
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionAction: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10.5),
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 12,
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 4,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(14),
    marginBottom: 2,
  },
  rowSubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginBottom: scale(6),
  },
  rowSize: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginRight: 4,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Progress
  progressBar: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT_COLOR,
    borderRadius: 1.5,
  },
  progressText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
  },

  // Swipe delete
  swipeDeleteButton: {
    backgroundColor: '#ff4b4b',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginLeft: 8,
  },
  swipeDeleteText: {
    fontFamily: fonts.jetbrainsMono.regular,
    color: '#fff',
    fontSize: scale(10),
    marginTop: 4,
  },

  // Settings link
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  settingsIconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsLinkContent: {
    flex: 1,
  },
  settingsLinkTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  settingsLinkSubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10.5),
    lineHeight: scale(15),
    marginTop: 2,
  },
});
