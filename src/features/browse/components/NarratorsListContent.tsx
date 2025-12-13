import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { NarratorCard } from '@/features/narrator';
import { useNarrators, NarratorInfo } from '@/features/narrator';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { SearchBar } from '@/features/search/components/SearchBar';
import { LoadingSpinner, EmptyState, ErrorView } from '@/shared/components';
import { colors, spacing } from '@/shared/theme';

export function NarratorsListContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const { library, isLoading: isLoadingLibrary } = useDefaultLibrary();
  const { narrators, narratorCount, isLoading, error, refetch } = useNarrators(
    library?.id || '',
    { sortBy: 'name-asc', searchQuery }
  );

  if (isLoadingLibrary || isLoading) {
    return <LoadingSpinner text="Loading narrators..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load narrators" onRetry={refetch} />;
  }

  if (narratorCount === 0 && !searchQuery) {
    return (
      <EmptyState
        icon="🎙️"
        message="No narrators found"
        description="Your library doesn't have any narrators"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search narrators..."
          autoFocus={false}
        />
      </View>

      <FlatList
        data={narrators}
        renderItem={({ item }) => <NarratorCard narrator={item} />}
        keyExtractor={(item: NarratorInfo) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
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
            message="No narrators found"
            description={`No narrators match "${searchQuery}"`}
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
  row: {
    justifyContent: 'space-between',
  },
});