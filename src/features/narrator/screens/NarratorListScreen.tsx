import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NarratorCard } from '../components/NarratorCard';
import { useNarrators, NarratorInfo } from '../hooks/useNarrators';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { SearchBar } from '@/features/search/components/SearchBar';
import { FilterSortBar, SortOption, LoadingSpinner, EmptyState, ErrorView } from '@/shared/components';
import { colors, spacing } from '@/shared/theme';

export function NarratorListScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const { library } = useDefaultLibrary();
  const { narrators, narratorCount, isLoading, error, refetch } = useNarrators(
    library?.id || '',
    { sortBy, searchQuery }
  );

  if (isLoading) {
    return <LoadingSpinner text="Loading narrators..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load narrators" onRetry={refetch} />;
  }

  if (narratorCount === 0 && !searchQuery) {
    return (
      <EmptyState icon="🎙️" message="No narrators found" description="Your library doesn't have narrator information" />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search narrators..." autoFocus={false} />
        <FilterSortBar sortBy={sortBy} onSortChange={setSortBy} />
      </View>
      <FlatList
        data={narrators}
        renderItem={({ item }) => <NarratorCard narrator={item} />}
        keyExtractor={(item: NarratorInfo) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
        ListEmptyComponent={<EmptyState icon="🔍" message="No narrators found" description={`No narrators match "${searchQuery}"`} />}
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