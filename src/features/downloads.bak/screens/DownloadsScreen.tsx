/**
 * src/features/downloads/screens/DownloadsScreen.tsx
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDownloads, formatBytes } from '../hooks/useDownloads';
import { DownloadItem } from '../components/DownloadItem';
import { DownloadedBook } from '../services/downloadService';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { theme } from '@/shared/theme';

export function DownloadsScreen() {
  const navigation = useNavigation();
  const { downloads, totalStorageUsed, isLoading, clearAllDownloads } = useDownloads();
  const { loadBook } = usePlayerStore();

  const handleClearAll = () => {
    if (downloads.length === 0) return;

    Alert.alert(
      'Clear All Downloads',
      `This will remove ${downloads.length} downloaded books (${formatBytes(totalStorageUsed)})`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearAllDownloads,
        },
      ]
    );
  };

  const handlePlay = (download: DownloadedBook) => {
    loadBook({
      id: download.libraryItemId,
      ino: '',
      libraryId: '',
      folderId: '',
      path: '',
      relPath: '',
      isFile: false,
      mtimeMs: 0,
      ctimeMs: 0,
      birthtimeMs: 0,
      addedAt: 0,
      updatedAt: 0,
      isMissing: false,
      isInvalid: false,
      mediaType: 'book',
      media: {
        metadata: {
          title: download.title,
          authorName: download.author,
        },
        coverPath: download.localCoverPath,
        duration: download.duration,
        audioFiles: [],
      },
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Downloads</Text>
      <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
        <Text style={styles.clearButtonText}>Clear All</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStats = () => (
    <View style={styles.stats}>
      <View style={styles.stat}>
        <Ionicons name="cloud-download" size={20} color={theme.colors.primary[500]} />
        <Text style={styles.statValue}>{downloads.length}</Text>
        <Text style={styles.statLabel}>Books</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.stat}>
        <Ionicons name="folder" size={20} color={theme.colors.primary[500]} />
        <Text style={styles.statValue}>{formatBytes(totalStorageUsed)}</Text>
        <Text style={styles.statLabel}>Used</Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="cloud-download-outline" size={64} color={theme.colors.text.tertiary} />
      <Text style={styles.emptyTitle}>No Downloads</Text>
      <Text style={styles.emptyText}>
        Download books from your library to listen offline
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderStats()}
      <FlatList
        data={downloads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DownloadItem download={item} onPlay={() => handlePlay(item)} />
        )}
        contentContainerStyle={[
          styles.list,
          downloads.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  backButton: {
    padding: theme.spacing[1],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  clearButton: {
    padding: theme.spacing[1],
  },
  clearButtonText: {
    fontSize: 14,
    color: theme.colors.status.error,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginTop: theme.spacing[1],
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border.light,
  },
  list: {
    padding: theme.spacing[4],
  },
  listEmpty: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: theme.spacing[4],
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing[2],
  },
});