/**
 * src/features/profile/screens/PlaylistSettingsScreen.tsx
 *
 * Homepage Settings screen for managing Library screen views.
 * - Toggle which views appear in dropdown (including built-in views)
 * - Reorder all views via drag-and-drop
 * - Set default view when opening Library screen
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ListMusic,
  GripVertical,
  Circle,
  CheckCircle2,
  Info,
  Library,
  Clock,
  BookCheck,
  Heart,
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { haptics } from '@/core/native/haptics';
import { SettingsHeader } from '../components/SettingsHeader';
import {
  usePlaylists,
  usePlaylistSettingsStore,
  type DefaultViewType,
  type BuiltInViewKey,
} from '@/features/playlists';

// =============================================================================
// TYPES
// =============================================================================

interface ViewItem {
  id: string;
  key: DefaultViewType;
  label: string;
  isBuiltIn: boolean;
  builtInKey?: BuiltInViewKey;
  icon: 'library' | 'clock' | 'finished' | 'heart' | 'playlist';
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface UnifiedViewRowProps {
  item: ViewItem;
  isVisible: boolean;
  isDefault: boolean;
  onToggleVisibility: () => void;
  onSetDefault: () => void;
  drag: () => void;
  isActive: boolean;
}

function UnifiedViewRow({
  item,
  isVisible,
  isDefault,
  onToggleVisibility,
  onSetDefault,
  drag,
  isActive,
}: UnifiedViewRowProps) {
  const colors = useSecretLibraryColors();

  const handleToggle = useCallback(
    (_newValue: boolean) => {
      haptics.selection();
      onToggleVisibility();
    },
    [onToggleVisibility]
  );

  const handleSetDefault = useCallback(() => {
    if (!isVisible) return;
    haptics.selection();
    onSetDefault();
  }, [isVisible, onSetDefault]);

  // Get icon component
  const IconComponent = item.icon === 'library' ? Library
    : item.icon === 'clock' ? Clock
    : item.icon === 'finished' ? BookCheck
    : item.icon === 'heart' ? Heart
    : ListMusic;

  return (
    <View style={[
      styles.unifiedRow,
      { backgroundColor: colors.white, borderBottomColor: colors.borderLight },
      !isVisible && { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
      isActive && { backgroundColor: colors.grayLight },
    ]}>
      {/* Drag Handle -- all items are draggable */}
      <TouchableOpacity
        style={styles.dragHandle}
        onLongPress={drag}
        delayLongPress={100}
      >
        <GripVertical
          size={scale(16)}
          color={colors.gray}
          strokeWidth={1.5}
        />
      </TouchableOpacity>

      {/* Left side: Icon + Label */}
      <View style={styles.rowLeft}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: colors.grayLight },
          !isVisible && { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        ]}>
          <IconComponent
            size={scale(16)}
            color={isVisible ? colors.gray : colors.grayLine}
            strokeWidth={1.5}
          />
        </View>
        <Text
          style={[styles.rowLabel, { color: colors.black }, !isVisible && { color: colors.grayLine }]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </View>

      {/* Right side: Default radio + Toggle */}
      <View style={styles.rowControls}>
        {/* Default View Radio */}
        <TouchableOpacity
          style={styles.radioButton}
          onPress={handleSetDefault}
          disabled={!isVisible}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isDefault ? (
            <CheckCircle2
              size={scale(22)}
              color={colors.black}
              strokeWidth={1.5}
              fill={colors.black}
            />
          ) : (
            <Circle
              size={scale(22)}
              color={isVisible ? colors.grayLine : colors.borderLight}
              strokeWidth={1.5}
            />
          )}
        </TouchableOpacity>

        {/* Visibility Toggle */}
        <Switch
          value={isVisible}
          onValueChange={handleToggle}
          trackColor={{ false: colors.borderLight, true: colors.black }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.borderLight}
          style={styles.toggle}
        />
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PlaylistSettingsScreen() {
  const colors = useSecretLibraryColors();
  const insets = useSafeAreaInsets();

  // Fetch playlists
  const { data: playlists = [], isLoading, error } = usePlaylists();

  // Store state
  const visiblePlaylistIds = usePlaylistSettingsStore((s) => s.visiblePlaylistIds);
  const hiddenBuiltInViews = usePlaylistSettingsStore((s) => s.hiddenBuiltInViews);
  const allItemOrder = usePlaylistSettingsStore((s) => s.allItemOrder);
  const defaultView = usePlaylistSettingsStore((s) => s.defaultView);

  // Store actions
  const togglePlaylistVisibility = usePlaylistSettingsStore((s) => s.togglePlaylistVisibility);
  const toggleBuiltInVisibility = usePlaylistSettingsStore((s) => s.toggleBuiltInVisibility);
  const setAllItemOrder = usePlaylistSettingsStore((s) => s.setAllItemOrder);
  const setDefaultView = usePlaylistSettingsStore((s) => s.setDefaultView);
  const syncWithAvailablePlaylists = usePlaylistSettingsStore((s) => s.syncWithAvailablePlaylists);

  // Sync store with available playlists when they load
  useEffect(() => {
    if (playlists.length > 0) {
      const availableIds = playlists.map(p => p.id);
      syncWithAvailablePlaylists(availableIds);
    }
  }, [playlists, syncWithAvailablePlaylists]);

  // Built-in view items
  const builtInViews: ViewItem[] = useMemo(() => [
    { id: '__library', key: 'library', label: 'My Library', isBuiltIn: true, builtInKey: 'library', icon: 'library' },
    { id: '__mySeries', key: 'mySeries', label: 'My Series', isBuiltIn: true, builtInKey: 'mySeries', icon: 'heart' },
    { id: '__lastPlayed', key: 'lastPlayed', label: 'Last Played', isBuiltIn: true, builtInKey: 'lastPlayed', icon: 'clock' },
    { id: '__finished', key: 'finished', label: 'Finished', isBuiltIn: true, builtInKey: 'finished', icon: 'finished' },
  ], []);

  // Convert playlists to ViewItems (exclude __sl_ system playlists)
  const playlistViews: ViewItem[] = useMemo(() => {
    return playlists
      .filter(p => !p.name.startsWith('__sl_'))
      .map(p => ({
        id: p.id,
        key: `playlist:${p.id}` as DefaultViewType,
        label: p.name,
        isBuiltIn: false,
        icon: 'playlist' as const,
      }));
  }, [playlists]);

  // All items indexed by ID for quick lookup
  const allItemsById = useMemo(() => {
    const map = new Map<string, ViewItem>();
    for (const v of builtInViews) map.set(v.id, v);
    for (const v of playlistViews) map.set(v.id, v);
    return map;
  }, [builtInViews, playlistViews]);

  // Combine and order all items using allItemOrder
  const allViewItems = useMemo(() => {
    const result: ViewItem[] = [];
    const addedIds = new Set<string>();

    // First, add items in stored order
    for (const id of allItemOrder) {
      const item = allItemsById.get(id);
      if (item) {
        result.push(item);
        addedIds.add(id);
      }
    }

    // Then add any remaining items not in the stored order (new items)
    // Built-in views first, then playlists
    for (const item of builtInViews) {
      if (!addedIds.has(item.id)) {
        result.push(item);
        addedIds.add(item.id);
      }
    }
    for (const item of playlistViews) {
      if (!addedIds.has(item.id)) {
        result.push(item);
        addedIds.add(item.id);
      }
    }

    return result;
  }, [allItemOrder, allItemsById, builtInViews, playlistViews]);

  // Check if item is visible
  const isItemVisible = useCallback((item: ViewItem): boolean => {
    if (item.isBuiltIn && item.builtInKey) {
      return !hiddenBuiltInViews.includes(item.builtInKey);
    }
    return visiblePlaylistIds.includes(item.id);
  }, [visiblePlaylistIds, hiddenBuiltInViews]);

  // Handlers
  const handleToggleVisibility = useCallback((item: ViewItem) => {
    if (item.isBuiltIn && item.builtInKey) {
      toggleBuiltInVisibility(item.builtInKey);
    } else {
      togglePlaylistVisibility(item.id);
    }
  }, [togglePlaylistVisibility, toggleBuiltInVisibility]);

  const handleSetDefault = useCallback((item: ViewItem) => {
    setDefaultView(item.key);
  }, [setDefaultView]);

  // Handle drag end - save the full order
  const handleDragEnd = useCallback(({ data }: { data: ViewItem[] }) => {
    haptics.selection();
    // Save the complete ordering of all items (built-in + playlists)
    const newOrder = data.map(item => item.id);
    setAllItemOrder(newOrder);

    // Also update playlistOrder for backwards compat with LibraryScreen
    const newPlaylistOrder = data
      .filter(item => !item.isBuiltIn)
      .map(item => item.id);
    usePlaylistSettingsStore.getState().setPlaylistOrder(newPlaylistOrder);
  }, [setAllItemOrder]);

  // Render item for DraggableFlatList
  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<ViewItem>) => {
    return (
      <ScaleDecorator>
        <UnifiedViewRow
          item={item}
          isVisible={isItemVisible(item)}
          isDefault={defaultView === item.key}
          onToggleVisibility={() => handleToggleVisibility(item)}
          onSetDefault={() => handleSetDefault(item)}
          drag={drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    );
  }, [isItemVisible, defaultView, handleToggleVisibility, handleSetDefault]);

  const keyExtractor = useCallback((item: ViewItem) => item.id, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
        <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
        <SettingsHeader title="Homepage Settings" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.black} />
          <Text style={[styles.loadingText, { color: colors.gray }]}>Loading views...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
        <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
        <SettingsHeader title="Homepage Settings" />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.black }]}>Failed to load views</Text>
          <Text style={[styles.emptySubtext, { color: colors.gray }]}>Please check your connection and try again</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title="Homepage Settings" />

      {/* Column Headers */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: colors.gray }]}>View</Text>
        <View style={styles.headerControls}>
          <Text style={[styles.headerText, styles.headerDefault, { color: colors.gray }]}>Default</Text>
          <Text style={[styles.headerText, styles.headerShow, { color: colors.gray }]}>Show</Text>
        </View>
      </View>

      {/* Draggable List */}
      <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
        <DraggableFlatList
          data={allViewItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onDragEnd={handleDragEnd}
          contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }}
        />
      </View>

      {/* Info Note */}
      <View style={styles.infoSection}>
        <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
        <Text style={[styles.infoText, { color: colors.gray }]}>
          <Text style={[styles.infoBold, { color: colors.black }]}>Default:</Text> The view shown when opening Library.{'\n'}
          <Text style={[styles.infoBold, { color: colors.black }]}>Drag:</Text> Long press and drag to reorder.{'\n'}
          <Text style={[styles.infoBold, { color: colors.black }]}>Show:</Text> Toggle visibility in the dropdown.
        </Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(20),
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtext: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textAlign: 'center',
  },
  // Header Row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  headerLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  headerDefault: {
    width: scale(44),
  },
  headerShow: {
    width: scale(50),
    marginLeft: 12,
  },
  // Section Card
  sectionCard: {
  },
  // Unified Row
  unifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingLeft: 4,
    paddingRight: 12,
    borderBottomWidth: 1,
    minHeight: scale(56),
  },
  dragHandle: {
    width: scale(32),
    height: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(14),
    marginLeft: 10,
    flex: 1,
  },
  rowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioButton: {
    width: scale(32),
    height: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggle: {
    transform: [{ scale: 0.85 }],
  },
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  infoText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    flex: 1,
    lineHeight: scale(16),
  },
  infoBold: {
    fontFamily: fonts.jetbrainsMono.medium,
  },
});
