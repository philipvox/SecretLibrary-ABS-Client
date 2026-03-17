/**
 * src/features/library/components/tabs/AllBooksTab.tsx
 *
 * All books tab content for MyLibraryScreen.
 * Shows continue listening hero, books, series, authors, narrators.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { ContinueListeningHero } from '../ContinueListeningHero';
import { LibraryEmptyState } from '../LibraryEmptyState';
import { BookRow } from '../BookRow';
import { FannedSeriesCard } from '../FannedSeriesCard';
import { PersonCard } from '../PersonCard';
import { DownloadItem } from '@/features/downloads/components/DownloadItem';
import { scale } from '@/shared/theme';
import { EnrichedBook, FannedSeriesCardData } from '../../types';

interface AllBooksTabProps {
  books: EnrichedBook[];
  continueListeningBook: any | null;
  activeDownloads: any[];
  favoriteSeriesData: FannedSeriesCardData[];
  favoriteAuthorData: any[];
  favoriteNarratorData: any[];
  onBookPress: (bookId: string) => void;
  onBookPlay: (book: EnrichedBook) => void;
  onContinueListeningPlay: () => void;
  onSeriesPress: (seriesName: string) => void;
  onAuthorPress: (authorName: string) => void;
  onNarratorPress: (narratorName: string) => void;
  onDownloadPause: (itemId: string) => void;
  onDownloadResume: (itemId: string) => void;
  onDownloadDelete: (itemId: string) => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  isMarkedFinished: (bookId: string) => boolean;
  hasDownloading: boolean;
  hasPaused: boolean;
  onBrowse: () => void;
}

export function AllBooksTab({
  books,
  continueListeningBook,
  activeDownloads,
  favoriteSeriesData,
  favoriteAuthorData,
  favoriteNarratorData,
  onBookPress,
  onBookPlay,
  onContinueListeningPlay,
  onSeriesPress,
  onAuthorPress,
  onNarratorPress,
  onDownloadPause,
  onDownloadResume,
  onDownloadDelete,
  isMarkedFinished,
  onBrowse,
}: AllBooksTabProps) {
  const navigation = useNavigation<any>();

  const hasContent = books.length > 0 || activeDownloads.length > 0 ||
    favoriteSeriesData.length > 0 || favoriteAuthorData.length > 0 ||
    favoriteNarratorData.length > 0;

  if (!hasContent) {
    return <LibraryEmptyState tab="all" onAction={onBrowse} />;
  }

  // Get continue listening hero data
  const heroBook = continueListeningBook;
  const heroProgress = heroBook?.userMediaProgress?.progress || 0;
  const heroDuration = (heroBook?.media as any)?.duration || 0;
  const heroRemainingSeconds = heroDuration * (1 - heroProgress);
  const showHero = heroBook && heroProgress > 0 && heroProgress < 0.95;

  return (
    <View>
      {/* Continue Listening Hero */}
      {showHero && (
        <ContinueListeningHero
          book={heroBook}
          progress={heroProgress}
          remainingSeconds={heroRemainingSeconds}
          onPlay={onContinueListeningPlay}
          onPress={() => onBookPress(heroBook.id)}
        />
      )}

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

      {/* Books Section */}
      {books.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={`Books (${books.length})`} showViewAll={false} />
          {books.map(book => (
            <BookRow
              key={book.id}
              book={book}
              onPress={() => onBookPress(book.id)}
              onLongPress={() => navigation.navigate('BookDetail', { id: book.id })}
              onPlay={() => onBookPlay(book)}
              isMarkedFinished={isMarkedFinished(book.id)}
            />
          ))}
        </View>
      )}

      {/* Series Section */}
      {favoriteSeriesData.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={`Series (${favoriteSeriesData.length})`} showViewAll={false} />
          <View style={styles.fannedSeriesGrid}>
            {favoriteSeriesData.map((series) => (
              <FannedSeriesCard
                key={series.name}
                series={series}
                onPress={() => onSeriesPress(series.name)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Authors Section */}
      {favoriteAuthorData.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={`Authors (${favoriteAuthorData.length})`} showViewAll={false} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {favoriteAuthorData.map((author: any) => (
              <PersonCard
                key={author.name}
                name={author.name}
                imageUrl={author.imageUrl}
                bookCount={author.books?.length || 0}
                type="author"
                onPress={() => onAuthorPress(author.name)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Narrators Section */}
      {favoriteNarratorData.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={`Narrators (${favoriteNarratorData.length})`} showViewAll={false} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {favoriteNarratorData.map((narrator: any) => (
              <PersonCard
                key={narrator.name}
                name={narrator.name}
                bookCount={narrator.books?.length || 0}
                type="narrator"
                onPress={() => onNarratorPress(narrator.name)}
              />
            ))}
          </ScrollView>
        </View>
      )}
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
  horizontalList: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },
});

export default AllBooksTab;
