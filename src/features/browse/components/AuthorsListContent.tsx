import React, { useState, useCallback } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { AuthorCard } from '@/features/author';
import { useAuthors } from '@/features/author/hooks/useAuthors';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { SearchBar } from '@/features/search/components/SearchBar';
import { LoadingSpinner, EmptyState, ErrorView } from '@/shared/components';
import { AuthorInfo } from '@/features/author/services/authorAdapter';
import { colors, spacing } from '@/shared/theme';

export function AuthorsListContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const { library, isLoading: isLoadingLibrary } = useDefaultLibrary();
  const { authors, authorCount, isLoading, error, refetch } = useAuthors(
    library?.id || '',
    { sortBy: 'name-asc', searchQuery }
  );

  if (isLoadingLibrary || isLoading) {
    return <LoadingSpinner text="Loading authors..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load authors" onRetry={refetch} />;
  }

  if (authorCount === 0 && !searchQuery) {
    return (
      <EmptyState
        icon="👤"
        message="No authors found"
        description="Your library doesn't have any authors"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search authors..."
          autoFocus={false}
        />
      </View>

      <FlashList
        data={authors}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <AuthorCard author={item} />
          </View>
        )}
        keyExtractor={(item: AuthorInfo) => item.id}
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
            message="No authors found"
            description={`No authors match "${searchQuery}"`}
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