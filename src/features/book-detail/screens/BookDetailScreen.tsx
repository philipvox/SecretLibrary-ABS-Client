import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useBookDetails } from '../hooks/useBookDetails';
import { OverviewTab } from '../components/OverviewTab';
import { ChaptersTab } from '../components/ChaptersTab';
import { LoadingSpinner, ErrorView } from '@/shared/components';
import { Icon } from '@/shared/components/Icon';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { theme } from '@/shared/theme';

type BookDetailRouteParams = {
  BookDetail: { bookId: string };
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const COVER_WIDTH = SCREEN_WIDTH * 0.38;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

type TabType = 'overview' | 'chapters' | 'details';

export function BookDetailScreen() {
  const route = useRoute<RouteProp<BookDetailRouteParams, 'BookDetail'>>();
  const navigation = useNavigation();
  const { bookId } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  const { book, isLoading, error, refetch } = useBookDetails(bookId);
  const { loadBook } = usePlayerStore();

  if (isLoading) {
    return <LoadingSpinner text="Loading book details..." />;
  }

  if (error || !book) {
    return <ErrorView message="Failed to load book details" onRetry={refetch} />;
  }

  const metadata = book.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata.narrators?.[0] || null;
  const genres = metadata.genres || [];
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const chapters = book.media.chapters || [];
  const currentPosition = book.userMediaProgress?.currentTime || 0;
  const duration = book.media.duration || 0;
  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0 && progress < 1;

  const handlePlay = async () => {
    try {
      await loadBook(book);
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const playButtonText = hasProgress ? 'Continue' : 'Play Now';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={theme.colors.text.primary} set="ionicons" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Details</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="heart-outline" size={22} color={theme.colors.primary[500]} set="ionicons" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Top Section - Cover + Info */}
        <View style={styles.topSection}>
          {/* Cover with Play Overlay */}
          <TouchableOpacity style={styles.coverContainer} onPress={handlePlay} activeOpacity={0.9}>
            <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Icon name="play" size={24} color={theme.colors.primary[500]} set="ionicons" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Info Side */}
          <View style={styles.infoSide}>
            <Text style={styles.title} numberOfLines={3}>{title}</Text>
            <Text style={styles.authorLabel}>
              Author: <Text style={styles.authorName}>{author}</Text>
            </Text>
            {narrator && (
              <Text style={styles.narratorLabel}>
                Narrator: <Text style={styles.narratorName}>{narrator}</Text>
              </Text>
            )}

            {/* Tags */}
            {genres.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsLabel}>Tags</Text>
                <View style={styles.tagsRow}>
                  {genres.slice(0, 2).map((genre, idx) => (
                    <View key={idx} style={styles.tag}>
                      <Text style={styles.tagText}>#{genre.toLowerCase()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Chapters</Text>
            <Text style={styles.statValue}>{chapters.length}</Text>
          </View>
          <TouchableOpacity style={styles.playNowButton} onPress={handlePlay} activeOpacity={0.8}>
            <Text style={styles.playNowText}>{playButtonText}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'chapters' && styles.activeTab]}
            onPress={() => setActiveTab('chapters')}
          >
            <Text style={[styles.tabText, activeTab === 'chapters' && styles.activeTabText]}>
              Chapters ({chapters.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'details' && styles.activeTab]}
            onPress={() => setActiveTab('details')}
          >
            <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>Details</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && <OverviewTab book={book} />}
          {activeTab === 'chapters' && <ChaptersTab chapters={chapters} currentPosition={currentPosition} />}
          {activeTab === 'details' && <OverviewTab book={book} showFullDetails />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  topSection: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[4],
  },
  coverContainer: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    ...theme.elevation.medium,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
    ...theme.elevation.small,
  },
  infoSide: {
    flex: 1,
    marginLeft: theme.spacing[4],
    paddingTop: theme.spacing[1],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
    lineHeight: 24,
  },
  authorLabel: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[1],
  },
  authorName: {
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  narratorLabel: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[3],
  },
  narratorName: {
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  tagsSection: {
    marginTop: 'auto',
  },
  tagsLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[2],
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[2],
  },
  tag: {
    backgroundColor: theme.colors.neutral[100],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1] + 2,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.secondary,
  },
  statItem: {
    marginRight: theme.spacing[6],
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[1],
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  playNowButton: {
    marginLeft: 'auto',
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radius.medium,
  },
  playNowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  tab: {
    paddingVertical: theme.spacing[3],
    marginRight: theme.spacing[6],
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary[500],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.tertiary,
  },
  activeTabText: {
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  tabContent: {
    paddingBottom: theme.spacing[24],
  },
});