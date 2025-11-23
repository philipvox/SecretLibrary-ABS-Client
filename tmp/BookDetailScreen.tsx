/**
 * src/features/book-detail/screens/BookDetailScreen.tsx
 *
 * Main book detail screen showing full book information, chapters, and actions.
 * Uses ScrollView for full-page scrolling with nested components.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useBookDetails } from '../hooks/useBookDetails';
import { BookHeader } from '../components/BookHeader';
import { BookInfo } from '../components/BookInfo';
import { ChapterList } from '../components/ChapterList';
import { BookActions } from '../components/BookActions';
import { LoadingSpinner, ErrorView } from '@/shared/components';

/**
 * Route params for BookDetail screen
 */
type BookDetailRouteParams = {
  BookDetail: {
    bookId: string;
  };
};

type BookDetailRouteProp = RouteProp<BookDetailRouteParams, 'BookDetail'>;

/**
 * Display full book details with scrollable content
 */
export function BookDetailScreen() {
  const route = useRoute<BookDetailRouteProp>();
  const { bookId } = route.params;
  
  const { book, isLoading, error, refetch } = useBookDetails(bookId);

  // Show loading spinner
  if (isLoading) {
    return <LoadingSpinner text="Loading book details..." />;
  }

  // Show error view
  if (error) {
    return (
      <ErrorView
        message="Failed to load book details. Please try again."
        onRetry={refetch}
      />
    );
  }

  // Show error if book not found
  if (!book) {
    return (
      <ErrorView
        message="Book not found."
        onRetry={refetch}
      />
    );
  }

  // Extract chapters
  const chapters = book.media.chapters || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <BookHeader book={book} />

      {/* Action Buttons */}
      <BookActions book={book} />

      {/* Book Information */}
      <BookInfo book={book} />

      {/* Chapter List */}
      <ChapterList chapters={chapters} />

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 32,
  },
  bottomSpacing: {
    height: 32,
  },
});
