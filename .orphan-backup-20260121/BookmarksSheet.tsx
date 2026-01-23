/**
 * src/features/player/components/sheets/BookmarksSheet.tsx
 *
 * Bookmarks sheet for viewing and managing saved positions.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { X, Bookmark as BookmarkIcon, Play, Trash2 } from 'lucide-react-native';
import { scale, spacing, layout, useTheme } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { formatTime, formatBookmarkDate } from '../../utils/timeFormatters';
import type { Bookmark } from '../../stores/bookmarksStore';

export interface BookmarksSheetProps {
  bookmarks: Bookmark[];
  coverUrl: ImageSource | string | null;
  onGoBack: () => void;
  onClose: () => void;
  onSeekTo: (time: number) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
}

export const BookmarksSheet: React.FC<BookmarksSheetProps> = ({
  bookmarks,
  coverUrl,
  onGoBack,
  onClose,
  onSeekTo,
  onEditBookmark,
  onDeleteBookmark,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background.elevated }]}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity
          onPress={onGoBack}
          style={styles.sheetBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sheetBackText, { color: colors.text.secondary }]}>← Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>Bookmarks</Text>
        <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
          <X size={24} color={colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.bookmarksScrollView} showsVerticalScrollIndicator={false}>
        {bookmarks.length === 0 ? (
          <View style={styles.bookmarksEmpty}>
            <BookmarkIcon size={48} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={[styles.bookmarksEmptyText, { color: colors.text.primary }]}>No bookmarks yet</Text>
            <Text style={[styles.bookmarksEmptySubtext, { color: colors.text.secondary }]}>
              Tap the bookmark button while listening to save your place.
            </Text>
            <Text style={[styles.bookmarksEmptyHint, { color: colors.text.tertiary }]}>
              Perfect for favorite quotes, important passages, or where you left off.
            </Text>
          </View>
        ) : (
          bookmarks.map((bookmark) => (
            <View key={bookmark.id} style={[styles.bookmarkCard, { backgroundColor: colors.background.secondary }]}>
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
                  <Text style={[styles.bookmarkChapter, { color: colors.text.primary }]} numberOfLines={1}>
                    {bookmark.chapterTitle || 'Unknown Chapter'}
                  </Text>
                  <Text style={[styles.bookmarkTime, { color: colors.accent.primary }]}>
                    {formatTime(bookmark.time)}
                  </Text>
                  {bookmark.note && (
                    <Text style={[styles.bookmarkNote, { color: colors.text.secondary }]} numberOfLines={2}>
                      "{bookmark.note}"
                    </Text>
                  )}
                  <Text style={[styles.bookmarkDate, { color: colors.text.tertiary }]}>
                    {formatBookmarkDate(bookmark.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Action buttons */}
              <View style={styles.bookmarkActions}>
                <TouchableOpacity
                  style={[styles.bookmarkPlayButton, { backgroundColor: colors.text.primary }]}
                  onPress={() => {
                    onSeekTo(bookmark.time);
                    haptics.selection();
                    onClose();
                  }}
                >
                  <Play size={16} color={colors.background.primary} fill={colors.background.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bookmarkDeleteButton, { backgroundColor: `${colors.text.primary}10` }]}
                  onPress={() => {
                    onDeleteBookmark(bookmark);
                    haptics.impact('light');
                  }}
                >
                  <Trash2 size={16} color={colors.text.tertiary} />
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
  },
});
