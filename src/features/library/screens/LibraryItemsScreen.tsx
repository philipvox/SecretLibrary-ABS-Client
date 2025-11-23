/**
 * Library screen - fully redesigned
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { BookCard } from '../components/BookCard';
import { useDefaultLibrary } from '../hooks/useDefaultLibrary';
import { useLibraryItems } from '../hooks/useLibraryItems';
import { LoadingSpinner, ErrorView, EmptyState } from '@/shared/components';
import { LibraryItem } from '@/core/types';
import { theme } from '@/shared/theme';

export function LibraryItemsScreen() {
  const {
    library,
    isLoading: isLoadingLibrary,
    error: libraryError,
  } = useDefaultLibrary();

  const {
    items,
    isLoading: isLoadingItems,
    error: itemsError,
    refetch,
  } = useLibraryItems(library?.id || '', {
    limit: 50,
    page: 0,
  });

  const renderItem = ({ item }: { item: LibraryItem }) => (
    <BookCard book={item} />
  );

  const ListHeader = () => (
    <View style={styles.header}>
      <Text style={styles.greeting}>Good morning</Text>
      <Text style={styles.subGreeting}>We have some fantastic books for you.</Text>
    </View>
  );

  if (isLoadingLibrary || (isLoadingItems && items.length === 0)) {
    return <LoadingSpinner text="Loading library..." />;
  }

  if (libraryError) {
    return (
      <ErrorView
        message="Failed to load library"
        onRetry={refetch}
      />
    );
  }

  if (!library) {
    return (
      <EmptyState
        message="No libraries found"
        description="Please add a library in AudiobookShelf"
        icon="📚"
      />
    );
  }

  if (itemsError) {
    return (
      <ErrorView
        message="Failed to load books"
        onRetry={refetch}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        message="Your library is empty"
        description="Add some audiobooks to get started"
        icon="📖"
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingItems}
            onRefresh={refetch}
            tintColor={theme.colors.primary[500]}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  listContent: {
    padding: theme.spacing[5],
    paddingBottom: theme.spacing[32], // Extra space for mini player
  },
  header: {
    marginBottom: theme.spacing[6],
    paddingTop: theme.spacing[2],
  },
  greeting: {
    fontSize: 34,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
    letterSpacing: -0.5,
  },
  subGreeting: {
    ...theme.textStyles.body,
    color: theme.colors.text.secondary,
    fontSize: 15,
  },
  row: {
    justifyContent: 'flex-start',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[1],
  },
});