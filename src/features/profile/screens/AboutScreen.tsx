/**
 * src/features/profile/screens/AboutScreen.tsx
 *
 * About & Help screen — merged About + Bug Report into a single screen.
 * Shows app identity, version info, bug report form, and open source licenses.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Platform,
  Linking,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send,
  Bug,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '@/core/auth';
import { APP_VERSION, BUILD_NUMBER, VERSION_DATE } from '@/constants/version';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { SettingsHeader } from '../components/SettingsHeader';
import { SectionHeader } from '../components/SectionHeader';

// =============================================================================
// SKULL LOGO
// =============================================================================

const SkullLogo = ({ size = 48, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 189.47 189.47">
    <Path fill={color} d="M105.18,30.63c-11.17,5.68-24.12,6.5-36.32,4.09,1.32-2.17,6.21-4.03,12.02-5.23.44.43.88.83,1.33,1.23.21.2.79.75.99.94,1.88,2.05,5.49,1.79,6.98-.58.6-.97,1.2-1.95,1.76-2.94,6.15-.26,11.56.44,13.24,2.49Z" />
    <Path fill={color} d="M92.58,18.85v.06c-.1.87-.28,1.74-.54,2.57,0,.04-.02.06-.03.1-.04.14-.08.28-.13.43-.07.23-.15.46-.24.67-.35.93-.77,1.89-1.25,2.86-.11.23-.21.44-.33.65-.07.14-.15.28-.23.43-.33.58-.65,1.15-.99,1.71-.13.23-.26.44-.39.66-.01.01-.01.03-.03.04-.02.04-.03.06-.06.09-.01.02-.03.06-.05.09-.07.1-.13.2-.2.3,0,.01-.02.04-.03.05-.03.06-.07.11-.12.16-.08.09-.16.17-.23.24-.08.07-.17.13-.23.19t-.01.01c-.14.09-.28.16-.42.19-.08.02-.16.04-.24.06-.08.02-.16.03-.24.02-.05,0-.1,0-.17,0h-.01c-.47-.05-.93-.3-1.4-.67,0,0-.01,0-.01-.01-.29-.27-.6-.55-.89-.84h-.01s-.07-.07-.11-.11c-1.11-1.04-2.1-1.98-2.9-2.9-.13-.15-.25-.32-.37-.47-.01-.01-.02-.03-.02-.04-1.27-1.73-1.83-3.47-1.36-5.38,0-.03.02-.06.02-.09,0-.04.02-.06.03-.1.25-.78.66-1.61,1.26-2.52.07-.11.15-.22.23-.34.16-.21.33-.42.51-.64.21-.23.42-.48.66-.72h0c.65-.57,1.23-1.18,1.73-1.83.07-.1.14-.2.23-.31.6-.77,1.15-1.72,1.56-3.07.03-.09.06-.18.08-.28,0-.03.02-.05.02-.08.24-.79.4-1.63.46-2.48v-.18s.66-.18.66-.18c.33.45.67.92,1.01,1.37.3.42.59.84.9,1.27.54.78,1.09,1.57,1.56,2.39.26.42.49.84.71,1.27.21.39.4.78.57,1.2.1.23.2.46.28.7.08.19.14.37.21.57h0c.05.17.11.33.15.49.05.19.1.37.14.56,0,.05.02.09.03.15.06.26.11.54.15.82.02.21.05.43.07.64v.05c0,.05-.01.1,0,.16Z" />
    <Path fill={color} d="M154.64,114.18c-.37-3.76-1.31-7.46-2.46-11.07-.64-2.02-1.25-4.16-2.16-6.07-1.85-3.88-5.23-6.54-7.85-10-3.91-5.22-6.83-11.26-10.7-16.6-.63-.89-1.89-.85-2.64-.06-.01,0-.01.01-.02.02-.92.79-2.07.95-3.04.95-2.85-.11-5.54-1.18-8.24-1.6-4.14-.71-8.04-.72-10.38,2.11-.32.42-.62.86-.86,1.34-1.25,2.83-4.32,4.66-7.29,4.89-8.11.84-13.25-5.28-20.51-1.81-2.37,1.02-5.4,2.86-8.36,2.99-4.72.37-8.78-2.84-13.36-1.89-1.19.37-2.77.89-4.17.93-2.31.28-4.54.99-7.08.43l-.6-.14c-1.65,1.78-3.17,3.66-4.51,5.62-.07.09-.13.19-.22.27l-.23.23s-.08.07-.13.12c-.65,1.09-1.27,2.18-1.83,3.31-.02.08-.07.13-.11.2-.75,1.41-1.37,2.79-1.93,4.21-5.64,15.05-6.3,20.7-.65,34.8,9.7,24.22,30.45,41.48,34.12,43.17,3.98,1.85,23.33-5,27.65-4.58,3.6.36,5.96,4.3,7.39,7.22.67,1.35,2.45,8.85,3.88,9.06.89.13,1.87-.16,2.91-.47.44-.13.86-.26,1.27-.34,1.44-.36,2.36-.7,2.85-.92-.28-.81-.67-1.87-.98-2.66-1.14-2.94-1.88-5.63-2.01-8.81,2.99-1.34,4.15,5.92,4.79,7.65.39,1.11.82,2.27,1.14,3.13,1.18-.35,3.08-.96,4.99-1.57,1.9-.64,3.81-1.26,4.96-1.67-.48-1.36-.81-2.8-1.4-4.1-.51-1.12-1.11-1.82-1.3-3.08-.12-.79-.6-5.69,1.35-4.5,1.25.76,1.68,2.6,2.06,3.9.41,1.43.97,2.65,1.43,4.05.29.88.75,2.2,1.09,2.91.42-.13.99-.27,1.66-.44,1.76-.47,5.47-1.43,7.09-1.95-.12-.6-.41-1.48-.77-2.69-.56-1.79-1.04-3.62-1.28-5.47-.09-.72-.04-1.44.62-2,.7-.6,3.33,5.98,3.59,6.54.54,1.13.78,2.42,2.04,2.6,1.57.26,3.2-.97,4.52-1.59,1.39-.68,2.87-1.23,3.36-2.85.72-2.43-.58-4.91-2.07-6.67-1.65-2-2.93-4.3-3.84-6.72-1.09-2.9-3.63-15.08-3.5-15.97.61-3.83,2.92-6.7,6.56-8.34,2.92-1.31,4.45-3.88,4.68-7.18.12-1.55-.12-3.15.19-4.68.29-1.5.47-2.59.3-4.18ZM112.28,126.14c-.35,13.26-15.48,23.48-27.03,11.4-6.92-6.92-7.95-20.42.99-26.01,10.82-7.04,25.02,2.1,26.06,14.38l-.02.23ZM125.73,142.21c-5.9-16.63-.51-18.6,5.09-1.25.99,3.11-4.09,4.42-5.09,1.25ZM146.64,124.67l-.13.15c-6.59,8.95-18.3,1.62-20.71-9.47-3.05-11.7,5.51-24.38,16.32-17.1,8.46,4.89,10.31,18.99,4.52,26.42Z" />
    <Path fill={color} d="M127.43,65.65c.14,1.55.05,3.09-1.51,3.06,0,0-.02,0-.03,0-2.67-.14-5.21-1.28-7.87-1.84-4.34-1.11-9.91-1.44-12.98,2.49-.62.69-1.06,1.55-1.56,2.26-2.31,3.02-6.74,2.76-10.07,1.87-9.92-3.39-11.63-3.29-20.88,1.59-5.3,2.29-10.83-2.26-16.21-.57-1.77.72-3.42.92-5.27,1.22-1.61.32-3.18.65-4.68.47-2.98-3.62,13.84-16.58,18.36-19.16,1.26-.72,1.89-1.7,2.2-2.83,0-.03.02-.05.02-.08.07-.2.12-.42.15-.64.03-.19.05-.4.07-.61.11-1.05.07-2.16.1-3.25,0-.31,0-.62.03-.94.17-3.48.2-7.2.12-10.7-.04-.54.52-.9.99-.73,9.38,2.54,19.76,2.7,29.13-.33,3.01-.92,5.9-2.19,8.68-3.64.59.76.43,2,.33,3.32-.04,1.55.13,2.95.18,4.44l.25,4.38c.09,2.19.11,4.72,1.39,6.7,2.15,3.32,18.39,6.14,19.05,13.5Z" />
  </Svg>
);

// =============================================================================
// CONSTANTS
// =============================================================================

const LICENSES = [
  { name: 'React Native', license: 'MIT', author: 'Meta Platforms' },
  { name: 'Expo', license: 'MIT', author: 'Expo' },
  { name: 'React Navigation', license: 'MIT', author: 'React Navigation Contributors' },
  { name: 'TanStack Query', license: 'MIT', author: 'Tanner Linsley' },
  { name: 'Zustand', license: 'MIT', author: 'Daishi Kato' },
  { name: 'expo-av', license: 'MIT', author: 'Expo' },
  { name: 'Lucide Icons', license: 'ISC', author: 'Lucide Contributors' },
  { name: 'React Native SVG', license: 'MIT', author: 'Software Mansion' },
  { name: 'React Native Reanimated', license: 'MIT', author: 'Software Mansion' },
  { name: 'AsyncStorage', license: 'MIT', author: 'React Native Community' },
  { name: 'Expo SQLite', license: 'MIT', author: 'Expo' },
];

const BUG_REPORT_API = 'https://mysecretlibrary.com/api/bugs';
const BUG_REPORT_WEBSITE = 'https://mysecretlibrary.com/bugs.html';

interface CategoryDef {
  key: string;
  label: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'playback', label: 'Playback' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'sync', label: 'Sync / Progress' },
  { key: 'ui', label: 'UI / Display' },
  { key: 'crash', label: 'Crash / Freeze' },
  { key: 'other', label: 'Other' },
];

const CATEGORY_SEVERITY: Record<string, string> = {
  crash: 'critical',
  playback: 'high',
  sync: 'high',
  downloads: 'medium',
  ui: 'low',
  other: 'medium',
};

function buildDiagnostics(serverUrl: string | null): string {
  return [
    `App: Secret Library v${APP_VERSION} (${BUILD_NUMBER})`,
    `Date: ${VERSION_DATE}`,
    `Platform: ${Platform.OS} ${Platform.Version}`,
    `Server: ${serverUrl ? '(connected)' : '(none)'}`,
  ].join('\n');
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const { serverUrl } = useAuth();

  // Bug report form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [showCategories, setShowCategories] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const diagnostics = useMemo(() => buildDiagnostics(serverUrl), [serverUrl]);
  const canSubmit = title.trim().length > 0 && description.trim().length > 0;
  const selectedCategoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? 'Other';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSending) return;
    setIsSending(true);
    setSubmitResult(null);
    setErrorMessage('');

    try {
      const steps = [
        description.trim(),
        '',
        '--- Diagnostics ---',
        `Category: ${selectedCategoryLabel}`,
        diagnostics,
      ].join('\n');

      const res = await fetch(BUG_REPORT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          type: 'bug',
          severity: CATEGORY_SEVERITY[category] ?? 'medium',
          platform: Platform.OS,
          version: APP_VERSION,
          steps,
          expected: '',
          name: '',
        }),
      });

      let result: unknown;
      try {
        result = await res.json();
      } catch {
        result = null;
      }

      if (res.ok) {
        setSubmitResult('success');
        setTitle('');
        setDescription('');
        setCategory('other');
      } else {
        setSubmitResult('error');
        const errorMsg =
          typeof result === 'object' && result !== null && 'error' in result
            ? String((result as { error: unknown }).error)
            : 'Something went wrong. Try again.';
        setErrorMessage(errorMsg);
      }
    } catch {
      setSubmitResult('error');
      setErrorMessage('Could not reach the server. Try again later.');
    } finally {
      setIsSending(false);
    }
  }, [canSubmit, isSending, title, description, category, selectedCategoryLabel, diagnostics]);

  const handleOpenWebsite = useCallback(() => {
    Linking.openURL(
      `${BUG_REPORT_WEBSITE}?version=${encodeURIComponent(APP_VERSION)}&platform=${encodeURIComponent(Platform.OS)}`,
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title="About & Help" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* App Identity */}
          <View style={styles.identity}>
            <SkullLogo size={80} color={colors.black} />
            <Text style={[styles.appName, { color: colors.black }]}>Secret Library</Text>
            <Text style={[styles.tagline, { color: colors.gray }]}>Your personal audiobook companion</Text>
          </View>

          {/* Version Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.gray }]}>Version</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
              <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.infoLabel, { color: colors.black }]}>Version</Text>
                <Text style={[styles.infoValue, { color: colors.gray }]}>{APP_VERSION}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.infoLabel, { color: colors.black }]}>Build</Text>
                <Text style={[styles.infoValue, { color: colors.gray }]}>{BUILD_NUMBER}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.infoLabel, { color: colors.black }]}>Date</Text>
                <Text style={[styles.infoValue, { color: colors.gray }]}>{VERSION_DATE}</Text>
              </View>
            </View>
          </View>

          {/* Bug Report */}
          <SectionHeader title="Report a Bug" />

          {/* Success Banner */}
          {submitResult === 'success' && (
            <View style={[styles.banner, { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' }]}>
              <CheckCircle size={scale(18)} color="#2E7D32" strokeWidth={1.5} />
              <Text style={[styles.bannerText, { color: '#2E7D32' }]}>
                Bug report submitted. Thank you!
              </Text>
            </View>
          )}

          {/* Error Banner */}
          {submitResult === 'error' && (
            <View style={[styles.banner, { backgroundColor: '#FBE9E7', borderColor: '#EF5350' }]}>
              <AlertTriangle size={scale(18)} color="#C62828" strokeWidth={1.5} />
              <Text style={[styles.bannerText, { color: '#C62828' }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Category Picker */}
          <Text style={[styles.formLabel, { color: colors.gray }]}>Category</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.white, borderColor: colors.borderLight }]}
            onPress={() => setShowCategories((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Bug category, currently ${selectedCategoryLabel}`}
          >
            <Text style={[styles.pickerText, { color: colors.black }]}>{selectedCategoryLabel}</Text>
            <ChevronDown size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          </TouchableOpacity>

          {showCategories && (
            <View style={[styles.categoryList, { backgroundColor: colors.white, borderColor: colors.borderLight }]}>
              {CATEGORIES.map((cat) => {
                const isActive = cat.key === category;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryItem,
                      { borderBottomColor: colors.borderLight },
                      isActive && { backgroundColor: colors.cream },
                    ]}
                    onPress={() => {
                      setCategory(cat.key);
                      setShowCategories(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${cat.label}${isActive ? ', currently selected' : ''}`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.categoryItemText, { color: isActive ? colors.black : colors.gray }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Title */}
          <Text style={[styles.formLabel, { color: colors.gray }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.white, borderColor: colors.borderLight, color: colors.black }]}
            placeholder="Brief summary of the issue"
            placeholderTextColor={colors.gray}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            returnKeyType="next"
            accessibilityLabel="Bug report title"
          />

          {/* Description */}
          <Text style={[styles.formLabel, { color: colors.gray }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.white, borderColor: colors.borderLight, color: colors.black }]}
            placeholder="What happened? What did you expect to happen?"
            placeholderTextColor={colors.gray}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            accessibilityLabel="Bug report description"
          />

          {/* Diagnostics Preview */}
          <Text style={[styles.formLabel, { color: colors.gray }]}>Attached Diagnostics</Text>
          <View style={[styles.diagnosticsCard, { backgroundColor: colors.white, borderColor: colors.borderLight }]}>
            <Text style={[styles.diagnosticsText, { color: colors.textMuted }]}>{diagnostics}</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: canSubmit ? colors.black : colors.borderLight },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || isSending}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isSending ? 'Submitting bug report' : 'Submit bug report'}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Send size={scale(16)} color={canSubmit ? colors.white : colors.gray} strokeWidth={1.5} />
                <Text style={[styles.submitText, { color: canSubmit ? colors.white : colors.gray }]}>
                  Submit Report
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Website Link */}
          <TouchableOpacity
            style={styles.websiteLink}
            onPress={handleOpenWebsite}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Report on our website instead"
          >
            <ExternalLink size={scale(14)} color={colors.gray} strokeWidth={1.5} />
            <Text style={[styles.websiteLinkText, { color: colors.gray }]}>
              Report on our website instead
            </Text>
          </TouchableOpacity>

          {/* Licenses */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.gray }]}>Open Source Licenses</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
              {LICENSES.map((dep, index) => (
                <View key={dep.name} style={[styles.licenseRow, { borderBottomColor: colors.borderLight }, index === LICENSES.length - 1 && styles.lastRow]}>
                  <View style={styles.licenseInfo}>
                    <Text style={[styles.licenseName, { color: colors.black }]}>{dep.name}</Text>
                    <Text style={[styles.licenseAuthor, { color: colors.gray }]}>{dep.author}</Text>
                  </View>
                  <Text style={[styles.licenseType, { color: colors.gray }]}>{dep.license}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  // Identity
  identity: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  appName: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(32),
    marginTop: 16,
  },
  tagline: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginTop: 4,
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionCard: {
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  infoValue: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
  },
  // Bug report form
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: scale(8),
    padding: 14,
    marginBottom: 20,
  },
  bannerText: {
    flex: 1,
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    lineHeight: scale(18),
  },
  formLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: scale(8),
    paddingHorizontal: 14,
    minHeight: scale(44),
    marginBottom: 8,
  },
  pickerText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(13),
  },
  categoryList: {
    borderWidth: 1,
    borderRadius: scale(8),
    marginBottom: 16,
    overflow: 'hidden',
  },
  categoryItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  categoryItemText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
  },
  input: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(13),
    borderWidth: 1,
    borderRadius: scale(8),
    paddingHorizontal: 14,
    paddingVertical: scale(4),
    minHeight: scale(44),
    marginBottom: 16,
  },
  textArea: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(13),
    borderWidth: 1,
    borderRadius: scale(8),
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: scale(140),
    marginBottom: 16,
  },
  diagnosticsCard: {
    borderWidth: 1,
    borderRadius: scale(8),
    padding: 14,
    marginBottom: 24,
  },
  diagnosticsText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    lineHeight: scale(18),
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: scale(8),
    minHeight: scale(48),
    marginBottom: 16,
  },
  submitText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(13),
    fontWeight: '600',
  },
  websiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 24,
  },
  websiteLinkText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  // License rows
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  licenseInfo: {
    flex: 1,
  },
  licenseName: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(14),
  },
  licenseAuthor: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  licenseType: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginLeft: 12,
  },
});
