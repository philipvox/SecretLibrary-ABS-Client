/**
 * src/features/profile/screens/DisplaySettingsScreen.tsx
 *
 * Secret Library Display Settings
 * Consolidated display settings with accordion sections:
 * - Home Screen Views (links to full view editor)
 * - Spine Appearance (server spines toggle + spine server URL)
 * - Series Display (hide single-book series)
 * - Chapter Names (links to full chapter cleaning editor)
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '@/navigation/types';
import {
  ListMusic,
  ImageIcon,
  Library,
  Type,
  Info,
  Server,
  Check,
  Globe,
  Upload,
  LayoutGrid,
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { useSpineCacheStore } from '@/shared/spine';
import { useLibraryCache } from '@/core/cache';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { usePlaylistSettingsStore } from '@/shared/stores/playlistSettingsStore';
import type { DefaultViewType } from '@/shared/stores/playlistSettingsStore';
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

const VIEW_MODE_LABELS: Record<string, string> = {
  shelf: 'Shelf (Spines)',
  grid: 'Grid (Covers)',
  list: 'List',
};

const VIEW_MODE_CYCLE: Record<string, string> = {
  shelf: 'grid',
  grid: 'list',
  list: 'shelf',
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
  const navigation = useNavigation<RootStackNavigationProp>();
  const colors = useSecretLibraryColors();

  // Spine settings
  const useServerSpines = useSpineCacheStore((s) => s.useServerSpines);
  const setUseServerSpines = useSpineCacheStore((s) => s.setUseServerSpines);
  const spineServerUrl = useSpineCacheStore((s) => s.spineServerUrl);
  const setSpineServerUrl = useSpineCacheStore((s) => s.setSpineServerUrl);

  const useCommunitySpines = useSpineCacheStore((s) => s.useCommunitySpines);
  const setUseCommunitySpines = useSpineCacheStore((s) => s.setUseCommunitySpines);
  const promptCommunitySubmit = useSpineCacheStore((s) => s.promptCommunitySubmit);
  const setPromptCommunitySubmit = useSpineCacheStore((s) => s.setPromptCommunitySubmit);

  // Local state for URL editing
  const [urlDraft, setUrlDraft] = useState(spineServerUrl);
  const urlChanged = urlDraft.trim().replace(/\/+$/, '') !== spineServerUrl;

  // Series display
  const hideSingleBookSeries = useMyLibraryStore((s) => s.hideSingleBookSeries);
  const setHideSingleBookSeries = useMyLibraryStore((s) => s.setHideSingleBookSeries);

  // Default view mode
  const defaultViewMode = useMyLibraryStore((s) => s.defaultViewMode);
  const setDefaultViewMode = useMyLibraryStore((s) => s.setDefaultViewMode);

  // Home screen view — for status text
  const defaultView = usePlaylistSettingsStore((s) => s.defaultView);
  const hiddenBuiltInViews = usePlaylistSettingsStore((s) => s.hiddenBuiltInViews);
  const _visibleViews = 4 - hiddenBuiltInViews.length;

  // Chapter cleaning — for status text
  const cleaningLevel = useChapterCleaningStore((s) => s.level);

  // Handlers
  const handleServerSpinesToggle = useCallback(
    (value: boolean) => {
      setUseServerSpines(value);
      // Reload manifest so booksWithServerSpines + dimensions update
      useLibraryCache.getState().loadSpineManifest(true);
    },
    [setUseServerSpines],
  );

  const handleCommunitySpinesToggle = useCallback(
    (value: boolean) => {
      setUseCommunitySpines(value);
      // Reload manifest so booksWithCommunitySpines + dimensions update
      useLibraryCache.getState().loadSpineManifest(true);
    },
    [setUseCommunitySpines],
  );

  const handleHideSingleSeriesToggle = useCallback(
    (value: boolean) => setHideSingleBookSeries(value),
    [setHideSingleBookSeries],
  );

  const handleSaveUrl = useCallback(() => {
    setSpineServerUrl(urlDraft);
  }, [urlDraft, setSpineServerUrl]);

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
          onPress={() => navigation.navigate('PlaylistSettings')}
        />

        {/* Spine Appearance */}
        <SectionHeader title="Spine Appearance" />
        <SettingsRow
          Icon={Globe}
          label="Community Spines"
          switchValue={useCommunitySpines}
          onSwitchChange={handleCommunitySpinesToggle}
          description="Use spine images from the Secret Spines community library"
        />
        {useCommunitySpines && (
          <SettingsRow
            Icon={Upload}
            label="Suggest Custom Spines"
            switchValue={promptCommunitySubmit}
            onSwitchChange={setPromptCommunitySubmit}
            description="Prompt to submit custom spines to the community library for review"
          />
        )}
        <SettingsRow
          Icon={ImageIcon}
          label="Server Spines"
          switchValue={useServerSpines}
          onSwitchChange={handleServerSpinesToggle}
          description="Uses pre-generated spine images from your server"
        />

        {/* Spine Server URL — only show when server spines are enabled */}
        {useServerSpines && (
          <View style={[styles.urlSection, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.urlRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.grayLight }]}>
                <Server size={scale(18)} color={colors.gray} strokeWidth={1.5} />
              </View>
              <View style={styles.urlContent}>
                <Text style={[styles.rowLabel, { color: colors.black }]}>
                  Spine Server URL
                </Text>
                <Text style={[styles.urlHelp, { color: colors.gray }]}>
                  Leave empty to use your main ABS server
                </Text>
              </View>
            </View>
            <View style={styles.urlInputRow}>
              <TextInput
                style={[
                  styles.urlInput,
                  {
                    color: colors.black,
                    borderColor: urlChanged ? '#F3B60C' : colors.borderLight,
                    backgroundColor: colors.white,
                  },
                ]}
                value={urlDraft}
                onChangeText={setUrlDraft}
                placeholder="http://192.168.1.100:8786"
                placeholderTextColor={colors.gray}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleSaveUrl}
              />
              {urlChanged && (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveUrl}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Check size={scale(20)} color="#F3B60C" strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Default View Mode */}
        <SectionHeader title="Default View" />
        <SettingsRow
          Icon={LayoutGrid}
          label="Default View Mode"
          description="Choose whether screens open in shelf, grid, or list view"
          value={VIEW_MODE_LABELS[defaultViewMode] || 'Shelf (Spines)'}
          onPress={() => {
            const next = VIEW_MODE_CYCLE[defaultViewMode] || 'shelf';
            setDefaultViewMode(next as any);
          }}
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
          onPress={() => navigation.navigate('ChapterCleaningSettings')}
        />

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            Community spines pulls artwork from Secret Spines — a community library of
            book spine images. Server spines uses your own ABS server or custom spine server.
            Community spines are tried first; if not found, falls back to server/generated spines.
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
  urlSection: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  urlHelp: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginTop: 2,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
    borderWidth: 1,
    borderRadius: scale(8),
    paddingHorizontal: 12,
    minHeight: scale(44),
    paddingVertical: scale(4),
  },
  saveButton: {
    width: scale(44),
    height: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
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
