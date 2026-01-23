/**
 * Thriller genre profile
 * Bold intense type for page-turners
 */

import { GenreProfile } from '../types';

export const THRILLER: GenreProfile = {
  id: 'thriller',
  name: 'Thriller',
  description: 'Bold intense type for page-turners',

  title: {
    orientation: 'vertical-up',
    fontSize: 56,
    weight: '900',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['GravitasOne-Regular', 'AlfaSlabOne-Regular', 'Oswald-Bold'],
    case: 'uppercase',
    letterSpacing: 0.06,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: {
        fontSize: 44,
        paddingHorizontal: 3,
        paddingVertical: 5,
      },
      medium: {
        fontSize: 56,
      },
      large: {
        fontSize: 66,
        paddingHorizontal: 5,
        paddingVertical: 10,
      },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '700',
    fontFamily: 'Oswald-Regular',
    fontFamilies: ['Oswald-Regular', 'BebasNeue-Regular'],
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 16,
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

  decoration: {
    element: 'none',
    lineStyle: 'none',
  },

  options: {
    titleOrientations: ['horizontal', 'stacked-letters', 'vertical-down'],
    titleScales: ['shout', 'statement', 'balanced'],
    titleWeights: ['black', 'bold'],
    titleCases: ['uppercase'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'boxed'],
    authorScales: ['tiny', 'whisper', 'small'],
    densities: ['asymmetric', 'dense'],
    alignments: ['bottom-heavy', 'top-heavy', 'scattered'],
    lineStyles: ['thick', 'medium'],
    decorativeElements: ['partial-border', 'side-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['thriller', 'suspense', 'action', 'crime'],
  preferredFor: ['thriller', 'suspense'],
};
