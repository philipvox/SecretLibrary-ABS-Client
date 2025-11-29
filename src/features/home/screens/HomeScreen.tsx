/**
 * src/features/home/screens/HomeScreen.tsx
 * 
 * Home screen with:
 * - Auto-download of top 3 continue listening books
 * - Properly syncs downloads when list changes
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { theme } from '@/shared/theme';
import { useContinueListening } from '../hooks/useContinueListening';
import { ContinueListeningCard, CARD_HEIGHT, CARD_OVERLAP } from '../components/ContinueListeningCard';
import { Icon } from '@/shared/components/Icon';
// import { autoDownloadService } from '@/features/downloads/services/autoDownloadService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_BG = '#303030';
const GAP = 5;
const CARD_WIDTH_RATIO = 0.5;
const ACTION_CARD_WIDTH = (SCREEN_WIDTH - (GAP * 3)) * CARD_WIDTH_RATIO;
const ACTION_CARD_HEIGHT = ACTION_CARD_WIDTH;
const CARD_RADIUS = 5;
const MAX_CARDS = 3;

function ArrowUpRight({ size = 32, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 89 89" fill="none">
      <Path
        d="M25.9583 63.0416L63.0416 25.9583M63.0416 25.9583H25.9583M63.0416 25.9583V63.0416"
        stroke={color}
        strokeWidth={7.41667}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { items: continueListeningItems, isLoading: isLoadingContinue } = useContinueListening();
  const { 
    currentBook, 
    isPlaying, 
    loadBook, 
    play, 
    pause,
  } = usePlayerStore();

  // Track last synced items to avoid redundant syncs
  const lastSyncedRef = useRef<string>('');

  // Sync auto-downloads when continue listening changes
  useEffect(() => {
    if (!continueListeningItems.length) return;

    // Create key from book IDs
    const itemsKey = continueListeningItems.slice(0, MAX_CARDS).map(i => i.id).join(',');
    
    // Skip if already synced
    if (itemsKey === lastSyncedRef.current) return;
    lastSyncedRef.current = itemsKey;

    // Sync downloads (non-blocking)
    // console.log('[HomeScreen] Syncing auto-downloads...');
    // autoDownloadService.syncWithContinueListening(continueListeningItems).catch(e => {
    //   console.warn('[HomeScreen] Auto-download sync failed:', e);
    // });
  }, [continueListeningItems]);

  const visibleCards = continueListeningItems.slice(0, MAX_CARDS);
  
  const fullStackHeight = visibleCards.length > 0 
    ? CARD_HEIGHT + (visibleCards.length - 1) * (CARD_HEIGHT + CARD_OVERLAP)
    : 0;

  const reversedCards = [...visibleCards].reverse();
  const lastBook = continueListeningItems[0];

  const playCardBook = currentBook || lastBook;
  const playCardCoverUrl = playCardBook ? apiClient.getItemCoverUrl(playCardBook.id) : null;
  const hasCurrentBook = !!currentBook;

  const handlePlayPress = async () => {
    if (currentBook) {
      if (isPlaying) {
        await pause();
      } else {
        await play();
      }
    } else if (lastBook) {
      try {
        const fullBook = await apiClient.getItem(lastBook.id);
        await loadBook(fullBook);
      } catch (err) {
        console.error('Failed to load book:', err);
        try {
          await loadBook(lastBook);
        } catch (e) {
          console.error('Fallback failed:', e);
        }
      }
    }
  };

  const handlePlayLongPress = () => {
    if (currentBook) {
      usePlayerStore.setState({ isPlayerVisible: true });
    }
  };

  const handleJustForYou = () => {
    navigation.navigate('Recommendations');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={HEADER_BG} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: 100 + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Card Stack */}
        {isLoadingContinue ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary[500]} />
          </View>
        ) : visibleCards.length > 0 ? (
          <View style={[styles.cardStack, { height: fullStackHeight }]}>
            {reversedCards.map((book, reverseIndex) => {
              const zIndex = MAX_CARDS - reverseIndex;
              return (
                <ContinueListeningCard 
                  key={book.id} 
                  book={book}
                  zIndex={zIndex}
                  style={{
                    position: 'absolute',
                    top: reverseIndex * (CARD_HEIGHT + CARD_OVERLAP),
                    left: 0,
                    right: 0,
                  }}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyStack}>
            <Text style={styles.emptyEmoji}>🎧</Text>
            <Text style={styles.emptyTitle}>Start listening</Text>
            <Text style={styles.emptySubtitle}>Your audiobooks will appear here</Text>
          </View>
        )}

        {/* Action Cards */}
        <View style={styles.actionOverlay}>
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.justForYouCard, { width: ACTION_CARD_WIDTH, height: ACTION_CARD_HEIGHT }]} 
              onPress={handleJustForYou}
              activeOpacity={0.9}
            >
              <Text style={styles.justForYouTitle}>Just for{'\n'}You</Text>
              <View style={styles.justForYouBottom}>
                <Text style={styles.justForYouSubtitle}>your{'\n'}recommendations</Text>
                <ArrowUpRight size={32} color="#000000" />
              </View>
            </TouchableOpacity>

            <Pressable 
              style={[
                styles.playCard, 
                { width: ACTION_CARD_WIDTH, height: ACTION_CARD_HEIGHT },
                !playCardBook && styles.playCardDisabled
              ]} 
              onPress={handlePlayPress}
              onLongPress={handlePlayLongPress}
              delayLongPress={300}
              disabled={!playCardBook}
            >
              {playCardCoverUrl ? (
                <Image 
                  source={{ uri: playCardCoverUrl }} 
                  style={styles.playCardCover}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.playCardOverlay}>
                <Icon 
                  name={hasCurrentBook && isPlaying ? 'pause' : 'play'} 
                  size={56} 
                  color="#FFFFFF" 
                  set="ionicons" 
                />
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEADER_BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStack: {
    marginBottom: GAP,
    zIndex: 1,
  },
  actionOverlay: {
    zIndex: 10,
    marginTop: 0,
    paddingBottom: 175,
    flex: 1,
  },
  emptyStack: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: GAP,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: GAP,
    gap: GAP,
  },
  justForYouCard: {
    backgroundColor: '#CEFF00',
    borderRadius: CARD_RADIUS,
    padding: 14,
    justifyContent: 'space-between',
  },
  justForYouTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 32,
  },
  justForYouBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  justForYouSubtitle: {
    fontSize: 12,
    color: '#000000',
    opacity: 0.7,
    lineHeight: 16,
  },
  playCard: {
    backgroundColor: '#333333',
    borderRadius: CARD_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playCardCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  playCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCardDisabled: {
    opacity: 0.5,
  },
});