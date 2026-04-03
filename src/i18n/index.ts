/**
 * src/i18n/index.ts
 *
 * Internationalization setup using i18next.
 * Auto-detects device language, falls back to English.
 * Language can be overridden in settings.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ko from './locales/ko.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import ru from './locales/ru.json';

const LANGUAGE_KEY = 'app_language';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = { en, es, fr, de, pt, ja, zh, ko, it, nl, ru };

/**
 * Get the device's preferred language, mapped to our supported codes.
 * Falls back to 'en' if device language isn't supported.
 */
function getDeviceLanguage(): LanguageCode {
  let deviceLocale = 'en';
  try {
    if (Platform.OS === 'ios') {
      deviceLocale = NativeModules.SettingsManager?.settings?.AppleLocale
        || NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        || 'en';
    } else {
      deviceLocale = NativeModules.I18nManager?.localeIdentifier || 'en';
    }
    // Extract language code from locale (e.g., 'en_US' → 'en', 'pt-BR' → 'pt')
    deviceLocale = deviceLocale.split(/[-_]/)[0];
  } catch {
    deviceLocale = 'en';
  }
  const supported = SUPPORTED_LANGUAGES.find(l => l.code === deviceLocale);
  return (supported?.code || 'en') as LanguageCode;
}

/**
 * Initialize i18n. Call this before app renders.
 * Restores saved language preference, or uses device language.
 */
export async function initI18n(): Promise<void> {
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  const language = (savedLanguage as LanguageCode) || getDeviceLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      resources: Object.fromEntries(
        Object.entries(resources).map(([key, value]) => [key, { translation: value }])
      ),
      lng: language,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // React already escapes
      },
      react: {
        useSuspense: false, // Don't suspend during language load
      },
    });
}

/**
 * Change the app language. Persists to AsyncStorage.
 * Pass 'system' to use device language.
 */
export async function setLanguage(code: LanguageCode | 'system'): Promise<void> {
  if (code === 'system') {
    await AsyncStorage.removeItem(LANGUAGE_KEY);
    const deviceLang = getDeviceLanguage();
    await i18n.changeLanguage(deviceLang);
  } else {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
    await i18n.changeLanguage(code);
  }
}

/**
 * Get the currently active language code.
 */
export function getCurrentLanguage(): LanguageCode {
  return (i18n.language || 'en') as LanguageCode;
}

/**
 * Check if current language is RTL (Arabic, Hebrew, etc.)
 */
export function isRTL(): boolean {
  return i18n.dir() === 'rtl';
}

export default i18n;
