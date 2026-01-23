/**
 * Art & Design genre profile
 * 1920s art deco elegance
 */

import { GenreProfile } from '../types';

export const ART_DESIGN: GenreProfile = {
  id: 'art-design',
  name: 'Art & Design',
  description: '1920s art deco elegance',

  title: {
    orientation: 'stacked-words',
    fontSize: 50,
    weight: '400',
    fontFamily: 'Federo-Regular',
    fontFamilies: ['Federo-Regular', 'GravitasOne-Regular', 'PlayfairDisplay-Bold'],
    case: 'uppercase',
    letterSpacing: 0.15,
    placement: 'center',
    align: 'center',
    heightPercent: 75,
    paddingHorizontal: 8,
    paddingVertical: 1,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 38, paddingHorizontal: 4, paddingVertical: 4 },
      medium: { fontSize: 45 },
      large: { fontSize: 56, paddingHorizontal: 10, paddingVertical: 2 },
    },
  },

  author: {
    orientation: 'stacked-words',
    fontSize: 14,
    weight: '600',
    fontFamily: 'Federo-Regular',
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 18,
    treatment: 'plain',
    paddingHorizontal: 1,
    paddingVertical: 6,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 11, paddingHorizontal: 3, paddingVertical: 4 },
      medium: {},
      large: { fontSize: 16, paddingHorizontal: 2, paddingVertical: 8 },
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

  usedFor: ['art', 'design', 'architecture', '1920s', 'jazz'],
  preferredFor: ['art', '1920s'],
};
