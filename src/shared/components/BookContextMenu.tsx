/**
 * src/shared/components/BookContextMenu.tsx
 *
 * Bottom sheet context menu — editorial, high-contrast design.
 *
 * Layout (top to bottom):
 * ┌─────────────────────────────────────┐
 * │          ˅ (close chevron)          │
 * │  [Cover] Title              [share] │
 * │          Author / Narrator / Series │
 * │                                     │
 * │  Series Name                      > │
 * │  Author Name                      > │
 * │  Narrator Name                    > │
 * │                                     │
 * │  (Queue)(Save)(DL)(Done)(Playlist)  │
 * │                                     │
 * │  [DETAILS]  [▶▶▶▶▶ PLAY ▶▶▶▶▶]    │
 * └─────────────────────────────────────┘
 *
 * Toggle actions do NOT close the sheet. Only backdrop tap, chevron, or navigation rows close.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  useWindowDimensions,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Download,
  Play,
  ListPlus,
  BookOpen,
  Check,
  Trash2,
  Library,
  ListMusic,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Layers,
  User,
  Mic,
  Share2,
  X as XIcon,
  type LucideIcon,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { useDownloadStatus, useDownloads } from '@/core/hooks/useDownloads';
import { useQueueStore, useIsInQueue } from '@/features/queue/stores/queueStore';
import { useProgressStore, useIsInLibrary } from '@/core/stores/progressStore';
import { usePlayerStore } from '@/features/player/stores';
import { useIsComplete, useToggleComplete } from '@/features/completion';
import { usePlaylists } from '@/features/playlists/hooks/usePlaylists';
import { playlistsApi } from '@/core/api/endpoints/playlists';
import { useLibraryCache } from '@/core/cache';
import { useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/shared/hooks/useToast';
import { scale, spacing, radius, useTheme, type ThemeColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import type { LibraryItem, Playlist } from '@/core/types';

// Palette — high contrast black/white
const BLACK = '#0f0f0f';
const WHITE = '#FFFFFF';
const WHITE_DIM = '#e8e8e8';
const ICON_SIZE = scale(16);
const DANGER = '#E85050';
const ACCENT = '#F3B60C';

// =============================================================================
// TOGGLE ACTION — icon circle grid
// =============================================================================

interface ToggleActionProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  progress?: number; // 0-1 for progress ring
}

const TOGGLE_SIZE = scale(44);
const PROGRESS_STROKE = 3;

function ToggleAction({ icon: Icon, label, onPress, active, danger, progress }: ToggleActionProps) {
  const iconColor = danger ? DANGER
    : active ? BLACK
    : 'rgba(255,255,255,0.5)';
  const circleBg = danger ? 'transparent'
    : active ? WHITE
    : 'transparent';
  const circleBorder = danger ? 'rgba(232,80,80,0.3)'
    : active ? WHITE
    : 'rgba(255,255,255,0.15)';
  const labelColor = danger ? DANGER
    : active ? WHITE
    : 'rgba(255,255,255,0.4)';

  const showProgress = progress !== undefined && progress > 0 && progress < 1;

  return (
    <TouchableOpacity
      style={styles.toggleAction}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.6}
    >
      {showProgress ? (
        <View style={[styles.toggleCircle, { borderWidth: 0 }]}>
          <Svg width={TOGGLE_SIZE} height={TOGGLE_SIZE} style={StyleSheet.absoluteFill}>
            <SvgCircle
              cx={TOGGLE_SIZE / 2}
              cy={TOGGLE_SIZE / 2}
              r={(TOGGLE_SIZE - PROGRESS_STROKE) / 2}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={PROGRESS_STROKE}
              fill="none"
            />
            <SvgCircle
              cx={TOGGLE_SIZE / 2}
              cy={TOGGLE_SIZE / 2}
              r={(TOGGLE_SIZE - PROGRESS_STROKE) / 2}
              stroke="#4ADE80"
              strokeWidth={PROGRESS_STROKE}
              fill="none"
              strokeDasharray={`${Math.PI * (TOGGLE_SIZE - PROGRESS_STROKE)}`}
              strokeDashoffset={`${Math.PI * (TOGGLE_SIZE - PROGRESS_STROKE) * (1 - progress!)}`}
              strokeLinecap="round"
              rotation={-90}
              origin={`${TOGGLE_SIZE / 2}, ${TOGGLE_SIZE / 2}`}
            />
          </Svg>
          <Icon size={ICON_SIZE} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        </View>
      ) : (
        <View style={[
          styles.toggleCircle,
          { backgroundColor: circleBg, borderColor: circleBorder },
        ]}>
          <Icon size={ICON_SIZE} color={iconColor} strokeWidth={active ? 2.5 : 1.5} />
        </View>
      )}
      <Text style={[styles.toggleLabel, { color: showProgress ? '#4ADE80' : labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// NAV ROW — text row with chevron
// =============================================================================

interface NavRowProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function NavRow({ icon: Icon, label, onPress, danger }: NavRowProps) {
  const color = danger ? DANGER : 'rgba(255,255,255,0.5)';
  const chevronColor = danger ? 'rgba(232,80,80,0.4)' : 'rgba(255,255,255,0.25)';
  return (
    <TouchableOpacity
      style={styles.navRow}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.6}
    >
      <Icon size={scale(14)} color={color} strokeWidth={1.5} />
      <Text style={[styles.navRowLabel, danger && { color: DANGER }]}>{label}</Text>
      <ChevronRight size={scale(14)} color={chevronColor} strokeWidth={2} />
    </TouchableOpacity>
  );
}

// =============================================================================
// PLAYLIST PICKER SUB-VIEW
// =============================================================================

function PlaylistPicker({
  book,
  onBack,
  onDone,
}: {
  book: LibraryItem;
  onBack: () => void;
  onDone: (playlistName?: string, playlistId?: string) => void;
}) {
  const { data: playlists, isLoading } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const libraryId = useLibraryCache((s) => s.currentLibraryId);

  const filteredPlaylists = (playlists || []).filter(p => !p.name.startsWith('__sl_'));

  const handleAddToPlaylist = useCallback(async (playlist: Playlist) => {
    try {
      await playlistsApi.batchAdd(playlist.id, [book.id]);
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(playlist.name, playlist.id);
    } catch {
      Alert.alert('Error', 'Failed to add to playlist');
    }
  }, [book.id, queryClient, onDone]);

  const handleCreatePlaylist = useCallback(async () => {
    if (!newName.trim() || !libraryId) return;
    setSubmitting(true);
    try {
      const playlist = await playlistsApi.create({
        libraryId,
        name: newName.trim(),
        items: [{ libraryItemId: book.id }],
      });
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(newName.trim(), playlist.id);
    } catch {
      Alert.alert('Error', 'Failed to create playlist');
    } finally {
      setSubmitting(false);
    }
  }, [newName, libraryId, book.id, queryClient, onDone]);

  const renderPlaylistItem = useCallback(({ item }: { item: Playlist }) => {
    const itemCount = item.items?.length || 0;
    const alreadyAdded = item.items?.some((pi) => pi.libraryItemId === book.id);
    return (
      <TouchableOpacity
        style={styles.playlistRow}
        onPress={() => !alreadyAdded && handleAddToPlaylist(item)}
        disabled={alreadyAdded}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.playlistName,
            alreadyAdded && styles.playlistNameActive,
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <View style={styles.playlistRowRight}>
          <Text style={styles.playlistCount}>{itemCount}</Text>
          {alreadyAdded && <Check size={scale(13)} color={ACCENT} strokeWidth={2.5} />}
        </View>
      </TouchableOpacity>
    );
  }, [book.id, handleAddToPlaylist]);

  return (
    <View>
      <View style={styles.playlistHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={scale(16)} color={WHITE_DIM} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.playlistTitle}>Add to Playlist</Text>
        <View style={{ width: scale(16) }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="rgba(255,255,255,0.5)" />
        </View>
      ) : (
        <FlatList
          data={filteredPlaylists}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaylistItem}
          style={styles.playlistList}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No playlists yet</Text>
          }
        />
      )}

      {creating ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            placeholder="Playlist name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreatePlaylist}
          />
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreatePlaylist}
            disabled={!newName.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={BLACK} />
            ) : (
              <Check size={scale(14)} color={BLACK} strokeWidth={3} />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.createNewRow}
          onPress={() => setCreating(true)}
          activeOpacity={0.7}
        >
          <Plus size={scale(13)} color={WHITE_DIM} strokeWidth={2} />
          <Text style={styles.createNewLabel}>New Playlist</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface BookContextMenuProps {
  book: LibraryItem | null;
  visible: boolean;
  onClose: () => void;
  onViewDetails?: (book: LibraryItem) => void;
  playlistId?: string;
}

export function BookContextMenu({
  book,
  visible,
  onClose,
  onViewDetails,
  playlistId,
}: BookContextMenuProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { height: screenHeight } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const addToast = useToastStore((s) => s.addToast);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  // Book state
  const { isDownloaded, isDownloading, progress: dlProgress } = useDownloadStatus(book?.id || '');
  const isInQueue = useIsInQueue(book?.id || '');
  const isInLibrary = useIsInLibrary(book?.id || '');
  const isComplete = useIsComplete(book?.id || '');
  const toggleComplete = useToggleComplete();
  const coverUrl = useCoverUrl(book?.id || '');

  // Actions
  const { queueDownload, cancelDownload, deleteDownload } = useDownloads();
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);
  const addToLibrary = useProgressStore((s) => s.addToLibrary);
  const removeFromLibrary = useProgressStore((s) => s.removeFromLibrary);
  const loadBook = usePlayerStore((s) => s.loadBook);
  const queryClient = useQueryClient();

  // Metadata
  const metadata = book?.media?.metadata as any;
  const title = metadata?.title || 'Untitled';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || '';
  const narrator = metadata?.narratorName || metadata?.narrators?.[0] || '';
  const seriesNameRaw = metadata?.seriesName || metadata?.series?.[0]?.name || '';
  const seriesName = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();
  const seriesDisplay = seriesNameRaw.trim(); // Keep "#43" for display

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setShowPlaylistPicker(false), 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: screenHeight, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // ─── Toggle actions (do NOT close sheet) ────────────────────────────

  const handlePlay = useCallback(() => {
    if (book) {
      loadBook(book, { autoPlay: true, showPlayer: true });
      onClose();
    }
  }, [book, loadBook, onClose]);

  const handleQueueToggle = useCallback(() => {
    if (!book) return;
    if (isInQueue) {
      removeFromQueue(book.id);
      addToast({ type: 'success', message: 'Removed from Queue', duration: 3000, onUndo: () => addToQueue(book) });
    } else {
      addToQueue(book);
      addToast({ type: 'success', message: 'Added to Queue', duration: 3000, onUndo: () => removeFromQueue(book.id) });
    }
  }, [book, isInQueue, addToQueue, removeFromQueue, addToast]);

  const handleLibraryToggle = useCallback(() => {
    if (!book) return;
    if (isInLibrary) {
      // Confirm before removing
      Alert.alert(
        'Remove from Library?',
        'This will remove your reading progress for this book.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              removeFromLibrary(book.id);
              addToast({ type: 'success', message: 'Removed from Library', duration: 5000, onUndo: () => addToLibrary(book.id) });
            },
          },
        ],
      );
    } else {
      addToLibrary(book.id);
      addToast({ type: 'success', message: 'Saved to Library', duration: 3000, onUndo: () => removeFromLibrary(book.id) });
    }
  }, [book, isInLibrary, addToLibrary, removeFromLibrary, addToast]);

  const handleDownload = useCallback(() => {
    if (!book) return;
    if (isDownloaded) {
      deleteDownload(book.id);
      addToast({ type: 'info', message: 'Download Removed', duration: 3000 });
    } else if (isDownloading) {
      cancelDownload(book.id);
      addToast({ type: 'info', message: 'Download Cancelled', duration: 3000 });
    } else {
      queueDownload(book);
      addToast({ type: 'success', message: 'Download Started', duration: 3000 });
    }
  }, [book, isDownloaded, isDownloading, queueDownload, cancelDownload, deleteDownload, addToast]);

  const handleToggleComplete = useCallback(async () => {
    if (!book) return;
    await toggleComplete(book.id);
    addToast({ type: 'success', message: isComplete ? 'Marked as Unfinished' : 'Marked as Finished', duration: 3000 });
  }, [book, isComplete, toggleComplete, addToast]);

  // ─── Navigation actions (close sheet) ───────────────────────────────

  const handleViewDetails = useCallback(() => {
    if (book && onViewDetails) {
      onViewDetails(book);
      onClose();
    }
  }, [book, onViewDetails, onClose]);

  const handleGoToSeries = useCallback(() => {
    if (seriesName) {
      navigation.navigate('SeriesDetail', { seriesName });
      onClose();
    }
  }, [seriesName, navigation, onClose]);

  const handleGoToAuthor = useCallback(() => {
    if (author) {
      navigation.navigate('AuthorDetail', { authorName: author });
      onClose();
    }
  }, [author, navigation, onClose]);

  const handleShare = useCallback(async () => {
    if (!book) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const parts = [title];
    if (author) parts.push(`by ${author}`);
    if (seriesDisplay) parts.push(`(${seriesDisplay})`);
    try {
      await Share.share({ message: parts.join(' ') });
    } catch {}
  }, [book, title, author, seriesDisplay]);

  const handleRemoveFromPlaylist = useCallback(async () => {
    if (!book || !playlistId) return;
    try {
      await playlistsApi.batchRemove(playlistId, [book.id]);
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const bookId = book.id;
      addToast({
        type: 'success', message: 'Removed from Playlist', duration: 5000,
        onUndo: async () => { await playlistsApi.batchAdd(playlistId, [bookId]); queryClient.invalidateQueries({ queryKey: ['playlists'] }); },
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to remove from playlist');
    }
  }, [book, playlistId, queryClient, onClose, addToast]);

  const handlePlaylistDone = useCallback((playlistName?: string, addedPlaylistId?: string) => {
    if (book && playlistName && addedPlaylistId) {
      const bookId = book.id;
      addToast({
        type: 'success', message: `Added to ${playlistName}`, duration: 5000,
        onUndo: async () => { await playlistsApi.batchRemove(addedPlaylistId, [bookId]); queryClient.invalidateQueries({ queryKey: ['playlists'] }); },
      });
    }
    setShowPlaylistPicker(false);
  }, [book, addToast, queryClient]);

  if (!book) return null;

  // Download label/icon
  const dlLabel = isDownloading ? `${Math.round(dlProgress * 100)}%`
    : isDownloaded ? 'Remove' : 'Download';
  const DlIcon = isDownloading ? XIcon : isDownloaded ? Trash2 : Download;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom + scale(8) },
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* Close handle */}
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeHandle}
                hitSlop={{ top: 8, bottom: 8, left: 40, right: 40 }}
              >
                <ChevronDown size={scale(18)} color="rgba(255,255,255,0.35)" strokeWidth={2.5} />
              </TouchableOpacity>

              {showPlaylistPicker ? (
                <PlaylistPicker
                  book={book}
                  onBack={() => setShowPlaylistPicker(false)}
                  onDone={handlePlaylistDone}
                />
              ) : (
                <>
                  {/* Header: cover + metadata + share */}
                  <View style={styles.header}>
                    <Image source={coverUrl} style={styles.cover} contentFit="cover" />
                    <View style={styles.headerInfo}>
                      <Text style={styles.title} numberOfLines={1}>{title}</Text>
                      {seriesDisplay ? <Text style={styles.metaLine} numberOfLines={1}>{seriesDisplay}</Text> : null}
                    </View>
                    <TouchableOpacity
                      onPress={handleShare}
                      style={styles.shareBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Share2 size={scale(20)} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                    </TouchableOpacity>
                  </View>

                  {/* ── Navigation rows ── */}
                  <View style={styles.navSection}>
                    {seriesName ? (
                      <NavRow icon={Layers} label={seriesName} onPress={handleGoToSeries} />
                    ) : null}
                    {author ? (
                      <NavRow icon={User} label={author} onPress={handleGoToAuthor} />
                    ) : null}
                    {narrator ? (
                      <NavRow icon={Mic} label={narrator} onPress={() => {
                        navigation.navigate('NarratorDetail', { narratorName: narrator });
                        onClose();
                      }} />
                    ) : null}
                    {playlistId && (
                      <NavRow icon={Trash2} label="Remove from Playlist" onPress={handleRemoveFromPlaylist} danger />
                    )}
                  </View>

                  {/* ── Toggle grid (5 icons) ── */}
                  <View style={styles.toggleGrid}>
                    <ToggleAction
                      icon={isInQueue ? Check : ListPlus}
                      label={isInQueue ? 'Queued' : 'Queue'}
                      onPress={handleQueueToggle}
                      active={isInQueue}
                    />
                    <ToggleAction
                      icon={isInLibrary ? Check : Library}
                      label={isInLibrary ? 'Saved' : 'Save'}
                      onPress={handleLibraryToggle}
                      active={isInLibrary}
                    />
                    <ToggleAction
                      icon={DlIcon}
                      label={dlLabel}
                      onPress={handleDownload}
                      danger={isDownloaded}
                      progress={isDownloading ? dlProgress : undefined}
                    />
                    <ToggleAction
                      icon={CheckCircle}
                      label={isComplete ? 'Unfinish' : 'Finished'}
                      onPress={handleToggleComplete}
                      active={isComplete}
                    />
                    <ToggleAction
                      icon={ListMusic}
                      label="Playlist"
                      onPress={() => setShowPlaylistPicker(true)}
                    />
                  </View>

                  {/* ── Button row: Details (1/3) + Play (2/3) ── */}
                  <View style={styles.buttonRow}>
                    {onViewDetails && (
                      <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={handleViewDetails}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.detailsBtnText}>DETAILS</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.playBtn}
                      onPress={handlePlay}
                      activeOpacity={0.85}
                    >
                      <Play size={scale(16)} color={BLACK} fill={BLACK} strokeWidth={0} />
                      <Text style={styles.playBtnText}>PLAY</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BLACK,
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    paddingTop: scale(10),
    paddingHorizontal: scale(20),
  },
  closeHandle: {
    alignSelf: 'center',
    paddingVertical: scale(4),
    marginBottom: scale(10),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  cover: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(4),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  title: {
    color: WHITE,
    fontSize: scale(15),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metaLine: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: scale(10),
    marginTop: scale(2),
    fontFamily: fonts.jetbrainsMono.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareBtn: {
    padding: scale(6),
  },

  // Navigation rows
  navSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: scale(8),
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    gap: scale(10),
  },
  navRowLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Toggle grid
  toggleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: scale(18),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: scale(16),
  },
  toggleAction: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: scale(2),
  },
  toggleCircle: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  toggleLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },

  // Button row: Play (2/3) + Details (1/3)
  buttonRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  playBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
    height: scale(46),
    borderRadius: scale(6),
    gap: scale(8),
  },
  playBtnText: {
    color: BLACK,
    fontFamily: fonts.jetbrainsMono.medium,
    fontSize: scale(12),
    letterSpacing: 1.5,
  },
  detailsBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(46),
    borderRadius: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  detailsBtnText: {
    color: WHITE_DIM,
    fontFamily: fonts.jetbrainsMono.medium,
    fontSize: scale(10),
    letterSpacing: 1,
  },

  // Playlist picker
  playlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(4),
    marginBottom: scale(2),
  },
  backButton: {
    padding: scale(4),
  },
  playlistTitle: {
    color: WHITE,
    fontFamily: fonts.jetbrainsMono.medium,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playlistList: {
    maxHeight: scale(220),
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(5),
  } as ViewStyle,
  playlistRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  } as ViewStyle,
  playlistName: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
  } as TextStyle,
  playlistNameActive: {
    color: WHITE,
    fontFamily: fonts.jetbrainsMono.bold,
  } as TextStyle,
  playlistCount: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  } as TextStyle,
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textAlign: 'center',
    paddingVertical: scale(12),
  },
  loadingContainer: {
    paddingVertical: scale(16),
    alignItems: 'center',
  },
  createNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingVertical: scale(6),
    marginTop: scale(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  } as ViewStyle,
  createNewLabel: {
    color: WHITE_DIM,
    fontFamily: fonts.jetbrainsMono.medium,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(4),
    gap: scale(8),
    marginTop: scale(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    fontSize: scale(12),
    fontFamily: fonts.jetbrainsMono.regular,
    color: WHITE_DIM,
    minHeight: scale(34),
  },
  createButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(6),
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BookContextMenu;
