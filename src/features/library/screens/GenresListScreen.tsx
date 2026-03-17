/**
 * src/features/library/screens/GenresListScreen.tsx
 *
 * Genres list matching AllBooksScreen design:
 * - Skull logo TopNav with sort pill + back pill + search circle button
 * - JetBrainsMono uppercase count label
 * - Flat sorted FlatList with Playfair names and JetBrainsMono metadata
 * - Sort dropdown modal (Name, Book Count)
 * - AlphabetScrubber for Name sort
 * - No avatar — just genre name + book count
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { InteractionManager } from 'react-native';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Pressable,
  Modal,
  ViewStyle,
  TextStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache } from '@/core/cache';
import { SkullRefreshControl, TopNav, TopNavBackIcon, TopNavSearchIcon, AlphabetScrubber, ScreenLoadingOverlay } from '@/shared/components';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useTheme } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { MIN_BOOKS_TO_SHOW } from '../constants/genreCategories';

const PADDING = 16;

// Sort types
type SortType = 'name' | 'bookCount';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortType; label: string; defaultDir: SortDirection }[] = [
  { key: 'name', label: 'Name', defaultDir: 'asc' },
  { key: 'bookCount', label: 'Book Count', defaultDir: 'desc' },
];

// Sort arrow icon
const SortArrow = ({ color = '#000', direction = 'desc' }: { color?: string; direction?: 'asc' | 'desc' }) => (
  <Svg
    width={10}
    height={10}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={3}
    style={direction === 'asc' ? { transform: [{ rotate: '180deg' }] } : undefined}
  >
    <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

interface GenreItem {
  name: string;
  bookCount: number;
}

// List item component
const ListGenreItem = React.memo(function ListGenreItem({
  item,
  onPress,
  isDark,
}: {
  item: GenreItem;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, isDark ? styles.rowDark : styles.rowLight]}
      onPress={onPress}
    >
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemName, isDark && styles.itemNameDark]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={styles.itemMeta}>
          {item.bookCount} {item.bookCount === 1 ? 'book' : 'books'}
        </Text>
      </View>
    </Pressable>
  );
});

export function GenresListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [sortBy, setSortBy] = useState<SortType>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string | undefined>(undefined);

  const { refreshCache } = useLibraryCache();
  const genresWithBooks = useLibraryCache((s) => s.genresWithBooks);

  // Current sort label for the pill
  const currentSortLabel = useMemo(() => {
    const option = SORT_OPTIONS.find(o => o.key === sortBy);
    return option?.label || 'Sort';
  }, [sortBy]);

  // Wait for navigation animation
  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => {
      setMounted(true);
      globalLoading.hide();
    });
    return () => interaction.cancel();
  }, []);

  // Build genre list from cache
  const genresData = useMemo((): GenreItem[] => {
    if (!genresWithBooks || genresWithBooks.size === 0) return [];

    return Array.from(genresWithBooks.values())
      .filter(g => g.bookCount >= MIN_BOOKS_TO_SHOW)
      .map(genreInfo => ({
        name: genreInfo.name,
        bookCount: genreInfo.bookCount,
      }));
  }, [genresWithBooks]);

  // Sort genres
  const sortedGenres = useMemo(() => {
    if (!genresData.length) return [];

    const sorted = [...genresData];
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => direction * a.name.localeCompare(b.name));
        break;
      case 'bookCount':
        sorted.sort((a, b) => direction * (b.bookCount - a.bookCount));
        break;
    }

    return sorted;
  }, [genresData, sortBy, sortDirection]);

  // Alphabet letters for scrubber (Name sort only)
  const isAlphabeticSort = sortBy === 'name';
  const { letters: alphabetLetters, letterIndexMap } = useMemo(() => {
    if (!isAlphabeticSort) {
      return { letters: [], letterIndexMap: new Map<string, number>() };
    }

    const lettersSet = new Set<string>();
    const indexMap = new Map<string, number>();

    sortedGenres.forEach((item, index) => {
      const firstChar = (item.name || '').charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        if (!lettersSet.has(firstChar)) {
          lettersSet.add(firstChar);
          indexMap.set(firstChar, index);
        }
      }
    });

    return {
      letters: Array.from(lettersSet).sort(),
      letterIndexMap: indexMap,
    };
  }, [sortedGenres, isAlphabeticSort]);

  // Handlers
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

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleGenrePress = useCallback((genreName: string) => {
    navigation.navigate('GenreDetail', { genreName });
  }, [navigation]);

  const handleSortPillPress = useCallback(() => {
    setShowSortDropdown(true);
  }, []);

  const handleSortSelect = useCallback((key: SortType) => {
    if (sortBy === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      const option = SORT_OPTIONS.find(o => o.key === key);
      setSortDirection(option?.defaultDir || 'desc');
      if (key !== 'name') {
        setActiveLetter(undefined);
      }
    }
    setShowSortDropdown(false);
  }, [sortBy]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshCache();
    setIsRefreshing(false);
  }, [refreshCache]);

  // Estimated row height: paddingVertical (24) + text (~40) + border (1)
  const ESTIMATED_ITEM_HEIGHT = 65;

  const handleLetterSelect = useCallback((letter: string) => {
    setActiveLetter(letter);
    const index = letterIndexMap.get(letter);
    if (index !== undefined) {
      flatListRef.current?.scrollToOffset({
        offset: index * ESTIMATED_ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [letterIndexMap]);

  // Track active letter from scroll position
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isAlphabeticSort) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const currentIndex = Math.floor(offsetY / ESTIMATED_ITEM_HEIGHT);
    if (currentIndex >= 0 && currentIndex < sortedGenres.length) {
      const item = sortedGenres[currentIndex];
      const firstChar = (item.name || '').charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar) && firstChar !== activeLetter) {
        setActiveLetter(firstChar);
      }
    }
  }, [isAlphabeticSort, sortedGenres, activeLetter]);

  const renderItem = useCallback(({ item }: { item: GenreItem }) => (
    <ListGenreItem
      item={item}
      onPress={() => handleGenrePress(item.name)}
      isDark={isDark}
    />
  ), [handleGenrePress, isDark]);

  const keyExtractor = useCallback((item: GenreItem) => item.name, []);

  // Icon colors for TopNav
  const iconColor = isDark ? secretLibraryColors.white : secretLibraryColors.black;
  const sortPillIconColor = showSortDropdown
    ? (isDark ? secretLibraryColors.black : secretLibraryColors.white)
    : iconColor;

  return (
    <View style={[styles.container, { backgroundColor: secretLibraryColors.black }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={secretLibraryColors.black} />

      <ScreenLoadingOverlay visible={!mounted} />

      <TopNav
        variant={isDark ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: secretLibraryColors.black }}
        circleButtons={[
          {
            key: 'search',
            icon: <TopNavSearchIcon color={iconColor} size={16} />,
            onPress: handleSearchPress,
          },
        ]}
        pills={[
          {
            key: 'sort',
            icon: <SortArrow color={sortPillIconColor} direction={sortDirection} />,
            label: currentSortLabel,
            onPress: handleSortPillPress,
            active: showSortDropdown,
          },
          {
            key: 'back',
            label: '',
            icon: <TopNavBackIcon color={iconColor} size={16} />,
            onPress: handleBack,
          },
        ]}
      />

      {/* Genre count */}
      <View style={styles.countBar}>
        <Text style={[styles.resultCount, { color: colors.text.secondary }]}>
          {sortedGenres.length} genres
        </Text>
      </View>

      {/* Genre List */}
      <View style={styles.listContainer}>
        <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
          <FlatList
            ref={flatListRef}
            data={mounted ? sortedGenres : []}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[styles.list, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={7}
          />
        </SkullRefreshControl>

        {alphabetLetters.length > 0 && (
          <AlphabetScrubber
            letters={alphabetLetters}
            activeLetter={activeLetter}
            onLetterSelect={handleLetterSelect}
          />
        )}
      </View>

      {/* Sort Dropdown Modal */}
      <Modal
        visible={showSortDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: isDark ? '#1a1a1a' : secretLibraryColors.white }]}>
            {SORT_OPTIONS.map((option) => {
              const isActive = sortBy === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.dropdownItem}
                  onPress={() => handleSortSelect(option.key)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      { color: isDark ? secretLibraryColors.white : secretLibraryColors.black },
                      isActive && styles.dropdownItemTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isActive && (
                    <Text style={styles.dropdownCheck}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  countBar: {
    paddingHorizontal: PADDING,
    paddingBottom: 8,
  },
  resultCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  list: {
    paddingHorizontal: PADDING,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  rowLight: {
    backgroundColor: secretLibraryColors.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  rowDark: {
    backgroundColor: secretLibraryColors.black,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(16),
    color: secretLibraryColors.black,
    lineHeight: scale(20),
    marginBottom: 2,
  },
  itemNameDark: {
    color: secretLibraryColors.white,
  },
  itemMeta: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: secretLibraryColors.gray,
  },

  // Sort dropdown modal
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  dropdownMenu: {
    width: 260,
    maxHeight: 420,
    borderRadius: 12,
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  } as ViewStyle,
  dropdownItemText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  } as TextStyle,
  dropdownItemTextActive: {
    fontFamily: secretLibraryFonts.jetbrainsMono.bold,
  } as TextStyle,
  dropdownCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F3B60C',
  } as TextStyle,
});

export default GenresListScreen;
