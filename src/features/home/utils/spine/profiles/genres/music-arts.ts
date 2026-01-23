/**
 * Music & Arts genre profile
 * 1920s art deco for creative works
 */

import { GenreProfile } from '../types';

export const MUSIC_ARTS: GenreProfile = {
  id: 'music-arts',
  name: 'Music & Arts',
  description: '1920s art deco for creative works',

  title: {
    orientation: 'vertical-up',
    fontSize: 52,
    weight: '400',
    fontFamily: 'Federo-Regular',
    fontFamilies: ['Federo-Regular', 'GravitasOne-Regular', 'PlayfairDisplay-Bold'],
    case: 'uppercase',
    letterSpacing: 0.08,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 40, letterSpacing: 0.06, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 62, letterSpacing: 0.10, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '600',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['PlayfairDisplay-Bold', 'Lora-Bold'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 17,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 11, paddingHorizontal: 4, paddingVertical: 4 },
      medium: {},
      large: { fontSize: 16, paddingHorizontal: 10, paddingVertical: 8 },
    },
  },

  decoration: { element: 'none', lineStyle: 'none' },

  options: {
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'whisper', 'statement', 'balanced'],
    titleWeights: ['light', 'regular', 'medium'],
    titleCases: ['capitalize', 'lowercase', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'prefixed', 'underlined'],
    authorScales: ['small', 'balanced', 'tiny'],
    densities: ['minimal', 'balanced'],
    alignments: ['centered', 'top-heavy', 'bottom-heavy'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['none', 'divider-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: true,
  },

  usedFor: ['music', 'art', 'design', '1920s', 'jazz'],
  preferredFor: ['music', 'art'],
};
