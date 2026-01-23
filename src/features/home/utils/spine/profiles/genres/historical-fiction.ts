/**
 * Historical Fiction genre profile
 * Period-appropriate elegance for historical tales
 */

import { GenreProfile } from '../types';

export const HISTORICAL_FICTION: GenreProfile = {
  id: 'historical-fiction',
  name: 'Historical Fiction',
  description: 'Period-appropriate elegance for historical tales',

  title: {
    orientation: 'vertical-up',
    fontSize: 46,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'NotoSerif-Regular', 'LibreBaskerville-Regular'],
    case: 'capitalize',
    letterSpacing: 0.05,
    placement: 'center',
    align: 'center',
    heightPercent: 75,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 35, letterSpacing: 0.04, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 54, letterSpacing: 0.06, paddingHorizontal: 5, paddingVertical: 10 },
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
    heightPercent: 20,
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
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thin'],
    decorativeElements: ['top-line', 'bottom-line', 'divider-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['historical-fiction', 'history', 'period-drama'],
  preferredFor: ['historical-fiction'],
};
