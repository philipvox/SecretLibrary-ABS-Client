/**
 * Romance genre profile
 * Flowing script for romantic tales
 */

import { GenreProfile } from '../types';

export const ROMANCE: GenreProfile = {
  id: 'romance',
  name: 'Romance',
  description: 'Flowing script for romantic tales',

  title: {
    orientation: 'vertical-up',
    fontSize: 42,
    weight: '400',
    fontFamily: 'Charm-Regular',
    fontFamilies: ['Charm-Regular', 'PlayfairDisplay-Regular'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 66,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: {
        fontSize: 32,
        letterSpacing: 0.03,
        paddingHorizontal: 3,
        paddingVertical: 5,
      },
      medium: {},
      large: {
        fontFamily: 'Charm-Regular',
        fontSize: 50,
        letterSpacing: 0.05,
        paddingHorizontal: 5,
        paddingVertical: 10,
      },
    },
  },

  author: {
    orientation: 'stacked-words',
    fontSize: 15,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'Lora-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 20,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: {
        orientation: 'vertical-up',
        fontSize: 12,
        paddingHorizontal: 4,
        paddingVertical: 4,
      },
      medium: {},
      large: {
        orientation: 'stacked-words',
        fontSize: 17,
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
    titleScales: ['normal', 'statement', 'balanced', 'shout'],
    titleWeights: ['light', 'regular', 'medium'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'prefixed', 'underlined'],
    authorScales: ['small', 'balanced', 'tiny'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'double'],
    decorativeElements: ['divider-line', 'top-line', 'bottom-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['romance', 'historical-romance', 'contemporary-romance', 'womens-fiction'],
  preferredFor: ['romance', 'womens-fiction'],
};
