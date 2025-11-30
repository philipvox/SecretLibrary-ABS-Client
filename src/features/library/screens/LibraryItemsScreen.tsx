/**
 * src/features/library/screens/LibraryItemsScreen.tsx
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryPrefetch } from '@/core/hooks';
import { BookCard } from '../components/BookCard';
import { useDefaultLibrary } from '../hooks/useDefaultLibrary';
import { useLibraryItems } from '../hooks/useLibraryItems';
import { TopNavBar } from '@/navigation/components/TopNavBar';
import { LoadingSpinner, ErrorView, EmptyState } from '@/shared/components';
import { LibraryItem } from '@/core/types';
import { theme } from '@/shared/theme';

const NUM_COLUMNS = 3;

export function LibraryItemsScreen() {
  const insets = useSafeAreaInsets();
  const { library, isLoading: isLoadingLibrary, error: libraryError } = useDefaultLibrary();
  const { items, isLoading: isLoadingItems, error: itemsError, refetch, isRefetching } = useLibraryItems(library?.id || '', {
    limit: 50,
  });

  useLibraryPrefetch(library?.id);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <View style={styles.itemWrapper}>
      <BookCard book={item} />
    </View>
  ), []);

  const keyExtractor = useCallback((item: LibraryItem) => item.id, []);

  if (isLoadingLibrary || (isLoadingItems && items.length === 0)) {
    return <LoadingSpinner text="Loading library..." />;
  }

  if (libraryError) {
    return <ErrorView message="Failed to load library" onRetry={refetch} />;
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
    return <ErrorView message="Failed to load books" onRetry={refetch} />;
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
      <View style={{ paddingTop: insets.top }}>
        <TopNavBar />
      </View>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        estimatedItemSize={180}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
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
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
    paddingBottom: 120,
  },
  itemWrapper: {
    flex: 1,
    paddingHorizontal: theme.spacing[1],
    paddingBottom: theme.spacing[4],
  },
});