/**
 * src/features/wishlist/components/ManualAddSheet.tsx
 *
 * Bottom sheet for manually adding books to the wishlist.
 * Allows users to enter book details for titles not in their library.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Bookmark,
  Star,
  User,
  Mic,
  Library,
  Hash,
  FileText,
  Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { WishlistPriority } from '../types';
import { useWishlistStore } from '../stores/wishlistStore';
import { colors, spacing, radius, scale, layout } from '@/shared/theme';

const ACCENT = colors.accent;

interface ManualAddSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface FormData {
  title: string;
  author: string;
  narrator: string;
  series: string;
  seriesSequence: string;
  notes: string;
}

const PRIORITY_OPTIONS: { value: WishlistPriority; label: string; description: string }[] = [
  { value: 'must-read', label: 'Must Read', description: 'High priority - read next' },
  { value: 'want-to-read', label: 'Want to Read', description: 'Normal priority' },
  { value: 'maybe', label: 'Maybe', description: 'Might read someday' },
];

export function ManualAddSheet({ visible, onClose }: ManualAddSheetProps) {
  const insets = useSafeAreaInsets();
  const addFromManualEntry = useWishlistStore((s) => s.addFromManualEntry);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: '',
    author: '',
    narrator: '',
    series: '',
    seriesSequence: '',
    notes: '',
  });
  const [priority, setPriority] = useState<WishlistPriority>('want-to-read');
  const [errors, setErrors] = useState<{ title?: string; author?: string }>({});

  // Reset form when sheet closes
  const handleClose = useCallback(() => {
    setFormData({
      title: '',
      author: '',
      narrator: '',
      series: '',
      seriesSequence: '',
      notes: '',
    });
    setPriority('want-to-read');
    setErrors({});
    onClose();
  }, [onClose]);

  // Update form field
  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (field === 'title' || field === 'author') {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, []);

  // Validate and submit
  const handleSubmit = useCallback(() => {
    const newErrors: { title?: string; author?: string } = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.author.trim()) {
      newErrors.author = 'Author is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Add to wishlist
    addFromManualEntry(
      {
        title: formData.title.trim(),
        author: formData.author.trim(),
        narrator: formData.narrator.trim() || undefined,
        series: formData.series.trim() || undefined,
        seriesSequence: formData.seriesSequence.trim() || undefined,
      },
      priority,
      formData.notes.trim() || undefined
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  }, [formData, priority, addFromManualEntry, handleClose]);

  // Select priority
  const handlePrioritySelect = useCallback((value: WishlistPriority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPriority(value);
  }, []);

  const isValid = formData.title.trim() && formData.author.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
            onPress={() => {}} // Prevent close when tapping sheet
          >
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add to Wishlist</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title Field */}
              <View style={styles.fieldContainer}>
                <View style={styles.fieldLabel}>
                  <Bookmark size={scale(16)} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.fieldLabelText}>Title *</Text>
                </View>
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  value={formData.title}
                  onChangeText={(v) => updateField('title', v)}
                  placeholder="Book title"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
              </View>

              {/* Author Field */}
              <View style={styles.fieldContainer}>
                <View style={styles.fieldLabel}>
                  <User size={scale(16)} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.fieldLabelText}>Author *</Text>
                </View>
                <TextInput
                  style={[styles.input, errors.author && styles.inputError]}
                  value={formData.author}
                  onChangeText={(v) => updateField('author', v)}
                  placeholder="Author name"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.author && <Text style={styles.errorText}>{errors.author}</Text>}
              </View>

              {/* Narrator Field */}
              <View style={styles.fieldContainer}>
                <View style={styles.fieldLabel}>
                  <Mic size={scale(16)} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.fieldLabelText}>Narrator</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={formData.narrator}
                  onChangeText={(v) => updateField('narrator', v)}
                  placeholder="Narrator name (optional)"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Series Row */}
              <View style={styles.rowContainer}>
                <View style={[styles.fieldContainer, { flex: 2 }]}>
                  <View style={styles.fieldLabel}>
                    <Library size={scale(16)} color={colors.textSecondary} strokeWidth={2} />
                    <Text style={styles.fieldLabelText}>Series</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formData.series}
                    onChangeText={(v) => updateField('series', v)}
                    placeholder="Series name (optional)"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.fieldContainer, { flex: 1, marginLeft: spacing.sm }]}>
                  <View style={styles.fieldLabel}>
                    <Hash size={scale(16)} color={colors.textSecondary} strokeWidth={2} />
                    <Text style={styles.fieldLabelText}>#</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formData.seriesSequence}
                    onChangeText={(v) => updateField('seriesSequence', v)}
                    placeholder="1"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Notes Field */}
              <View style={styles.fieldContainer}>
                <View style={styles.fieldLabel}>
                  <FileText size={scale(16)} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.fieldLabelText}>Notes</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={formData.notes}
                  onChangeText={(v) => updateField('notes', v)}
                  placeholder="Why do you want to read this? (optional)"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Priority Selector */}
              <View style={styles.prioritySection}>
                <Text style={styles.prioritySectionTitle}>Priority</Text>
                <View style={styles.priorityOptions}>
                  {PRIORITY_OPTIONS.map((option) => {
                    const isActive = priority === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.priorityOption,
                          isActive && styles.priorityOptionActive,
                          option.value === 'must-read' && isActive && styles.priorityOptionMustRead,
                        ]}
                        onPress={() => handlePrioritySelect(option.value)}
                        activeOpacity={0.7}
                      >
                        {option.value === 'must-read' ? (
                          <Star
                            size={scale(16)}
                            color={isActive ? '#000' : colors.textSecondary}
                            fill={isActive ? '#000' : 'transparent'}
                            strokeWidth={2}
                          />
                        ) : (
                          <Bookmark
                            size={scale(16)}
                            color={isActive ? '#000' : colors.textSecondary}
                            fill={isActive ? '#000' : 'transparent'}
                            strokeWidth={2}
                          />
                        )}
                        <View style={styles.priorityTextContainer}>
                          <Text style={[
                            styles.priorityLabel,
                            isActive && styles.priorityLabelActive,
                          ]}>
                            {option.label}
                          </Text>
                          <Text style={[
                            styles.priorityDescription,
                            isActive && styles.priorityDescriptionActive,
                          ]}>
                            {option.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!isValid}
                activeOpacity={0.7}
              >
                <Plus size={scale(20)} color="#000" strokeWidth={2.5} />
                <Text style={styles.submitButtonText}>Add to Wishlist</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    maxHeight: '90%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: scale(36),
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  fieldLabelText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: scale(15),
    color: colors.textPrimary,
    minHeight: scale(44),
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  inputMultiline: {
    minHeight: scale(80),
    paddingTop: spacing.sm,
  },
  errorText: {
    fontSize: scale(12),
    color: colors.error,
    marginTop: spacing.xs,
  },
  rowContainer: {
    flexDirection: 'row',
  },
  prioritySection: {
    marginTop: spacing.md,
  },
  prioritySectionTitle: {
    fontSize: scale(13),
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  priorityOptions: {
    gap: spacing.sm,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  priorityOptionActive: {
    backgroundColor: ACCENT,
  },
  priorityOptionMustRead: {
    backgroundColor: '#FF6B6B',
  },
  priorityTextContainer: {
    flex: 1,
  },
  priorityLabel: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  priorityLabelActive: {
    color: '#000',
  },
  priorityDescription: {
    fontSize: scale(12),
    color: colors.textTertiary,
    marginTop: scale(1),
  },
  priorityDescriptionActive: {
    color: 'rgba(0,0,0,0.6)',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: ACCENT,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#000',
  },
});
