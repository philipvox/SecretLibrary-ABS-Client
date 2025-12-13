import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeriesCard } from '../components/SeriesCard';
import { useSeries } from '../hooks/useSeries';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { SearchBar } from '@/features/search/components/SearchBar';
import { FilterSortBar, SortOption, LoadingSpinner, EmptyState, ErrorView } from '@/shared/components';
import { SeriesInfo } from '../services/seriesAdapter';
import { colors, spacing } from '@/shared/theme';

export function SeriesListScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const { library, isLoading: isLoadingLibrary } = useDefaultLibrary();
  const { series, seriesCount, isLoading, error, refetch } = useSeries(
    library?.id || '',
    { sortBy, searchQuery }
  );

  if (isLoadingLibrary || isLoading) {
    return <LoadingSpinner text="Loading series..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load series" onRetry={refetch} />;
  }

  if (seriesCount === 0 && !searchQuery) {
    return (
      <EmptyState icon="📚" message="No series found" description="Your library doesn't have any series" />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search series..." autoFocus={false} />
        <FilterSortBar sortBy={sortBy} onSortChange={setSortBy} />
      </View>
      <FlatList
        data={series}
        renderItem={({ item }) => <SeriesCard series={item} />}
        keyExtractor={(item: SeriesInfo) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
        ListEmptyComponent={<EmptyState icon="🔍" message="No series found" description={`No series match "${searchQuery}"`} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 188 },
  row: { justifyContent: 'space-between' },
});