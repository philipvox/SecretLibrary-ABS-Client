/**
 * src/features/browse/screens/BrowseScreen.tsx
 *
 * Discover page using app design system.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner } from '@/shared/components';
import { COLORS, DIMENSIONS, LAYOUT } from '@/features/home/homeDesign';
import {
  useDiscoverData,
  HeroSection,
  QuickFilterChips,
  ContentRowCarousel,
  CategoryGrid,
  GENRE_CHIPS,
} from '@/features/discover';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Selected genre filter
  const [selectedGenre, setSelectedGenre] = useState('All');

  // Discover data
  const {
    rows,
    hero,
    availableGenres,
    isLoading,
    isRefreshing,
    refresh,
  } = useDiscoverData(selectedGenre);

  // Navigation handlers
  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleGenreSelect = useCallback((genre: string) => {
    setSelectedGenre(genre);
  }, []);

  // Loading state
  if (isLoading && rows.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <LoadingSpinner text="Loading library..." />
      </View>
    );
  }

  // Empty state
  const hasContent = hero || rows.length > 0;

  // Get cached cover URL for hero background
  const heroCoverUrl = useCoverUrl(hero?.book.id || '');
  const showHeroBackground = hero && selectedGenre === 'All';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full-screen Hero Background - extends behind header and pills */}
      {showHeroBackground && (
        <View style={styles.heroBackground}>
          <Image
            source={heroCoverUrl || hero.book.coverUrl}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={60}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + scale(10) }]}>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleSearchPress}>
          <Icon name="search" size={scale(20)} color="#FFF" set="ionicons" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={COLORS.playButton}
          />
        }
      >
        {/* Quick Filter Chips */}
        <QuickFilterChips
          chips={availableGenres.length > 0 ? availableGenres : GENRE_CHIPS}
          selectedChip={selectedGenre}
          onSelect={handleGenreSelect}
        />

        {/* Hero Recommendation Content */}
        {showHeroBackground && (
          <HeroSection hero={hero} />
        )}

        {/* Content Rows */}
        {rows.map((row) => (
          <ContentRowCarousel key={row.id} row={row} />
        ))}

        {/* Browse by Category */}
        {selectedGenre === 'All' && (
          <CategoryGrid />
        )}

        {/* Empty State */}
        {!hasContent && (
          <View style={styles.emptyState}>
            <Icon name="library-outline" size={scale(48)} color="rgba(255,255,255,0.3)" set="ionicons" />
            <Text style={styles.emptyTitle}>Your library is waiting</Text>
            <Text style={styles.emptySubtitle}>
              Add audiobooks to your server to start discovering.
            </Text>
          </View>
        )}

        {/* No Results for Filter */}
        {hasContent && rows.length === 0 && selectedGenre !== 'All' && (
          <View style={styles.emptyState}>
            <Icon name="search-outline" size={scale(48)} color="rgba(255,255,255,0.3)" set="ionicons" />
            <Text style={styles.emptyTitle}>No books match "{selectedGenre}"</Text>
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setSelectedGenre('All')}
            >
              <Text style={styles.clearFilterText}>Show All</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scale(350),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: scale(8),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
    paddingBottom: scale(12),
    zIndex: 1,
  },
  headerTitle: {
    fontSize: scale(28),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: COLORS.controlButtonBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: scale(60),
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    marginTop: scale(16),
    fontSize: scale(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: scale(8),
    fontSize: scale(13),
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: scale(18),
  },
  clearFilterButton: {
    marginTop: scale(20),
    backgroundColor: COLORS.playButton,
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    borderRadius: scale(20),
  },
  clearFilterText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000',
  },
});
