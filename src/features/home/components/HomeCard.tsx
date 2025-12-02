/**
 * src/features/home/components/HomeCard.tsx
 * 
 * Main home card showing current/recent book
 * - Cover image at top
 * - Title, chapter, download and heart icons
 * - View Series and Restart buttons are OUTSIDE (rendered by parent)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { getTitle } from '@/shared/utils/metadata';
import { GlassPanel } from './GlassPanel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default config (used if no config prop passed)
const DEFAULT_CONFIG = {
  mainCard: {
    width: Math.min(339, SCREEN_WIDTH - 32),
    height: 480,
    borderRadius: 8,
  },
  cover: {
    height: 340,
    margin: 8,
    borderRadius: 8,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    titleFontSize: 26,
    titleLineHeight: 30,
    titleMarginBottom: 4,
    chapterFontSize: 14,
    iconSize: 24,
    iconGap: 8,
  },
  colors: {
    accent: '#CCFF00',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    iconDefault: 'rgba(255,255,255,0.6)',
  },
};

interface HomeCardProps {
  book: LibraryItem & {
    userMediaProgress?: {
      progress?: number;
      currentTime?: number;
      duration?: number;
    };
  };
  onPress: () => void;
  onDownload?: () => void;
  onHeart?: () => void;
  config?: typeof DEFAULT_CONFIG;
}

// Icons
function DownloadIcon({ size = 24, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 16L12 4M12 16L8 12M12 16L16 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 20H20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function HeartIcon({ size = 24, color = 'white', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
        stroke={color}
        strokeWidth={2}
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

export function HomeCard({ book, onPress, onDownload, onHeart, config = DEFAULT_CONFIG }: HomeCardProps) {
  const c = config;
  
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book) || 'Unknown Title';

  // Calculate chapter number from progress
  const currentTime = book.userMediaProgress?.currentTime ?? 0;
  const chapters = book.media?.chapters ?? [];
  let chapterNumber = 1;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const nextCh = chapters[i + 1];
    if (currentTime >= ch.start && (!nextCh || currentTime < nextCh.start)) {
      chapterNumber = i + 1;
      break;
    }
  }

  return (
    <Pressable onPress={onPress}>
      <View style={[
        styles.card, 
        { 
          width: c.mainCard.width, 
          height: c.mainCard.height,
          borderRadius: c.mainCard.borderRadius,
        }
      ]}>
        {/* SVG Glass Background */}
        <GlassPanel 
          width={c.mainCard.width} 
          height={c.mainCard.height} 
          borderRadius={c.mainCard.borderRadius} 
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Book cover */}
          <View style={[
            styles.coverContainer,
            {
              margin: c.cover.margin,
              height: c.cover.height,
              borderRadius: c.cover.borderRadius,
            }
          ]}>
            <Image
              source={coverUrl}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
            {/* Cover inner shadow at bottom */}
            <LinearGradient
              colors={['transparent', 'transparent', 'rgba(0,0,0,0.6)']}
              locations={[0, 0.6, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Cover border */}
            <View style={[
              styles.coverBorder, 
              { borderRadius: c.cover.borderRadius }
            ]} pointerEvents="none" />
          </View>

          {/* Card info */}
          <View style={[
            styles.cardInfo,
            {
              paddingHorizontal: c.cardContent.paddingHorizontal,
              paddingVertical: c.cardContent.paddingVertical,
            }
          ]}>
            {/* Title row */}
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <Text 
                  style={[
                    styles.cardTitle,
                    {
                      fontSize: c.cardContent.titleFontSize,
                      lineHeight: c.cardContent.titleLineHeight,
                      marginBottom: c.cardContent.titleMarginBottom,
                      color: c.colors.textPrimary,
                    }
                  ]} 
                  numberOfLines={2}
                >
                  {title}
                </Text>
                <Text style={[
                  styles.chapterText,
                  {
                    fontSize: c.cardContent.chapterFontSize,
                    color: c.colors.textSecondary,
                  }
                ]}>
                  Chapter {chapterNumber}
                </Text>
              </View>
              
              {/* Icons column */}
              <View style={[styles.iconsColumn, { gap: c.cardContent.iconGap }]}>
                <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
                  <DownloadIcon size={c.cardContent.iconSize} color={c.colors.iconDefault} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onHeart} style={styles.iconButton}>
                  <HeartIcon size={c.cardContent.iconSize} color={c.colors.accent} filled={true} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
  coverContainer: {
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontWeight: '700',
  },
  chapterText: {},
  iconsColumn: {
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
  },
});

export default HomeCard;