/**
 * src/features/player/sheets/AddBookmarkSheet.tsx
 *
 * Add/Edit Bookmark popup - Editorial design with timestamp, type selector, and note input.
 * Supports both creating new bookmarks and editing existing ones.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { haptics } from '@/core/native/haptics';
import { scale } from '@/shared/theme';
import {
  secretLibraryColors as colors,
} from '@/shared/theme/secretLibrary';

// =============================================================================
// ICONS
// =============================================================================

const CloseIcon = ({ color = colors.black, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const ClockIcon = ({ color = colors.black, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const BookmarkIcon = ({ color = colors.black, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

const NoteIcon = ({ color = colors.black, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
    <Path d="M16 13H8M16 17H8" />
  </Svg>
);

const TrashIcon = ({ color = colors.orange, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

// =============================================================================
// TYPES
// =============================================================================

export type BookmarkType = 'bookmark' | 'note';

export interface BookmarkData {
  id?: string;
  type: BookmarkType;
  note: string;
  time: number;
  createdAt?: number;
}

interface AddBookmarkSheetProps {
  /** Current position in seconds (for new bookmarks) */
  position: number;
  /** Current chapter title */
  chapterTitle: string;
  /** Close handler */
  onClose: () => void;
  /** Save handler - receives bookmark data */
  onSave: (data: { type: BookmarkType; note: string }) => void;
  /** Optional: Existing bookmark data for edit mode */
  editBookmark?: BookmarkData;
  /** Optional: Delete handler for edit mode */
  onDelete?: (id: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AddBookmarkSheet({
  position,
  chapterTitle,
  onClose,
  onSave,
  editBookmark,
  onDelete,
}: AddBookmarkSheetProps) {
  // Determine if we're in edit mode
  const isEditMode = !!editBookmark;

  // Use edit bookmark values if available, otherwise defaults
  const [bookmarkType, setBookmarkType] = useState<BookmarkType>(
    editBookmark?.type || 'bookmark'
  );
  const [note, setNote] = useState(editBookmark?.note || '');

  // Time to display - use edit bookmark time or current position
  const displayTime = editBookmark?.time ?? position;

  // Reset state when editBookmark changes
  useEffect(() => {
    if (editBookmark) {
      setBookmarkType(editBookmark.type);
      setNote(editBookmark.note);
    } else {
      setBookmarkType('bookmark');
      setNote('');
    }
  }, [editBookmark]);

  const handleTypeSelect = useCallback((type: BookmarkType) => {
    haptics.selection();
    setBookmarkType(type);
  }, []);

  const handleSave = useCallback(() => {
    haptics.success();
    onSave({
      type: bookmarkType,
      note: note.trim(),
    });
    onClose();
  }, [bookmarkType, note, onSave, onClose]);

  const handleCancel = useCallback(() => {
    haptics.selection();
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    if (editBookmark?.id && onDelete) {
      haptics.warning();
      onDelete(editBookmark.id);
      onClose();
    }
  }, [editBookmark, onDelete, onClose]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEditMode ? 'Edit Bookmark' : 'Add Bookmark'}
          </Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <CloseIcon color={colors.black} size={14} />
          </TouchableOpacity>
        </View>

        {/* Timestamp Display */}
        <View style={styles.timestamp}>
          <View style={styles.timestampIcon}>
            <ClockIcon color={colors.black} size={16} />
          </View>
          <View style={styles.timestampInfo}>
            <Text style={styles.timestampChapter} numberOfLines={1}>
              {chapterTitle || 'Unknown Chapter'}
            </Text>
            <Text style={styles.timestampTime}>{formatTime(displayTime)}</Text>
          </View>
        </View>

        {/* Type Selector */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.types}>
          <TouchableOpacity
            style={[styles.typeBtn, bookmarkType === 'bookmark' && styles.typeBtnSelected]}
            onPress={() => handleTypeSelect('bookmark')}
            activeOpacity={0.7}
          >
            <BookmarkIcon
              color={bookmarkType === 'bookmark' ? colors.white : colors.black}
              size={14}
            />
            <Text style={[
              styles.typeBtnText,
              bookmarkType === 'bookmark' && styles.typeBtnTextSelected,
            ]}>
              Bookmark
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, bookmarkType === 'note' && styles.typeBtnSelected]}
            onPress={() => handleTypeSelect('note')}
            activeOpacity={0.7}
          >
            <NoteIcon
              color={bookmarkType === 'note' ? colors.white : colors.black}
              size={14}
            />
            <Text style={[
              styles.typeBtnText,
              bookmarkType === 'note' && styles.typeBtnTextSelected,
            ]}>
              Note
            </Text>
          </TouchableOpacity>
        </View>

        {/* Note Input */}
        <Text style={styles.label}>
          Note <Text style={styles.labelOptional}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note about this moment..."
          placeholderTextColor={colors.gray}
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
        />

        {/* Actions */}
        <View style={styles.actions}>
          {isEditMode && onDelete ? (
            <>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <TrashIcon color={colors.orange} size={14} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <Text style={styles.actionBtnTextPrimary}>Save</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <BookmarkIcon color={colors.white} size={14} />
                <Text style={styles.actionBtnTextPrimary}>Save</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.creamGray,
    padding: scale(24),
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(20),
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(24),
    fontWeight: '400',
    color: colors.black,
  },
  closeBtn: {
    width: scale(32),
    height: scale(32),
    borderWidth: 1,
    borderColor: colors.grayLine,
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Timestamp
  timestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(14),
    paddingHorizontal: scale(16),
    backgroundColor: colors.grayLight,
    marginBottom: scale(20),
  },
  timestampIcon: {
    width: scale(36),
    height: scale(36),
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  timestampInfo: {
    flex: 1,
  },
  timestampChapter: {
    fontSize: scale(11),
    color: colors.gray,
    marginBottom: scale(2),
  },
  timestampTime: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(18),
    fontWeight: '500',
    color: colors.black,
  },

  // Labels
  label: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.gray,
    marginBottom: scale(10),
  },
  labelOptional: {
    opacity: 0.5,
  },

  // Type Selector
  types: {
    flexDirection: 'row',
    gap: scale(8),
    marginBottom: scale(20),
  },
  typeBtn: {
    flex: 1,
    height: scale(44),
    borderWidth: 1,
    borderColor: colors.grayLine,
    backgroundColor: colors.grayLight,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(6),
  },
  typeBtnSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  typeBtnText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.black,
  },
  typeBtnTextSelected: {
    color: colors.white,
  },

  // Note Input
  noteInput: {
    width: '100%',
    height: scale(100),
    borderWidth: 1,
    borderColor: colors.grayLine,
    backgroundColor: colors.grayLight,
    padding: scale(12),
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(14),
    color: colors.black,
    marginBottom: scale(20),
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: scale(8),
  },
  actionBtn: {
    flex: 1,
    height: scale(48),
    borderWidth: 1,
    borderColor: colors.grayLine,
    backgroundColor: colors.grayLight,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
  },
  actionBtnPrimary: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  actionBtnText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.black,
  },
  actionBtnTextPrimary: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.white,
  },
  deleteBtn: {
    width: scale(48),
    height: scale(48),
    borderWidth: 1,
    borderColor: colors.orange,
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AddBookmarkSheet;
