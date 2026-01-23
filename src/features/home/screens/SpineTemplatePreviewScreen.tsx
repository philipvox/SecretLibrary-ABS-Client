/**
 * src/features/home/screens/SpineTemplatePreviewScreen.tsx
 *
 * Preview screen to review all spine templates.
 * Compact grid view - tap a spine to see full specs.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { colors, spacing, scale } from '@/shared/theme';
import { SPINE_TEMPLATES, SpineTemplate, getConfigForSize } from '../utils/spine/templateAdapter';
import { X } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

// =============================================================================
// CONFIGURATION - ADJUST VALUES HERE
// =============================================================================
const CONFIG = {
  // Spine dimensions
  SPINE_WIDTH_THIN: 40,     // Width of thin spines
  SPINE_WIDTH_NORMAL: 80,   // Width of normal spines
  SPINE_WIDTH_WIDE: 120,    // Width of wide spines
  SPINE_HEIGHT: 340,        // Height of each spine in the bookshelf
  SPINE_WIDTH_LARGE: 120,   // Width in modal preview
  SPINE_HEIGHT_LARGE: 480,  // Height in modal preview

  // Spacing
  SPINE_MARGIN: spacing.sm,    // Space between spines
  ROW_SPACING: spacing.xl * 3, // Space between rows
  TOP_PADDING: spacing.xl * 2, // Padding from top of screen

  // Debug mode - set to true to see layout boxes
  DEBUG_MODE: false,  // Shows colored overlays on all containers
};

interface SpineTemplatePreviewScreenProps {
  navigation: any;
}

export function SpineTemplatePreviewScreen({ navigation }: SpineTemplatePreviewScreenProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<SpineTemplate | null>(null);

  // Sample book data for preview - varied title lengths (48 books for 16 templates × 3 sizes)
  const sampleBooks = useMemo(() => [
    // Literary Fiction (3 sizes)
    { title: 'The Midnight Library', author: 'Matt Haig' },
    { title: 'Normal People', author: 'Sally Rooney' },
    { title: 'The Remains of the Day', author: 'Kazuo Ishiguro' },

    // Science Fiction (3 sizes)
    { title: 'Foundation', author: 'Isaac Asimov' },
    { title: 'The Three-Body Problem', author: 'Cixin Liu' },
    { title: 'Do Androids Dream of Electric Sheep?', author: 'Philip K. Dick' },

    // Technology (3 sizes)
    { title: 'The Innovators', author: 'Walter Isaacson' },
    { title: 'Clean Code', author: 'Robert Martin' },
    { title: 'The Pragmatic Programmer', author: 'Andrew Hunt' },

    // Western (3 sizes)
    { title: 'Lonesome Dove', author: 'Larry McMurtry' },
    { title: 'True Grit', author: 'Charles Portis' },
    { title: 'Blood Meridian', author: 'Cormac McCarthy' },

    // Art & Design (3 sizes)
    { title: 'The Story of Art', author: 'E.H. Gombrich' },
    { title: 'Steal Like an Artist', author: 'Austin Kleon' },
    { title: 'Ways of Seeing', author: 'John Berger' },

    // Adventure (3 sizes)
    { title: 'The Count of Monte Cristo', author: 'Alexandre Dumas' },
    { title: 'Treasure Island', author: 'Robert Louis Stevenson' },
    { title: 'Into the Wild', author: 'Jon Krakauer' },

    // True Crime (3 sizes)
    { title: 'In Cold Blood', author: 'Truman Capote' },
    { title: "The Devil in the White City", author: 'Erik Larson' },
    { title: 'Mindhunter', author: 'John Douglas' },

    // Horror (3 sizes)
    { title: 'The Shining', author: 'Stephen King' },
    { title: 'Dracula', author: 'Bram Stoker' },
    { title: 'The Haunting of Hill House', author: 'Shirley Jackson' },

    // Romance (3 sizes)
    { title: 'Pride and Prejudice', author: 'Jane Austen' },
    { title: 'Outlander', author: 'Diana Gabaldon' },
    { title: 'The Notebook', author: 'Nicholas Sparks' },

    // Biography (3 sizes)
    { title: 'Steve Jobs', author: 'Walter Isaacson' },
    { title: 'Becoming', author: 'Michelle Obama' },
    { title: 'The Diary of a Young Girl', author: 'Anne Frank' },

    // Philosophy (3 sizes)
    { title: 'Meditations', author: 'Marcus Aurelius' },
    { title: 'The Republic', author: 'Plato' },
    { title: 'Being and Nothingness', author: 'Jean-Paul Sartre' },

    // Thriller (3 sizes)
    { title: 'Gone Girl', author: 'Gillian Flynn' },
    { title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson' },
    { title: 'The Da Vinci Code', author: 'Dan Brown' },

    // Historical Fiction (3 sizes)
    { title: 'All the Light We Cannot See', author: 'Anthony Doerr' },
    { title: 'The Book Thief', author: 'Markus Zusak' },
    { title: 'The Curious Incident of the Dog in the Night-Time', author: 'Mark Haddon' },

    // Business (3 sizes)
    { title: 'Good to Great', author: 'Jim Collins' },
    { title: 'The Lean Startup', author: 'Eric Ries' },
    { title: "I'd Tell You I Love You, But Then I'd Have to Kill You", author: 'Ally Carter' },

    // Music & Arts (3 sizes)
    { title: 'Just Kids', author: 'Patti Smith' },
    { title: 'Life', author: 'Keith Richards' },
    { title: 'The Rest Is Noise', author: 'Alex Ross' },

    // Anthology (3 sizes)
    { title: 'The Complete Stories', author: 'Flannery O\'Connor' },
    { title: 'Nine Stories', author: 'J.D. Salinger' },
    { title: 'The Collected Stories', author: 'Grace Paley' },
  ], []);

  return (
    <View style={[styles.container, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 255, 0, 0.05)' }]}>
      {/* Header */}
      <View style={[styles.header, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(0, 255, 0, 0.1)' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spine Templates ({SPINE_TEMPLATES.length}) {CONFIG.DEBUG_MODE ? '🔍' : ''}</Text>
        <Text style={styles.headerSubtitle}>Scroll horizontally · Tap any spine to see details</Text>
      </View>

      {/* Three rows of bookshelves with different widths */}
      <ScrollView style={[styles.bookshelfContainer, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
        {/* Row 1: Thin spines (40px) */}
        <View style={[styles.rowContainer, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 255, 0, 0.05)' }]}>
          <Text style={styles.rowLabel}>Thin (40px)</Text>
          <ScrollView
            horizontal
            style={[styles.scrollView, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(0, 255, 255, 0.05)' }]}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: spacing.md },
              CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 165, 0, 0.05)' }
            ]}
            showsHorizontalScrollIndicator={false}
          >
            {SPINE_TEMPLATES.map((template, index) => {
              const book = sampleBooks[index % sampleBooks.length];
              return (
                <TouchableOpacity
                  key={`thin-${template.id}`}
                  style={[
                    styles.spineItem,
                    { marginRight: CONFIG.SPINE_MARGIN },
                    CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(128, 0, 128, 0.1)' }
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                  activeOpacity={0.7}
                >
                  <SpinePreview template={template} book={book} width={CONFIG.SPINE_WIDTH_THIN} />
                  <Text style={[styles.templateLabel, { width: CONFIG.SPINE_WIDTH_THIN + 10 }]} numberOfLines={2}>
                    {template.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ width: spacing.lg }} />
          </ScrollView>
          {/* Shelf line */}
          <View style={[styles.shelfLine, { top: spacing.md + CONFIG.SPINE_HEIGHT }]} />
        </View>

        {/* Row 2: Normal spines (80px) */}
        <View style={[styles.rowContainer, { marginTop: CONFIG.ROW_SPACING }, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 255, 0, 0.05)' }]}>
          <Text style={styles.rowLabel}>Normal (80px)</Text>
          <ScrollView
            horizontal
            style={[styles.scrollView, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(0, 255, 255, 0.05)' }]}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: spacing.md },
              CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 165, 0, 0.05)' }
            ]}
            showsHorizontalScrollIndicator={false}
          >
            {SPINE_TEMPLATES.map((template, index) => {
              const book = sampleBooks[index % sampleBooks.length];
              return (
                <TouchableOpacity
                  key={`normal-${template.id}`}
                  style={[
                    styles.spineItem,
                    { marginRight: CONFIG.SPINE_MARGIN },
                    CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(128, 0, 128, 0.1)' }
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                  activeOpacity={0.7}
                >
                  <SpinePreview template={template} book={book} width={CONFIG.SPINE_WIDTH_NORMAL} />
                  <Text style={[styles.templateLabel, { width: CONFIG.SPINE_WIDTH_NORMAL + 10 }]} numberOfLines={2}>
                    {template.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ width: spacing.lg }} />
          </ScrollView>
          {/* Shelf line */}
          <View style={[styles.shelfLine, { top: spacing.md + CONFIG.SPINE_HEIGHT }]} />
        </View>

        {/* Row 3: Wide spines (120px) */}
        <View style={[styles.rowContainer, { marginTop: CONFIG.ROW_SPACING }, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 255, 0, 0.05)' }]}>
          <Text style={styles.rowLabel}>Wide (120px)</Text>
          <ScrollView
            horizontal
            style={[styles.scrollView, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(0, 255, 255, 0.05)' }]}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: spacing.md },
              CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 165, 0, 0.05)' }
            ]}
            showsHorizontalScrollIndicator={false}
          >
            {SPINE_TEMPLATES.map((template, index) => {
              const book = sampleBooks[index % sampleBooks.length];
              return (
                <TouchableOpacity
                  key={`wide-${template.id}`}
                  style={[
                    styles.spineItem,
                    { marginRight: CONFIG.SPINE_MARGIN },
                    CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(128, 0, 128, 0.1)' }
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                  activeOpacity={0.7}
                >
                  <SpinePreview template={template} book={book} width={CONFIG.SPINE_WIDTH_WIDE} />
                  <Text style={[styles.templateLabel, { width: CONFIG.SPINE_WIDTH_WIDE + 10 }]} numberOfLines={2}>
                    {template.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ width: spacing.lg }} />
          </ScrollView>
          {/* Shelf line */}
          <View style={[styles.shelfLine, { top: spacing.md + CONFIG.SPINE_HEIGHT }]} />
        </View>

        {/* Bottom padding */}
        <View style={{ height: spacing.xl * 3 }} />
      </ScrollView>

      {/* Specs Modal */}
      {selectedTemplate && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedTemplate(null)}
        >
          <View style={[styles.modalOverlay, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 0, 0.1)' }]}>
            <View style={[styles.modalContent, CONFIG.DEBUG_MODE && { backgroundColor: CONFIG.DEBUG_MODE ? colors.backgroundSecondary : colors.backgroundSecondary, borderWidth: CONFIG.DEBUG_MODE ? 2 : 0, borderColor: 'lime' }]}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedTemplate(null)}
              >
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>

              {/* Template preview (larger) */}
              <View style={[styles.modalPreview, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 165, 0, 0.1)' }]}>
                <SpinePreview
                  template={selectedTemplate}
                  book={sampleBooks[0]}
                  size="large"
                />
              </View>

              {/* Template info */}
              <ScrollView style={[styles.modalScroll, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(128, 0, 128, 0.05)' }]} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selectedTemplate.name}</Text>
                <Text style={styles.modalDescription}>{selectedTemplate.description}</Text>

                {/* Genre tags */}
                <Text style={styles.sectionLabel}>Best For:</Text>
                <View style={[styles.genreTags, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(0, 128, 0, 0.1)' }]}>
                  {selectedTemplate.preferredFor?.map(genre => (
                    <View key={genre} style={[styles.genreTag, styles.preferredTag, CONFIG.DEBUG_MODE && { borderWidth: 1, borderColor: 'yellow' }]}>
                      <Text style={styles.genreTagText}>{genre}</Text>
                    </View>
                  ))}
                  {selectedTemplate.usedFor.slice(0, 4).map(genre => (
                    <View key={genre} style={[styles.genreTag, CONFIG.DEBUG_MODE && { borderWidth: 1, borderColor: 'cyan' }]}>
                      <Text style={styles.genreTagText}>{genre}</Text>
                    </View>
                  ))}
                </View>

                {/* Specs */}
                <Text style={styles.sectionLabel}>Title Specs:</Text>
                <View style={[styles.specRow, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
                  <Text style={styles.specKey}>Size:</Text>
                  <Text style={styles.specValue}>{selectedTemplate.title.fontSize}pt</Text>
                </View>
                <View style={[styles.specRow, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
                  <Text style={styles.specKey}>Font:</Text>
                  <Text style={styles.specValue}>
                    {selectedTemplate.title.fontFamily.split('-')[0]} {selectedTemplate.title.weight}
                  </Text>
                </View>
                <View style={[styles.specRow, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
                  <Text style={styles.specKey}>Orientation:</Text>
                  <Text style={styles.specValue}>{selectedTemplate.title.orientation}</Text>
                </View>
                <View style={[styles.specRow, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
                  <Text style={styles.specKey}>Case:</Text>
                  <Text style={styles.specValue}>{selectedTemplate.title.case}</Text>
                </View>

                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Author Specs:</Text>
                <View style={[styles.specRow, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
                  <Text style={styles.specKey}>Size:</Text>
                  <Text style={styles.specValue}>{selectedTemplate.author.fontSize}pt</Text>
                </View>
                <View style={[styles.specRow, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
                  <Text style={styles.specKey}>Font:</Text>
                  <Text style={styles.specValue}>
                    {selectedTemplate.author.fontFamily.split('-')[0]} {selectedTemplate.author.weight}
                  </Text>
                </View>
                <View style={[styles.specRow, CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 0, 255, 0.05)' }]}>
                  <Text style={styles.specKey}>Treatment:</Text>
                  <Text style={styles.specValue}>{selectedTemplate.author.treatment || 'plain'}</Text>
                </View>

                <View style={{ height: spacing.xl }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// =============================================================================
// SPINE PREVIEW COMPONENT
// =============================================================================

interface SpinePreviewProps {
  template: SpineTemplate;
  book: { title: string; author: string };
  size?: 'normal' | 'large';
  width?: number; // Custom width override
}

function SpinePreview({ template, book, size = 'normal', width }: SpinePreviewProps) {
  const { title: titleConfig, author: authorConfig, decoration } = template;

  const spineWidth = width ?? (size === 'large' ? CONFIG.SPINE_WIDTH_LARGE : CONFIG.SPINE_WIDTH_NORMAL);
  const spineHeight = size === 'large' ? CONFIG.SPINE_HEIGHT_LARGE : CONFIG.SPINE_HEIGHT;

  // Apply text case
  const titleText = (() => {
    let text = book.title;
    switch (titleConfig.case) {
      case 'uppercase': text = text.toUpperCase(); break;
      case 'lowercase': text = text.toLowerCase(); break;
      default: break;
    }

    // Apply words-per-line wrapping if specified
    if (titleConfig.wordsPerLine && titleConfig.orientation === 'horizontal') {
      const words = text.split(' ');
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += titleConfig.wordsPerLine) {
        lines.push(words.slice(i, i + titleConfig.wordsPerLine).join(' '));
      }
      text = lines.join('\n');
    }

    return text;
  })();

  const authorText = (() => {
    switch (authorConfig.case) {
      case 'uppercase': return book.author.toUpperCase();
      case 'lowercase': return book.author.toLowerCase();
      default: return book.author;
    }
  })();

  // Get size-appropriate configs based on spine width
  // Uses new size-based system: small (<60px), medium (60-90px), large (>90px)
  const adaptiveTitleConfig = getConfigForSize(titleConfig, spineWidth);
  const adaptiveAuthorConfig = getConfigForSize(authorConfig, spineWidth);

  // Calculate positions based on heightPercent
  const titleHeight = (spineHeight * adaptiveTitleConfig.heightPercent) / 100;
  const authorHeight = (spineHeight * adaptiveAuthorConfig.heightPercent) / 100;
  const remainingHeight = spineHeight - titleHeight - authorHeight;

  // Calculate Y positions based on placement
  let titleY: number;
  let authorY: number;

  if (adaptiveTitleConfig.placement === 'center') {
    // Center the content block (title + author) on the spine
    const contentHeight = titleHeight + authorHeight;
    const startY = (spineHeight - contentHeight) / 2;

    if (adaptiveAuthorConfig.placement === 'top') {
      authorY = startY;
      titleY = authorY + authorHeight;
    } else {
      titleY = startY;
      authorY = titleY + titleHeight;
    }
  } else if (adaptiveTitleConfig.placement === 'top') {
    // Position at top
    if (adaptiveAuthorConfig.placement === 'top') {
      authorY = 0;
      titleY = authorHeight;
    } else {
      titleY = 0;
      authorY = titleHeight;
    }
  } else if (adaptiveTitleConfig.placement === 'bottom') {
    // Position at bottom
    if (adaptiveAuthorConfig.placement === 'top') {
      authorY = spineHeight - titleHeight - authorHeight;
      titleY = authorY + authorHeight;
    } else {
      titleY = spineHeight - titleHeight - authorHeight;
      authorY = titleY + titleHeight;
    }
  } else {
    // Fallback to old logic
    titleY = adaptiveAuthorConfig.placement === 'top' ? authorHeight + remainingHeight / 2 : remainingHeight / 2;
    authorY = adaptiveAuthorConfig.placement === 'top' ? 0 : titleY + titleHeight;
  }

  // Handle two-row layout: vertical title with horizontal author below
  if (adaptiveTitleConfig.orientation === 'vertical-with-horizontal-author') {
    return (
      <View style={[styles.spine, { width: spineWidth, height: spineHeight, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }]}>
        {/* Debug: Show remaining/negative space */}
        {CONFIG.DEBUG_MODE && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(128, 128, 128, 0.1)', // Gray tint for unused space
            }}
          />
        )}

        {/* Title section (vertical) */}
        <View
          style={{
            height: titleHeight,
            width: spineWidth,
            backgroundColor: CONFIG.DEBUG_MODE ? 'rgba(0, 0, 255, 0.3)' : 'transparent',
            paddingHorizontal: adaptiveTitleConfig.paddingHorizontal ?? 3,
            paddingVertical: adaptiveTitleConfig.paddingVertical ?? 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: titleHeight,
              height: spineWidth,
              justifyContent: adaptiveTitleConfig.align === 'top' ? 'flex-start' :
                             adaptiveTitleConfig.align === 'bottom' ? 'flex-end' : 'center',
              transform: [{ rotate: '-90deg' }], // Always vertical-up for this layout
            }}
          >
            <Text
              style={[
                styles.text,
                {
                  fontSize: adaptiveTitleConfig.fontSize,
                  fontWeight: adaptiveTitleConfig.weight,
                  fontFamily: adaptiveTitleConfig.fontFamily,
                  textAlign: 'center',
                  ...(adaptiveTitleConfig.lineHeight
                    ? { lineHeight: adaptiveTitleConfig.lineHeight }
                    : adaptiveTitleConfig.lineHeightScale
                    ? { lineHeight: adaptiveTitleConfig.fontSize * adaptiveTitleConfig.lineHeightScale }
                    : {}),
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {titleText}
            </Text>
          </View>
        </View>

        {/* Author section (horizontal, stacked below title) */}
        <View
          style={{
            height: authorHeight,
            width: spineWidth,
            backgroundColor: CONFIG.DEBUG_MODE ? 'rgba(255, 0, 0, 0.3)' : 'transparent',
            paddingHorizontal: adaptiveAuthorConfig.paddingHorizontal ?? 3,
            paddingVertical: adaptiveAuthorConfig.paddingVertical ?? 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={[
              styles.text,
              {
                fontSize: adaptiveAuthorConfig.fontSize,
                fontWeight: adaptiveAuthorConfig.weight,
                fontFamily: adaptiveAuthorConfig.fontFamily,
                textAlign: adaptiveAuthorConfig.align === 'left' ? 'left' :
                          adaptiveAuthorConfig.align === 'right' ? 'right' : 'center',
                ...(adaptiveAuthorConfig.lineHeight
                  ? { lineHeight: adaptiveAuthorConfig.lineHeight }
                  : adaptiveAuthorConfig.lineHeightScale
                  ? { lineHeight: adaptiveAuthorConfig.fontSize * adaptiveAuthorConfig.lineHeightScale }
                  : {}),
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {adaptiveAuthorConfig.treatment === 'prefixed' ? `by ${authorText}` : authorText}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.spine, { width: spineWidth, height: spineHeight }]}>
      {/* Debug: Show remaining/negative space */}
      {CONFIG.DEBUG_MODE && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(128, 128, 128, 0.1)', // Gray tint for unused space
          }}
        />
      )}

      {/* Author section */}
      <View
        style={[
          styles.section,
          {
            top: authorY,
            height: authorHeight,
            backgroundColor: CONFIG.DEBUG_MODE ? 'rgba(255, 0, 0, 0.3)' : 'transparent', // Red tint for author
            paddingHorizontal: adaptiveAuthorConfig.paddingHorizontal ?? 3,
            paddingVertical: adaptiveAuthorConfig.paddingVertical ?? 0,
          },
        ]}
      >
        {adaptiveAuthorConfig.orientation === 'stacked-letters' ? (
          // Stacked letters - control spacing with container gap, not lineHeight
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: adaptiveAuthorConfig.lineHeightScale
              ? -(adaptiveAuthorConfig.fontSize * 0.8) * (1 - adaptiveAuthorConfig.lineHeightScale)
              : adaptiveAuthorConfig.fontSize * -0.15  // Default: pull letters closer by 15% of fontSize
          }}>
            {authorText.replace(/\s+/g, '').split('').map((letter, i) => (
              <Text
                key={i}
                style={[
                  styles.text,
                  {
                    fontSize: adaptiveAuthorConfig.fontSize * 0.8,
                    fontWeight: adaptiveAuthorConfig.weight,
                    fontFamily: adaptiveAuthorConfig.fontFamily,
                    letterSpacing: adaptiveAuthorConfig.letterSpacing ?? 0,
                    // Don't set lineHeight - it causes clipping
                  },
                ]}
              >
                {letter}
              </Text>
            ))}
          </View>
        ) : adaptiveAuthorConfig.orientation === 'stacked-words' ? (
          // Stacked words - control spacing with container gap, not lineHeight
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: adaptiveAuthorConfig.lineHeightScale
              ? -adaptiveAuthorConfig.fontSize * (1 - adaptiveAuthorConfig.lineHeightScale)
              : adaptiveAuthorConfig.fontSize * -0.1  // Default: pull words closer by 10% of fontSize
          }}>
            {authorText.split(' ').map((word, i) => (
              <Text
                key={i}
                style={[
                  styles.text,
                  {
                    fontSize: adaptiveAuthorConfig.fontSize,
                    fontWeight: adaptiveAuthorConfig.weight,
                    fontFamily: adaptiveAuthorConfig.fontFamily,
                    letterSpacing: adaptiveAuthorConfig.letterSpacing ?? 0,
                    // Don't set lineHeight - it causes clipping with adjustsFontSizeToFit
                  },
                ]}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {word}
              </Text>
            ))}
          </View>
        ) : adaptiveAuthorConfig.orientation === 'vertical-two-row' ? (
          // Vertical text with two-line wrap (rotated)
          (() => {
            // Account for padding when calculating rotated dimensions
            const paddingH = adaptiveAuthorConfig.paddingHorizontal ?? 3;
            const paddingV = adaptiveAuthorConfig.paddingVertical ?? 0;
            // After rotation: width becomes height constraint, height becomes width constraint
            // So we need to subtract vertical padding from width, horizontal padding from height
            const rotatedWidth = authorHeight - (paddingV * 2);
            const rotatedHeight = spineWidth - (paddingH * 2);

            return (
              <View
                style={{
                  width: rotatedWidth,
                  height: rotatedHeight,
                  justifyContent: 'center',
                  transform: [{ rotate: '-90deg' }],
                }}
              >
                <Text
                  style={[
                    styles.text,
                    {
                      fontSize: adaptiveAuthorConfig.fontSize,
                      fontWeight: adaptiveAuthorConfig.weight,
                      fontFamily: adaptiveAuthorConfig.fontFamily,
                      textAlign: adaptiveAuthorConfig.align === 'left' ? 'left' : adaptiveAuthorConfig.align === 'right' ? 'right' : 'center',
                      // Apply letterSpacing if specified
                      ...(adaptiveAuthorConfig.letterSpacing !== undefined ? { letterSpacing: adaptiveAuthorConfig.letterSpacing } : {}),
                      // Don't use lineHeight with adjustsFontSizeToFit - it prevents proper scaling
                      ...(adaptiveAuthorConfig.lineHeight ? { lineHeight: adaptiveAuthorConfig.lineHeight } : {}),
                    },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {(() => {
                    // Split text at specified percentage (default 50%)
                    const words = authorText.split(' ');
                    const splitPercent = adaptiveAuthorConfig.textSplitPercent ?? 50;
                    const splitPoint = Math.ceil(words.length * (splitPercent / 100));
                    const line1 = words.slice(0, splitPoint).join(' ');
                    const line2 = words.slice(splitPoint).join(' ');
                    return line2 ? `${line1}\n${line2}` : line1;
                  })()}
                </Text>
              </View>
            );
          })()

        ) : (
          // Horizontal or vertical text
          (() => {
            const isVertical = adaptiveAuthorConfig.orientation === 'vertical-up' ||
                              adaptiveAuthorConfig.orientation === 'vertical-down';

            // Account for padding when calculating rotated dimensions
            if (isVertical) {
              const paddingH = adaptiveAuthorConfig.paddingHorizontal ?? 3;
              const paddingV = adaptiveAuthorConfig.paddingVertical ?? 0;
              const rotatedWidth = authorHeight - (paddingV * 2);
              const rotatedHeight = spineWidth - (paddingH * 2);

              return (
                <View
                  style={{
                    width: rotatedWidth,
                    height: rotatedHeight,
                    justifyContent: adaptiveAuthorConfig.align === 'top' ? 'flex-start' :
                                   adaptiveAuthorConfig.align === 'bottom' ? 'flex-end' : 'center',
                    transform: adaptiveAuthorConfig.orientation === 'vertical-up' ? [{ rotate: '-90deg' }] :
                               adaptiveAuthorConfig.orientation === 'vertical-down' ? [{ rotate: '90deg' }] : [],
                  }}
                >
                  <Text
                    style={[
                      styles.text,
                      {
                        fontSize: adaptiveAuthorConfig.fontSize,
                        fontWeight: adaptiveAuthorConfig.weight,
                        fontFamily: adaptiveAuthorConfig.fontFamily,
                        textAlign: adaptiveAuthorConfig.align === 'left' ? 'left' :
                                  adaptiveAuthorConfig.align === 'right' ? 'right' : 'center',
                        ...(adaptiveAuthorConfig.lineHeight
                          ? { lineHeight: adaptiveAuthorConfig.lineHeight }
                          : adaptiveAuthorConfig.lineHeightScale
                          ? { lineHeight: adaptiveAuthorConfig.fontSize * adaptiveAuthorConfig.lineHeightScale }
                          : {}),
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {adaptiveAuthorConfig.treatment === 'prefixed' ? `by ${authorText}` : authorText}
                  </Text>
                </View>
              );
            }

            // Horizontal text - no padding adjustment needed
            return (
              <View
                style={{
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={[
                    styles.text,
                    {
                      fontSize: adaptiveAuthorConfig.fontSize,
                      fontWeight: adaptiveAuthorConfig.weight,
                      fontFamily: adaptiveAuthorConfig.fontFamily,
                      textAlign: adaptiveAuthorConfig.align === 'left' ? 'left' :
                                adaptiveAuthorConfig.align === 'right' ? 'right' : 'center',
                      ...(adaptiveAuthorConfig.lineHeight
                        ? { lineHeight: adaptiveAuthorConfig.lineHeight }
                        : adaptiveAuthorConfig.lineHeightScale
                        ? { lineHeight: adaptiveAuthorConfig.fontSize * adaptiveAuthorConfig.lineHeightScale }
                        : {}),
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {adaptiveAuthorConfig.treatment === 'prefixed' ? `by ${authorText}` : authorText}
                </Text>
              </View>
            );
          })()
        )}
      </View>

      {/* Title section */}
      <View
        style={[
          styles.section,
          {
            top: titleY,
            height: titleHeight,
            backgroundColor: CONFIG.DEBUG_MODE ? 'rgba(0, 0, 255, 0.3)' : 'transparent', // Blue tint for title
            paddingHorizontal: adaptiveTitleConfig.paddingHorizontal ?? 3,
            paddingVertical: adaptiveTitleConfig.paddingVertical ?? 0,
          },
        ]}
      >
        {adaptiveTitleConfig.orientation === 'stacked-letters' ? (
          // Stacked letters - control spacing with container gap, not lineHeight
          <View style={[
            {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: adaptiveTitleConfig.lineHeightScale
                ? -(adaptiveTitleConfig.fontSize * 0.7) * (1 - adaptiveTitleConfig.lineHeightScale)
                : adaptiveTitleConfig.fontSize * -0.2  // Default: pull letters closer by 20% of fontSize
            },
            CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(255, 255, 0, 0.15)' }
          ]}>
            {titleText.replace(/\s+/g, '').split('').slice(0, adaptiveTitleConfig.maxLines ?? 20).map((letter, i) => (
              <Text
                key={i}
                style={[
                  styles.text,
                  {
                    fontSize: adaptiveTitleConfig.fontSize * 0.7,
                    fontWeight: adaptiveTitleConfig.weight,
                    fontFamily: adaptiveTitleConfig.fontFamily,
                    // Don't set lineHeight - it causes clipping
                  },
                ]}
              >
                {letter}
              </Text>
            ))}
          </View>
        ) : adaptiveTitleConfig.orientation === 'stacked-words' ? (
          // Stacked words - control spacing with container gap, not lineHeight
          <View style={[
            {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: adaptiveTitleConfig.lineHeightScale
                ? -(adaptiveTitleConfig.fontSize * 0.6) * (1 - adaptiveTitleConfig.lineHeightScale)
                : adaptiveTitleConfig.fontSize * -0.15  // Default: pull words closer by 15% of fontSize
            },
            CONFIG.DEBUG_MODE && { backgroundColor: 'rgba(0, 255, 255, 0.15)' }
          ]}>
            {titleText.split(' ').slice(0, adaptiveTitleConfig.maxLines ?? 10).map((word, i) => (
              <Text
                key={i}
                style={[
                  styles.text,
                  {
                    fontSize: adaptiveTitleConfig.fontSize * 0.6,
                    fontWeight: adaptiveTitleConfig.weight,
                    fontFamily: adaptiveTitleConfig.fontFamily,
                    // Don't set lineHeight - it causes clipping with adjustsFontSizeToFit
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {word}
              </Text>
            ))}
          </View>
        ) : adaptiveTitleConfig.orientation === 'horizontal' ? (
          // Horizontal text (no rotation needed)
          <Text
            style={[
              styles.text,
              {
                fontSize: adaptiveTitleConfig.fontSize,
                fontWeight: adaptiveTitleConfig.weight,
                fontFamily: adaptiveTitleConfig.fontFamily,
                textAlign: adaptiveTitleConfig.align === 'left' ? 'left' :
                          adaptiveTitleConfig.align === 'right' ? 'right' : 'center',
                ...(adaptiveTitleConfig.lineHeight
                  ? { lineHeight: adaptiveTitleConfig.lineHeight }
                  : adaptiveTitleConfig.lineHeightScale
                  ? { lineHeight: adaptiveTitleConfig.fontSize * adaptiveTitleConfig.lineHeightScale }
                  : {}),
              },
            ]}
            numberOfLines={adaptiveTitleConfig.maxLines ?? 2}
            adjustsFontSizeToFit
          >
            {titleText}
          </Text>
        ) : adaptiveTitleConfig.orientation === 'vertical-two-row' ? (
          // Vertical text with two-line wrap (rotated)
          (() => {
            // Account for padding when calculating rotated dimensions
            const paddingH = adaptiveTitleConfig.paddingHorizontal ?? 3;
            const paddingV = adaptiveTitleConfig.paddingVertical ?? 0;
            // After rotation: width becomes height constraint, height becomes width constraint
            // So we need to subtract vertical padding from width, horizontal padding from height
            const rotatedWidth = titleHeight - (paddingV * 2);
            const rotatedHeight = spineWidth - (paddingH * 2);

            return (
              <View
                style={{
                  width: rotatedWidth,
                  height: rotatedHeight,
                  justifyContent: 'center',
                  transform: [{ rotate: '-90deg' }],
                }}
              >
                <Text
                  style={[
                    styles.text,
                    {
                      fontSize: adaptiveTitleConfig.fontSize,
                      fontWeight: adaptiveTitleConfig.weight,
                      fontFamily: adaptiveTitleConfig.fontFamily,
                      textAlign: adaptiveTitleConfig.align === 'left' ? 'left' : adaptiveTitleConfig.align === 'right' ? 'right' : 'center',
                      // Apply letterSpacing if specified
                      ...(adaptiveTitleConfig.letterSpacing !== undefined ? { letterSpacing: adaptiveTitleConfig.letterSpacing } : {}),
                      // Don't use lineHeight with adjustsFontSizeToFit - it prevents proper scaling
                      ...(adaptiveTitleConfig.lineHeight ? { lineHeight: adaptiveTitleConfig.lineHeight } : {}),
                    },
                  ]}
                  numberOfLines={adaptiveTitleConfig.maxLines ?? 2}
                  adjustsFontSizeToFit
                >
                  {(() => {
                    // Split text at specified percentage (default 50%)
                    const words = titleText.split(' ');
                    const splitPercent = adaptiveTitleConfig.textSplitPercent ?? 50;
                    const splitPoint = Math.ceil(words.length * (splitPercent / 100));
                    const line1 = words.slice(0, splitPoint).join(' ');
                    const line2 = words.slice(splitPoint).join(' ');
                    return line2 ? `${line1}\n${line2}` : line1;
                  })()}
                </Text>
              </View>
            );
          })()

        ) : (
          // Vertical text (swap dimensions, then rotate)
          (() => {
            // Account for padding when calculating rotated dimensions
            const paddingH = adaptiveTitleConfig.paddingHorizontal ?? 3;
            const paddingV = adaptiveTitleConfig.paddingVertical ?? 0;
            // After rotation: width becomes height constraint, height becomes width constraint
            // So we need to subtract vertical padding from width, horizontal padding from height
            const rotatedWidth = titleHeight - (paddingV * 2);
            const rotatedHeight = spineWidth - (paddingH * 2);

            return (
              <View
                style={{
                  width: rotatedWidth,
                  height: rotatedHeight,
                  justifyContent: adaptiveTitleConfig.align === 'top' ? 'flex-start' :
                                 adaptiveTitleConfig.align === 'bottom' ? 'flex-end' : 'center',
                  transform: adaptiveTitleConfig.orientation === 'vertical-up' ? [{ rotate: '-90deg' }] :
                             adaptiveTitleConfig.orientation === 'vertical-down' ? [{ rotate: '90deg' }] : [],
                }}
              >
                <Text
                  style={[
                    styles.text,
                    {
                      fontSize: adaptiveTitleConfig.fontSize,
                      fontWeight: adaptiveTitleConfig.weight,
                      fontFamily: adaptiveTitleConfig.fontFamily,
                      textAlign: adaptiveTitleConfig.align === 'left' ? 'left' : adaptiveTitleConfig.align === 'right' ? 'right' : 'center',
                      ...(adaptiveTitleConfig.lineHeight
                        ? { lineHeight: adaptiveTitleConfig.lineHeight }
                        : adaptiveTitleConfig.lineHeightScale
                        ? { lineHeight: adaptiveTitleConfig.fontSize * adaptiveTitleConfig.lineHeightScale }
                        : {}),
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {titleText}
                </Text>
              </View>
            );
          })()
        )}
      </View>

      {/* Decorative elements */}
      {decoration?.element === 'divider-line' && (
        <View
          style={{
            position: 'absolute',
            top: titleY + titleHeight,
            left: 6,
            right: 6,
            height: decoration.lineStyle === 'thick' ? 2 : 1,
            backgroundColor: colors.textPrimary,
          }}
        />
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },

  header: {
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray + '30',
  },

  backButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },

  backButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },

  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },

  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  bookshelfContainer: {
    flex: 1,
  },

  rowContainer: {
    position: 'relative',
    paddingHorizontal: spacing.lg,
  },

  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.xs,
    paddingTop: spacing.md,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: spacing.md,
    alignItems: 'center', // Center spines vertically
  },

  shelfLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.textPrimary + '30',
  },

  spineItem: {
    alignItems: 'center',
  },

  templateLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  spine: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.textPrimary + '40',
    borderRadius: 4,
    position: 'relative',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  section: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  text: {
    color: colors.textPrimary,
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
    zIndex: 10,
  },

  modalPreview: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  modalScroll: {
    flex: 1,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },

  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  genreTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },

  genreTag: {
    backgroundColor: colors.gray + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },

  preferredTag: {
    backgroundColor: colors.accent + '40',
  },

  genreTagText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
  },

  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray + '20',
  },

  specKey: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  specValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
