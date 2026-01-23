/**
 * Philosophy genre profile
 * Timeless uncial for philosophical works
 */

import { GenreProfile } from '../types';

export const PHILOSOPHY: GenreProfile = {
  id: 'philosophy',
  name: 'Philosophy',
  description: 'Timeless uncial for philosophical works',

  title: {
    orientation: 'vertical-up',
    fontSize: 40,
    weight: '400',
    fontFamily: 'UncialAntiqua-Regular',
    fontFamilies: ['UncialAntiqua-Regular', 'NotoSerif-Regular', 'LibreBaskerville-Regular'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 66,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 30, letterSpacing: 0.03, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 48, letterSpacing: 0.05, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '400',
    fontFamily: 'Lora-Regular',
    fontFamilies: ['Lora-Regular', 'PlayfairDisplay-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 20,
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
    titleScales: ['whisper', 'normal'],
    titleWeights: ['light', 'regular'],
    titleCases: ['lowercase', 'capitalize'],
    authorOrientations: ['match-title', 'horizontal'],
    authorTreatments: ['plain', 'prefixed'],
    authorScales: ['balanced', 'small'],
    densities: ['minimal'],
    alignments: ['centered', 'scattered'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['none', 'divider-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: true,
  },

  usedFor: ['philosophy', 'religion', 'spirituality', 'essays'],
  preferredFor: ['philosophy', 'religion'],
};
