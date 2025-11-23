/**
 * src/features/library/screens/LibraryItemsScreen.tsx
 *
 * Main library browsing screen displaying books in a grid.
 * Features: pull-to-refresh, loading states, error handling.
 */

import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { BookCard } from '../components/BookCard';
import { useDefaultLibrary } from '../hooks/useDefaultLibrary';
import { useLibraryItems } from '../hooks/useLibraryItems';
import { LoadingSpinner, ErrorView, EmptyState } from '@/shared/components';
import { LibraryItem } from '@/core/types';

/**
 * Display library items in a 2-column grid with pull-to-refresh
 */
export function LibraryItemsScreen() {
  // Get the default library
  const {
    library,
    isLoading: isLoadingLibrary,
    error: libraryError,
  } = useDefaultLibrary();

  // Get library items
  const {
    items,
    total,
    isLoading: isLoadingItems,
    error: itemsError,
    refetch,
  } = useLibraryItems(library?.id || '', {
    limit: 50,
    page: 0,
  });

  // Render individual book card
  const renderItem = ({ item }: { item: LibraryItem }) => (
    <BookCard book={item} />
  );

  // Show loading spinner while fetching library or items
  if (isLoadingLibrary || (isLoadingItems && items.length === 0)) {
    return <LoadingSpinner text="Loading library..." />;
  }

  // Show error if library failed to load
  if (libraryError) {
    return (
      <ErrorView
        message="Failed to load library. Please check your connection and try again."
        onRetry={refetch}
      />
    );
  }

  // Show error if no library found
  if (!library) {
    return (
      <EmptyState
        message="No libraries found. Please add a library in AudiobookShelf."
        icon="📚"
      />
    );
  }

  // Show error if items failed to load
  if (itemsError) {
    return (
      <ErrorView
        message="Failed to load books. Please try again."
        onRetry={refetch}
      />
    );
  }

  // Show empty state if no items
  if (items.length === 0) {
    return (
      <EmptyState
        message={`Your library "${library.name}" is empty. Add some audiobooks to get started!`}
        icon="📖"
      />
    );
  }

  // Render the grid of books
  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingItems}
            onRefresh={refetch}
            tintColor="#007AFF"
          />
        }
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
});
