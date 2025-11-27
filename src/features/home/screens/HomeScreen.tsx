/**
 * src/features/home/screens/HomeScreen.tsx
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/core/auth';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { useAllLibraryItems } from '@/features/search/hooks/useAllLibraryItems';
import { LibraryHeartButton } from '@/features/library';
import { TopNavBar } from '@/navigation/components/TopNavBar';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';
import { useContinueListening } from '../hooks/useContinueListening';
import { ContinueListeningCard } from '../components/ContinueListeningCard';

// Safe import for recommendations
let useRecommendations: any;
let usePreferencesStore: any;
try {
  const recommendations = require('@/features/recommendations');
  useRecommendations = recommendations.useRecommendations;
  usePreferencesStore = recommendations.usePreferencesStore;
} catch {
  useRecommendations = null;
  usePreferencesStore = null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 140;
const CARD_HEIGHT = CARD_WIDTH;

interface SectionHeaderProps {
  title: string;
  onMorePress?: () => void;
}

function SectionHeader({ title, onMorePress }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onMorePress && (
        <TouchableOpacity onPress={onMorePress}>
          <Text style={styles.moreLink}>More</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface BookCardProps {
  book: LibraryItem;
}

function BookCard({ book }: BookCardProps) {
  const navigation = useNavigation<any>();
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);

  return (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => navigation.navigate('BookDetail', { bookId: book.id })}
      activeOpacity={0.7}
    >
      <View style={styles.bookCoverContainer}>
        <Image source={{ uri: coverUrl }} style={styles.bookCover} resizeMode="cover" />
        <View style={styles.heartPosition}>
          <LibraryHeartButton bookId={book.id} size="small" />
        </View>
      </View>
      <Text style={styles.bookTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>{author}</Text>
    </TouchableOpacity>
  );
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { library } = useDefaultLibrary();
  const { items: allItems } = useAllLibraryItems(library?.id || '');
  const { items: continueListeningItems, isLoading: isLoadingContinue } = useContinueListening();
  
  // Safe access to preferences/recommendations
  const hasCompletedOnboarding = usePreferencesStore?.()?.hasCompletedOnboarding ?? false;
  const recommendationsData = useRecommendations?.(allItems, 30) ?? { 
    recommendations: [], 
  };
  const { recommendations } = recommendationsData;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleSetupPreferences = () => {
    navigation.navigate('PreferencesOnboarding');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      <TopNavBar />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.subGreeting}>
            {user?.username ? `Welcome back, ${user.username}` : 'What will you listen to today?'}
          </Text>
        </View>

        {/* Continue Listening */}
        {isLoadingContinue ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary[500]} />
          </View>
        ) : continueListeningItems.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Continue Listening" />
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {continueListeningItems.slice(0, 10).map((book) => (
                <ContinueListeningCard key={book.id} book={book} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recommendations Setup CTA */}
        {!hasCompletedOnboarding && (
          <TouchableOpacity style={styles.setupCard} onPress={handleSetupPreferences}>
            <View style={styles.setupIconContainer}>
              <Icon name="sparkles" size={28} color={theme.colors.primary[500]} set="ionicons" />
            </View>
            <View style={styles.setupInfo}>
              <Text style={styles.setupTitle}>Get personalized recommendations</Text>
              <Text style={styles.setupSubtitle}>Answer a few questions to discover your next favorite book</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={theme.colors.text.tertiary} set="ionicons" />
          </TouchableOpacity>
        )}

        {/* Your Recommendations - horizontal scroll */}
        {hasCompletedOnboarding && recommendations.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Your Recommendations" />
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {recommendations.map((book: LibraryItem) => (
                <BookCard key={book.id} book={book} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Coming Soon placeholder if no content */}
        {!hasCompletedOnboarding && continueListeningItems.length === 0 && (
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonEmoji}>✨</Text>
            <Text style={styles.comingSoonTitle}>Coming soon</Text>
            <Text style={styles.comingSoonSubtitle}>
              Recently added, and more features are on the way
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing[32] + 80,
  },
  greetingContainer: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[5],
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
  },
  subGreeting: {
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  loadingContainer: {
    padding: theme.spacing[6],
    alignItems: 'center',
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary[50],
    marginHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[5],
    padding: theme.spacing[4],
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: theme.colors.primary[100],
  },
  setupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing[3],
  },
  setupInfo: {
    flex: 1,
  },
  setupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  setupSubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  section: {
    marginBottom: theme.spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[3],
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  moreLink: {
    fontSize: 14,
    color: theme.colors.primary[500],
    fontWeight: '500',
  },
  horizontalList: {
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
  },
  bookCard: {
    width: CARD_WIDTH,
  },
  bookCoverContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    marginBottom: theme.spacing[2],
  },
  bookCover: {
    width: '100%',
    height: '100%',
  },
  heartPosition: {
    position: 'absolute',
    bottom: 6,
    right: 6,
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  bookAuthor: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  comingSoonCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    marginHorizontal: theme.spacing[5],
    padding: theme.spacing[6],
    borderRadius: theme.radius.large,
  },
  comingSoonEmoji: {
    fontSize: 32,
    marginBottom: theme.spacing[3],
  },
  comingSoonTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  comingSoonSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});