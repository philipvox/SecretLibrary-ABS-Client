/**
 * Default genre profile
 * Clean versatile type for any genre
 */

import { GenreProfile } from '../types';

export const DEFAULT: GenreProfile = {
  id: 'default',
  name: 'Default',
  description: 'Clean versatile type for any genre',

  title: {
    orientation: 'vertical-up',
    fontSize: 48,
    weight: '600',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'Lora-Bold', 'PlayfairDisplay-Bold'],
    case: 'uppercase',
    letterSpacing: 0.05,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 36, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 58, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '500',
    fontFamily: 'Oswald-Regular',
    fontFamilies: ['Oswald-Regular', 'Lora-Regular'],
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 16,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 10, paddingHorizontal: 4, paddingVertical: 4 },
      medium: {},
      large: { fontSize: 15, paddingHorizontal: 10, paddingVertical: 8 },
    },
  },

  decoration: { element: 'none', lineStyle: 'none' },

  options: {
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['normal', 'statement', 'balanced', 'shout'],
    titleWeights: ['medium', 'bold'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title', 'vertical-up', 'vertical-down', 'oppose-title'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['small', 'tiny', 'whisper'],
    densities: ['balanced'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['divider-line', 'none'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['default', 'unknown', 'uncategorized'],
  preferredFor: ['default'],
};
