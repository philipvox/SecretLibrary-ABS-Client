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
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Plus,
  Bookmark,
  Filter,
  SortAsc,
  Star,
  BookOpen,
  User,
  Library,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { WishlistItem, WishlistSortOption, WishlistPriority } from '../types';
import {
  useWishlistStore,
  useWishlistCount,
  useFollowedAuthorsCount,
  useTrackedSeriesCount,
} from '../stores/wishlistStore';
import { WishlistItemRow } from '../components/WishlistItemRow';
import { ManualAddSheet } from '../components/ManualAddSheet';
import { colors, scale, spacing, radius, layout } from '@/shared/theme';

const ACCENT = colors.accent;

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

  // Store state
  const items = useWishlistStore((s) => s.items);
  const sortBy = useWishlistStore((s) => s.sortBy);
  const setSortBy = useWishlistStore((s) => s.setSortBy);
  const getFilteredItems = useWishlistStore((s) => s.getFilteredItems);
  const getSortedItems = useWishlistStore((s) => s.getSortedItems);
  const followedAuthors = useWishlistStore((s) => s.followedAuthors);
  const trackedSeries = useWishlistStore((s) => s.trackedSeries);

  // Local state
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

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
    setShowAddSheet(true);
  }, []);

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
          <User size={scale(48)} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Followed Authors</Text>
          <Text style={styles.emptySubtitle}>
            Follow authors to get notified when they release new books
          </Text>
        </View>
      );
    }

    if (activeTab === 'series') {
      return (
        <View style={styles.emptyState}>
          <Library size={scale(48)} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Tracked Series</Text>
          <Text style={styles.emptySubtitle}>
            Track series to see your progress and upcoming releases
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Bookmark size={scale(48)} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Add books you want to read by tapping the bookmark icon on any book
        </Text>
        <TouchableOpacity style={styles.emptyButton} onPress={handleAddPress}>
          <Plus size={scale(18)} color="#000" strokeWidth={2} />
          <Text style={styles.emptyButtonText}>Add a Book</Text>
        </TouchableOpacity>
      </View>
    );
  }, [activeTab, handleAddPress]);

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSortPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <SortAsc size={scale(20)} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={scale(22)} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Picker (dropdown) */}
      {showSortPicker && (
        <View style={styles.sortPicker}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive,
              ]}
              onPress={() => handleSortSelect(option.value)}
            >
              <Text
                style={[
                  styles.sortOptionText,
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
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabPress(tab.id)}
            >
              <tab.Icon
                size={scale(16)}
                color={isActive ? '#000' : 'rgba(255,255,255,0.6)'}
                strokeWidth={2}
                fill={isActive && tab.id === 'must-read' ? '#000' : 'transparent'}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
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
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.authorRow}>
                <View style={styles.authorAvatar}>
                  <User size={scale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                </View>
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>{item.name}</Text>
                  <Text style={styles.authorMeta}>
                    Following since {new Date(item.followedAt).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
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
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.seriesRow}>
                <View style={styles.seriesIcon}>
                  <Library size={scale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                </View>
                <View style={styles.seriesInfo}>
                  <Text style={styles.seriesName}>{item.name}</Text>
                  <Text style={styles.seriesMeta}>
                    {item.ownedBooks || 0} owned · {item.wishlistBooks || 0} on wishlist
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        // Wishlist items
        <FlatList
          data={displayItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            displayItems.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={ACCENT}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Manual Add Sheet */}
      <ManualAddSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
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
    color: colors.textPrimary,
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
    backgroundColor: '#1c1c1e',
    marginHorizontal: layout.screenPaddingH,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sortOption: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(244,182,12,0.1)',
  },
  sortOptionText: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.7)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: scale(6),
  },
  tabActive: {
    backgroundColor: ACCENT,
  },
  tabText: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000',
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
    color: '#000',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: colors.textTertiary,
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
    color: '#000',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    color: colors.textPrimary,
  },
  authorMeta: {
    fontSize: scale(12),
    color: colors.textTertiary,
    marginTop: scale(2),
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
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    color: colors.textPrimary,
  },
  seriesMeta: {
    fontSize: scale(12),
    color: colors.textTertiary,
    marginTop: scale(2),
  },
});
