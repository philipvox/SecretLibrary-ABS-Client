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
  Library,
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
import { useDefaultLibrary } from '@/shared/hooks/useDefaultLibrary';
import { librarySyncService } from '@/core/services/librarySyncService';
import { playlistsApi } from '@/core/api/endpoints/playlists';
import { Playlist } from '@/core/types/library';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { WebContentContainer } from '@/shared/components/WebContentContainer';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsRow } from '../components/SettingsRow';
import { SectionHeader } from '../components/SectionHeader';
import { useTranslation } from 'react-i18next';
import { logger } from '@/shared/utils/logger';
import { formatBytes } from '@/shared/utils/format';
import { useSpineCacheStore } from '@/shared/spine';

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
  const { t } = useTranslation();

  const renderPlaylist = ({ item }: { item: Playlist }) => {
    const isSelected = item.id === currentPlaylistId;
    const itemCount = item.items?.length || 0;
    // Friendly names for internal playlists
    const displayName = item.name === '__sl_my_library' ? t('settings.storage.pickerMyLibraryAuto')
      : item.name === '__sl_favorite_series' ? t('settings.storage.pickerMySeriesAuto')
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
        accessibilityRole="button"
        accessibilityLabel={`${displayName}, ${itemCount} book${itemCount !== 1 ? 's' : ''}${isSelected ? ', currently selected' : ''}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={styles.playlistInfo}>
          <Text style={[styles.playlistName, { color: colors.black }]}>{displayName}</Text>
          <Text style={[styles.playlistMeta, { color: colors.gray }]}>{t('settings.storage.pickerBookCount', { count: itemCount })}</Text>
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
          <Text style={[styles.modalTitle, { color: colors.black }]}>{t('settings.storage.pickerTitle')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton} accessibilityRole="button" accessibilityLabel={t('settings.storage.pickerClose')}>
            <X size={scale(24)} color={colors.black} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.modalDescription, { color: colors.gray }]}>
          {t('settings.storage.pickerDescription')}
        </Text>

        {/* Create New Button */}
        <TouchableOpacity style={[styles.createNewButton, { borderBottomColor: colors.grayLight }]} onPress={onCreateNew} accessibilityRole="button" accessibilityLabel={t('settings.storage.pickerCreateNewPlaylist')}>
          <Plus size={scale(18)} color={colors.black} strokeWidth={1.5} />
          <Text style={[styles.createNewText, { color: colors.black }]}>{t('settings.storage.pickerCreateNewPlaylist')}</Text>
        </TouchableOpacity>

        {/* Playlist List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gray} />
            <Text style={[styles.loadingText, { color: colors.gray }]}>{t('settings.storage.pickerLoadingPlaylists')}</Text>
          </View>
        ) : playlists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <List size={scale(32)} color={colors.gray} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { color: colors.gray }]}>{t('settings.storage.pickerNoPlaylists')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.gray }]}>{t('settings.storage.pickerCreateToStart')}</Text>
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
  const { t } = useTranslation();

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
  const [autoDownloadSeriesEnabled, setAutoDownloadSeriesEnabled] = useState(
    networkMonitor.isAutoDownloadSeriesEnabled()
  );
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
          setLinkedPlaylistName(linked.name.startsWith('__sl_') ? t('settings.storage.pickerMyLibraryAuto') : linked.name);
        }
      }

      // Find linked series playlist name
      const currentSeriesId = useLibrarySyncStore.getState().seriesPlaylistId;
      if (currentSeriesId) {
        const linkedSeries = fetchedPlaylists.find(p => p.id === currentSeriesId);
        if (linkedSeries) {
          setLinkedSeriesPlaylistName(linkedSeries.name.startsWith('__sl_') ? t('settings.storage.pickerMySeriesAuto') : linkedSeries.name);
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
      await useLibraryCache.getState().loadSpineManifest(true);
      // 2. Refresh library cache - this updates lastRefreshed, busting all spine URLs
      //    MUST happen BEFORE clearing dimensions so old-URL images can't race ahead
      //    and re-set stale dimensions from expo-image cache
      await refreshCache();
      // 3. NOW clear cached dimensions - images will reload with new URLs
      //    and onLoad will set fresh dimensions from the new images
      useSpineCacheStore.getState().clearServerSpineDimensions();
      const count = useLibraryCache.getState().booksWithServerSpines.size;
      Alert.alert(t('settings.storage.alertSpinesRefreshedTitle'), t('settings.storage.alertSpinesRefreshedMessage', { count }));
    } catch (error) {
      logger.error('[DataStorage] Failed to refresh spines:', error);
      Alert.alert(t('common.error'), t('settings.storage.alertCouldNotRefreshSpines'));
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
      setLinkedPlaylistName(playlist.name.startsWith('__sl_') ? t('settings.storage.pickerMyLibraryAuto') : playlist.name);

      // Set up series playlist too
      if (library?.id) {
        librarySyncService.getOrCreateSeriesPlaylist(library.id);
      }

      // Sync
      setIsSyncing(true);
      await librarySyncService.fullSync();
      setIsSyncing(false);

      Alert.alert(t('settings.storage.alertPlaylistLinkedTitle'), t('settings.storage.alertPlaylistLinkedMessage', { name: playlist.name.startsWith('__sl_') ? 'My Library' : playlist.name }));
    } catch (err: any) {
      Alert.alert(t('common.error'), t('settings.storage.alertCouldNotLinkPlaylist'));
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
      setLinkedPlaylistName(t('settings.storage.pickerMyLibraryAuto'));
      librarySyncService.getOrCreateSeriesPlaylist(library.id);

      setIsSyncing(true);
      await librarySyncService.fullSync();
      setIsSyncing(false);

      Alert.alert(t('settings.storage.alertCloudSyncEnabledTitle'), t('settings.storage.alertCloudSyncEnabledMessage'));
    } catch (err: any) {
      Alert.alert(t('common.error'), t('settings.storage.alertCouldNotCreatePlaylist'));
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
    setLinkedSeriesPlaylistName(playlist.name.startsWith('__sl_') ? t('settings.storage.pickerMySeriesAuto') : playlist.name);

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
      setLinkedSeriesPlaylistName(t('settings.storage.pickerMySeriesAuto'));

      setIsSyncing(true);
      await librarySyncService.fullSync();
      setIsSyncing(false);
    } catch (err: any) {
      Alert.alert(t('common.error'), t('settings.storage.alertCouldNotCreateSeriesPlaylist'));
    }
  }, [library?.id]);

  // Handlers
  const handleWifiOnlyToggle = useCallback(async (enabled: boolean) => {
    setWifiOnlyEnabled(enabled);
    await networkMonitor.setWifiOnlyEnabled(enabled);
  }, []);

  const handleAutoDownloadSeriesToggle = useCallback(async (enabled: boolean) => {
    setAutoDownloadSeriesEnabled(enabled);
    await networkMonitor.setAutoDownloadSeriesEnabled(enabled);
  }, []);

  const handleManageDownloads = useCallback(() => {
    navigation.navigate('Downloads');
  }, [navigation]);

  const handleReloadLibrary = useCallback(async () => {
    if (isRefreshingCache) return;

    setIsRefreshingCache(true);
    try {
      await refreshCache();
      Alert.alert(t('common.done'), t('settings.storage.alertLibraryReloaded'));
    } catch {
      Alert.alert(t('common.error'), t('settings.storage.alertCouldNotReloadLibrary'));
    } finally {
      setIsRefreshingCache(false);
    }
  }, [isRefreshingCache, refreshCache]);

  const handleClearTempFiles = useCallback(() => {
    if (isClearingCache) return;

    Alert.alert(
      t('settings.storage.alertClearTempFilesTitle'),
      t('settings.storage.alertClearTempFilesMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.clear'),
          onPress: async () => {
            setIsClearingCache(true);
            try {
              await clearCache();
              Alert.alert(t('common.done'), t('settings.storage.alertTempFilesCleared'));
            } catch (error) {
              logger.error('[DataStorage] Failed to clear cache:', error);
              Alert.alert(t('common.error'), t('settings.storage.alertCouldNotClearFiles'));
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
      Alert.alert(t('settings.storage.alertNoDownloadsTitle'), t('settings.storage.alertNoDownloadsMessage'));
      return;
    }

    if (isClearingDownloads) return;

    Alert.alert(
      t('settings.storage.alertRemoveAllDownloadsTitle'),
      t('settings.storage.alertRemoveAllDownloadsMessage', { count: downloadCount, size: formatBytes(totalStorage) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.storage.alertRemoveAll'),
          style: 'destructive',
          onPress: async () => {
            setIsClearingDownloads(true);
            try {
              await downloadManager.clearAllDownloads();
              Alert.alert(t('common.done'), t('settings.storage.alertAllDownloadsRemoved'));
            } catch (error) {
              logger.error('[DataStorage] Failed to clear downloads:', error);
              Alert.alert(t('common.error'), t('settings.storage.alertCouldNotRemoveDownloads'));
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
      Alert.alert(t('settings.storage.alertAlreadyEmptyTitle'), t('settings.storage.alertAlreadyEmptyMessage'));
      return;
    }
    Alert.alert(
      t('settings.storage.alertEmptyMyLibraryTitle'),
      t('settings.storage.alertEmptyMyLibraryMessage', { count: libraryCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.storage.alertEmptyLibraryButton'),
          style: 'destructive',
          onPress: () => {
            clearAllLibrary();
            Alert.alert(t('common.done'), t('settings.storage.alertLibraryEmptied'));
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
      t('settings.storage.alertTurnOffCloudSyncTitle'),
      t('settings.storage.alertTurnOffCloudSyncMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.storage.alertTurnOff'),
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
      t('settings.storage.alertResetFromServerTitle'),
      t('settings.storage.alertResetFromServerMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: async () => {
            setIsSyncing(true);
            try {
              const count = await librarySyncService.resetAndPull();
              Alert.alert(t('common.done'), t('settings.storage.alertRestoredFromServer', { count }));
            } catch (err: any) {
              Alert.alert(t('common.error'), t('settings.storage.alertCouldNotReset'));
            } finally {
              setIsSyncing(false);
            }
          },
        },
      ]
    );
  }, []);

  const formatLastSync = () => {
    if (!lastSyncAt) return t('settings.storage.lastSyncNever');
    const diff = Date.now() - lastSyncAt;
    if (diff < 60000) return t('settings.storage.lastSyncJustNow');
    if (diff < 3600000) return t('settings.storage.lastSyncMinutesAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('settings.storage.lastSyncHoursAgo', { count: Math.floor(diff / 3600000) });
    return new Date(lastSyncAt).toLocaleDateString();
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title={t('settings.storage.title')} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <WebContentContainer variant="narrow">
        {/* Storage Overview — tap to manage downloads */}
        <TouchableOpacity
          style={[styles.storageOverview, { backgroundColor: colors.white }]}
          onPress={handleManageDownloads}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('settings.storage.storageOverviewA11y', { size: formatBytes(totalStorage), count: downloadCount })}
        >
          <View style={[styles.storageIcon, { backgroundColor: colors.grayLight }]}>
            <Folder size={scale(24)} color={colors.black} strokeWidth={1.5} />
          </View>
          <View style={styles.storageInfo}>
            <Text style={[styles.storageValue, { color: colors.black }]}>{formatBytes(totalStorage)}</Text>
            <Text style={[styles.storageLabel, { color: colors.gray }]}>
              {t('settings.storage.booksDownloaded', { count: downloadCount })}
            </Text>
          </View>
          <View style={styles.storageChevron}>
            <ChevronRight size={scale(18)} color={colors.gray} strokeWidth={1.5} />
          </View>
        </TouchableOpacity>

        {/* Downloads */}
        <SectionHeader title={t('settings.storage.sectionDownloads')} />
        <SettingsRow
          Icon={Download}
          label={t('settings.storage.viewDownloadedBooks')}
          value={`${downloadCount}`}
          onPress={handleManageDownloads}
          description={t('settings.storage.viewDownloadedBooksDescription')}
        />
        <SettingsRow
          Icon={Wifi}
          label={t('settings.storage.downloadOnlyOnWifi')}
          switchValue={wifiOnlyEnabled}
          onSwitchChange={handleWifiOnlyToggle}
          description={t('settings.storage.downloadOnlyOnWifiDescription')}
        />
        <SettingsRow
          Icon={Library}
          label={t('settings.storage.autoDownloadSeries')}
          switchValue={autoDownloadSeriesEnabled}
          onSwitchChange={handleAutoDownloadSeriesToggle}
          description={t('settings.storage.autoDownloadSeriesDescription')}
        />
        {/* Cloud Sync */}
        <SectionHeader title={t('settings.storage.sectionCloudSync')} />
        {isCloudSyncEnabled ? (
          <>
            <SettingsRow
              Icon={List}
              label={t('settings.storage.syncedMyLibrary')}
              value={linkedPlaylistName || t('settings.storage.unknown')}
              onPress={handleOpenPlaylistPicker}
              description={t('settings.storage.syncedMyLibraryDescription')}
            />
            <SettingsRow
              Icon={Heart}
              label={t('settings.storage.syncedMySeries')}
              value={linkedSeriesPlaylistName || t('settings.storage.notSet')}
              onPress={handleOpenSeriesPlaylistPicker}
              description={t('settings.storage.syncedMySeriesDescription')}
            />
            <SettingsRow
              Icon={Cloud}
              label={t('settings.storage.syncStatus')}
              value={formatLastSync()}
              description={t('settings.storage.booksInLibrary', { count: libraryCount })}
            />
            <SettingsRow
              Icon={RefreshCw}
              label={t('settings.storage.syncNow')}
              onPress={handleSyncNow}
              loading={isSyncing}
              description={t('settings.storage.syncNowDescription')}
            />
            <SettingsRow
              Icon={CloudOff}
              label={t('settings.storage.turnOffCloudSync')}
              onPress={handleDisableCloudSync}
              description={t('settings.storage.turnOffCloudSyncDescription')}
              danger
            />
          </>
        ) : (
          <SettingsRow
            Icon={Cloud}
            label={t('settings.storage.turnOnCloudSync')}
            onPress={handleOpenPlaylistPicker}
            loading={isEnablingSync}
            description={t('settings.storage.turnOnCloudSyncDescription', { count: libraryCount })}
          />
        )}

        {/* Troubleshooting */}
        <SectionHeader title={t('settings.storage.sectionTroubleshooting')} />
        <SettingsRow
          Icon={RefreshCw}
          label={t('settings.storage.reloadLibrary')}
          onPress={handleReloadLibrary}
          loading={isRefreshingCache}
          description={t('settings.storage.reloadLibraryDescription')}
        />
        <SettingsRow
          Icon={ImageIcon}
          label={t('settings.storage.refreshSpines')}
          onPress={isRefreshingSpines ? undefined : handleRefreshSpines}
          loading={isRefreshingSpines}
          description={t('settings.storage.refreshSpinesDescription')}
        />
        <SettingsRow
          Icon={Trash2}
          label={t('settings.storage.clearTempFiles')}
          onPress={handleClearTempFiles}
          loading={isClearingCache}
          description={t('settings.storage.clearTempFilesDescription')}
        />

        {/* Danger Zone */}
        <SectionHeader title={t('settings.storage.sectionDangerZone')} />
        {isCloudSyncEnabled && (
          <SettingsRow
            Icon={RefreshCw}
            label={t('settings.storage.resetFromServer')}
            onPress={handleResetFromServer}
            description={t('settings.storage.resetFromServerDescription')}
            danger
            loading={isSyncing}
          />
        )}
        <SettingsRow
          Icon={Trash2}
          label={t('settings.storage.removeAllDownloads')}
          onPress={handleRemoveAllDownloads}
          loading={isClearingDownloads}
          description={downloadCount > 0 ? t('settings.storage.removeAllDownloadsDescription', { count: downloadCount, size: formatBytes(totalStorage) }) : t('settings.storage.noDownloadsDescription')}
          danger
        />
        <SettingsRow
          Icon={Trash2}
          label={t('settings.storage.emptyMyLibrary')}
          onPress={handleEmptyLibrary}
          description={libraryCount > 0 ? t('settings.storage.emptyMyLibraryDescription', { count: libraryCount }) : t('settings.storage.emptyLibraryDescription')}
          danger
        />

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            {t('settings.storage.infoNote')}
          </Text>
        </View>
        </WebContentContainer>
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
