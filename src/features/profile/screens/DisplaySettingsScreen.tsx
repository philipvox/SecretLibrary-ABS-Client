/**
 * src/features/profile/screens/DisplaySettingsScreen.tsx
 *
 * Secret Library Display Settings
 * Consolidated display settings with accordion sections:
 * - Home Screen Views (links to full view editor)
 * - Spine Appearance (server spines toggle)
 * - Series Display (hide single-book series)
 * - Chapter Names (links to full chapter cleaning editor)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ListMusic,
  ImageIcon,
  Library,
  Type,
  Info,
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { usePlaylistSettingsStore, type DefaultViewType } from '@/features/playlists';
import { useChapterCleaningStore, CLEANING_LEVEL_INFO } from '../stores/chapterCleaningStore';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsRow } from '../components/SettingsRow';
import { SectionHeader } from '../components/SectionHeader';

// =============================================================================
// HELPERS
// =============================================================================

const DEFAULT_VIEW_LABELS: Record<string, string> = {
  library: 'My Library',
  mySeries: 'My Series',
  lastPlayed: 'Last Played',
  finished: 'Finished',
};

function getDefaultViewLabel(defaultView: DefaultViewType): string {
  if (typeof defaultView === 'string' && defaultView.startsWith('playlist:')) {
    return 'Playlist';
  }
  return DEFAULT_VIEW_LABELS[defaultView as string] || 'My Library';
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DisplaySettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useSecretLibraryColors();

  // Spine settings
  const useServerSpines = useSpineCacheStore((s) => s.useServerSpines);
  const setUseServerSpines = useSpineCacheStore((s) => s.setUseServerSpines);

  // Series display
  const hideSingleBookSeries = useMyLibraryStore((s) => s.hideSingleBookSeries);
  const setHideSingleBookSeries = useMyLibraryStore((s) => s.setHideSingleBookSeries);

  // Home screen view — for status text
  const defaultView = usePlaylistSettingsStore((s) => s.defaultView);
  const hiddenBuiltInViews = usePlaylistSettingsStore((s) => s.hiddenBuiltInViews);
  const _visibleViews = 4 - hiddenBuiltInViews.length;

  // Chapter cleaning — for status text
  const cleaningLevel = useChapterCleaningStore((s) => s.level);

  // Handlers
  const handleServerSpinesToggle = useCallback(
    (value: boolean) => setUseServerSpines(value),
    [setUseServerSpines],
  );

  const handleHideSingleSeriesToggle = useCallback(
    (value: boolean) => setHideSingleBookSeries(value),
    [setHideSingleBookSeries],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.grayLight}
      />
      <SettingsHeader title="Display Settings" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Home Screen Views */}
        <SectionHeader title="Home Screen Views" />
        <SettingsRow
          Icon={ListMusic}
          label="Edit View Settings"
          description="Reorder views, set default, toggle visibility"
          value={getDefaultViewLabel(defaultView)}
          onPress={() => navigation.navigate('PlaylistSettings' as never)}
        />

        {/* Spine Appearance */}
        <SectionHeader title="Spine Appearance" />
        <SettingsRow
          Icon={ImageIcon}
          label="Server Spines"
          switchValue={useServerSpines}
          onSwitchChange={handleServerSpinesToggle}
          description="Uses pre-generated spine images from your server"
        />

        {/* Series Display */}
        <SectionHeader title="Series Display" />
        <SettingsRow
          Icon={Library}
          label="Hide Single-Book Series"
          switchValue={hideSingleBookSeries}
          onSwitchChange={handleHideSingleSeriesToggle}
          description="Hides series that only contain one book"
        />

        {/* Chapter Names */}
        <SectionHeader title="Chapter Names" />
        <SettingsRow
          Icon={Type}
          label="Chapter Cleaning"
          description="Clean up inconsistent chapter names"
          value={(CLEANING_LEVEL_INFO[cleaningLevel] ?? CLEANING_LEVEL_INFO['standard']).label}
          onPress={() => navigation.navigate('ChapterCleaningSettings' as never)}
        />

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            Server spines require your Audiobookshelf server to have pre-generated spine images.
            Chapter cleaning only affects display — your server data remains unchanged.
          </Text>
        </View>
      </ScrollView>
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
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  infoText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    flex: 1,
    lineHeight: scale(16),
  },
});
