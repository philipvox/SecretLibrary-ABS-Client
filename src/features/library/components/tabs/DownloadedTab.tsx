/**
 * src/features/library/components/tabs/DownloadedTab.tsx
 *
 * Downloaded books tab content for MyLibraryScreen.
 * Shows downloading section, downloaded books, series, and storage summary.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { LibraryEmptyState } from '../LibraryEmptyState';
import { BookRow } from '../BookRow';
import { FannedSeriesCard } from '../FannedSeriesCard';
import { StorageSummary } from '../StorageSummary';
import { DownloadItem } from '@/features/downloads/components/DownloadItem';
import { scale } from '@/shared/theme';
import { EnrichedBook, SeriesGroup } from '../../types';

interface DownloadedTabProps {
  books: EnrichedBook[];
  seriesGroups: SeriesGroup[];
  activeDownloads: any[];
  totalStorageUsed: number;
  onBookPress: (bookId: string) => void;
  onBookPlay: (book: EnrichedBook) => void;
  onSeriesPress: (seriesName: string) => void;
  onDownloadPause: (itemId: string) => void;
  onDownloadResume: (itemId: string) => void;
  onDownloadDelete: (itemId: string) => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onManageStorage: () => void;
  isMarkedFinished: (bookId: string) => boolean;
  hasDownloading: boolean;
  hasPaused: boolean;
  onBrowse: () => void;
}

export function DownloadedTab({
  books,
  seriesGroups,
  activeDownloads,
  totalStorageUsed,
  onBookPress,
  onBookPlay,
  onSeriesPress,
  onDownloadPause,
  onDownloadResume,
  onDownloadDelete,
  onManageStorage,
  isMarkedFinished,
  onBrowse,
}: DownloadedTabProps) {
  const hasContent = books.length > 0 || activeDownloads.length > 0;

  if (!hasContent) {
    return <LibraryEmptyState tab="downloaded" onAction={onBrowse} />;
  }

  return (
    <View>
      {/* Downloading Section */}
      {activeDownloads.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title={`Downloading (${activeDownloads.length})`}
            showViewAll={false}
          />
          <View style={styles.downloadList}>
            {activeDownloads.map((download) => (
              <DownloadItem
                key={download.itemId}
                download={download}
                onPause={() => onDownloadPause(download.itemId)}
                onResume={() => onDownloadResume(download.itemId)}
                onDelete={() => onDownloadDelete(download.itemId)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Downloaded Books Section */}
      {books.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={`Downloaded Books (${books.length})`} showViewAll={false} />
          {books.map(book => (
            <BookRow
              key={book.id}
              book={book}
              onPress={() => onBookPress(book.id)}
              onPlay={() => onBookPlay(book)}
              isMarkedFinished={isMarkedFinished(book.id)}
            />
          ))}
        </View>
      )}

      {/* Downloaded Series Section */}
      {seriesGroups.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={`Downloaded Series (${seriesGroups.length})`} showViewAll={false} />
          <View style={styles.fannedSeriesGrid}>
            {seriesGroups.map((series) => (
              <FannedSeriesCard
                key={series.name}
                series={series}
                onPress={() => onSeriesPress(series.name)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Storage Summary */}
      <StorageSummary
        usedBytes={totalStorageUsed}
        bookCount={books.length}
        onManagePress={onManageStorage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: scale(24),
  },
  downloadList: {
    paddingHorizontal: scale(16),
  },
  fannedSeriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: scale(16),
    gap: scale(12),
  },
});

export default DownloadedTab;
