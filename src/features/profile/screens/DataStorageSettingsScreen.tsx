/**
 * src/features/profile/screens/DataStorageSettingsScreen.tsx
 *
 * Combined Data & Storage settings screen.
 * Merges Storage and Library Sync into one clear, user-friendly screen.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Folder,
  Download,
  Wifi,
  RefreshCw,
  Trash2,
  Info,
  Cloud,
  CloudOff,
  List,
  Plus,
  Check,
  X,
  Image as ImageIcon,
  Heart,
  ChevronRight,
} from 'lucide-react-native';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useLibraryCache } from '@/core/cache';
import { networkMonitor } from '@/core/services/networkMonitor';
import { useLibrarySyncStore } from '@/shared/stores/librarySyncStore';
import { useDefaultLibrary } from '@/features/library';
import { librarySyncService } from '@/core/services/librarySyncService';
import { playlistsApi } from '@/core/api/endpoints/playlists';
import { Playlist } from '@/core/types/library';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsRow } from '../components/SettingsRow';
import { SectionHeader } from '../components/SectionHeader';
import { logger } from '@/shared/utils/logger';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// =============================================================================
// PLAYLIST PICKER MODAL
// =============================================================================

interface PlaylistPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (playlist: Playlist) => void;
  onCreateNew: () => void;
  playlists: Playlist[];
  loading: boolean;
  currentPlaylistId: string | null;
}

function PlaylistPickerModal({
  visible,
  onClose,
  onSelect,
  onCreateNew,
  playlists,
  loading,
  currentPlaylistId,
}: PlaylistPickerModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();

  const renderPlaylist = ({ item }: { item: Playlist }) => {
    const isSelected = item.id === currentPlaylistId;
    const itemCount = item.items?.length || 0;
    // Friendly names for internal playlists
    const displayName = item.name === '__sl_my_library' ? 'My Library (auto)'
      : item.name === '__sl_favorite_series' ? 'My Series (auto)'
      : item.name;

    return (
      <TouchableOpacity
        style={[
          styles.playlistRow,
          { borderBottomColor: colors.grayLight },
          isSelected && { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
        ]}
        onPress={() => onSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.playlistInfo}>
          <Text style={[styles.playlistName, { color: colors.black }]}>{displayName}</Text>
          <Text style={[styles.playlistMeta, { color: colors.gray }]}>{itemCount} book{itemCount !== 1 ? 's' : ''}</Text>
        </View>
        {isSelected && (
          <Check size={scale(18)} color={colors.black} strokeWidth={2} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.white, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.grayLight }]}>
          <Text style={[styles.modalTitle, { color: colors.black }]}>Choose Playlist</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <X size={scale(24)} color={colors.black} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.modalDescription, { color: colors.gray }]}>
          Select a playlist to sync with your library, or create a new one.
        </Text>

        {/* Create New Button */}
        <TouchableOpacity style={[styles.createNewButton, { borderBottomColor: colors.grayLight }]} onPress={onCreateNew}>
          <Plus size={scale(18)} color={colors.black} strokeWidth={1.5} />
          <Text style={[styles.createNewText, { color: colors.black }]}>Create New Playlist</Text>
        </TouchableOpacity>

        {/* Playlist List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gray} />
            <Text style={[styles.loadingText, { color: colors.gray }]}>Loading playlists...</Text>
          </View>
        ) : playlists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <List size={scale(32)} color={colors.gray} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { color: colors.gray }]}>No playlists yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.gray }]}>Create one to start syncing</Text>
          </View>
        ) : (
          <FlatList
            data={playlists}
            renderItem={renderPlaylist}
            keyExtractor={(item) => item.id}
            style={styles.playlistList}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          />
        )}
      </View>
    </Modal>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataStorageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { library } = useDefaultLibrary();
  const colors = useSecretLibraryColors();

  // Downloads data
  const { downloads } = useDownloads();
  const completedDownloads = downloads.filter((d) => d.status === 'complete');
  const downloadCount = completedDownloads.length;
  const totalStorage = completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);

  // Library cache
  const { refreshCache, clearCache } = useLibraryCache();
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isClearingDownloads, setIsClearingDownloads] = useState(false);

  // Network settings
  const [wifiOnlyEnabled, setWifiOnlyEnabled] = useState(networkMonitor.isWifiOnlyEnabled());
  // Cloud sync
  const libraryPlaylistId = useLibrarySyncStore(s => s.libraryPlaylistId);
  const seriesPlaylistId = useLibrarySyncStore(s => s.seriesPlaylistId);
  const lastSyncAt = useLibrarySyncStore(s => s.lastSyncAt);
  const isCloudSyncEnabled = !!libraryPlaylistId;
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEnablingSync, setIsEnablingSync] = useState(false);

  // Playlist picker (library)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [linkedPlaylistName, setLinkedPlaylistName] = useState<string | null>(null);

  // Playlist picker (series)
  const [showSeriesPlaylistPicker, setShowSeriesPlaylistPicker] = useState(false);
  const [linkedSeriesPlaylistName, setLinkedSeriesPlaylistName] = useState<string | null>(null);

  // My Library
  const libraryCount = useMyLibraryStore((s) => s.libraryIds.length);
  const libraryIds = useMyLibraryStore((s) => s.libraryIds);
  const clearAllLibrary = useMyLibraryStore((s) => s.clearAll);

  // Spine refresh state
  const [isRefreshingSpines, setIsRefreshingSpines] = useState(false);

  // Load playlists and get linked playlist names
  const loadPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const fetchedPlaylists = await playlistsApi.getAll();
      setPlaylists(fetchedPlaylists);

      // Find linked library playlist name
      if (libraryPlaylistId) {
        const linked = fetchedPlaylists.find(p => p.id === libraryPlaylistId);
        if (linked) {
          setLinkedPlaylistName(linked.name.startsWith('__sl_') ? 'My Library (auto)' : linked.name);
        }
      }

      // Find linked series playlist name
      const currentSeriesId = useLibrarySyncStore.getState().seriesPlaylistId;
      if (currentSeriesId) {
        const linkedSeries = fetchedPlaylists.find(p => p.id === currentSeriesId);
        if (linkedSeries) {
          setLinkedSeriesPlaylistName(linkedSeries.name.startsWith('__sl_') ? 'My Series (auto)' : linkedSeries.name);
        }
      }
    } catch (err) {
      logger.error('[DataStorage] Failed to load playlists:', err);
    } finally {
      setLoadingPlaylists(false);
    }
  }, [libraryPlaylistId]);

  // Load playlists on mount and when playlist picker opens
  useEffect(() => {
    if (libraryPlaylistId) {
      loadPlaylists();
    }
  }, [libraryPlaylistId]);

  const handleRefreshSpines = useCallback(async () => {
    if (isRefreshingSpines) return;
    setIsRefreshingSpines(true);
    try {
      // 1. Reload spine manifest from server (which books have spines)
      await useLibraryCache.getState().loadSpineManifest();
      // 2. Refresh library cache - this updates lastRefreshed, busting all spine URLs
      //    MUST happen BEFORE clearing dimensions so old-URL images can't race ahead
      //    and re-set stale dimensions from expo-image cache
      await refreshCache();
      // 3. NOW clear cached dimensions - images will reload with new URLs
      //    and onLoad will set fresh dimensions from the new images
      useSpineCacheStore.getState().clearServerSpineDimensions();
      const count = useLibraryCache.getState().booksWithServerSpines.size;
      Alert.alert('Spines Refreshed', `Loaded ${count} spine images from server.`);
    } catch (error) {
      logger.error('[DataStorage] Failed to refresh spines:', error);
      Alert.alert('Error', 'Could not refresh spines. Please try again.');
    } finally {
      setIsRefreshingSpines(false);
    }
  }, [isRefreshingSpines, refreshCache]);

  const handleOpenPlaylistPicker = useCallback(() => {
    loadPlaylists();
    setShowPlaylistPicker(true);
  }, [loadPlaylists]);

  const handleSelectPlaylist = useCallback(async (playlist: Playlist) => {
    setShowPlaylistPicker(false);
    setIsEnablingSync(true);

    try {
      // Set the playlist ID
      useLibrarySyncStore.getState().setLibraryPlaylistId(playlist.id);
      setLinkedPlaylistName(playlist.name.startsWith('__sl_') ? 'My Library (auto)' : playlist.name);

      // Set up series playlist too
      if (library?.id) {
        librarySyncService.getOrCreateSeriesPlaylist(library.id);
      }

      // Sync
      setIsSyncing(true);
      await librarySyncService.fullSync();
      setIsSyncing(false);

      Alert.alert('Playlist Linked', `Your library is now syncing with "${playlist.name.startsWith('__sl_') ? 'My Library' : playlist.name}".`);
    } catch (err: any) {
      Alert.alert('Error', `Could not link playlist: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsEnablingSync(false);
    }
  }, [library?.id]);

  const handleCreateNewPlaylist = useCallback(async () => {
    setShowPlaylistPicker(false);

    if (!library?.id) return;
    setIsEnablingSync(true);

    try {
      const newPlaylist = await playlistsApi.create({
        libraryId: library.id,
        name: '__sl_my_library',
        items: libraryIds.map(id => ({ libraryItemId: id })),
      });

      useLibrarySyncStore.getState().setLibraryPlaylistId(newPlaylist.id);
      setLinkedPlaylistName('My Library (auto)');
      librarySyncService.getOrCreateSeriesPlaylist(library.id);

      setIsSyncing(true);
      await librarySyncService.fullSync();
      setIsSyncing(false);

      Alert.alert('Cloud Sync Enabled', 'Created a new playlist and started syncing.');
    } catch (err: any) {
      Alert.alert('Error', `Could not create playlist: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsEnablingSync(false);
    }
  }, [library?.id, libraryIds]);

  // Series playlist picker handlers
  const handleOpenSeriesPlaylistPicker = useCallback(() => {
    loadPlaylists();
    setShowSeriesPlaylistPicker(true);
  }, [loadPlaylists]);

  const handleSelectSeriesPlaylist = useCallback(async (playlist: Playlist) => {
    setShowSeriesPlaylistPicker(false);
    useLibrarySyncStore.getState().setSeriesPlaylistId(playlist.id);
    setLinkedSeriesPlaylistName(playlist.name.startsWith('__sl_') ? 'My Series (auto)' : playlist.name);

    // Sync series
    setIsSyncing(true);
    try {
      await librarySyncService.fullSync();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleCreateNewSeriesPlaylist = useCallback(async () => {
    setShowSeriesPlaylistPicker(false);
    if (!library?.id) return;

    try {
      const _playlistId = await librarySyncService.getOrCreateSeriesPlaylist(library.id);
      setLinkedSeriesPlaylistName('My Series (auto)');

      setIsSyncing(true);
      await librarySyncService.fullSync();
      setIsSyncing(false);
    } catch (err: any) {
      Alert.alert('Error', `Could not create series playlist: ${err?.message || 'Please try again.'}`);
    }
  }, [library?.id]);

  // Handlers
  const handleWifiOnlyToggle = useCallback(async (enabled: boolean) => {
    setWifiOnlyEnabled(enabled);
    await networkMonitor.setWifiOnlyEnabled(enabled);
  }, []);

  const handleManageDownloads = useCallback(() => {
    navigation.navigate('Downloads');
  }, [navigation]);

  const handleReloadLibrary = useCallback(async () => {
    if (isRefreshingCache) return;

    setIsRefreshingCache(true);
    try {
      await refreshCache();
      Alert.alert('Done', 'Your library has been reloaded from the server.');
    } catch {
      Alert.alert('Error', 'Could not reload library. Please check your connection.');
    } finally {
      setIsRefreshingCache(false);
    }
  }, [isRefreshingCache, refreshCache]);

  const handleClearTempFiles = useCallback(() => {
    if (isClearingCache) return;

    Alert.alert(
      'Clear Temporary Files?',
      'This removes cached images and data to free up space. Your downloads and listening progress are safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            setIsClearingCache(true);
            try {
              await clearCache();
              Alert.alert('Done', 'Temporary files cleared.');
            } catch (error) {
              logger.error('[DataStorage] Failed to clear cache:', error);
              Alert.alert('Error', 'Could not clear files. Please try again.');
            } finally {
              setIsClearingCache(false);
            }
          },
        },
      ]
    );
  }, [isClearingCache, clearCache]);

  const handleRemoveAllDownloads = useCallback(() => {
    if (downloadCount === 0) {
      Alert.alert('No Downloads', 'You have no downloaded books.');
      return;
    }

    if (isClearingDownloads) return;

    Alert.alert(
      'Remove All Downloads?',
      `This will delete ${downloadCount} downloaded book${downloadCount !== 1 ? 's' : ''} and free up ${formatBytes(totalStorage)}. You can re-download them anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: async () => {
            setIsClearingDownloads(true);
            try {
              await downloadManager.clearAllDownloads();
              Alert.alert('Done', 'All downloads removed.');
            } catch (error) {
              logger.error('[DataStorage] Failed to clear downloads:', error);
              Alert.alert('Error', 'Could not remove downloads. Please try again.');
            } finally {
              setIsClearingDownloads(false);
            }
          },
        },
      ]
    );
  }, [downloadCount, totalStorage, isClearingDownloads]);

  const handleEmptyLibrary = useCallback(() => {
    if (libraryCount === 0) {
      Alert.alert('Already Empty', 'Your library has no books.');
      return;
    }
    Alert.alert(
      'Empty My Library?',
      `This removes all ${libraryCount} books from your library list. Downloads and progress are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty Library',
          style: 'destructive',
          onPress: () => {
            clearAllLibrary();
            Alert.alert('Done', 'Your library has been emptied.');
          },
        },
      ]
    );
  }, [libraryCount, clearAllLibrary]);

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await librarySyncService.fullSync();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleDisableCloudSync = useCallback(() => {
    Alert.alert(
      'Turn Off Cloud Sync?',
      'Your library will stay on this device but won\'t sync to other devices anymore.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn Off',
          style: 'destructive',
          onPress: () => {
            const syncStore = useLibrarySyncStore.getState();
            syncStore.setLibraryPlaylistId(null);
            syncStore.setSeriesPlaylistId(null);
            setLinkedPlaylistName(null);
          },
        },
      ]
    );
  }, []);

  const handleResetFromServer = useCallback(() => {
    Alert.alert(
      'Reset from Server?',
      'This replaces your local library with the server version. Use this if your library got out of sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsSyncing(true);
            try {
              const count = await librarySyncService.resetAndPull();
              Alert.alert('Done', `Restored ${count} books from server.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not reset. Please try again.');
            } finally {
              setIsSyncing(false);
            }
          },
        },
      ]
    );
  }, []);

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never';
    const diff = Date.now() - lastSyncAt;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(lastSyncAt).toLocaleDateString();
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title="Data & Storage" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Storage Overview — tap to manage downloads */}
        <TouchableOpacity
          style={[styles.storageOverview, { backgroundColor: colors.white }]}
          onPress={handleManageDownloads}
          activeOpacity={0.7}
        >
          <View style={[styles.storageIcon, { backgroundColor: colors.grayLight }]}>
            <Folder size={scale(24)} color={colors.black} strokeWidth={1.5} />
          </View>
          <View style={styles.storageInfo}>
            <Text style={[styles.storageValue, { color: colors.black }]}>{formatBytes(totalStorage)}</Text>
            <Text style={[styles.storageLabel, { color: colors.gray }]}>
              {downloadCount} book{downloadCount !== 1 ? 's' : ''} downloaded
            </Text>
          </View>
          <View style={styles.storageChevron}>
            <ChevronRight size={scale(18)} color={colors.gray} strokeWidth={1.5} />
          </View>
        </TouchableOpacity>

        {/* Downloads */}
        <SectionHeader title="Downloads" />
        <SettingsRow
          Icon={Download}
          label="View Downloaded Books"
          value={`${downloadCount}`}
          onPress={handleManageDownloads}
          description="See and manage your offline books"
        />
        <SettingsRow
          Icon={Wifi}
          label="Download Only on WiFi"
          switchValue={wifiOnlyEnabled}
          onSwitchChange={handleWifiOnlyToggle}
          description="Restricts downloads to Wi-Fi networks"
        />
        {/* Cloud Sync */}
        <SectionHeader title="Cloud Sync" />
        {isCloudSyncEnabled ? (
          <>
            <SettingsRow
              Icon={List}
              label="Synced My Library"
              value={linkedPlaylistName || 'Unknown'}
              onPress={handleOpenPlaylistPicker}
              description="Tap to change which playlist syncs"
            />
            <SettingsRow
              Icon={Heart}
              label="Synced My Series"
              value={linkedSeriesPlaylistName || 'Not set'}
              onPress={handleOpenSeriesPlaylistPicker}
              description="Tap to change which playlist syncs series"
            />
            <SettingsRow
              Icon={Cloud}
              label="Sync Status"
              value={formatLastSync()}
              description={`${libraryCount} books in library`}
            />
            <SettingsRow
              Icon={RefreshCw}
              label="Sync Now"
              onPress={handleSyncNow}
              loading={isSyncing}
              description="Upload and download library changes"
            />
            <SettingsRow
              Icon={CloudOff}
              label="Turn Off Cloud Sync"
              onPress={handleDisableCloudSync}
              description="Stop syncing to other devices"
              danger
            />
          </>
        ) : (
          <SettingsRow
            Icon={Cloud}
            label="Turn On Cloud Sync"
            onPress={handleOpenPlaylistPicker}
            loading={isEnablingSync}
            description={`Sync your ${libraryCount} books across devices`}
          />
        )}

        {/* Troubleshooting */}
        <SectionHeader title="Troubleshooting" />
        <SettingsRow
          Icon={RefreshCw}
          label="Reload Library from Server"
          onPress={handleReloadLibrary}
          loading={isRefreshingCache}
          description="Re-download your book list and covers"
        />
        <SettingsRow
          Icon={ImageIcon}
          label="Refresh Spines"
          onPress={isRefreshingSpines ? undefined : handleRefreshSpines}
          loading={isRefreshingSpines}
          description="Reload spine images from server"
        />
        {isCloudSyncEnabled && (
          <SettingsRow
            Icon={RefreshCw}
            label="Reset from Server"
            onPress={handleResetFromServer}
            description="Replace local library with server version"
            danger
            loading={isSyncing}
          />
        )}

        {/* Clear Data */}
        <SectionHeader title="Clear Data" />
        <SettingsRow
          Icon={Trash2}
          label="Clear Temporary Files"
          onPress={handleClearTempFiles}
          loading={isClearingCache}
          description="Frees space without deleting books"
        />
        <SettingsRow
          Icon={Trash2}
          label="Remove All Downloads"
          onPress={handleRemoveAllDownloads}
          loading={isClearingDownloads}
          description={downloadCount > 0 ? `Delete ${downloadCount} books (${formatBytes(totalStorage)})` : 'No downloads to remove'}
          danger
        />
        <SettingsRow
          Icon={Trash2}
          label="Empty My Library"
          onPress={handleEmptyLibrary}
          description={libraryCount > 0 ? `Remove all ${libraryCount} books from list` : 'Library is empty'}
          danger
        />

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            Your listening progress is always saved to the server. Downloads and library data are stored locally on this device.
          </Text>
        </View>
      </ScrollView>

      {/* Playlist Picker Modal (Library) */}
      <PlaylistPickerModal
        visible={showPlaylistPicker}
        onClose={() => setShowPlaylistPicker(false)}
        onSelect={handleSelectPlaylist}
        onCreateNew={handleCreateNewPlaylist}
        playlists={playlists}
        loading={loadingPlaylists}
        currentPlaylistId={libraryPlaylistId}
      />

      {/* Playlist Picker Modal (Series) */}
      <PlaylistPickerModal
        visible={showSeriesPlaylistPicker}
        onClose={() => setShowSeriesPlaylistPicker(false)}
        onSelect={handleSelectSeriesPlaylist}
        onCreateNew={handleCreateNewSeriesPlaylist}
        playlists={playlists}
        loading={loadingPlaylists}
        currentPlaylistId={seriesPlaylistId}
      />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  // Storage Overview
  storageOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 24,
  },
  storageIcon: {
    width: scale(48),
    height: scale(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageInfo: {
    marginLeft: 16,
  },
  storageValue: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(28),
  },
  storageLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginTop: 2,
  },
  storageChevron: {
    marginLeft: 'auto',
  },
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  infoText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    flex: 1,
    lineHeight: scale(16),
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(20),
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDescription: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  createNewText: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  playlistList: {
    flex: 1,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  playlistMeta: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 100,
  },
  emptyText: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(16),
    marginTop: 8,
  },
  emptySubtext: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
});
