/**
 * src/features/player/hooks/useBookmarkActions.ts
 *
 * Hook for bookmark CRUD operations with animation and undo support.
 */

import { useState, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { formatTime } from '../utils/timeFormatters';
import { haptics } from '@/core/native/haptics';
import type { Bookmark } from '../stores/bookmarksStore';

export interface UseBookmarkActionsOptions {
  chapters: Array<{ title?: string; displayTitle?: string }>;
  chapterIndex: number;
  bookmarks: Bookmark[];
  addBookmark: ((bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void) | undefined;
}

export interface UseBookmarkActionsReturn {
  // Pill popup state
  showBookmarkPill: boolean;
  bookmarkPillAnim: Animated.Value;
  // Note input state
  showNoteInput: boolean;
  noteInputValue: string;
  editingBookmarkId: string | null;
  setNoteInputValue: (value: string) => void;
  setShowNoteInput: (show: boolean) => void;
  setEditingBookmarkId: (id: string | null) => void;
  // Deleted bookmark state for undo
  deletedBookmark: { bookmark: Bookmark; timeout: NodeJS.Timeout } | null;
  // Actions
  handleAddBookmark: () => void;
  handleAddNoteFromPill: () => void;
  handleSaveNote: () => void;
  handleDeleteBookmark: (bookmark: Bookmark) => void;
  handleUndoDelete: () => void;
}

/**
 * Hook that manages bookmark creation, editing, deletion, and undo.
 */
export function useBookmarkActions({
  chapters,
  chapterIndex,
  bookmarks,
  addBookmark,
}: UseBookmarkActionsOptions): UseBookmarkActionsReturn {
  // Pill popup state (grows from bookmark button)
  const [showBookmarkPill, setShowBookmarkPill] = useState(false);
  const bookmarkPillAnim = useRef(new Animated.Value(0)).current;
  const [lastCreatedBookmarkId, setLastCreatedBookmarkId] = useState<string | null>(null);

  // Note input state
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteInputValue, setNoteInputValue] = useState('');
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);

  // Deleted bookmark state for undo
  const [deletedBookmark, setDeletedBookmark] = useState<{ bookmark: Bookmark; timeout: NodeJS.Timeout } | null>(null);

  // Store actions
  const updateBookmark = usePlayerStore((s) => s.updateBookmark);
  const removeBookmark = usePlayerStore((s) => s.removeBookmark);

  // Add bookmark at current position with toast feedback
  const handleAddBookmark = useCallback(() => {
    const state = usePlayerStore.getState();
    const currentPos = state.position;
    const chapter = chapters[chapterIndex];
    const chapterTitle = chapter?.displayTitle || chapter?.title || `Chapter ${chapterIndex + 1}`;

    // Generate bookmark ID for tracking
    const bookmarkId = `bm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    addBookmark?.({
      title: `Bookmark at ${formatTime(currentPos)}`,
      note: null,
      time: currentPos,
      chapterTitle,
    });

    // Show pill popup with grow animation
    setLastCreatedBookmarkId(bookmarkId);
    setShowBookmarkPill(true);
    bookmarkPillAnim.setValue(0);
    Animated.spring(bookmarkPillAnim, {
      toValue: 1,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Auto-hide pill after 4 seconds
    setTimeout(() => {
      Animated.timing(bookmarkPillAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowBookmarkPill(false);
        setLastCreatedBookmarkId(null);
      });
    }, 4000);
  }, [chapters, chapterIndex, addBookmark, bookmarkPillAnim]);

  // Handle adding note from pill popup
  const handleAddNoteFromPill = useCallback(() => {
    setShowBookmarkPill(false);
    // Find the most recently added bookmark
    const latestBookmark = bookmarks[bookmarks.length - 1];
    if (latestBookmark) {
      setEditingBookmarkId(latestBookmark.id);
      setNoteInputValue(latestBookmark.note || '');
      setShowNoteInput(true);
    }
  }, [bookmarks]);

  // Save note
  const handleSaveNote = useCallback(() => {
    if (editingBookmarkId) {
      updateBookmark(editingBookmarkId, { note: noteInputValue || null });
      haptics.selection();
    }
    setShowNoteInput(false);
    setNoteInputValue('');
    setEditingBookmarkId(null);
  }, [editingBookmarkId, noteInputValue, updateBookmark]);

  // Delete bookmark with undo
  const handleDeleteBookmark = useCallback((bookmark: Bookmark) => {
    // Clear any existing undo timeout
    if (deletedBookmark?.timeout) {
      clearTimeout(deletedBookmark.timeout);
    }

    // Remove from store
    removeBookmark(bookmark.id);

    // Set up undo with 5 second window
    const timeout = setTimeout(() => {
      setDeletedBookmark(null);
    }, 5000);

    setDeletedBookmark({ bookmark, timeout });
  }, [removeBookmark, deletedBookmark]);

  // Undo delete
  const handleUndoDelete = useCallback(() => {
    if (deletedBookmark) {
      clearTimeout(deletedBookmark.timeout);
      // Re-add the bookmark
      addBookmark?.({
        title: deletedBookmark.bookmark.title,
        note: deletedBookmark.bookmark.note,
        time: deletedBookmark.bookmark.time,
        chapterTitle: deletedBookmark.bookmark.chapterTitle,
      });
      setDeletedBookmark(null);
    }
  }, [deletedBookmark, addBookmark]);

  return {
    // Pill popup state
    showBookmarkPill,
    bookmarkPillAnim,
    // Note input state
    showNoteInput,
    noteInputValue,
    editingBookmarkId,
    setNoteInputValue,
    setShowNoteInput,
    setEditingBookmarkId,
    // Deleted bookmark state
    deletedBookmark,
    // Actions
    handleAddBookmark,
    handleAddNoteFromPill,
    handleSaveNote,
    handleDeleteBookmark,
    handleUndoDelete,
  };
}
