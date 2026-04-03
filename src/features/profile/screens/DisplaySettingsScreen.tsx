/**
 * src/features/profile/screens/DisplaySettingsScreen.tsx
 *
 * Secret Library Display Settings
 * - Home Screen Views (links to full view editor)
 * - Spine Source (single picker replacing separate community/server toggles)
 * - Default View Mode
 * - Series Display
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import type { RootStackNavigationProp } from '@/navigation/types';
import {
  ListMusic,
  Library,
  Server,
  Check,
  Upload,
  LayoutGrid,
  Globe,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPPORTED_LANGUAGES, setLanguage, getCurrentLanguage } from '@/i18n';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { WebContentContainer } from '@/shared/components/WebContentContainer';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { useSpineCacheStore } from '@/shared/spine';
import { useLibraryCache } from '@/core/cache';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { usePlaylistSettingsStore } from '@/shared/stores/playlistSettingsStore';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsRow } from '../components/SettingsRow';
import { SectionHeader } from '../components/SectionHeader';

// =============================================================================
// HELPERS
// =============================================================================

const DEFAULT_VIEW_LABEL_KEYS: Record<string, string> = {
  library: 'settings.display.defaultViewLibrary',
  mySeries: 'settings.display.defaultViewMySeries',
  lastPlayed: 'settings.display.defaultViewLastPlayed',
  finished: 'settings.display.defaultViewFinished',
};

const VIEW_MODE_LABEL_KEYS: Record<string, string> = {
  shelf: 'settings.display.viewModeShelf',
  grid: 'settings.display.viewModeGrid',
  list: 'settings.display.viewModeList',
};

const VIEW_MODE_CYCLE: Record<string, string> = {
  shelf: 'grid',
  grid: 'list',
  list: 'shelf',
};

// =============================================================================
// SPINE SOURCE
// =============================================================================

type SpineSource = 'communityAndServer' | 'communityOnly' | 'serverOnly' | 'generatedOnly';

const SPINE_SOURCE_KEYS: { key: SpineSource; recommended?: boolean }[] = [
  { key: 'communityAndServer', recommended: true },
  { key: 'communityOnly' },
  { key: 'serverOnly' },
  { key: 'generatedOnly' },
];

const SPINE_SOURCE_LABEL_KEYS: Record<SpineSource, string> = {
  communityAndServer: 'settings.display.spineSourceCommunityAndServerLabel',
  communityOnly: 'settings.display.spineSourceCommunityOnlyLabel',
  serverOnly: 'settings.display.spineSourceServerOnlyLabel',
  generatedOnly: 'settings.display.spineSourceGeneratedOnlyLabel',
};

const SPINE_SOURCE_DESC_KEYS: Record<SpineSource, string> = {
  communityAndServer: 'settings.display.spineSourceCommunityAndServerDescription',
  communityOnly: 'settings.display.spineSourceCommunityOnlyDescription',
  serverOnly: 'settings.display.spineSourceServerOnlyDescription',
  generatedOnly: 'settings.display.spineSourceGeneratedOnlyDescription',
};

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
  sourceKey: SpineSource;
  label: string;
  description: string;
  recommended?: boolean;
  recommendedLabel: string;
  isSelected: boolean;
  onSelect: (key: SpineSource) => void;
}

function SpineSourceOption({ sourceKey, label, description, recommended, recommendedLabel, isSelected, onSelect }: SpineSourceOptionProps) {
  const colors = useSecretLibraryColors();

  return (
    <TouchableOpacity
      style={[
        styles.sourceOption,
        { borderBottomColor: colors.borderLight },
        isSelected && { backgroundColor: colors.grayLight },
      ]}
      onPress={() => onSelect(sourceKey)}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityLabel={`${label}${recommended ? ', ' + recommendedLabel : ''}${isSelected ? ', currently selected' : ''}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.sourceOptionLeft}>
        <View style={[styles.radioOuter, { borderColor: colors.gray }, isSelected && { borderColor: colors.black }]}>
          {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.black }]} />}
        </View>
        <View style={styles.sourceContent}>
          <View style={styles.labelRow}>
            <Text style={[styles.sourceLabel, { color: colors.black }, isSelected && styles.sourceLabelSelected]}>
              {label}
            </Text>
            {recommended && (
              <View style={[styles.recommendedBadge, { backgroundColor: colors.grayLight }]}>
                <Text style={[styles.recommendedText, { color: colors.gray }]}>{recommendedLabel}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.sourceDescription, { color: colors.gray }]}>{description}</Text>
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
  const { t } = useTranslation();

  // Language picker
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage);
  const [isSystemLang, setIsSystemLang] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('app_language').then((saved) => {
      setIsSystemLang(!saved);
    });
  }, []);

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

  const handleLanguageSelect = useCallback(async (code: string) => {
    if (code === 'system') {
      await setLanguage('system');
      setIsSystemLang(true);
    } else {
      await setLanguage(code as any);
      setIsSystemLang(false);
    }
    setCurrentLang(getCurrentLanguage());
    setLanguagePickerOpen(false);
  }, []);

  const currentLanguageDisplayName = useMemo(() => {
    if (isSystemLang) return t('settings.display.languageSystem');
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang);
    return lang ? lang.nativeName : currentLang;
  }, [isSystemLang, currentLang, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.grayLight}
      />
      <SettingsHeader title={t('settings.display.title')} />

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
        <SectionHeader title={t('settings.display.sectionHomeScreenViews')} />
        <SettingsRow
          Icon={ListMusic}
          label={t('settings.display.editViewSettingsLabel')}
          description={t('settings.display.editViewSettingsDescription')}
          value={
            typeof defaultView === 'string' && defaultView.startsWith('playlist:')
              ? t('settings.display.defaultViewPlaylist')
              : t(DEFAULT_VIEW_LABEL_KEYS[defaultView as string] || 'settings.display.defaultViewLibrary')
          }
          onPress={() => navigation.navigate('PlaylistSettings')}
        />

        {/* Spine Source */}
        <SectionHeader title={t('settings.display.sectionSpineSource')} />
        <View style={styles.sourceIntro}>
          <Text style={[styles.sourceIntroText, { color: colors.gray }]}>
            {t('settings.display.spineSourceIntro')}
          </Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          {SPINE_SOURCE_KEYS.map((opt) => (
            <SpineSourceOption
              key={opt.key}
              sourceKey={opt.key}
              label={t(SPINE_SOURCE_LABEL_KEYS[opt.key])}
              description={t(SPINE_SOURCE_DESC_KEYS[opt.key])}
              recommended={opt.recommended}
              recommendedLabel={t('settings.display.spineSourceRecommended')}
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
              label={t('settings.display.contributeToCommunityLabel')}
              switchValue={promptCommunitySubmit}
              onSwitchChange={setPromptCommunitySubmit}
              description={t('settings.display.contributeToCommunityDescription')}
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
                  {t('settings.display.spineServerUrlLabel')}
                </Text>
                <Text style={[styles.urlHelp, { color: colors.gray }]}>
                  {t('settings.display.spineServerUrlHelp')}
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
                placeholder={t('settings.display.spineServerUrlPlaceholder')}
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
        <SectionHeader title={t('settings.display.sectionDefaultView')} />
        <SettingsRow
          Icon={LayoutGrid}
          label={t('settings.display.defaultViewModeLabel')}
          description={t('settings.display.defaultViewModeDescription')}
          value={t(VIEW_MODE_LABEL_KEYS[defaultViewMode] || 'settings.display.viewModeShelf')}
          onPress={() => {
            const next = VIEW_MODE_CYCLE[defaultViewMode] || 'shelf';
            setDefaultViewMode(next as any);
          }}
        />

        {/* Series Display */}
        <SectionHeader title={t('settings.display.sectionSeriesDisplay')} />
        <SettingsRow
          Icon={Library}
          label={t('settings.display.hideSingleBookSeriesLabel')}
          switchValue={hideSingleBookSeries}
          onSwitchChange={handleHideSingleSeriesToggle}
          description={t('settings.display.hideSingleBookSeriesDescription')}
        />

        {/* Language */}
        <SectionHeader title={t('settings.display.languageLabel')} />
        <SettingsRow
          Icon={Globe}
          label={t('settings.display.languageLabel')}
          description={t('settings.display.languageDescription')}
          value={currentLanguageDisplayName}
          onPress={() => setLanguagePickerOpen(!languagePickerOpen)}
        />
        {languagePickerOpen && (
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <TouchableOpacity
              style={[
                styles.languageOption,
                { borderBottomColor: colors.borderLight },
                isSystemLang && { backgroundColor: colors.grayLight },
              ]}
              onPress={() => handleLanguageSelect('system')}
              activeOpacity={0.7}
            >
              <Text style={[styles.languageOptionText, { color: colors.black }, isSystemLang && styles.languageOptionTextSelected]}>
                {t('settings.display.languageSystem')}
              </Text>
              {isSystemLang && <Check size={scale(18)} color={colors.black} strokeWidth={2} />}
            </TouchableOpacity>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = !isSystemLang && currentLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    { borderBottomColor: colors.borderLight },
                    isSelected && { backgroundColor: colors.grayLight },
                  ]}
                  onPress={() => handleLanguageSelect(lang.code)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={[styles.languageOptionText, { color: colors.black }, isSelected && styles.languageOptionTextSelected]}>
                      {lang.nativeName}
                    </Text>
                    <Text style={[styles.languageOptionSubtext, { color: colors.gray }]}>
                      {lang.name}
                    </Text>
                  </View>
                  {isSelected && <Check size={scale(18)} color={colors.black} strokeWidth={2} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
  // Language picker
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  languageOptionText: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  languageOptionTextSelected: {
    fontFamily: fonts.playfair.bold,
  },
  languageOptionSubtext: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
});
