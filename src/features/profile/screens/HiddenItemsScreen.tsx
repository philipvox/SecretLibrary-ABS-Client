/**
 * src/features/profile/screens/HiddenItemsScreen.tsx
 *
 * Secret Library Hidden Items Screen
 * Manage hidden/dismissed books from recommendations.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { CoverStars } from '@/shared/components/CoverStars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Undo2, Trash2, BookX, Info } from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { useDismissedItemsStore } from '@/features/recommendations/stores/dismissedItemsStore';
import { useLibraryCache, useCoverUrl } from '@/core/cache';
import { haptics } from '@/core/native/haptics';
import { SettingsHeader } from '../components/SettingsHeader';

// =============================================================================
// COMPONENTS
// =============================================================================

interface HiddenBookItemProps {
  bookId: string;
  onRestore: (id: string) => void;
}

function HiddenBookItem({ bookId, onRestore }: HiddenBookItemProps) {
  const colors = useSecretLibraryColors();
  const { items } = useLibraryCache();
  const coverUrl = useCoverUrl(bookId);
  const navigation = useNavigation<any>();

  // Find the book in library cache
  const book = useMemo(() => items.find((item) => item.id === bookId), [items, bookId]);
  const metadata = (book?.media?.metadata as any) || {};
  const title = metadata.title || 'Unknown Book';
  const author = metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author';

  const handlePress = useCallback(() => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation, bookId]);

  const handleRestore = useCallback(() => {
    haptics.selection();
    onRestore(bookId);
  }, [bookId, onRestore]);

  return (
    <TouchableOpacity
      style={[styles.bookItem, { borderBottomColor: colors.borderLight }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={{ width: scale(48), height: scale(48), overflow: 'hidden' }}>
        <Image
          source={coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <CoverStars bookId={bookId} starSize={scale(14)} />
      </View>
      <View style={styles.bookInfo}>
        <Text style={[styles.bookTitle, { color: colors.black }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.bookAuthor, { color: colors.gray }]} numberOfLines={1}>
          {author}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.restoreButton, { backgroundColor: colors.grayLight }]}
        onPress={handleRestore}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Undo2 size={scale(18)} color={colors.black} strokeWidth={2} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HiddenItemsScreen() {
  const insets = useSafeAreaInsets();
  const _navigation = useNavigation<any>();
  const colors = useSecretLibraryColors();

  const dismissedItems = useDismissedItemsStore((s) => s.dismissedItems);
  const undismissItem = useDismissedItemsStore((s) => s.undismissItem);
  const clearAllDismissals = useDismissedItemsStore((s) => s.clearAllDismissals);

  const dismissedIds = useMemo(() => Object.keys(dismissedItems), [dismissedItems]);
  const isEmpty = dismissedIds.length === 0;

  const handleRestore = useCallback(
    (id: string) => {
      undismissItem(id);
    },
    [undismissItem]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Restore All Books',
      'This will restore all hidden books back to your recommendations. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore All',
          onPress: () => {
            haptics.selection();
            clearAllDismissals();
          },
        },
      ]
    );
  }, [clearAllDismissals]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => <HiddenBookItem bookId={item} onRestore={handleRestore} />,
    [handleRestore]
  );

  const keyExtractor = useCallback((item: string) => item, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title="Hidden Books" />

      <View style={styles.content}>
        {/* Header with count and clear button */}
        {!isEmpty && (
          <View style={styles.headerRow}>
            <Text style={[styles.countText, { color: colors.gray }]}>
              {dismissedIds.length} hidden book{dismissedIds.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.white }]}
              onPress={handleClearAll}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={scale(16)} color={colors.gray} strokeWidth={2} />
              <Text style={[styles.clearButtonText, { color: colors.gray }]}>Restore All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Description */}
        <View style={[styles.descriptionCard, { backgroundColor: colors.white }]}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.descriptionText, { color: colors.gray }]}>
            These books won't appear in your recommendations. Tap the restore button to bring them
            back.
          </Text>
        </View>

        {isEmpty ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.white }]}>
              <BookX size={scale(48)} color={colors.gray} strokeWidth={1} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.black }]}>No Hidden Books</Text>
            <Text style={[styles.emptyText, { color: colors.gray }]}>
              Swipe left on any book card in the Browse tab to hide it from recommendations.
            </Text>
          </View>
        ) : (
          <View style={[styles.listCard, { backgroundColor: colors.white }]}>
            <FlatList
              data={dismissedIds}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
              ]}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  countText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  // Description
  descriptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    marginBottom: 16,
  },
  descriptionText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    flex: 1,
    lineHeight: scale(16),
  },
  // List Card
  listCard: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  // Book Item
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cover: {
    width: scale(48),
    height: scale(48),
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bookTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(14),
    marginBottom: 2,
  },
  bookAuthor: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  restoreButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: scale(96),
    height: scale(96),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(24),
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textAlign: 'center',
    lineHeight: scale(18),
  },
});
