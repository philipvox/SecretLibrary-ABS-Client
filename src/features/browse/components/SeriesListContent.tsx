import React, { useState, useCallback } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SeriesCard } from '@/features/series';
import { useSeries } from '@/features/series';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { SearchBar } from '@/features/search/components/SearchBar';
import { LoadingSpinner, EmptyState, ErrorView } from '@/shared/components';
import { SeriesInfo } from '@/features/series';
import { theme } from '@/shared/theme';

export function SeriesListContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const { library, isLoading: isLoadingLibrary } = useDefaultLibrary();
  const { series, seriesCount, isLoading, error, refetch } = useSeries(
    library?.id || '',
    { sortBy: 'name-asc', searchQuery }
  );

  if (isLoadingLibrary || isLoading) {
    return <LoadingSpinner text="Loading series..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load series" onRetry={refetch} />;
  }

  if (seriesCount === 0 && !searchQuery) {
    return (
      <EmptyState
        icon="📚"
        message="No series found"
        description="Your library doesn't have any series"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search series..."
          autoFocus={false}
        />
      </View>

      <FlashList
        data={series}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <SeriesCard series={item} />
          </View>
        )}
        keyExtractor={(item: SeriesInfo) => item.id}
        numColumns={2}
        estimatedItemSize={200}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primary[500]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            message="No series found"
            description={`No series match "${searchQuery}"`}
          />
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
  searchContainer: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
  },
  listContent: {
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[32] + 60,
  },
  itemWrapper: {
    flex: 1,
    paddingHorizontal: theme.spacing[1],
  },
});