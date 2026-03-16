/**
 * src/features/wishlist/screens/WishlistScreen.tsx
 *
 * Main wishlist screen showing all wishlist items.
 * Supports sorting, filtering, and manual entry.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Plus,
  Bookmark,
  SortAsc,
  Star,
  User,
  Library,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { WishlistItem, WishlistSortOption, FollowedAuthor, TrackedSeries } from '../types';
import {
  useWishlistStore,
  useWishlistCount,
  useFollowedAuthorsCount,
  useTrackedSeriesCount,
} from '../stores/wishlistStore';
import { useLibraryCache } from '@/core/cache';
import { WishlistItemRow } from '../components/WishlistItemRow';
import { SkullRefreshControl } from '@/shared/components';
import { scale, spacing, radius, layout, useTheme, ACCENT } from '@/shared/theme';
import { ChevronRight, BellOff } from 'lucide-react-native';

type TabId = 'all' | 'must-read' | 'authors' | 'series';

interface Tab {
  id: TabId;
  label: string;
  Icon: any;
}

const TABS: Tab[] = [
  { id: 'all', label: 'All', Icon: Bookmark },
  { id: 'must-read', label: 'Must Read', Icon: Star },
  { id: 'authors', label: 'Authors', Icon: User },
  { id: 'series', label: 'Series', Icon: Library },
];

const SORT_OPTIONS: { value: WishlistSortOption; label: string }[] = [
  { value: 'date-added', label: 'Recently Added' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
];

export function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  // Store state
  const items = useWishlistStore((s) => s.items);
  const sortBy = useWishlistStore((s) => s.sortBy);
  const setSortBy = useWishlistStore((s) => s.setSortBy);
  const _getFilteredItems = useWishlistStore((s) => s.getFilteredItems);
  const getSortedItems = useWishlistStore((s) => s.getSortedItems);
  const followedAuthors = useWishlistStore((s) => s.followedAuthors);
  const trackedSeries = useWishlistStore((s) => s.trackedSeries);
  const unfollowAuthor = useWishlistStore((s) => s.unfollowAuthor);
  const untrackSeries = useWishlistStore((s) => s.untrackSeries);

  // Library cache for author/series info
  const { getAuthor, getSeries, isLoaded } = useLibraryCache();

  // Local state
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);

  // Counts for badges
  const wishlistCount = useWishlistCount();
  const authorsCount = useFollowedAuthorsCount();
  const seriesCount = useTrackedSeriesCount();

  // Filter and sort items based on active tab
  const displayItems = useMemo(() => {
    let filtered: WishlistItem[] = [];

    switch (activeTab) {
      case 'all':
        filtered = [...items];
        break;
      case 'must-read':
        filtered = items.filter((item) => item.priority === 'must-read');
        break;
      default:
        filtered = [...items];
    }

    return getSortedItems(filtered);
  }, [activeTab, items, getSortedItems]);

  const handleTabPress = useCallback((tabId: TabId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tabId);
  }, []);

  const handleItemPress = useCallback((item: WishlistItem) => {
    // If it's a library item, navigate to book detail
    if (item.libraryItemId) {
      navigation.navigate('BookDetail', { id: item.libraryItemId });
    } else {
      // Show edit sheet for manual entries
      // TODO: Implement edit sheet
    }
  }, [navigation]);

  const handleAddPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('ManualAdd');
  }, [navigation]);

  const handleAuthorPress = useCallback((author: FollowedAuthor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AuthorDetail', { authorName: author.name });
  }, [navigation]);

  const handleUnfollowAuthor = useCallback((author: FollowedAuthor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    unfollowAuthor(author.name);
  }, [unfollowAuthor]);

  const handleSeriesPress = useCallback((series: TrackedSeries) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SeriesDetail', { seriesName: series.name });
  }, [navigation]);

  const handleUntrackSeries = useCallback((series: TrackedSeries) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    untrackSeries(series.name);
  }, [untrackSeries]);

  const handleSortPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSortPicker(!showSortPicker);
  }, [showSortPicker]);

  const handleSortSelect = useCallback((sort: WishlistSortOption) => {
    setSortBy(sort);
    setShowSortPicker(false);
  }, [setSortBy]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Sync with server if needed
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const renderItem = useCallback(({ item }: { item: WishlistItem }) => (
    <WishlistItemRow
      item={item}
      onPress={handleItemPress}
    />
  ), [handleItemPress]);

  const renderEmptyState = useCallback(() => {
    if (activeTab === 'authors') {
      return (
        <View style={styles.emptyState}>
          <User size={scale(48)} color={colors.text.tertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No Followed Authors</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
            Follow authors to get notified when they release new books
          </Text>
        </View>
      );
    }

    if (activeTab === 'series') {
      return (
        <View style={styles.emptyState}>
          <Library size={scale(48)} color={colors.text.tertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No Tracked Series</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
            Track series to see your progress and upcoming releases
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Bookmark size={scale(48)} color={colors.text.tertiary} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Your Wishlist is Empty</Text>
        <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
          Add books you want to read by tapping the bookmark icon on any book
        </Text>
        <TouchableOpacity style={styles.emptyButton} onPress={handleAddPress}>
          <Plus size={scale(18)} color={colors.text.inverse} strokeWidth={2} />
          <Text style={styles.emptyButtonText}>Add a Book</Text>
        </TouchableOpacity>
      </View>
    );
  }, [activeTab, handleAddPress, colors]);

  const keyExtractor = useCallback((item: WishlistItem) => item.id, []);

  // Get badge count for each tab
  const getTabBadge = useCallback((tabId: TabId): number | undefined => {
    switch (tabId) {
      case 'all':
        return wishlistCount > 0 ? wishlistCount : undefined;
      case 'must-read':
        const mustReadCount = items.filter((i) => i.priority === 'must-read').length;
        return mustReadCount > 0 ? mustReadCount : undefined;
      case 'authors':
        return authorsCount > 0 ? authorsCount : undefined;
      case 'series':
        return seriesCount > 0 ? seriesCount : undefined;
      default:
        return undefined;
    }
  }, [wishlistCount, items, authorsCount, seriesCount]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Wishlist</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSortPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <SortAsc size={scale(20)} color={colors.text.secondary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={scale(22)} color={colors.text.inverse} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Picker (dropdown) */}
      {showSortPicker && (
        <View style={[styles.sortPicker, { backgroundColor: colors.background.secondary }]}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                { borderBottomColor: colors.border.default },
                sortBy === option.value && styles.sortOptionActive,
              ]}
              onPress={() => handleSortSelect(option.value)}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  { color: colors.text.secondary },
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const badge = getTabBadge(tab.id);
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, { backgroundColor: colors.border.default }, isActive && styles.tabActive]}
              onPress={() => handleTabPress(tab.id)}
            >
              <tab.Icon
                size={scale(16)}
                color={isActive ? colors.text.inverse : colors.text.secondary}
                strokeWidth={2}
                fill={isActive && tab.id === 'must-read' ? colors.text.inverse : 'transparent'}
              />
              <Text style={[styles.tabText, { color: colors.text.secondary }, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {badge !== undefined && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'authors' ? (
        // Authors list
        followedAuthors.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={followedAuthors}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const authorInfo = isLoaded && item.name ? getAuthor(item.name) : null;
              const bookCount = authorInfo?.bookCount || 0;

              return (
                <TouchableOpacity
                  style={styles.authorRow}
                  onPress={() => handleAuthorPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.authorAvatar, { backgroundColor: colors.border.default }]}>
                    <User size={scale(20)} color={colors.text.secondary} strokeWidth={2} />
                  </View>
                  <View style={styles.authorInfo}>
                    <Text style={[styles.authorName, { color: colors.text.primary }]}>{item.name}</Text>
                    <Text style={[styles.authorMeta, { color: colors.text.tertiary }]}>
                      {bookCount > 0 ? `${bookCount} books in library` : 'Following'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unfollowButton}
                    onPress={() => handleUnfollowAuthor(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <BellOff size={scale(18)} color={colors.text.tertiary} strokeWidth={2} />
                  </TouchableOpacity>
                  <ChevronRight size={scale(18)} color={colors.text.tertiary} strokeWidth={2} />
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={[styles.authorSeparator, { backgroundColor: colors.border.default }]} />}
          />
        )
      ) : activeTab === 'series' ? (
        // Series list
        trackedSeries.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={trackedSeries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const seriesInfo = isLoaded && item.name ? getSeries(item.name) : null;
              const bookCount = seriesInfo?.bookCount || 0;

              return (
                <TouchableOpacity
                  style={styles.seriesRow}
                  onPress={() => handleSeriesPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.seriesIcon, { backgroundColor: colors.border.default }]}>
                    <Library size={scale(20)} color={colors.text.secondary} strokeWidth={2} />
                  </View>
                  <View style={styles.seriesInfo}>
                    <Text style={[styles.seriesName, { color: colors.text.primary }]}>{item.name}</Text>
                    <Text style={[styles.seriesMeta, { color: colors.text.tertiary }]}>
                      {bookCount > 0 ? `${bookCount} books in library` : 'Tracking'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unfollowButton}
                    onPress={() => handleUntrackSeries(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <BellOff size={scale(18)} color={colors.text.tertiary} strokeWidth={2} />
                  </TouchableOpacity>
                  <ChevronRight size={scale(18)} color={colors.text.tertiary} strokeWidth={2} />
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={[styles.seriesSeparator, { backgroundColor: colors.border.default }]} />}
          />
        )
      ) : (
        // Wishlist items
        <SkullRefreshControl refreshing={refreshing} onRefresh={handleRefresh}>
          <FlatList
            data={displayItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={[
              styles.listContent,
              displayItems.length === 0 && styles.listContentEmpty,
            ]}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border.default }]} />}
          />
        </SkullRefreshControl>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via colors.background.primary in JSX
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: scale(28),
    fontWeight: '700',
    // color set via colors.text.primary in JSX
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  headerButton: {
    padding: scale(8),
  },
  addButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortPicker: {
    // backgroundColor set via colors.background.secondary in JSX
    marginHorizontal: layout.screenPaddingH,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sortOption: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    // borderBottomColor set via colors.border.default in JSX
  },
  sortOptionActive: {
    backgroundColor: 'rgba(244,182,12,0.1)',
  },
  sortOptionText: {
    fontSize: scale(14),
    // color set via colors.text.secondary in JSX
  },
  sortOptionTextActive: {
    color: ACCENT,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.md,
    gap: scale(8),
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(20),
    // backgroundColor set via colors.border.default in JSX
    gap: scale(6),
  },
  tabActive: {
    backgroundColor: ACCENT,
  },
  tabText: {
    fontSize: scale(13),
    // color set via colors.text.secondary in JSX
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000', // Black text on accent
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scale(6),
    paddingVertical: scale(1),
    borderRadius: scale(10),
    minWidth: scale(20),
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  tabBadgeText: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  tabBadgeTextActive: {
    color: '#000', // Black text on accent
  },
  listContent: {
    paddingBottom: scale(100),
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    // backgroundColor set via colors.border.default in JSX
    marginLeft: scale(84),
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    // color set via colors.text.primary in JSX
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: scale(14),
    // color set via colors.text.secondary in JSX
    textAlign: 'center',
    lineHeight: scale(20),
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
    borderRadius: scale(24),
    marginTop: spacing.xl,
    gap: scale(8),
  },
  emptyButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000', // Black text on accent
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: layout.screenPaddingH,
  },
  authorAvatar: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    // backgroundColor set via colors.border.default in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  authorName: {
    fontSize: scale(15),
    fontWeight: '600',
    // color set via colors.text.primary in JSX
  },
  authorMeta: {
    fontSize: scale(12),
    // color set via colors.text.tertiary in JSX
    marginTop: scale(2),
  },
  authorSeparator: {
    height: 1,
    // backgroundColor set via colors.border.default in JSX
    marginLeft: scale(76),
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: layout.screenPaddingH,
  },
  seriesIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(8),
    // backgroundColor set via colors.border.default in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  seriesInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  seriesName: {
    fontSize: scale(15),
    fontWeight: '600',
    // color set via colors.text.primary in JSX
  },
  seriesMeta: {
    fontSize: scale(12),
    // color set via colors.text.tertiary in JSX
    marginTop: scale(2),
  },
  seriesSeparator: {
    height: 1,
    // backgroundColor set via colors.border.default in JSX
    marginLeft: scale(76),
  },
  unfollowButton: {
    padding: scale(8),
    marginRight: scale(4),
  },
});
