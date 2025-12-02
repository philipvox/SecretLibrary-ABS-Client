/**
 * src/features/home/screens/HomeScreen.tsx
 * 
 * Home screen layout:
 * - Main card (most recent book)
 * - Action buttons (View Series, Restart)
 * - Library list (recently added books)
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Text,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { HomeCard } from '../components/HomeCard';
import { CardActions } from '../components/CardActions';
import { LibraryListCard } from '../components/LibraryListCard';
import { useContinueListening } from '../hooks/useContinueListening';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BG_COLOR = '#1a1a1a';

// ============================================================================
// LAYOUT CONFIGURATION - Adjust these values to customize the home screen
// ============================================================================
const CONFIG = {
  // === SCREEN LAYOUT ===
  screen: {
    backgroundColor: '#1a1a1a',
    horizontalPadding: 15,           // Left/right padding for content
    topPadding: 0,                  // Extra padding below safe area
    bottomPadding: 0,              // Extra padding above tab bar
  },
  // === MAIN CARD ===
  mainCard: {
    width: SCREEN_WIDTH - 30,  // Card width (max 339 or screen - padding)
    height: 550,                     // Total card height
    borderRadius: 8,                 // Corner radius
    marginTop: 0,                    // Space above card
    marginBottom: 0,                 // Space below card (before actions)
  },

  // === MAIN CARD COVER ===
  cover: {
    height: 400,                     // Cover image height
    margin: 5,                       // Margin around cover inside card
    borderRadius: 8,                 // Cover corner radius
  },

  // === MAIN CARD CONTENT ===
  cardContent: {
    paddingHorizontal: 10,           // Left/right padding inside card
    paddingVertical: 10,             // Top/bottom padding inside card
    titleFontSize: 26,               // Book title font size
    titleLineHeight: 30,             // Book title line height
    titleMarginBottom: 4,            // Space below title
    chapterFontSize: 14,             // Chapter text font size
    iconSize: 24,                    // Download/heart icon size
    iconGap: 8,                      // Gap between icons
  },

  // === CARD ACTIONS (View Series / Restart) ===
  actions: {
    paddingVertical: 12,             // Top/bottom padding
    paddingHorizontal: 4,            // Left/right padding
    marginBottom: 16,                // Space below actions (before library list)
    fontSize: 14,                    // Action text font size
    iconSize: 18,                    // Action icon size
    iconGap: 8,                      // Gap between icon and text
  },

  // === LIBRARY LIST ===
  libraryList: {
    gap: 5,                          // Gap between library cards
    marginTop: 50,                    // Space above library list

  },

  // === LIBRARY LIST CARD ===
  libraryCard: {
    height: 100,                      // Card height
    borderRadius: 5,                 // Corner radius
    paddingHorizontal: 8,            // Left/right padding inside card
    paddingVertical: 8,              // Top/bottom padding inside card
  },

  // === LIBRARY CARD COVER ===
  libraryCover: {
    size: 64,                        // Cover thumbnail size (square)
    borderRadius: 5,                 // Cover corner radius
    marginRight: 20,                 // Space between cover and text
  },

  // === LIBRARY CARD CONTENT ===
  libraryContent: {
    titleFontSize: 16,               // Title font size
    titleLineHeight: 20,             // Title line height
    titleMarginBottom: 4,            // Space below title
    timeFontSize: 13,                // Time text font size
  },

  // === LIBRARY CARD RIGHT COLUMN ===
  libraryRightColumn: {
    marginLeft: 8,                   // Space before play button
    gap: 4,                          // Gap between play and heart
    playButtonSize: 40,              // Play button diameter
    playIconSize: 24,                // Play icon size
    heartSize: 18,                   // Heart icon size
    heartPadding: 4,                 // Heart button padding
  },

  // === COLORS ===
  colors: {
    accent: '#CCFF00',               // Primary accent color (heart, etc)
    textPrimary: '#FFFFFF',          // Primary text color
    textSecondary: 'rgba(255,255,255,0.6)',  // Secondary text color
    textTertiary: 'rgba(255,255,255,0.5)',   // Tertiary text color
    iconDefault: 'rgba(255,255,255,0.6)',    // Default icon color
    playButtonBg: 'rgba(255,255,255,0.1)',   // Play button background
  },

  // === EMPTY STATE ===
  emptyState: {
    titleFontSize: 24,
    subtitleFontSize: 16,
    subtitlePaddingHorizontal: 40,
  },

  // === LOADING STATE ===
  loading: {
    indicatorSize: 'large' as const,
    indicatorColor: '#CCFF00',
  },
};

// Export config for use in child components
export { CONFIG as HOME_CONFIG };

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { loadBook } = usePlayerStore();
  const { items: continueListeningItems, isLoading } = useContinueListening();

  const handleBookSelect = useCallback(async (book: LibraryItem) => {
    try {
      await loadBook(book, { autoPlay: false });
    } catch (e) {
      console.warn('Failed to load book:', e);
    }
  }, [loadBook]);

  const handlePlayBook = useCallback(async (book: LibraryItem) => {
    try {
      await loadBook(book, { autoPlay: true });
    } catch (e) {
      console.warn('Failed to play book:', e);
    }
  }, [loadBook]);

  const handleViewSeries = useCallback((book: LibraryItem) => {
    const series = book.media?.metadata?.series?.[0];
    const seriesId = typeof series === 'object' ? series?.id : undefined;
    const seriesName = typeof series === 'string' ? series : series?.name;
    
    if (seriesId) {
      navigation.navigate('SeriesDetail', { id: seriesId, name: seriesName });
    }
  }, [navigation]);

  const handleRestart = useCallback(async (book: LibraryItem) => {
    try {
      await loadBook(book, { startPosition: 0, autoPlay: true });
    } catch (e) {
      console.warn('Failed to restart book:', e);
    }
  }, [loadBook]);

  const handleDownload = useCallback((book: LibraryItem) => {
    console.log('Download:', book.id);
  }, []);

  const handleHeart = useCallback((book: LibraryItem) => {
    console.log('Heart:', book.id);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" backgroundColor={CONFIG.screen.backgroundColor} />
        <ActivityIndicator 
          size={CONFIG.loading.indicatorSize} 
          color={CONFIG.loading.indicatorColor} 
        />
      </View>
    );
  }

  // Empty state
  if (continueListeningItems.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" backgroundColor={CONFIG.screen.backgroundColor} />
        <Text style={styles.emptyTitle}>No Books Yet</Text>
        <Text style={styles.emptySubtitle}>
          Start listening to see your books here
        </Text>
      </View>
    );
  }

  // First book is the main card
  const mainBook = continueListeningItems[0];
  // Rest are library list
  const libraryBooks = continueListeningItems.slice(1);
  
  // Check if main book has series
  const mainSeries = mainBook.media?.metadata?.series?.[0];
  const hasMainSeries = typeof mainSeries === 'object' ? !!mainSeries?.id : false;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CONFIG.screen.backgroundColor} />
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: insets.top + CONFIG.screen.topPadding, 
            paddingBottom: insets.bottom + CONFIG.screen.bottomPadding,
            paddingHorizontal: CONFIG.screen.horizontalPadding,
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card Container */}
        <View style={[
          styles.mainCardContainer, 
          { 
            marginTop: CONFIG.mainCard.marginTop,
            marginBottom: CONFIG.mainCard.marginBottom,
          }
        ]}>
          <HomeCard
            book={mainBook}
            onPress={() => handleBookSelect(mainBook)}
            onDownload={() => handleDownload(mainBook)}
            onHeart={() => handleHeart(mainBook)}
            config={CONFIG}
          />
        </View>
        
        {/* Actions Container */}
        <View style={[
          styles.actionsContainer, 
          { marginBottom: CONFIG.actions.marginBottom }
        ]}>
          <CardActions
            showViewSeries={hasMainSeries}
            onViewSeries={() => handleViewSeries(mainBook)}
            onRestart={() => handleRestart(mainBook)}
            config={CONFIG}
          />
        </View>

        {/* Library List Container */}
        {libraryBooks.length > 0 && (
          <View style={[
            styles.libraryContainer, 
            { 
              gap: CONFIG.libraryList.gap,
              marginTop: CONFIG.libraryList.marginTop,
            }
          ]}>
            {libraryBooks.map((book) => (
              <View key={book.id} style={styles.libraryItemWrapper}>
                <LibraryListCard
                  book={book}
                  onPress={() => handleBookSelect(book)}
                  onPlay={() => handlePlayBook(book)}
                  onHeart={() => handleHeart(book)}
                  config={CONFIG}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.screen.backgroundColor,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    alignItems: 'center',
  },
  mainCardContainer: {
    alignItems: 'center',
    width: '100%',
  },
  actionsContainer: {
    alignItems: 'center',
    width: '100%',
  },
  libraryContainer: {
    width: '100%',
  },
  libraryItemWrapper: {
    width: '100%',
  },
  emptyTitle: {
    fontSize: CONFIG.emptyState.titleFontSize,
    fontWeight: '700',
    color: CONFIG.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: CONFIG.emptyState.subtitleFontSize,
    color: CONFIG.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: CONFIG.emptyState.subtitlePaddingHorizontal,
  },
});

export default HomeScreen;