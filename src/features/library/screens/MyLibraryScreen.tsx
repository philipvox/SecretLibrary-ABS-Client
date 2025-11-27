/**
 * src/features/library/screens/MyLibraryScreen.tsx
 * 
 * User's personal library with selection and removal
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopNavBar } from '@/navigation/components/TopNavBar';
import { LibraryBookCard } from '../components/LibraryBookCard';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { useAllLibraryItems } from '@/features/search/hooks/useAllLibraryItems';
import { useDefaultLibrary } from '../hooks/useDefaultLibrary';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner, EmptyState } from '@/shared/components';
import { LibraryItem } from '@/core/types';
import { theme } from '@/shared/theme';

const NUM_COLUMNS = 3;

export function MyLibraryScreen() {
  const insets = useSafeAreaInsets();
  const { library } = useDefaultLibrary();
  const { items: allItems, isLoading } = useAllLibraryItems(library?.id || '');
  
  const {
    libraryIds,
    isSelecting,
    selectedIds,
    stopSelecting,
    selectAll,
    clearSelection,
    removeMultiple,
  } = useMyLibraryStore();

  // Filter to only show books in user's library
  const libraryItems = useMemo(() => {
    return allItems.filter(item => libraryIds.includes(item.id));
  }, [allItems, libraryIds]);

  const handleSelectAll = () => {
    if (selectedIds.length === libraryItems.length) {
      clearSelection();
    } else {
      selectAll(libraryItems.map(item => item.id));
    }
  };

  const handleRemove = () => {
    if (selectedIds.length === 0) return;
    
    Alert.alert(
      'Remove from Library',
      `Remove ${selectedIds.length} ${selectedIds.length === 1 ? 'book' : 'books'} from your library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeMultiple(selectedIds),
        },
      ]
    );
  };

  const handleCancel = () => {
    stopSelecting();
  };

  const renderItem = ({ item }: { item: LibraryItem }) => (
    <LibraryBookCard book={item} />
  );

  if (isLoading) {
    return <LoadingSpinner text="Loading library..." />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      
      <View style={{ paddingTop: insets.top }}>
        {isSelecting ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <Text style={styles.selectionCount}>
              {selectedIds.length} selected
            </Text>
            
            <TouchableOpacity onPress={handleSelectAll} style={styles.headerButton}>
              <Text style={styles.selectAllText}>
                {selectedIds.length === libraryItems.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TopNavBar />
        )}
      </View>

      {/* Header */}
      {!isSelecting && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Library</Text>
          <Text style={styles.headerSubtitle}>
            {libraryItems.length} {libraryItems.length === 1 ? 'book' : 'books'}
          </Text>
        </View>
      )}

      {libraryItems.length === 0 ? (
        <EmptyState
          icon="📚"
          message="Your library is empty"
          description="Add books from Browse or Search to build your collection"
        />
      ) : (
        <FlatList
          data={libraryItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Selection footer */}
      {isSelecting && selectedIds.length > 0 && (
        <View style={[styles.selectionFooter, { paddingBottom: insets.bottom + 100 }]}>
          <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
            <Icon name="trash-outline" size={20} color="#FFFFFF" set="ionicons" />
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  headerButton: {
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  selectAllText: {
    fontSize: 14,
    color: theme.colors.primary[500],
    fontWeight: '500',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  header: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[4],
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: 120,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  selectionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: theme.radius.medium,
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[2],
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});