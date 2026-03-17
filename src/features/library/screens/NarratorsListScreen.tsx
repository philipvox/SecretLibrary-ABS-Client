/**
 * src/features/library/screens/NarratorsListScreen.tsx
 *
 * Narrators list matching AllBooksScreen design:
 * - Skull logo TopNav with sort pill + back pill + search circle button
 * - JetBrainsMono uppercase count label
 * - Flat sorted FlatList with Playfair names and JetBrainsMono metadata
 * - Sort dropdown modal (Name, Book Count)
 * - AlphabetScrubber for Name sort
 * - Narrators always use initials (no images)
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

const PADDING = 16;

// Avatar color generator based on name
const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

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

interface NarratorItem {
  name: string;
  bookCount: number;
  primaryGenre: string | null;
}

// List item component
const ListNarratorItem = React.memo(function ListNarratorItem({
  item,
  onPress,
  isDark,
}: {
  item: NarratorItem;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, isDark ? styles.rowDark : styles.rowLight]}
      onPress={onPress}
    >
      {/* Avatar - always initials */}
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>

      {/* Info */}
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemName, isDark && styles.itemNameDark]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={styles.itemMeta}>
          {item.bookCount} {item.bookCount === 1 ? 'book' : 'books'}{item.primaryGenre ? ` · ${item.primaryGenre}` : ''}
        </Text>
      </View>
    </Pressable>
  );
});

export function NarratorsListScreen() {
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
  const narratorsMap = useLibraryCache((s) => s.narrators);

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

  // Build narrator list with primary genre
  const narratorsWithData = useMemo((): NarratorItem[] => {
    if (!narratorsMap || narratorsMap.size === 0) return [];

    return Array.from(narratorsMap.values()).map(narrator => {
      const genreCounts = new Map<string, number>();
      narrator.books?.forEach(book => {
        const genres = (book.media?.metadata as any)?.genres || [];
        genres.forEach((genre: string) => {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        });
      });
      const primaryGenre = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      return {
        name: narrator.name,
        bookCount: narrator.bookCount,
        primaryGenre,
      };
    });
  }, [narratorsMap]);

  // Sort narrators
  const sortedNarrators = useMemo(() => {
    if (!narratorsWithData.length) return [];

    const sorted = [...narratorsWithData];
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
  }, [narratorsWithData, sortBy, sortDirection]);

  // Alphabet letters for scrubber (Name sort only)
  const isAlphabeticSort = sortBy === 'name';
  const { letters: alphabetLetters, letterIndexMap } = useMemo(() => {
    if (!isAlphabeticSort) {
      return { letters: [], letterIndexMap: new Map<string, number>() };
    }

    const lettersSet = new Set<string>();
    const indexMap = new Map<string, number>();

    sortedNarrators.forEach((item, index) => {
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
  }, [sortedNarrators, isAlphabeticSort]);

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

  const handleNarratorPress = useCallback((narratorName: string) => {
    navigation.navigate('NarratorDetail', { narratorName });
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

  // Estimated row height: avatar (48) + vertical padding (24) + border (1)
  const ESTIMATED_ITEM_HEIGHT = 73;

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
    if (currentIndex >= 0 && currentIndex < sortedNarrators.length) {
      const item = sortedNarrators[currentIndex];
      const firstChar = (item.name || '').charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar) && firstChar !== activeLetter) {
        setActiveLetter(firstChar);
      }
    }
  }, [isAlphabeticSort, sortedNarrators, activeLetter]);

  const renderItem = useCallback(({ item }: { item: NarratorItem }) => (
    <ListNarratorItem
      item={item}
      onPress={() => handleNarratorPress(item.name)}
      isDark={isDark}
    />
  ), [handleNarratorPress, isDark]);

  const keyExtractor = useCallback((item: NarratorItem) => item.name, []);

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

      {/* Narrator count */}
      <View style={styles.countBar}>
        <Text style={[styles.resultCount, { color: colors.text.secondary }]}>
          {sortedNarrators.length} narrators
        </Text>
      </View>

      {/* Narrator List */}
      <View style={styles.listContainer}>
        <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
          <FlatList
            ref={flatListRef}
            data={mounted ? sortedNarrators : []}
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
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

export default NarratorsListScreen;
