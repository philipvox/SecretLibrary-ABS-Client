/**
 * src/features/library/screens/AuthorsListScreen.tsx
 *
 * Redesigned Author Browse page matching GenresListScreen pattern:
 * - View mode toggle (grouped vs flat A-Z)
 * - Your Authors section (personalized from listening history)
 * - Popular Authors section (top by book count)
 * - Browse by Category (grouped by primary genre)
 * - Collapsible meta-category sections
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache } from '@/core/cache';
import { useContinueListening } from '@/shared/hooks/useContinueListening';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { AlphabetScrubber, SkullRefreshControl, TopNav, TopNavBackIcon, UserIcon, ScreenLoadingOverlay } from '@/shared/components';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { spacing, radius, useTheme, scale } from '@/shared/theme';
import {
  META_CATEGORIES,
  MetaCategory,
  getMetaCategoryForGenre,
} from '../constants/genreCategories';
import {
  PersonWithData,
  YourPersonsSection,
  PopularPersonsSection,
  MetaCategoryPersonSection,
} from '../components/PersonSections';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';

type ViewMode = 'grouped' | 'flat';

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

export function AuthorsListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const accent = colors.accent.primary;
  const sectionListRef = useRef<SectionList>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mark as mounted after first render and hide global loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      globalLoading.hide();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const { refreshCache, isLoaded } = useLibraryCache();
  const authorsMap = useLibraryCache((s) => s.authors);
  const { items: inProgressItems } = useContinueListening();

  // Get all authors with genre info and meta-category (from pre-indexed cache)
  const authorsWithData = useMemo((): PersonWithData[] => {
    if (!authorsMap || authorsMap.size === 0) return [];

    return Array.from(authorsMap.values()).map(author => {
      // Count genres across all books (books already indexed in cache)
      const genreCounts = new Map<string, number>();
      const sampleBookIds: string[] = [];

      author.books?.forEach(book => {
        if (sampleBookIds.length < 3) {
          sampleBookIds.push(book.id);
        }
        const genres = (book.media?.metadata as any)?.genres || [];
        genres.forEach((genre: string) => {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        });
      });

      // Find primary genre (most common)
      const primaryGenre = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Map to meta-category
      const metaCategory = primaryGenre ? getMetaCategoryForGenre(primaryGenre) : null;

      return {
        id: author.id,
        name: author.name,
        bookCount: author.bookCount,
        imagePath: author.imagePath,
        primaryGenre,
        metaCategoryId: metaCategory?.id || null,
        sampleBookIds,
        books: author.books, // Keep reference for yourAuthors lookup
      };
    });
  }, [authorsMap]);

  // Filter by search query
  const filteredAuthors = useMemo(() => {
    if (!searchQuery.trim()) return authorsWithData;
    const lowerQuery = searchQuery.toLowerCase();
    return authorsWithData.filter(a => a.name.toLowerCase().includes(lowerQuery));
  }, [authorsWithData, searchQuery]);

  // Get "Your Authors" - authors from books user is listening to
  const yourAuthors = useMemo((): PersonWithData[] => {
    const listenedBookIds = new Set(inProgressItems.map(item => item.id));
    if (listenedBookIds.size === 0) return [];

    const authorCounts = new Map<string, number>();
    authorsWithData.forEach(author => {
      // Use pre-indexed books from cache instead of filterItems
      const listenedCount = (author.books || []).filter(b => listenedBookIds.has(b.id)).length;
      if (listenedCount > 0) {
        authorCounts.set(author.name, listenedCount);
      }
    });

    return authorsWithData
      .filter(a => authorCounts.has(a.name))
      .sort((a, b) => (authorCounts.get(b.name) || 0) - (authorCounts.get(a.name) || 0))
      .slice(0, 5);
  }, [authorsWithData, inProgressItems]);

  // Get popular authors (top 6 by book count)
  const popularAuthors = useMemo((): PersonWithData[] => {
    return [...filteredAuthors]
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, 6);
  }, [filteredAuthors]);

  // Group authors by meta-category
  const authorsByCategory = useMemo(() => {
    const grouped = new Map<MetaCategory, PersonWithData[]>();

    // Initialize all categories
    META_CATEGORIES.forEach(cat => grouped.set(cat, []));

    // Assign authors
    filteredAuthors.forEach(author => {
      const category = META_CATEGORIES.find(c => c.id === author.metaCategoryId);
      if (category) {
        const existing = grouped.get(category) || [];
        existing.push(author);
        grouped.set(category, existing);
      } else {
        // Fallback to Fiction
        const fiction = META_CATEGORIES[0];
        const existing = grouped.get(fiction) || [];
        existing.push(author);
        grouped.set(fiction, existing);
      }
    });

    // Sort authors within each category by book count
    grouped.forEach((authors, category) => {
      authors.sort((a, b) => b.bookCount - a.bookCount);
    });

    return grouped;
  }, [filteredAuthors]);

  // Get total books per category
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    authorsByCategory.forEach((authors, category) => {
      totals.set(category.id, authors.reduce((sum, a) => sum + a.bookCount, 0));
    });
    return totals;
  }, [authorsByCategory]);

  // Flat list sections (A-Z) for SectionList
  const flatSections = useMemo(() => {
    const sorted = [...filteredAuthors].sort((a, b) => a.name.localeCompare(b.name));
    const sections: { title: string; data: PersonWithData[] }[] = [];

    sorted.forEach(author => {
      const letter = author.name[0].toUpperCase();
      const existing = sections.find(s => s.title === letter);
      if (existing) {
        existing.data.push(author);
      } else {
        sections.push({ title: letter, data: [author] });
      }
    });

    return sections;
  }, [filteredAuthors]);

  // Available letters for alphabet index
  const availableLetters = useMemo(() => {
    return flatSections.map(s => s.title);
  }, [flatSections]);

  // Handle alphabet letter press - scroll to section
  const handleLetterPress = useCallback((letter: string) => {
    const sectionIndex = flatSections.findIndex(s => s.title === letter);
    if (sectionIndex >= 0 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewPosition: 0,
      });
    }
  }, [flatSections]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  const handleAuthorPress = (authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  };

  const handleToggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  const isSearching = searchQuery.trim().length > 0;

  if (!isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background.primary} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Render author list item for flat view
  const renderAuthorItem = ({ item }: { item: PersonWithData }) => (
    <TouchableOpacity
      style={styles.authorRow}
      onPress={() => handleAuthorPress(item.name)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
        {item.id && item.imagePath ? (
          <Image
            source={apiClient.getAuthorImageUrl(item.id)}
            style={styles.avatarImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.authorInfo}>
        <Text style={[styles.authorName, { color: colors.text.primary }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.bookCount, { color: colors.text.secondary }]}>{item.bookCount} books in library</Text>
      </View>
    </TouchableOpacity>
  );

  // Render grouped view
  const renderGroupedView = () => (
    <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Your Authors Section */}
        {!isSearching && yourAuthors.length > 0 && (
          <YourPersonsSection
            persons={yourAuthors}
            onPersonPress={handleAuthorPress}
            type="author"
          />
        )}

        {/* Popular Authors Section */}
        {!isSearching && (
          <PopularPersonsSection
            persons={popularAuthors}
            onPersonPress={handleAuthorPress}
            type="author"
          />
        )}

        {/* Browse by Category Header */}
        {!isSearching && (
          <View style={styles.browseHeader}>
            <Text style={[styles.browseTitle, { color: colors.text.secondary }]}>Browse by Category</Text>
          </View>
        )}

        {/* Meta-Category Sections */}
        {META_CATEGORIES.map(category => {
          const authors = authorsByCategory.get(category) || [];
          if (authors.length === 0) return null;

          return (
            <MetaCategoryPersonSection
              key={category.id}
              metaCategory={category}
              persons={authors}
              totalBooks={categoryTotals.get(category.id) || 0}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => handleToggleCategory(category.id)}
              onPersonPress={handleAuthorPress}
              type="author"
              label={`${category.name} Authors`}
            />
          );
        })}

        {/* Empty State */}
        {filteredAuthors.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="Search" size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyText, { color: colors.text.primary }]}>No authors found</Text>
            <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>Try a different search term</Text>
          </View>
        )}
      </ScrollView>
    </SkullRefreshControl>
  );

  // Render flat A-Z view with SectionList
  const renderFlatView = () => (
    <View style={styles.flatContainer}>
      <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
        <SectionList
          ref={sectionListRef}
          sections={flatSections}
          keyExtractor={(item) => item.name}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom, paddingRight: 28 }}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background.primary }]}>
              <Text style={[styles.sectionHeaderText, { color: accent }]}>{section.title}</Text>
            </View>
          )}
          renderItem={renderAuthorItem}
          onScrollToIndexFailed={() => {}}
          getItemLayout={(data, index) => ({
            length: 72,
            offset: 72 * index,
            index,
          })}
        />
      </SkullRefreshControl>

      {/* Custom Alphabet Index */}
      {availableLetters.length > 1 && (
        <View style={[styles.alphabetIndex, { bottom: SCREEN_BOTTOM_PADDING + insets.bottom + 60 }]}>
          {availableLetters.map((letter) => (
            <TouchableOpacity
              key={letter}
              style={styles.alphabetLetterButton}
              onPress={() => handleLetterPress(letter)}
            >
              <Text style={[styles.alphabetLetter, { color: accent }]}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background.primary} />

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* TopNav with skull logo and integrated search bar */}
      <TopNav
        variant={isDark ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: colors.background.primary }}
        pills={[
          {
            key: 'authors',
            label: 'Authors',
            icon: <UserIcon size={10} color={colors.text.primary} />,
          },
        ]}
        circleButtons={[
          {
            key: 'back',
            icon: <TopNavBackIcon color={colors.text.primary} size={14} />,
            onPress: handleBack,
          },
        ]}
        searchBar={{
          value: searchQuery,
          onChangeText: setSearchQuery,
          placeholder: 'Search authors...',
        }}
      />

      {/* View Mode Toggle & Count */}
      <View style={styles.controlBar}>
        <Text style={[styles.resultCount, { color: colors.text.secondary }]}>{filteredAuthors.length} authors</Text>
        <View style={[
          styles.viewToggle,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }
        ]}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'grouped' && [styles.toggleButtonActive, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }]]}
            onPress={() => setViewMode('grouped')}
          >
            <Icon
              name="LayoutGrid"
              size={16}
              color={viewMode === 'grouped' ? colors.text.primary : colors.text.tertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'flat' && [styles.toggleButtonActive, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }]]}
            onPress={() => setViewMode('flat')}
          >
            <Icon
              name="List"
              size={16}
              color={viewMode === 'flat' ? colors.text.primary : colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'grouped' || isSearching ? renderGroupedView() : renderFlatView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  resultCount: {
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleButtonActive: {
    // backgroundColor applied inline
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  flatContainer: {
    flex: 1,
  },
  browseHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  browseTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  // Flat view styles
  sectionHeader: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  alphabetIndex: {
    position: 'absolute',
    right: 2,
    top: 8,
    width: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alphabetLetterButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    minHeight: 14,
  },
  alphabetLetter: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Author row for flat view
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 72,
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
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  bookCount: {
    fontSize: 14,
    marginBottom: 2,
  },
});
