/**
 * Biography genre profile
 * Refined serif for life stories
 */

import { GenreProfile } from '../types';

export const BIOGRAPHY: GenreProfile = {
  id: 'biography',
  name: 'Biography',
  description: 'Refined serif for life stories',

  title: {
    orientation: 'vertical-up',
    fontSize: 44,
    weight: '600',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['PlayfairDisplay-Bold', 'NotoSerif-Bold', 'LibreBaskerville-Bold'],
    case: 'capitalize',
    letterSpacing: 0.06,
    placement: 'bottom',
    align: 'center',
    heightPercent: 85,
    paddingHorizontal: 4,
    paddingVertical: 20,
    sizes: {
      small: {
        fontSize: 34,
        letterSpacing: 0.04,
        paddingHorizontal: 3,
        paddingVertical: 5,
      },
      medium: {},
      large: {
        fontSize: 52,
        letterSpacing: 0.08,
        paddingHorizontal: 5,
        paddingVertical: 10,
      },
    },
  },

  author: {
    orientation: 'stacked-words',
    fontSize: 14,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'Lora-Regular'],
    case: 'capitalize',
    placement: 'top',
    align: 'center',
    heightPercent: 15,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: {
        orientation: 'vertical-up',
        fontSize: 11,
        paddingHorizontal: 4,
        paddingVertical: 4,
      },
      medium: {},
      large: {
        fontSize: 16,
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
    },
  },

  decoration: { element: 'none', lineStyle: 'none' },

  options: {
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['regular', 'medium'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'underlined', 'prefixed'],
    authorScales: ['balanced', 'small'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['divider-line', 'none'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['biography', 'autobiography', 'memoir', 'history'],
  preferredFor: ['biography', 'autobiography'],
};
