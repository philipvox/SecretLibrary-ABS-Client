/**
 * src/features/player/components/sheets/BookmarksSheet.tsx
 *
 * Bookmarks sheet for viewing and managing saved positions.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { X, Bookmark as BookmarkIcon, Play, Trash2 } from 'lucide-react-native';
import { scale, spacing, layout } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { formatTime, formatBookmarkDate } from '../../utils/timeFormatters';
import type { PlayerColors } from '../../utils/playerTheme';
import type { Bookmark } from '../../stores/bookmarksStore';

export interface BookmarksSheetProps {
  themeColors: PlayerColors;
  isDarkMode: boolean;
  bookmarks: Bookmark[];
  coverUrl: ImageSource | string | null;
  onGoBack: () => void;
  onClose: () => void;
  onSeekTo: (time: number) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
}

export const BookmarksSheet: React.FC<BookmarksSheetProps> = ({
  themeColors,
  isDarkMode,
  bookmarks,
  coverUrl,
  onGoBack,
  onClose,
  onSeekTo,
  onEditBookmark,
  onDeleteBookmark,
}) => {
  return (
    <View style={[styles.sheet, { backgroundColor: themeColors.sheetBackground }]}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity
          onPress={onGoBack}
          style={styles.sheetBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sheetBackText, { color: themeColors.textSecondary }]}>← Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Bookmarks</Text>
        <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
          <X size={24} color={themeColors.iconPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.bookmarksScrollView} showsVerticalScrollIndicator={false}>
        {bookmarks.length === 0 ? (
          <View style={styles.bookmarksEmpty}>
            <BookmarkIcon size={48} color={themeColors.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.bookmarksEmptyText, { color: themeColors.textPrimary }]}>No bookmarks yet</Text>
            <Text style={[styles.bookmarksEmptySubtext, { color: themeColors.textSecondary }]}>
              Tap the bookmark button while listening to save your place.
            </Text>
            <Text style={[styles.bookmarksEmptyHint, { color: themeColors.textTertiary }]}>
              Perfect for favorite quotes, important passages, or where you left off.
            </Text>
          </View>
        ) : (
          bookmarks.map((bookmark) => (
            <View key={bookmark.id} style={[styles.bookmarkCard, { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F8F8F8' }]}>
              {/* Main content - tap to play */}
              <TouchableOpacity
                style={styles.bookmarkCardContent}
                onPress={() => {
                  onSeekTo(bookmark.time);
                  haptics.selection();
                  onClose();
                }}
                onLongPress={() => {
                  onEditBookmark(bookmark);
                  haptics.impact('medium');
                }}
              >
                {/* Cover thumbnail */}
                {coverUrl && (
                  <Image
                    source={coverUrl}
                    style={styles.bookmarkCover}
                    contentFit="cover"
                  />
                )}
                <View style={styles.bookmarkInfo}>
                  <Text style={[styles.bookmarkChapter, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {bookmark.chapterTitle || 'Unknown Chapter'}
                  </Text>
                  <Text style={[styles.bookmarkTime, { color: themeColors.accentRed }]}>
                    {formatTime(bookmark.time)}
                  </Text>
                  {bookmark.note && (
                    <Text style={[styles.bookmarkNote, { color: themeColors.textSecondary }]} numberOfLines={2}>
                      "{bookmark.note}"
                    </Text>
                  )}
                  <Text style={[styles.bookmarkDate, { color: themeColors.textTertiary }]}>
                    {formatBookmarkDate(bookmark.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Action buttons */}
              <View style={styles.bookmarkActions}>
                <TouchableOpacity
                  style={[styles.bookmarkPlayButton, { backgroundColor: themeColors.buttonBackground }]}
                  onPress={() => {
                    onSeekTo(bookmark.time);
                    haptics.selection();
                    onClose();
                  }}
                >
                  <Play size={16} color={themeColors.buttonText} fill={themeColors.buttonText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bookmarkDeleteButton}
                  onPress={() => {
                    onDeleteBookmark(bookmark);
                    haptics.impact('light');
                  }}
                >
                  <Trash2 size={16} color={themeColors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    paddingTop: scale(20),
    paddingBottom: scale(24),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(20),
  },
  sheetTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.5,
  },
  sheetClose: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetBackButton: {
    paddingVertical: scale(8),
    paddingRight: scale(8),
  },
  sheetBackText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  bookmarksScrollView: {
    maxHeight: scale(400),
  },
  bookmarksEmpty: {
    alignItems: 'center',
    paddingVertical: scale(40),
    paddingHorizontal: scale(20),
  },
  bookmarksEmptyText: {
    fontSize: scale(18),
    fontWeight: '600',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  bookmarksEmptySubtext: {
    fontSize: scale(14),
    textAlign: 'center',
    marginBottom: scale(8),
  },
  bookmarksEmptyHint: {
    fontSize: scale(12),
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bookmarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    borderRadius: scale(12),
    marginBottom: scale(8),
  },
  bookmarkCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkCover: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(6),
    marginRight: scale(12),
  },
  bookmarkInfo: {
    flex: 1,
  },
  bookmarkChapter: {
    fontSize: scale(14),
    fontWeight: '600',
    marginBottom: scale(2),
  },
  bookmarkTime: {
    fontSize: scale(13),
    fontWeight: '500',
    marginBottom: scale(4),
  },
  bookmarkNote: {
    fontSize: scale(12),
    marginBottom: scale(4),
    fontStyle: 'italic',
  },
  bookmarkDate: {
    fontSize: scale(11),
  },
  bookmarkActions: {
    flexDirection: 'row',
    gap: scale(8),
    marginLeft: scale(8),
  },
  bookmarkPlayButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkDeleteButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});
