/**
 * src/features/user/components/AddToCollectionButton.tsx
 *
 * Button that opens a modal to add an item to a collection.
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Modal,
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCollections } from '@/features/collections/hooks/useCollections';
import {
  useAddToCollection,
  useRemoveFromCollection,
} from '../hooks/useCollectionMutations';
import { theme } from '@/shared/theme';
import { Collection } from '@/core/types';

interface AddToCollectionButtonProps {
  itemId: string;
  size?: number;
  color?: string;
}

export function AddToCollectionButton({
  itemId,
  size = 24,
  color = 'rgba(255, 255, 255, 0.6)',
}: AddToCollectionButtonProps) {
  const [isModalVisible, setModalVisible] = useState(false);
  const { collections, isLoading } = useCollections();
  const { mutate: addToCollection, isPending: isAdding } = useAddToCollection();
  const { mutate: removeFromCollection, isPending: isRemoving } = useRemoveFromCollection();

  const isInCollection = (collection: Collection) => {
    return collection.books?.some((b: any) => b.id === itemId || b === itemId);
  };

  const handleToggleCollection = (collection: Collection) => {
    if (isInCollection(collection)) {
      removeFromCollection({ collectionId: collection.id, itemId });
    } else {
      addToCollection({ collectionId: collection.id, itemId });
    }
  };

  const renderCollectionItem = ({ item }: { item: Collection }) => {
    const inCollection = isInCollection(item);
    const bookCount = item.books?.length || 0;

    return (
      <TouchableOpacity
        style={[styles.collectionItem, inCollection && styles.collectionItemActive]}
        onPress={() => handleToggleCollection(item)}
        disabled={isAdding || isRemoving}
      >
        <View style={styles.collectionInfo}>
          <Text style={styles.collectionName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemCount}>
            {bookCount} {bookCount === 1 ? 'book' : 'books'}
          </Text>
        </View>
        <View style={styles.checkContainer}>
          {inCollection ? (
            <Feather name="check" size={20} color={theme.colors.accent.primary} />
          ) : (
            <Feather name="plus" size={20} color={theme.colors.text.secondary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="folder-plus" size={size} color={color} />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Collection</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              </View>
            ) : collections.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="folder-plus" size={48} color={theme.colors.text.secondary} />
                <Text style={styles.emptyText}>No collections yet</Text>
                <Text style={styles.emptySubtext}>
                  Create a collection on the server to organize your books
                </Text>
              </View>
            ) : (
              <FlatList
                data={collections}
                keyExtractor={(item) => item.id}
                renderItem={renderCollectionItem}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[800],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 200,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.neutral[900],
    borderRadius: 12,
    marginBottom: 8,
  },
  collectionItemActive: {
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.accent.primary,
  },
  collectionInfo: {
    flex: 1,
    marginRight: 12,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  itemCount: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  checkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.neutral[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
