/**
 * src/features/home/screens/HomeScreen.tsx
 * 
 * Home screen with:
 * - Auto-download of top 3 continue listening books
 * - Stacked continue listening cards
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { theme } from '@/shared/theme';
import { useContinueListening } from '../hooks/useContinueListening';
import { ContinueListeningCard, CARD_HEIGHT, CARD_OVERLAP, CARD_MARGIN_BOTTOM } from '../components/ContinueListeningCard';
import { Icon } from '@/shared/components/Icon';
import { autoDownloadService } from '@/features/downloads';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_BG = '#303030';
const GAP = 5;
const CARD_WIDTH_RATIO = 0.5;
const ACTION_CARD_WIDTH = (SCREEN_WIDTH - 10) * CARD_WIDTH_RATIO; // 2.5 margin each side + 5 gap
const ACTION_CARD_HEIGHT = ACTION_CARD_WIDTH;
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
  const queryClient = useQueryClient();
  const { items: continueListeningItems, isLoading: isLoadingContinue, refetch } = useContinueListening();
  const { 
    currentBook, 
    isPlaying, 
    loadBook, 
    play, 
    pause,
  } = usePlayerStore();

  // Track last synced items to avoid redundant syncs
  const lastSyncedRef = useRef<string>('');
  
  // Track locally hidden items for immediate UI feedback
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Handle removing a book from continue listening
  const handleRemoveFromContinue = useCallback((bookId: string) => {
    // Immediately hide locally
    setHiddenIds(prev => new Set(prev).add(bookId));
    
    // Clear sync ref to force re-sync when new data arrives
    lastSyncedRef.current = '';
    
    // Refetch from server
    refetch();
  }, [refetch]);
  
  // Filter out hidden items
  const visibleItems = continueListeningItems.filter(item => !hiddenIds.has(item.id));

  // Auto-download disabled - manual download buttons used instead
  // useEffect(() => {
  //   if (!visibleItems.length) return;
  //   const itemsKey = visibleItems.slice(0, MAX_CARDS).map(i => i.id).join(',');
  //   if (itemsKey === lastSyncedRef.current) return;
  //   lastSyncedRef.current = itemsKey;
  //   console.log('[HomeScreen] Syncing auto-downloads:', itemsKey);
  //   autoDownloadService.syncWithContinueListening(visibleItems).catch(e => {
  //     console.warn('[HomeScreen] Auto-download sync failed:', e);
  //   });
  // }, [visibleItems]);

  const visibleCards = visibleItems.slice(0, MAX_CARDS);

  const fullStackHeight = visibleCards.length > 0 
    ? CARD_HEIGHT + (visibleCards.length - 1) * (CARD_HEIGHT + CARD_OVERLAP)
    : 0;

  const reversedCards = [...visibleCards].reverse();
  const lastBook = visibleItems[0];

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
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: 100 + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Continue Listening Card Stack */}
        {isLoadingContinue ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary[500]} />
          </View>
        ) : visibleCards.length > 0 ? (
          <View style={[styles.cardStack, { height: fullStackHeight, marginBottom: CARD_MARGIN_BOTTOM }]}>
            {reversedCards.map((book, reverseIndex) => {
              const zIndex = MAX_CARDS - reverseIndex;
              return (
                <ContinueListeningCard 
                  key={book.id} 
                  book={book}
                  zIndex={zIndex}
                  onRemove={handleRemoveFromContinue}
                  onPress={() => navigation.navigate('BookDetail', { id: book.id })}
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
                size={48} 
                color="#FFFFFF" 
                set="ionicons"
              />
            </View>
          </Pressable>
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
    paddingHorizontal: 0,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2.5,
  },
  cardStack: {
    position: 'relative',
  },
  emptyStack: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: CARD_MARGIN_BOTTOM,
    marginHorizontal: 2.5,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: GAP,
    marginHorizontal: 2.5,
  },
  justForYouCard: {
    backgroundColor: '#CCFF00',
    borderRadius: 5,
    padding: 16,
    justifyContent: 'space-between',
  },
  justForYouTitle: {
    fontSize: 28,
    fontWeight: '800',
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
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  playCardDisabled: {
    opacity: 0.5,
  },
  playCardCover: {
    ...StyleSheet.absoluteFillObject,
  },
  playCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});