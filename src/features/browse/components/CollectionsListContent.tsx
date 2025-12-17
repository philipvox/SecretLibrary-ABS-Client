import React, { useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { CollectionCard } from '@/features/collections';
import { useCollections } from '@/features/collections/hooks/useCollections';
import { SearchBar } from '@/features/search/components/SearchBar';
import { LoadingSpinner, EmptyState, ErrorView } from '@/shared/components';
import { Collection } from '@/core/types';
import { colors, spacing } from '@/shared/theme';

export function CollectionsListContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const { collections, isLoading, error, refetch } = useCollections();

  const filteredCollections = searchQuery
    ? collections.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : collections;

  if (isLoading) {
    return <LoadingSpinner text="Loading collections..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load collections" onRetry={refetch} />;
  }

  if (collections.length === 0 && !searchQuery) {
    return (
      <EmptyState
        icon="📁"
        message="No collections yet"
        description="Create collections in AudiobookShelf to organize your books"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search collections..."
          autoFocus={false}
        />
      </View>

      <FlashList
        data={filteredCollections}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <CollectionCard collection={item} />
          </View>
        )}
        keyExtractor={(item: Collection) => item.id}
        numColumns={2}
        estimatedItemSize={200}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            message="No collections found"
            description={`No collections match "${searchQuery}"`}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 188,
  },
  itemWrapper: {
    flex: 1,
    paddingHorizontal: 4,
  },
});