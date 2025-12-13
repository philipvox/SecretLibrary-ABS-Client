/**
 * src/features/collections/screens/CollectionsScreen.tsx
 *
 * Collections list screen with search, create collection FAB,
 * and enhanced visual design matching app theme.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCollections } from '../hooks/useCollections';
import { Collection } from '@/core/types';
import { apiClient } from '@/core/api';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, wp, spacing, radius } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

const BG_COLOR = colors.backgroundSecondary;
const CARD_COLOR = colors.cardBackground;
const ACCENT = colors.accent;
const CARD_WIDTH = (SCREEN_WIDTH - scale(48)) / 2;

// Format duration helper
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Enhanced collection card component
interface CollectionCardProps {
  collection: Collection;
  onPress: () => void;
}

function EnhancedCollectionCard({ collection, onPress }: CollectionCardProps) {
  const books = collection.books || [];
  const bookCount = books.length;

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return books.reduce((sum, book) => {
      return sum + ((book.media as any)?.duration || 0);
    }, 0);
  }, [books]);

  // Get cover URLs for stacked display (up to 3)
  const coverUrls = useMemo(() => {
    return books.slice(0, 3).map((book) => apiClient.getItemCoverUrl(book.id));
  }, [books]);

  return (
    <TouchableOpacity style={styles.collectionCard} onPress={onPress} activeOpacity={0.7}>
      {/* Stacked covers */}
      <View style={styles.coversContainer}>
        {coverUrls.length > 0 ? (
          coverUrls.map((url, index) => (
            <View
              key={index}
              style={[
                styles.coverWrapper,
                {
                  left: index * scale(12),
                  zIndex: 3 - index,
                  opacity: 1 - index * 0.15,
                },
              ]}
            >
              <Image source={url} style={styles.cover} contentFit="cover" />
            </View>
          ))
        ) : (
          <View style={styles.placeholderCover}>
            <Ionicons name="albums" size={scale(32)} color="rgba(255,255,255,0.3)" />
          </View>
        )}

        {/* Book count badge */}
        <View style={styles.countBadge}>
          <Ionicons name="book" size={scale(10)} color="#000" />
          <Text style={styles.countText}>{bookCount}</Text>
        </View>
      </View>

      {/* Collection info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>
          {collection.name}
        </Text>
        <Text style={styles.cardMeta}>
          {bookCount} book{bookCount !== 1 ? 's' : ''} • {formatDuration(totalDuration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function CollectionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');

  const { collections, isLoading, error, refetch } = useCollections();

  // Filter collections by search query
  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const lowerQuery = searchQuery.toLowerCase();
    return collections.filter((c) =>
      c.name.toLowerCase().includes(lowerQuery)
    );
  }, [collections, searchQuery]);

  // Calculate total stats
  const totalBooks = useMemo(() => {
    return collections.reduce((sum, c) => sum + (c.books?.length || 0), 0);
  }, [collections]);

  const handleCollectionPress = useCallback(
    (collectionId: string) => {
      navigation.navigate('CollectionDetail', { collectionId });
    },
    [navigation]
  );

  const handleCreatePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCreateModal(true);
  }, []);

  const handleCreateCollection = useCallback(() => {
    if (!newCollectionName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your collection.');
      return;
    }

    // TODO: Implement collection creation via API
    Alert.alert(
      'Coming Soon',
      'Collection creation will be available in a future update. For now, create collections in the AudiobookShelf web interface.'
    );
    setShowCreateModal(false);
    setNewCollectionName('');
    setNewCollectionDesc('');
  }, [newCollectionName, newCollectionDesc]);

  const renderCollectionCard = useCallback(
    ({ item }: { item: Collection }) => (
      <EnhancedCollectionCard
        collection={item}
        onPress={() => handleCollectionPress(item.id)}
      />
    ),
    [handleCollectionPress]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Collections</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreatePress}>
            <Ionicons name="add" size={scale(20)} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="albums" size={scale(16)} color={ACCENT} />
            <Text style={styles.statText}>
              {collections.length} collection{collections.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="book" size={scale(16)} color={ACCENT} />
            <Text style={styles.statText}>
              {totalBooks} book{totalBooks !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={scale(18)} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search collections..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={scale(18)} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Collections list */}
      {collections.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums" size={scale(48)} color="rgba(255,255,255,0.2)" />
          </View>
          <Text style={styles.emptyTitle}>No collections yet</Text>
          <Text style={styles.emptySubtitle}>
            Create collections to organize your audiobooks
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleCreatePress}>
            <Ionicons name="add" size={scale(18)} color="#000" />
            <Text style={styles.emptyButtonText}>Create Collection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCollections}
          renderItem={renderCollectionCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={ACCENT} />
          }
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={scale(48)} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptySubtitle}>No collections match "{searchQuery}"</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Create Collection Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Collection</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={scale(24)} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Collection name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Add a description..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newCollectionDesc}
                onChangeText={setNewCollectionDesc}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.createCollectionButton, !newCollectionName.trim() && styles.buttonDisabled]}
              onPress={handleCreateCollection}
              disabled={!newCollectionName.trim()}
            >
              <Ionicons name="add" size={scale(18)} color="#000" />
              <Text style={styles.createCollectionButtonText}>Create Collection</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  header: {
    paddingHorizontal: scale(16),
    paddingBottom: scale(16),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  headerTitle: {
    fontSize: scale(28),
    fontWeight: '700',
    color: '#fff',
  },
  createButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  statText: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.6)',
  },
  statDivider: {
    width: 1,
    height: scale(12),
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: scale(12),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    height: scale(40),
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: scale(15),
    marginLeft: scale(8),
    paddingVertical: 0,
  },
  // Collection Cards
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
  },
  listContent: {
    paddingTop: scale(8),
  },
  collectionCard: {
    width: CARD_WIDTH,
    marginBottom: scale(20),
  },
  coversContainer: {
    height: CARD_WIDTH * 1.1,
    position: 'relative',
    marginBottom: scale(10),
  },
  coverWrapper: {
    position: 'absolute',
    top: 0,
    width: CARD_WIDTH - scale(24),
    height: CARD_WIDTH * 1.05,
    borderRadius: scale(8),
    overflow: 'hidden',
    backgroundColor: '#262626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    width: CARD_WIDTH - scale(24),
    height: CARD_WIDTH * 1.05,
    borderRadius: scale(8),
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadge: {
    position: 'absolute',
    bottom: scale(8),
    right: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: ACCENT,
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(10),
  },
  countText: {
    fontSize: scale(11),
    fontWeight: '700',
    color: '#000',
  },
  cardInfo: {
    paddingHorizontal: scale(4),
  },
  cardName: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(2),
    lineHeight: scale(18),
  },
  cardMeta: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(40),
  },
  emptyIcon: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  emptyTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: scale(24),
    lineHeight: scale(20),
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: ACCENT,
    paddingHorizontal: scale(20),
    paddingVertical: scale(12),
    borderRadius: scale(24),
  },
  emptyButtonText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#000',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
  },
  modalContent: {
    backgroundColor: '#262626',
    borderRadius: scale(16),
    padding: scale(20),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  modalTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#fff',
  },
  inputGroup: {
    marginBottom: scale(16),
  },
  inputLabel: {
    fontSize: scale(13),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: scale(8),
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(10),
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    fontSize: scale(15),
    color: '#fff',
  },
  textAreaInput: {
    height: scale(80),
    textAlignVertical: 'top',
  },
  createCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: ACCENT,
    paddingVertical: scale(14),
    borderRadius: scale(12),
    marginTop: scale(8),
  },
  createCollectionButtonText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#000',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
