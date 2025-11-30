/**
 * src/features/library/screens/MyLibraryScreen.tsx
 * 
 * User's library with:
 * - Grid of books with extracted color backgrounds
 * - Selection mode for removal
 * - Category cards row (Series, Authors, Narrators)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LibraryBookCard } from '../components/LibraryBookCard';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { useAllLibraryItems } from '@/features/search/hooks/useAllLibraryItems';
import { useDefaultLibrary } from '../hooks/useDefaultLibrary';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner, EmptyState } from '@/shared/components';
import { LibraryItem } from '@/core/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 5;
const NUM_COLUMNS = 3;
const HEADER_BG = '#303030';
const CATEGORY_CARD_WIDTH = (SCREEN_WIDTH - GAP * 4) / 2.5;
const CATEGORY_CARD_HEIGHT = CATEGORY_CARD_WIDTH * 0.7;

// Category card colors
const CATEGORY_COLORS = [
  { name: 'Series', color: '#FED132', textColor: '#000' },
  { name: 'Authors', color: '#9FDACC', textColor: '#000' },
  { name: 'Narrators', color: '#E94D59', textColor: '#FFF' },
];

interface CategoryCardProps {
  name: string;
  color: string;
  textColor: string;
  onPress: () => void;
}

function CategoryCard({ name, color, textColor, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity 
      style={[styles.categoryCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.categoryTitle, { color: textColor }]}>{name}</Text>
    </TouchableOpacity>
  );
}

export function MyLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
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

  const handleCategoryPress = (category: string) => {
    switch (category) {
      case 'Series':
        navigation.navigate('DiscoverTab', { screen: 'Series' });
        break;
      case 'Authors':
        navigation.navigate('DiscoverTab', { screen: 'Authors' });
        break;
      case 'Narrators':
        navigation.navigate('DiscoverTab', { screen: 'Narrators' });
        break;
    }
  };

  const renderItem = ({ item }: { item: LibraryItem }) => (
    <LibraryBookCard book={item} />
  );

  const renderHeader = () => (
    <View>
      {/* Title */}
      {!isSelecting && (
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Your Library</Text>
          <Text style={styles.headerSubtitle}>
            {libraryItems.length} {libraryItems.length === 1 ? 'book' : 'books'}
          </Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => (
    <View style={styles.categorySection}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORY_COLORS.map((cat) => (
          <CategoryCard
            key={cat.name}
            name={cat.name}
            color={cat.color}
            textColor={cat.textColor}
            onPress={() => handleCategoryPress(cat.name)}
          />
        ))}
      </ScrollView>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingSpinner text="Loading library..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
      
      {/* Selection Header */}
      {isSelecting && (
        <View style={[styles.selectionHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.selectionCount}>
            {selectedIds.length} selected
          </Text>
          
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.headerButton}>
              <Text style={styles.selectAllText}>
                {selectedIds.length === libraryItems.length ? 'None' : 'All'}
              </Text>
            </TouchableOpacity>
            
            {selectedIds.length > 0 && (
              <TouchableOpacity onPress={handleRemove} style={styles.headerButton}>
                <Icon name="trash-outline" size={22} color="#FF4444" set="ionicons" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {libraryItems.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
          <EmptyState
            message="Your library is empty"
            description="Add books from Browse to build your collection"
            icon="📚"
          />
          {renderFooter()}
        </View>
      ) : (
        <FlatList
          data={libraryItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[
            styles.listContent, 
            { paddingTop: isSelecting ? 10 : insets.top + 10 }
          ]}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEADER_BG,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: HEADER_BG,
  },
  headerButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 16,
    color: '#007AFF',
  },
  listContent: {
    paddingHorizontal: GAP,
    paddingBottom: 120,
  },
  columnWrapper: {
    gap: GAP,
  },
  headerSection: {
    paddingHorizontal: GAP,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  categorySection: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  categoryScroll: {
    paddingHorizontal: GAP,
    gap: GAP,
  },
  categoryCard: {
    width: CATEGORY_CARD_WIDTH,
    height: CATEGORY_CARD_HEIGHT,
    borderRadius: 5,
    padding: 14,
    justifyContent: 'flex-end',
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
});

export default MyLibraryScreen;