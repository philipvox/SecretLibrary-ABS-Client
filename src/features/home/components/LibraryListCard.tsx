/**
 * src/features/home/components/LibraryListCard.tsx
 * 
 * Horizontal card for library list showing:
 * - Cover thumbnail on left
 * - Title, time progress
 * - Play button on right
 * - Heart icon
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { getTitle } from '@/shared/utils/metadata';
import { GlassPanel } from './GlassPanel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default config
const DEFAULT_CONFIG = {
  screen: {
    horizontalPadding: 16,
  },
  libraryCard: {
    height: 80,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  libraryCover: {
    size: 64,
    borderRadius: 6,
    marginRight: 12,
  },
  libraryContent: {
    titleFontSize: 16,
    titleLineHeight: 20,
    titleMarginBottom: 4,
    timeFontSize: 13,
  },
  libraryRightColumn: {
    marginLeft: 8,
    gap: 4,
    playButtonSize: 40,
    playIconSize: 24,
    heartSize: 18,
    heartPadding: 4,
  },
  colors: {
    accent: '#CCFF00',
    textPrimary: '#FFFFFF',
    textTertiary: 'rgba(255,255,255,0.5)',
    playButtonBg: 'rgba(255,255,255,0.1)',
  },
};

interface LibraryListCardProps {
  book: LibraryItem & {
    userMediaProgress?: {
      progress?: number;
      currentTime?: number;
      duration?: number;
    };
  };
  onPress: () => void;
  onPlay?: () => void;
  onHeart?: () => void;
  config?: typeof DEFAULT_CONFIG;
}

// Format seconds to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Icons
function PlayIcon({ size = 24, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 5.14v13.72c0 1.04 1.13 1.69 2.02 1.16l10.18-6.86c.85-.57.85-1.75 0-2.32L10.02 3.98C9.13 3.45 8 4.1 8 5.14z"
        fill={color}
      />
    </Svg>
  );
}

function HeartIcon({ size = 20, color = '#CCFF00', filled = true }: { size?: number; color?: string; filled?: boolean }) {
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

export function LibraryListCard({ 
  book, 
  onPress, 
  onPlay, 
  onHeart,
  config = DEFAULT_CONFIG,
}: LibraryListCardProps) {
  const c = config;
  const CARD_WIDTH = SCREEN_WIDTH - (c.screen.horizontalPadding * 2);
  
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book) || 'Unknown Title';
  
  const currentTime = book.userMediaProgress?.currentTime ?? 0;
  const duration = book.media?.duration ?? book.userMediaProgress?.duration ?? 0;
  
  const timeDisplay = `${formatTime(currentTime)} : ${formatTime(duration)}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[
        styles.card,
        {
          width: CARD_WIDTH,
          height: c.libraryCard.height,
          borderRadius: c.libraryCard.borderRadius,
        }
      ]}>
        {/* SVG Glass Background */}
        <GlassPanel 
          width={CARD_WIDTH} 
          height={c.libraryCard.height} 
          borderRadius={c.libraryCard.borderRadius} 
        />

        {/* Content */}
        <View style={[
          styles.content,
          {
            paddingHorizontal: c.libraryCard.paddingHorizontal,
            paddingVertical: c.libraryCard.paddingVertical,
          }
        ]}>
          {/* Cover thumbnail */}
          <View style={[
            styles.coverContainer,
            {
              width: c.libraryCover.size,
              height: c.libraryCover.size,
              borderRadius: c.libraryCover.borderRadius,
              marginRight: c.libraryCover.marginRight,
            }
          ]}>
            <Image
              source={coverUrl}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
          </View>

          {/* Info section */}
          <View style={styles.infoSection}>
            <Text 
              style={[
                styles.title,
                {
                  fontSize: c.libraryContent.titleFontSize,
                  lineHeight: c.libraryContent.titleLineHeight,
                  marginBottom: c.libraryContent.titleMarginBottom,
                  color: c.colors.textPrimary,
                }
              ]} 
              numberOfLines={2}
            >
              {title}
            </Text>
            <Text style={[
              styles.timeText,
              {
                fontSize: c.libraryContent.timeFontSize,
                color: c.colors.textTertiary,
              }
            ]}>
              {timeDisplay}
            </Text>
          </View>

          {/* Right column: Play and Heart aligned vertically */}
          <View style={[
            styles.rightColumn,
            {
              marginLeft: c.libraryRightColumn.marginLeft,
              gap: c.libraryRightColumn.gap,
            }
          ]}>
            <TouchableOpacity 
              onPress={onPlay} 
              style={[
                styles.playButton,
                {
                  width: c.libraryRightColumn.playButtonSize,
                  height: c.libraryRightColumn.playButtonSize,
                  borderRadius: c.libraryRightColumn.playButtonSize / 2,
                  backgroundColor: c.colors.playButtonBg,
                }
              ]}
            >
              <PlayIcon size={c.libraryRightColumn.playIconSize} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onHeart} 
              style={[styles.heartButton, { padding: c.libraryRightColumn.heartPadding }]}
            >
              <HeartIcon 
                size={c.libraryRightColumn.heartSize} 
                color={c.colors.accent} 
                filled={true} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  coverContainer: {
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
  },
  timeText: {},
  rightColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButton: {},
});

export default LibraryListCard;