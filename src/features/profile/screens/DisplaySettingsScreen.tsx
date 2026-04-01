/**
 * src/features/profile/screens/DisplaySettingsScreen.tsx
 *
 * Secret Library Display Settings
 * - Home Screen Views (links to full view editor)
 * - Spine Source (single picker replacing separate community/server toggles)
 * - Default View Mode
 * - Series Display
 */

import React, { useCallback, useMemo, useState } from 'react';
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
  Library,
  Server,
  Check,
  Upload,
  LayoutGrid,
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { WebContentContainer } from '@/shared/components/WebContentContainer';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { useSpineCacheStore } from '@/shared/spine';
import { useLibraryCache } from '@/core/cache';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { usePlaylistSettingsStore } from '@/shared/stores/playlistSettingsStore';
import type { DefaultViewType } from '@/shared/stores/playlistSettingsStore';
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
// SPINE SOURCE
// =============================================================================

type SpineSource = 'communityAndServer' | 'communityOnly' | 'serverOnly' | 'generatedOnly';

const SPINE_SOURCE_OPTIONS: {
  key: SpineSource;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    key: 'communityAndServer',
    label: 'Community & Server',
    description: 'Tries community first, then your server, then generated',
    recommended: true,
  },
  {
    key: 'communityOnly',
    label: 'Community Only',
    description: 'Community library, then generated',
  },
  {
    key: 'serverOnly',
    label: 'Server Only',
    description: 'Your server spines, then generated',
  },
  {
    key: 'generatedOnly',
    label: 'Generated Only',
    description: 'All spines are procedurally designed',
  },
];

function deriveSpineSource(community: boolean, server: boolean): SpineSource {
  if (community && server) return 'communityAndServer';
  if (community) return 'communityOnly';
  if (server) return 'serverOnly';
  return 'generatedOnly';
}

function spineSourceToFlags(source: SpineSource): { community: boolean; server: boolean } {
  switch (source) {
    case 'communityAndServer': return { community: true, server: true };
    case 'communityOnly': return { community: true, server: false };
    case 'serverOnly': return { community: false, server: true };
    case 'generatedOnly': return { community: false, server: false };
  }
}

// =============================================================================
// SPINE SOURCE OPTION COMPONENT
// =============================================================================

interface SpineSourceOptionProps {
  option: typeof SPINE_SOURCE_OPTIONS[number];
  isSelected: boolean;
  onSelect: (key: SpineSource) => void;
}

function SpineSourceOption({ option, isSelected, onSelect }: SpineSourceOptionProps) {
  const colors = useSecretLibraryColors();

  return (
    <TouchableOpacity
      style={[
        styles.sourceOption,
        { borderBottomColor: colors.borderLight },
        isSelected && { backgroundColor: colors.grayLight },
      ]}
      onPress={() => onSelect(option.key)}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityLabel={`${option.label}${option.recommended ? ', recommended' : ''}${isSelected ? ', currently selected' : ''}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.sourceOptionLeft}>
        <View style={[styles.radioOuter, { borderColor: colors.gray }, isSelected && { borderColor: colors.black }]}>
          {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.black }]} />}
        </View>
        <View style={styles.sourceContent}>
          <View style={styles.labelRow}>
            <Text style={[styles.sourceLabel, { color: colors.black }, isSelected && styles.sourceLabelSelected]}>
              {option.label}
            </Text>
            {option.recommended && (
              <View style={[styles.recommendedBadge, { backgroundColor: colors.grayLight }]}>
                <Text style={[styles.recommendedText, { color: colors.gray }]}>Recommended</Text>
              </View>
            )}
          </View>
          <Text style={[styles.sourceDescription, { color: colors.gray }]}>{option.description}</Text>
        </View>
      </View>
      {isSelected && <Check size={scale(20)} color={colors.black} strokeWidth={2} />}
    </TouchableOpacity>
  );
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

  // Derive current spine source from booleans
  const spineSource = useMemo(
    () => deriveSpineSource(useCommunitySpines, useServerSpines),
    [useCommunitySpines, useServerSpines],
  );

  const communityActive = useCommunitySpines;
  const serverActive = useServerSpines;

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

  // Handlers
  const handleSpineSourceSelect = useCallback(
    (source: SpineSource) => {
      const { community, server } = spineSourceToFlags(source);
      setUseCommunitySpines(community);
      setUseServerSpines(server);
      useLibraryCache.getState().loadSpineManifest(true);
    },
    [setUseCommunitySpines, setUseServerSpines],
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
        <WebContentContainer variant="narrow">
        {/* Home Screen Views */}
        <SectionHeader title="Home Screen Views" />
        <SettingsRow
          Icon={ListMusic}
          label="Edit View Settings"
          description="Reorder views, set default, toggle visibility"
          value={getDefaultViewLabel(defaultView)}
          onPress={() => navigation.navigate('PlaylistSettings')}
        />

        {/* Spine Source */}
        <SectionHeader title="Spine Source" />
        <View style={styles.sourceIntro}>
          <Text style={[styles.sourceIntroText, { color: colors.gray }]}>
            Where should spine images come from? Books without a match always fall back to generated designs.
          </Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          {SPINE_SOURCE_OPTIONS.map((opt) => (
            <SpineSourceOption
              key={opt.key}
              option={opt}
              isSelected={spineSource === opt.key}
              onSelect={handleSpineSourceSelect}
            />
          ))}
        </View>

        {/* Conditional sub-settings */}
        {communityActive && (
          <>
            <View style={styles.subSettingSpacing} />
            <SettingsRow
              Icon={Upload}
              label="Contribute to Community"
              switchValue={promptCommunitySubmit}
              onSwitchChange={setPromptCommunitySubmit}
              description="Prompt to submit your spines to the community library"
            />
          </>
        )}

        {serverActive && (
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
        </WebContentContainer>
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
  // Spine source picker
  sourceIntro: {
    marginBottom: 12,
  },
  sourceIntroText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    lineHeight: scale(16),
  },
  sectionCard: {
  },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  sourceOptionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  radioOuter: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(2),
  },
  radioInner: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
  },
  sourceContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  sourceLabelSelected: {
    fontFamily: fonts.playfair.bold,
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recommendedText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceDescription: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  subSettingSpacing: {
    height: 4,
  },
  // URL input
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
});
