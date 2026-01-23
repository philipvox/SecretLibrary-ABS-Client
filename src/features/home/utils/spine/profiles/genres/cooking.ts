/**
 * Cooking genre profile
 * Warm inviting type for culinary books
 */

import { GenreProfile } from '../types';

export const COOKING: GenreProfile = {
  id: 'cooking',
  name: 'Cooking',
  description: 'Warm inviting type for culinary books',

  title: {
    orientation: 'vertical-up',
    fontSize: 44,
    weight: '600',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['PlayfairDisplay-Bold', 'Lora-Bold', 'LibreBaskerville-Bold'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 68,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 34, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 54, paddingHorizontal: 5, paddingVertical: 10 },
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
    heightPercent: 18,
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
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold', 'regular'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up', 'match-title'],
    authorTreatments: ['plain', 'prefixed'],
    authorScales: ['small', 'balanced'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['top-line', 'bottom-line', 'none'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['cooking', 'food', 'culinary', 'recipes'],
  preferredFor: ['cooking', 'food'],
};
