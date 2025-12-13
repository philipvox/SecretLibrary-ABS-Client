import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthorCard } from '../components/AuthorCard';
import { useAuthors } from '../hooks/useAuthors';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { SearchBar } from '@/features/search/components/SearchBar';
import { FilterSortBar, SortOption, LoadingSpinner, EmptyState, ErrorView } from '@/shared/components';
import { AuthorInfo } from '../services/authorAdapter';
import { colors, spacing, radius } from '@/shared/theme';

export function AuthorListScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const { library, isLoading: isLoadingLibrary } = useDefaultLibrary();
  const { authors, authorCount, isLoading, error, refetch } = useAuthors(
    library?.id || '',
    { sortBy, searchQuery }
  );

  if (isLoadingLibrary || isLoading) {
    return <LoadingSpinner text="Loading authors..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load authors" onRetry={refetch} />;
  }

  if (authorCount === 0 && !searchQuery) {
    return (
      <EmptyState icon="👤" message="No authors found" description="Your library doesn't have any authors" />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search authors..." autoFocus={false} />
        <FilterSortBar sortBy={sortBy} onSortChange={setSortBy} />
      </View>
      <FlatList
        data={authors}
        renderItem={({ item }) => <AuthorCard author={item} />}
        keyExtractor={(item: AuthorInfo) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
        ListEmptyComponent={<EmptyState icon="🔍" message="No authors found" description={`No authors match "${searchQuery}"`} />}
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