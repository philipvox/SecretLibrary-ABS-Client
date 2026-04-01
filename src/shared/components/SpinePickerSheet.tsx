/**
 * src/shared/components/SpinePickerSheet.tsx
 *
 * Inline content for the spine picker — renders inside the BookContextMenu modal.
 * Shows the procedural spine first, then available community spine images,
 * with the current selection highlighted.
 * Includes a (+) card to add a custom spine from the phone's gallery.
 * Long-press the procedural spine to pick a custom background color.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, Check, Plus } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { scale } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { BookSpineVertical, BookSpineVerticalData } from '@/features/home/components/BookSpineVertical';

const COMMUNITY_SPINE_URL = 'https://spines.mysecretlibrary.com';
const SPINE_DISPLAY_HEIGHT = scale(280);
const LOCAL_SPINES_DIR = `${FileSystem.documentDirectory}custom-spines/`;

// HSV ↔ Hex conversion helpers
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** Build gradient stops for the hue bar at current S and V */
function hueGradientColors(s: number, v: number): [string, string, ...string[]] {
  return Array.from({ length: 13 }, (_, i) => hsvToHex((i / 12) * 360, s, v)) as [string, string, ...string[]];
}

interface SpineOption {
  id: string;
  url: string;
  width: number;
  height: number;
  votes: number;
  isCurrent: boolean;
  isLocal?: boolean;
}

interface SpinePickerContentProps {
  bookId: string | undefined;
  bookTitle: string;
  onBack: () => void;
}

/** Ensure the local spines directory exists */
async function ensureSpineDir() {
  const info = await FileSystem.getInfoAsync(LOCAL_SPINES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOCAL_SPINES_DIR, { intermediates: true });
  }
}

/** Submit a spine image to the community server for review */
async function submitToCommunity(
  localUri: string,
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
  asin?: string,
  isbn?: string,
): Promise<string | null> {
  try {
    const formData = new FormData();
    const filename = localUri.split('/').pop() || 'spine.png';
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'webp' ? 'image/webp' : 'image/png';

    formData.append('spine', {
      uri: localUri,
      name: filename,
      type: mimeType,
    } as any);
    formData.append('title', bookTitle);
    formData.append('author', bookAuthor);
    if (asin) formData.append('asin', asin);
    if (isbn) formData.append('isbn', isbn);

    const res = await fetch(`${COMMUNITY_SPINE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.spine_id || data.spineId || data.id || null;
  } catch {
    return null;
  }
}

export function SpinePickerContent({ bookId, bookTitle, onBack }: SpinePickerContentProps) {
  const [loading, setLoading] = useState(true);
  const [spines, setSpines] = useState<SpineOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [proceduralSelected, setProceduralSelected] = useState(false);
  const [hue, setHue] = useState(200);
  const [sat, setSat] = useState(0.5);
  const [val, setVal] = useState(0.35);

  const setSpineOverride = useSpineCacheStore((s) => s.setSpineOverride);
  const clearSpineOverride = useSpineCacheStore((s) => s.clearSpineOverride);
  const spineOverrides = useSpineCacheStore((s) => s.spineOverrides);
  const promptCommunitySubmit = useSpineCacheStore((s) => s.promptCommunitySubmit);
  const addPendingSubmission = useSpineCacheStore((s) => s.addPendingSubmission);
  const setAccentColor = useSpineCacheStore((s) => s.setAccentColor);
  const accentColors = useSpineCacheStore((s) => s.accentColors);

  // Build procedural spine data from library cache
  const proceduralSpineData: BookSpineVerticalData | null = useMemo(() => {
    if (!bookId) return null;
    const items = useLibraryCache.getState().items;
    const localItem = items.find((i: any) => i.id === bookId);
    const metadata = localItem?.media?.metadata as any;
    if (!metadata) return null;
    return {
      id: bookId,
      title: metadata.title || bookTitle,
      author: metadata.authorName || metadata.authors?.[0]?.name || '',
      genres: metadata.genres || [],
      tags: (localItem?.media as any)?.tags || [],
      duration: (localItem?.media as any)?.duration || 0,
      seriesName: metadata.seriesName || metadata.series?.[0]?.name,
    };
  }, [bookId, bookTitle]);

  // Procedural spine dimensions (proportional to display height)
  const proceduralWidth = scale(45);
  const proceduralHeight = SPINE_DISPLAY_HEIGHT;

  // Determine if procedural is the active selection (no override set, or no spines)
  useEffect(() => {
    if (!bookId) return;
    const override = spineOverrides[bookId];
    setProceduralSelected(!override);
  }, [bookId, spineOverrides]);

  // Fetch available spines from community server
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const communityBookId = useSpineCacheStore.getState().communityBookMap[bookId];
        const items = useLibraryCache.getState().items;
        const localItem = items.find((i: any) => i.id === bookId);
        const metadata = localItem?.media?.metadata as any;
        const asin = metadata?.asin;
        const isbn = metadata?.isbn;

        const lookupId = communityBookId || asin || isbn || bookId;

        const currentOverride = spineOverrides[bookId];
        const options: SpineOption[] = [];

        // Check if there's a local custom spine
        try {
          await ensureSpineDir();
          const localPath = `${LOCAL_SPINES_DIR}${bookId}.png`;
          const localInfo = await FileSystem.getInfoAsync(localPath);
          if (localInfo.exists) {
            options.push({
              id: 'local',
              url: localPath,
              width: 150,
              height: 1200,
              votes: 0,
              isCurrent: currentOverride === localPath,
              isLocal: true,
            });
          }
        } catch {
          // Local spine check failed — non-critical, continue
        }

        if (cancelled) return;

        // Fetch community spines with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(
            `${COMMUNITY_SPINE_URL}/api/book/${encodeURIComponent(lookupId)}/spines`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);

          if (cancelled) return;

          if (res.ok) {
            const data = await res.json();
            if (cancelled) return;

            for (let idx = 0; idx < (data.spines || []).length; idx++) {
              const s = data.spines[idx];
              const fullUrl = `${COMMUNITY_SPINE_URL}${s.url}`;
              const isCurrent = currentOverride
                ? currentOverride.includes(s.id)
                : false;

              options.push({
                id: s.id,
                url: fullUrl,
                width: s.width || 150,
                height: s.height || 1200,
                votes: s.votes || 0,
                isCurrent,
              });
            }
          }
        } catch {
          clearTimeout(timeout);
          // Fetch failed — show what we have (procedural + local)
        }

        if (!cancelled) setSpines(options);
      } catch {
        if (!cancelled) setError('Failed to load spines');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bookId]);

  const handleSelectProcedural = useCallback(() => {
    if (!bookId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearSpineOverride(bookId);
    setProceduralSelected(true);
    setSpines((prev) => prev.map((s) => ({ ...s, isCurrent: false })));
    setShowColorPicker(false);
  }, [bookId, clearSpineOverride]);

  const handleLongPressProcedural = useCallback(() => {
    if (!bookId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowColorPicker((prev) => {
      if (!prev) {
        // Initialize sliders from current accent color
        const current = useSpineCacheStore.getState().accentColors[bookId];
        if (current) {
          const hsv = hexToHsv(current);
          setHue(hsv.h);
          setSat(hsv.s);
          setVal(hsv.v);
        }
      }
      return !prev;
    });
  }, [bookId]);

  const applyColor = useCallback((color: string) => {
    if (!bookId) return;
    setAccentColor(bookId, color);
    // Also select procedural spine
    clearSpineOverride(bookId);
    setProceduralSelected(true);
    setSpines((prev) => prev.map((s) => ({ ...s, isCurrent: false })));
  }, [bookId, setAccentColor, clearSpineOverride]);

  const handleSliderChange = useCallback((newH: number, newS: number, newV: number) => {
    const color = hsvToHex(newH, newS, newV);
    applyColor(color);
  }, [applyColor]);

  const handleResetColor = useCallback(() => {
    if (!bookId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Remove the custom accent color so it falls back to cover-extracted or genre
    const { accentColors: colors, ...rest } = useSpineCacheStore.getState();
    const { [bookId]: _, ...remaining } = colors;
    useSpineCacheStore.setState({
      accentColors: remaining,
      colorVersion: useSpineCacheStore.getState().colorVersion + 1,
    });
  }, [bookId]);

  const handleSelect = useCallback(
    (spine: SpineOption) => {
      if (!bookId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setProceduralSelected(false);
      setShowColorPicker(false);
      setSpines((prev) =>
        prev.map((s) => ({ ...s, isCurrent: s.id === spine.id }))
      );

      // Always set the override URL — this ensures the spine works
      // even when community/server spines are globally disabled
      setSpineOverride(bookId, spine.url);
    },
    [bookId, spines, setSpineOverride, clearSpineOverride]
  );

  const handleLongPressLocal = useCallback(
    (spine: SpineOption) => {
      if (!bookId || !spine.isLocal) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      Alert.alert(
        'Remove Local Spine?',
        'This will delete your custom spine image for this book.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await FileSystem.deleteAsync(spine.url, { idempotent: true });
              } catch {}
              clearSpineOverride(bookId);
              setSpines((prev) => {
                const without = prev.filter((s) => !s.isLocal);
                if (without.length > 0 && !without.some((s) => s.isCurrent)) {
                  without[0].isCurrent = true;
                }
                return without;
              });
            },
          },
        ],
      );
    },
    [bookId, clearSpineOverride]
  );

  const handleAddCustom = useCallback(async () => {
    if (!bookId) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Save to local spines directory
    await ensureSpineDir();
    const destPath = `${LOCAL_SPINES_DIR}${bookId}.png`;
    await FileSystem.copyAsync({ from: asset.uri, to: destPath });

    // Set as the override for this book
    setSpineOverride(bookId, destPath);
    setProceduralSelected(false);
    setShowColorPicker(false);

    // Add to spine list and mark as current
    setSpines((prev) => {
      const withoutLocal = prev.map((s) => ({ ...s, isCurrent: false }));
      const existingLocal = withoutLocal.findIndex((s) => s.isLocal);
      const localEntry: SpineOption = {
        id: 'local',
        url: destPath,
        width: asset.width || 150,
        height: asset.height || 1200,
        votes: 0,
        isCurrent: true,
        isLocal: true,
      };
      if (existingLocal >= 0) {
        withoutLocal[existingLocal] = localEntry;
      } else {
        withoutLocal.unshift(localEntry);
      }
      return withoutLocal;
    });

    // Prompt to submit to community
    if (promptCommunitySubmit) {
      const items = useLibraryCache.getState().items;
      const localItem = items.find((i: any) => i.id === bookId);
      const metadata = localItem?.media?.metadata as any;
      const author = metadata?.authorName || metadata?.authors?.[0]?.name || '';
      const asin = metadata?.asin;
      const isbn = metadata?.isbn;

      Alert.alert(
        'Share with Community?',
        'Submit this spine to Secret Spines for other users to enjoy? It will be reviewed before appearing publicly.',
        [
          { text: 'Skip', style: 'cancel' },
          {
            text: 'Submit',
            onPress: async () => {
              const spineId = await submitToCommunity(destPath, bookId, bookTitle, author, asin, isbn);
              if (spineId) {
                addPendingSubmission(spineId, bookTitle);
                Alert.alert('Submitted!', 'Your spine has been submitted for review. You\'ll be notified when it\'s approved.');
              } else {
                Alert.alert('Upload Failed', 'Could not reach the community server. Your spine is still saved locally.');
              }
            },
          },
        ],
      );
    }
  }, [bookId, bookTitle, setSpineOverride, promptCommunitySubmit, addPendingSubmission]);

  const currentAccentColor = bookId ? accentColors[bookId] : undefined;

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <TouchableOpacity onPress={onBack} style={styles.backRow}>
        <ChevronLeft size={scale(18)} color="rgba(255,255,255,0.5)" />
        <Text style={styles.backLabel}>Choose Spine</Text>
      </TouchableOpacity>

      <Text style={styles.bookTitle} numberOfLines={1}>{bookTitle}</Text>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={secretLibraryColors.gold} />
          <Text style={styles.statusText}>Loading spines...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.statusText, { color: secretLibraryColors.coral }]}>{error}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Procedural spine option */}
            {proceduralSpineData && (
              <View style={styles.spineColumn}>
                <TouchableOpacity
                  onPress={handleSelectProcedural}
                  onLongPress={handleLongPressProcedural}
                  delayLongPress={400}
                  style={[
                    styles.spineCard,
                    proceduralSelected && styles.spineCardActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <View pointerEvents="none">
                    <BookSpineVertical
                      book={proceduralSpineData}
                      width={proceduralWidth}
                      height={proceduralHeight}
                      leanAngle={0}
                      isActive={false}
                      showShadow={false}
                      proceduralOnly
                    />
                  </View>
                  {proceduralSelected && (
                    <View style={styles.checkBadge}>
                      <Check size={scale(12)} color="#000" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.cardLabel}>Hold{'\n'}for Color</Text>
              </View>
            )}

            {spines.map((spine) => {
              const aspect = spine.width / spine.height;
              const displayWidth = SPINE_DISPLAY_HEIGHT * aspect;
              const label = spine.isLocal ? 'Local' : 'Community\nSpine';

              return (
                <View key={spine.id} style={styles.spineColumn}>
                  <TouchableOpacity
                    onPress={() => handleSelect(spine)}
                    onLongPress={spine.isLocal ? () => handleLongPressLocal(spine) : undefined}
                    delayLongPress={500}
                    style={[
                      styles.spineCard,
                      spine.isCurrent && !proceduralSelected && styles.spineCardActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: spine.url }}
                      style={{
                        width: Math.max(displayWidth, scale(45)),
                        height: SPINE_DISPLAY_HEIGHT,
                      }}
                      contentFit="fill"
                    />
                    {spine.isCurrent && !proceduralSelected && (
                      <View style={styles.checkBadge}>
                        <Check size={scale(12)} color="#000" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.cardLabel}>{label}</Text>
                </View>
              );
            })}

            {/* Add custom spine button */}
            <View style={styles.spineColumn}>
              <TouchableOpacity
                onPress={handleAddCustom}
                style={styles.addCard}
                activeOpacity={0.7}
              >
                <View style={styles.addOutline}>
                  <Plus size={scale(24)} color="rgba(255,255,255,0.3)" />
                </View>
              </TouchableOpacity>
              <Text style={styles.cardLabel}>Add{'\n'}Spine</Text>
            </View>
          </ScrollView>

          {/* HSV color picker (shown on long-press of procedural spine) */}
          {showColorPicker && (() => {
            const previewColor = hsvToHex(hue, sat, val);
            const hueColors = hueGradientColors(sat, val);
            const satLow = hsvToHex(hue, 0, val);
            const satHigh = hsvToHex(hue, 1, val);
            const valLow = hsvToHex(hue, sat, 0);
            const valHigh = hsvToHex(hue, sat, 1);
            return (
              <View style={styles.colorPickerContainer}>
                <View style={styles.colorPickerHeader}>
                  <View style={styles.colorPickerTitleRow}>
                    <View style={[styles.previewSwatch, { backgroundColor: previewColor }]} />
                    <Text style={styles.colorPickerTitle}>Spine Color</Text>
                  </View>
                  <TouchableOpacity onPress={handleResetColor} activeOpacity={0.7}>
                    <Text style={styles.resetLabel}>Reset</Text>
                  </TouchableOpacity>
                </View>

                {/* Hue slider */}
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>H</Text>
                  <View style={styles.sliderTrackWrap}>
                    <LinearGradient
                      colors={hueColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sliderGradient}
                    />
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={360}
                      value={hue}
                      onValueChange={(v) => { setHue(v); handleSliderChange(v, sat, val); }}
                      minimumTrackTintColor="transparent"
                      maximumTrackTintColor="transparent"
                      thumbTintColor="#fff"
                    />
                  </View>
                </View>

                {/* Saturation slider */}
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>S</Text>
                  <View style={styles.sliderTrackWrap}>
                    <LinearGradient
                      colors={[satLow, satHigh]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sliderGradient}
                    />
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={1}
                      value={sat}
                      onValueChange={(v) => { setSat(v); handleSliderChange(hue, v, val); }}
                      minimumTrackTintColor="transparent"
                      maximumTrackTintColor="transparent"
                      thumbTintColor="#fff"
                    />
                  </View>
                </View>

                {/* Value (brightness) slider */}
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>V</Text>
                  <View style={styles.sliderTrackWrap}>
                    <LinearGradient
                      colors={[valLow, valHigh]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sliderGradient}
                    />
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={1}
                      value={val}
                      onValueChange={(v) => { setVal(v); handleSliderChange(hue, sat, v); }}
                      minimumTrackTintColor="transparent"
                      maximumTrackTintColor="transparent"
                      thumbTintColor="#fff"
                    />
                  </View>
                </View>
              </View>
            );
          })()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: scale(420),
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginBottom: scale(4),
  },
  backLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: scale(12),
    fontFamily: fonts.jetbrainsMono.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookTitle: {
    color: '#fff',
    fontSize: scale(15),
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: scale(16),
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(40),
  },
  statusText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: scale(12),
    marginTop: scale(8),
    textAlign: 'center',
  },
  scrollContent: {
    paddingVertical: scale(8),
    alignItems: 'flex-end',
    gap: scale(12),
  },
  spineColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  spineCard: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: scale(4),
    padding: scale(6),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  spineCardActive: {
    borderColor: secretLibraryColors.gold,
    backgroundColor: 'rgba(243,182,12,0.08)',
  },
  checkBadge: {
    position: 'absolute',
    top: scale(2),
    right: scale(2),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: secretLibraryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: scale(9),
    fontFamily: fonts.jetbrainsMono.regular,
    textAlign: 'center',
    marginTop: scale(6),
    lineHeight: scale(12),
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: scale(6),
  },
  addOutline: {
    width: scale(50),
    height: SPINE_DISPLAY_HEIGHT,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    borderRadius: scale(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerContainer: {
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(14),
  },
  colorPickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  previewSwatch: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  colorPickerTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: scale(11),
    fontFamily: fonts.jetbrainsMono.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resetLabel: {
    color: secretLibraryColors.gold,
    fontSize: scale(11),
    fontFamily: fonts.jetbrainsMono.regular,
    letterSpacing: 0.3,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  sliderLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: scale(10),
    fontFamily: fonts.jetbrainsMono.regular,
    width: scale(12),
    textAlign: 'center',
  },
  sliderTrackWrap: {
    flex: 1,
    height: scale(28),
    borderRadius: scale(14),
    overflow: 'hidden',
    justifyContent: 'center',
  },
  sliderGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(14),
  },
  slider: {
    width: '100%',
    height: scale(28),
  },
});
