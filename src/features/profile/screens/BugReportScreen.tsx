/**
 * src/features/profile/screens/BugReportScreen.tsx
 *
 * In-app bug reporter. Collects a title, description, and category,
 * auto-includes device/app diagnostics, and submits directly to the
 * bug report API (same backend as mysecretlibrary.com/bugs.html).
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, Bug, ChevronDown, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react-native';
import { useAuth } from '@/core/auth';
import { APP_VERSION, BUILD_NUMBER, VERSION_DATE } from '@/constants/version';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { SettingsHeader } from '../components/SettingsHeader';

// =============================================================================
// CONSTANTS
// =============================================================================

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

/** Map app categories to severity for the API */
const CATEGORY_SEVERITY: Record<string, string> = {
  crash: 'critical',
  playback: 'high',
  sync: 'high',
  downloads: 'medium',
  ui: 'low',
  other: 'medium',
};

// =============================================================================
// HELPERS
// =============================================================================

function buildDiagnostics(serverUrl: string | null): string {
  const lines = [
    `App: Secret Library v${APP_VERSION} (${BUILD_NUMBER})`,
    `Date: ${VERSION_DATE}`,
    `Platform: ${Platform.OS} ${Platform.Version}`,
    `Server: ${serverUrl ? '(connected)' : '(none)'}`,
  ];
  return lines.join('\n');
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BugReportScreen() {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const { serverUrl } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [showCategories, setShowCategories] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const diagnostics = useMemo(() => buildDiagnostics(serverUrl), [serverUrl]);

  const canSubmit = title.trim().length > 0 && description.trim().length > 0;

  const selectedCategoryLabel = CATEGORIES.find((c: CategoryDef) => c.key === category)?.label ?? 'Other';

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

      const result = await res.json();

      if (res.ok) {
        setSubmitResult('success');
        setTitle('');
        setDescription('');
        setCategory('other');
      } else {
        setSubmitResult('error');
        setErrorMessage(result.error || 'Something went wrong. Try again.');
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
      <SettingsHeader title="Bug Report" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={styles.introRow}>
            <Bug size={scale(20)} color={colors.gray} strokeWidth={1.5} />
            <Text style={[styles.introText, { color: colors.gray }]}>
              Describe the issue you encountered. Diagnostic info is attached automatically.
            </Text>
          </View>

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
          <Text style={[styles.label, { color: colors.gray }]}>Category</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.white, borderColor: colors.borderLight }]}
            onPress={() => setShowCategories((v: boolean) => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pickerText, { color: colors.black }]}>{selectedCategoryLabel}</Text>
            <ChevronDown size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          </TouchableOpacity>

          {showCategories && (
            <View style={[styles.categoryList, { backgroundColor: colors.white, borderColor: colors.borderLight }]}>
              {CATEGORIES.map((cat: CategoryDef) => {
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
          <Text style={[styles.label, { color: colors.gray }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.white, borderColor: colors.borderLight, color: colors.black }]}
            placeholder="Brief summary of the issue"
            placeholderTextColor={colors.gray}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            returnKeyType="next"
          />

          {/* Description */}
          <Text style={[styles.label, { color: colors.gray }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.white, borderColor: colors.borderLight, color: colors.black }]}
            placeholder="What happened? What did you expect to happen?"
            placeholderTextColor={colors.gray}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          {/* Diagnostics Preview */}
          <Text style={[styles.label, { color: colors.gray }]}>Attached Diagnostics</Text>
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
          >
            <ExternalLink size={scale(14)} color={colors.gray} strokeWidth={1.5} />
            <Text style={[styles.websiteLinkText, { color: colors.gray }]}>
              Report on our website instead
            </Text>
          </TouchableOpacity>
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
  scrollContent: {
    paddingHorizontal: 16,
  },
  // Intro
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    marginBottom: 24,
  },
  introText: {
    flex: 1,
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    lineHeight: scale(18),
  },
  // Banners
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
  // Labels
  label: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  // Category picker
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
  // Text inputs
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
  // Diagnostics
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
  // Actions
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
  // Website link
  websiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  websiteLinkText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
});
