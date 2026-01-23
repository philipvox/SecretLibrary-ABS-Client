/**
 * Classics genre profile
 * Timeless elegance for literary classics
 */

import { GenreProfile } from '../types';

export const CLASSICS: GenreProfile = {
  id: 'classics',
  name: 'Classics',
  description: 'Timeless elegance for literary classics',

  title: {
    orientation: 'vertical-up',
    fontSize: 44,
    weight: '400',
    fontFamily: 'LibreBaskerville-Regular',
    fontFamilies: ['LibreBaskerville-Regular', 'NotoSerif-Regular', 'PlayfairDisplay-Regular'],
    case: 'capitalize',
    letterSpacing: 0.05,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 34, letterSpacing: 0.04, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 52, letterSpacing: 0.06, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '400',
    fontFamily: 'LibreBaskerville-Regular',
    fontFamilies: ['LibreBaskerville-Regular', 'NotoSerif-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 18,
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

  usedFor: ['classics', 'classic-literature', 'victorian', 'literary-classics'],
  preferredFor: ['classics'],
};
