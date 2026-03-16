/**
 * src/features/browse/screens/CollectionsListScreen.tsx
 *
 * Full collections list screen with 2-column grid layout.
 * Dark theme with square collection cards.
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, FlatList, Text, TextInput, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Folder } from 'lucide-react-native';
import { useCollections } from '@/features/collections';
import { CollectionSquareCard } from '../components/CollectionSquareCard';
import { TopNav, TopNavBackIcon, ScreenLoadingOverlay, SkullRefreshControl } from '@/shared/components';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import { scale, spacing } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { Collection } from '@/core/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 24;
const CARD_GAP = 12;
const CARD_SIZE = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

export function CollectionsListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { collections, isLoading, refetch } = useCollections();

  // Filter collections by search query
  const filteredCollections = searchQuery
    ? collections.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : collections;

  // Mark as mounted after first render and hide global loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      globalLoading.hide();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation]);

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  const handleCollectionPress = useCallback((collectionId: string) => {
    navigation.navigate('CollectionDetail', { collectionId });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }: { item: Collection; index: number }) => {
    const isLeftColumn = index % 2 === 0;
    return (
      <View style={[styles.cardWrapper, isLeftColumn ? styles.leftCard : styles.rightCard]}>
        <CollectionSquareCard
          collection={item}
          size={CARD_SIZE}
          onPress={() => handleCollectionPress(item.id)}
        />
      </View>
    );
  }, [handleCollectionPress]);

  const keyExtractor = useCallback((item: Collection) => item.id, []);

  const renderHeader = useCallback(() => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search collections..."
          placeholderTextColor={secretLibraryColors.gray}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
    </View>
  ), [searchQuery]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    if (searchQuery && filteredCollections.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No collections match "{searchQuery}"</Text>
        </View>
      );
    }

    if (collections.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Folder size={scale(48)} color={secretLibraryColors.gray} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No collections yet</Text>
          <Text style={styles.emptySubtitle}>
            Create collections in AudiobookShelf to organize your books
          </Text>
        </View>
      );
    }

    return null;
  }, [isLoading, searchQuery, filteredCollections.length, collections.length]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={secretLibraryColors.black} />

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* TopNav with skull logo */}
      <TopNav
        variant="dark"
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={styles.topNav}
        pills={[
          {
            key: 'collections',
            label: 'Collections',
            icon: <Folder size={13} color={secretLibraryColors.white} />,
          },
        ]}
        circleButtons={[
          {
            key: 'back',
            icon: <TopNavBackIcon color={secretLibraryColors.white} size={16} />,
            onPress: handleBack,
          },
        ]}
      />

      {/* Collections grid */}
      <SkullRefreshControl refreshing={isLoading} onRefresh={refetch}>
        <FlatList
          data={filteredCollections}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
        />
      </SkullRefreshControl>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: secretLibraryColors.black,
  },
  topNav: {
    backgroundColor: secretLibraryColors.black,
  },
  searchContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  searchInputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(14),
    color: secretLibraryColors.white,
    paddingVertical: spacing.md,
    minHeight: scale(44),
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  cardWrapper: {
    width: CARD_SIZE,
  },
  leftCard: {
    // Left column
  },
  rightCard: {
    // Right column
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: scale(60),
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(18),
    fontWeight: '600',
    color: secretLibraryColors.white,
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: secretLibraryColors.gray,
    textAlign: 'center',
    lineHeight: scale(18),
  },
  emptyText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(14),
    color: secretLibraryColors.gray,
    textAlign: 'center',
  },
});
