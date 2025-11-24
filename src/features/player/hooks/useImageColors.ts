import { useState, useEffect } from 'react';
import { getColors } from 'react-native-image-colors';
import { getFallbackColors, getAccentColor, darkenColor, isLightColor } from '../utils/colorUtils';

interface ImageColors {
  background: string;
  accent: string;
  isLight: boolean;
  isLoading: boolean;
}

export function useImageColors(imageUrl: string, bookId: string): ImageColors {
  const [colors, setColors] = useState<ImageColors>(() => {
    const fallback = getFallbackColors(bookId);
    return {
      background: fallback.bg,
      accent: fallback.accent,
      isLight: false,
      isLoading: true,
    };
  });

  useEffect(() => {
    let mounted = true;

    const extractColors = async () => {
      try {
        const result = await getColors(imageUrl, {
          fallback: '#1A1A2E',
          cache: true,
          key: imageUrl,
        });

        if (!mounted) return;

        let dominant: string;
        
        if (result.platform === 'android') {
          dominant = result.dominant || result.average || result.vibrant || '#1A1A2E';
        } else if (result.platform === 'ios') {
          dominant = result.background || result.primary || result.secondary || '#1A1A2E';
        } else {
          // Web fallback
          dominant = (result as any).dominant || (result as any).vibrant || '#1A1A2E';
        }

        // Darken the dominant color for better background
        const background = darkenColor(dominant, 0.4);
        const accent = getAccentColor(dominant);
        const isLight = isLightColor(background);

        setColors({
          background,
          accent,
          isLight,
          isLoading: false,
        });
      } catch (error) {
        console.warn('Failed to extract image colors, using fallback:', error);
        if (!mounted) return;
        
        const fallback = getFallbackColors(bookId);
        setColors({
          background: fallback.bg,
          accent: fallback.accent,
          isLight: false,
          isLoading: false,
        });
      }
    };

    extractColors();

    return () => {
      mounted = false;
    };
  }, [imageUrl, bookId]);

  return colors;
}