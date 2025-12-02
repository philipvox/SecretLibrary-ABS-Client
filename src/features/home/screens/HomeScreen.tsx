/**
 * src/features/home/screens/HomeScreen.tsx
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { HomeCard } from '../components/HomeCard';
import { CardActions } from '../components/CardActions';
import { LibraryListCard } from '../components/LibraryListCard';
import { useContinueListening } from '../hooks/useContinueListening';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CONFIG = {
  screen: {
    backgroundColor: '#000',
    horizontalPadding: 16,
    topPadding: 8,
    bottomPadding: 160,
  },
  mainCard: {
    width: SCREEN_WIDTH - 32,
  },
  actions: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 14,
    iconSize: 16,
    iconGap: 6,
  },
  libraryList: {
    gap: 6,
    marginTop: 20,
    headerFontSize: 13,
    headerMarginBottom: 10,
  },
  libraryCard: {
    height: 88,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  libraryCover: {
    size: 68,
    borderRadius: 6,
    marginRight: 14,
  },
  libraryContent: {
    titleFontSize: 16,
    titleLineHeight: 20,
    titleMarginBottom: 4,
    timeFontSize: 13,
  },
  libraryRightColumn: {
    marginLeft: 8,
    gap: 6,
    playButtonSize: 36,
    playIconSize: 18,
    heartSize: 16,
    heartPadding: 4,
  },
  colors: {
    accent: '#CCFF00',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    textTertiary: 'rgba(255,255,255,0.4)',
    iconDefault: 'rgba(255,255,255,0.5)',
    playButtonBg: 'rgba(255,255,255,0.1)',
  },
  emptyState: {
    titleFontSize: 24,
    subtitleFontSize: 16,
    subtitlePaddingHorizontal: 40,
  },
  loading: {
    indicatorSize: 'large' as const,
    indicatorColor: '#CCFF00',
  },
};

export { CONFIG as HOME_CONFIG };

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { loadBook } = usePlayerStore();
  const { items: continueListeningItems, isLoading } = useContinueListening();

  const handleBookSelect = useCallback(async (book: LibraryItem) => {
    try {
      // Fetch full item data to ensure complete metadata (author, narrator, etc.)
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: false });
    } catch (e) {
      // Fallback to partial data if full fetch fails
      console.warn('Failed to load full book data, using partial:', e);
      await loadBook(book, { autoPlay: false });
    }
  }, [loadBook]);

  const handlePlayBook = useCallback(async (book: LibraryItem) => {
    try {
      // Fetch full item data to ensure complete metadata (author, narrator, etc.)
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true });
    } catch (e) {
      // Fallback to partial data if full fetch fails
      console.warn('Failed to load full book data, using partial:', e);
      await loadBook(book, { autoPlay: true });
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
      // Fetch full item data to ensure complete metadata (author, narrator, etc.)
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { startPosition: 0, autoPlay: true });
    } catch (e) {
      // Fallback to partial data if full fetch fails
      console.warn('Failed to restart book:', e);
      await loadBook(book, { startPosition: 0, autoPlay: true });
    }
  }, [loadBook]);

  const handleDownload = useCallback((book: LibraryItem) => {
    console.log('Download:', book.id);
  }, []);

  const handleHeart = useCallback((book: LibraryItem) => {
    console.log('Heart:', book.id);
  }, []);

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

  const mainBook = continueListeningItems[0];
  const libraryBooks = continueListeningItems.slice(1);
  
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
            paddingBottom: CONFIG.screen.bottomPadding,
            paddingHorizontal: CONFIG.screen.horizontalPadding,
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <HomeCard
          book={mainBook}
          onPress={() => handleBookSelect(mainBook)}
          onDownload={() => handleDownload(mainBook)}
          onHeart={() => handleHeart(mainBook)}
        />
        
        {/* Actions */}
        <CardActions
          showViewSeries={hasMainSeries}
          onViewSeries={() => handleViewSeries(mainBook)}
          onRestart={() => handleRestart(mainBook)}
          config={CONFIG}
        />

        {/* Your Library Section */}
        {libraryBooks.length > 0 && (
          <View style={styles.librarySection}>
            <Text style={styles.libraryHeader}>Your library</Text>
            <View style={styles.libraryContainer}>
              {libraryBooks.map((book) => (
                <LibraryListCard
                  key={book.id}
                  book={book}
                  onPress={() => handleBookSelect(book)}
                  onPlay={() => handlePlayBook(book)}
                  onHeart={() => handleHeart(book)}
                  config={CONFIG}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom gradient fade */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)', '#000']}
        locations={[0, 0.6, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
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
  librarySection: {
    width: '100%',
    marginTop: CONFIG.libraryList.marginTop,
  },
  libraryHeader: {
    fontSize: CONFIG.libraryList.headerFontSize,
    fontWeight: '500',
    color: CONFIG.colors.textTertiary,
    marginBottom: CONFIG.libraryList.headerMarginBottom,
  },
  libraryContainer: {
    width: '100%',
    gap: CONFIG.libraryList.gap,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
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