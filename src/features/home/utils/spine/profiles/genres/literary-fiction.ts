/**
 * Literary Fiction genre profile
 * Elegant serif with refined typography
 */

import { GenreProfile } from '../types';

export const LITERARY_FICTION: GenreProfile = {
  id: 'literary-fiction',
  name: 'Literary Fiction',
  description: 'Elegant serif with refined typography',

  title: {
    orientation: 'stacked-words',
    fontSize: 40,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'Lora-Regular', 'NotoSerif-Regular', 'LibreBaskerville-Regular'],
    case: 'capitalize',
    letterSpacing: 0.05,
    placement: 'center',
    heightPercent: 75,
    align: 'center',
    paddingHorizontal: 5,
    paddingVertical: 5,
    sizes: {
      small: {
        orientation: 'vertical-up',
        fontSize: 32,
        paddingHorizontal: 3,
        paddingVertical: 3,
      },
      medium: {},
      large: {
        fontSize: 48,
        paddingHorizontal: 8,
        paddingVertical: 8,
      },
    },
  },

  author: {
    orientation: 'vertical-two-row',
    fontSize: 18,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    case: 'capitalize',
    placement: 'bottom',
    heightPercent: 20,
    treatment: 'plain',
    align: 'center',
    lineHeight: 15,
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: {
        orientation: 'vertical-up',
        fontSize: 14,
        paddingHorizontal: 3,
        paddingVertical: 3,
      },
      medium: {},
      large: {
        fontSize: 20,
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
    },
  },

  decoration: {
    element: 'none',
    lineStyle: 'none',
  },

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

  usedFor: ['literary-fiction', 'contemporary-fiction', 'classics'],
  preferredFor: ['literary-fiction'],
};
